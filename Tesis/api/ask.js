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

// Normaliza texto para búsquedas simples
const norm = (s = "") =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

// Sinónimos por categoría base
const CATEGORY_MAP = [
  { key: "empanadas",  terms: ["empanada", "empanadas"] },
  { key: "bocaditos",  terms: ["bocadito", "bocaditos", "saladitos"] },
  { key: "alfajores",  terms: ["alfajor", "alfajores"] },
  { key: "tortas",     terms: ["torta", "tortas", "mini torta", "minitorta"] },
  { key: "combos",     terms: ["combo", "combos"] },
  { key: "confitería", terms: ["confiteria", "confitería", "dulces"] },
  { key: "panificados",terms: ["pan", "panes", "panificados"] },
  { key: "rostisería", terms: ["rostiseria", "rosticeria", "rostisería", "rosticería"] },
];

// Intenta detectar una categoría por palabras clave
function detectCategory(q) {
  const t = norm(q);
  for (const { key, terms } of CATEGORY_MAP) {
    if (terms.some((w) => t.includes(w))) return key;
  }
  return null;
}

// Búsqueda por texto libre en 'nombre'
async function searchProductsByText(q, limit = 6) {
  const term = norm(q);
  if (!term) return [];

  // Construimos un OR con hasta 3 tokens significativos
  const tokens = term.split(" ").filter(Boolean).slice(0, 3);
  const orFilter = tokens.map((tk) => `ilike.nombre.%${tk}%`).join(",");

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

// Búsqueda por “categoría aproximada” (usa coincidencia en nombre)
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

// Formatea lista “• Nombre — 12.345 Gs (stock…)”
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
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsg = norm(body?.messages?.[0]?.content ?? "");

    // -------- 1) Intento directo por texto --------
    let productos = await searchProductsByText(userMsg, 6);

    if (!productos.length) {
      // -------- 1.5) Fallback por categoría aproximada --------
      const cat = detectCategory(userMsg);
      if (cat) productos = await searchProductsByCategory(cat, 6);
      if (productos.length) {
        const lista = formatProductList(productos);
        return res.status(200).json({
          reply: `Estas son algunas opciones de **${cat}** que tenemos:\n\n${lista}\n\n¿Querés más detalles o agrego alguna al carrito?`,
        });
      }
    } else {
      // match directo por texto
      const lista = formatProductList(productos);
      return res
        .status(200)
        .json({ reply: `Te paso lo más relacionado con lo que pediste:\n\n${lista}\n\n¿Querés ver más opciones similares?` });
    }

    // -------- 2) RAG con kb_search (si no hubo productos) --------
    let contexto = "";
    try {
      const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userMsg || "menu",
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

    // -------- 3) LLM con instrucciones bien acotadas --------
    const system = `
Sos "Paniquiños Bot", asistente virtual de la confitería Paniquiños (Villa Elisa, Paraguay).
Objetivo: ayudar a descubrir productos (bocaditos, empanadas, alfajores, tortas y combos) sin inventar nada.
Reglas:
- Tono cálido y breve; emojis suaves 🍰🥟.
- Si piden productos, sugerí categorías cercanas y pedí confirmación.
- NO inventes sabores ni precios. Si falta info, ofrecé consultar o mostrar el catálogo.
- Si preguntan por horarios, sugiere consultar el local/sitio.
Contexto (puede estar vacío):
${contexto || "(sin contexto de KB)"}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg || "Hola" },
      ],
    });

    const llmText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "¿Te paso el catálogo por categorías (empanadas, bocaditos, alfajores, tortas y combos)?";

    // Si el LLM no encontró nada específico, guiamos a categorías reales
    const safeHelp =
      llmText +
      `\n\nSi querés, te muestro directamente:\n• Empanadas\n• Bocaditos\n• Alfajores\n• Tortas\n• Combos\nDecime cuál preferís 😄`;

    return res.status(200).json({ reply: safeHelp });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
