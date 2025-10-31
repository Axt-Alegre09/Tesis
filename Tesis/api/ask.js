// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV obligatorias (en Vercel):
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE
 * - OPENAI_API_KEY
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Service Role: SOLO en servidor
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ===================== Utils ===================== */
const toPY = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-PY");
};

const norm = (s = "") =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

// Mapeo de categorías y sinónimos
const CATEGORY_MAP = [
  { key: "empanadas", terms: ["empanada", "empanadas"] },
  { key: "bocaditos", terms: ["bocadito", "bocaditos", "saladitos"] },
  { key: "alfajores", terms: ["alfajor", "alfajores"] },
  { key: "tortas", terms: ["torta", "tortas", "mini torta", "minitorta"] },
  { key: "combos", terms: ["combo", "combos"] },
  { key: "confitería", terms: ["confiteria", "confitería", "dulces"] },
  { key: "panificados", terms: ["pan", "panes", "panificados"] },
  { key: "rostisería", terms: ["rostiseria", "rosticeria", "rostisería", "rosticería"] },
];

function detectCategory(q) {
  const t = norm(q);
  for (const { key, terms } of CATEGORY_MAP) {
    if (terms.some((w) => t.includes(w))) return key;
  }
  return null;
}

// ============ Búsqueda texto libre ============
async function searchProductsByText(q, limit = 6) {
  const term = norm(q);
  if (!term) return [];

  const tokens = term.split(" ").filter(Boolean).slice(0, 3);
  if (!tokens.length) return [];

  // Formato correcto para Supabase SDK
  const orFilter = tokens.map((tk) => `nombre.ilike.%${tk}%`).join(",");

  const { data, error } = await supa
    .from("productos")
    .select("id, nombre, precio, stock, activo")
    .eq("activo", true)
    .or(orFilter)
    .limit(limit);

  if (error) {
    console.warn("searchProductsByText error:", error.message);
    return [];
  }
  return data ?? [];
}

// ============ Búsqueda por categoría ============
async function searchProductsByCategory(cat, limit = 6) {
  if (!cat) return [];
  const { data, error } = await supa
    .from("productos")
    .select("id, nombre, precio, stock, activo")
    .eq("activo", true)
    .ilike("nombre", `%${cat}%`)
    .limit(limit);
  if (error) {
    console.warn("searchProductsByCategory error:", error.message);
    return [];
  }
  return data ?? [];
}

// ============ Formato lista ============
function formatProductList(arr) {
  return arr
    .map(
      (p) =>
        `• **${p.nombre}** — ${toPY(p.precio)} Gs` +
        (Number(p.stock) > 0 ? ` (stock: ${p.stock})` : ` (por encargo)`)
    )
    .join("\n");
}

/* ===================== Handler ===================== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const userMsg = norm(userMsgRaw);

    // ---- 1) Intento directo ----
    let productos = await searchProductsByText(userMsg, 6);

    if (!productos.length) {
      const cat = detectCategory(userMsg);
      if (cat) productos = await searchProductsByCategory(cat, 6);
      if (productos.length) {
        const lista = formatProductList(productos);
        return res.status(200).json({
          reply: `Estas son algunas opciones de **${cat}** que tenemos:\n\n${lista}\n\n¿Querés más detalles o agrego alguna al carrito?`,
        });
      }
    } else {
      const lista = formatProductList(productos);
      return res.status(200).json({
        reply: `Te paso lo más relacionado con lo que pediste:\n\n${lista}\n\n¿Querés ver más opciones similares?`,
      });
    }

    // ---- 2) RAG con kb_search ----
    let contexto = "";
    try {
      const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userMsgRaw || "menu",
      });
      const embedding = emb.data[0].embedding;

      const { data: ctx, error: kbErr } = await supa.rpc("kb_search", {
        query_embedding: embedding,
        match_count: 5,
      });
      if (kbErr) console.warn("kb_search error:", kbErr.message);

      if (ctx?.length) contexto = ctx.map((r) => r.content).join("\n");
    } catch (e) {
      console.warn("RAG falló, continuo sin contexto:", e?.message);
    }

    // ---- 3) LLM (responde natural, tono mozo) ----
    const system = `
Sos *Paniquiños Bot*, un mozo virtual amable y alegre de la confitería Paniquiños (Villa Elisa, Paraguay).
Tu misión es conversar como un humano, cálido y atento 🍰, recomendando productos reales sin inventar nada.
Si no sabés algo, pedí consultar el catálogo. Respondé breve y natural, sin tecnicismos.
Contexto adicional (puede estar vacío):
${contexto || "(sin contexto de KB)"}
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsgRaw || "Hola" },
      ],
    });

    const llmText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "¿Querés que te muestre el menú o las promos de hoy? 🍰";

    const safeHelp =
      llmText +
      `\n\nSi querés, te muestro directamente:\n• Empanadas\n• Bocaditos\n• Alfajores\n• Tortas\n• Combos\nDecime cuál preferís 😄`;

    return res.status(200).json({ reply: safeHelp });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
