// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV requeridas en Vercel:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE
 * - OPENAI_API_KEY
 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ==== Utils ==== */
const toPY = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-PY");
};
const norm = (s = "") =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

const CAT_ALIASES = [
  { slug: "bocaditos",   terms: ["bocadito", "bocaditos", "saladitos", "chipitas"] },
  { slug: "confiteria",  terms: ["confiteria", "confitería", "dulces", "alfajor", "alfajores"] },
  { slug: "panificados", terms: ["pan", "panes", "panificados"] },
  { slug: "rosticeria",  terms: ["rosticeria", "rostiseria", "rosticería", "rostisería", "empanada", "empanadas"] },
  { slug: "tortas",      terms: ["torta", "tortas", "minitorta", "mini torta"] },
  { slug: "combos",      terms: ["combo", "combos"] },
];
function detectCategorySlug(q) {
  const t = norm(q);
  for (const { slug, terms } of CAT_ALIASES) {
    if (terms.some(w => t.includes(w))) return slug;
  }
  return null;
}

function formatProductList(arr) {
  return arr.map(p =>
    `• **${p.nombre}** — ${toPY(p.precio)} Gs${Number(p.stock) > 0 ? ` (stock: ${p.stock})` : " (por encargo)"}`
  ).join("\n");
}

/* ==== Catálogo (consulta directa cuando hay match) ==== */
async function searchProductsByText(q, limit = 6) {
  const term = norm(q);
  if (!term) return [];
  const tokens = term.split(" ").filter(Boolean).slice(0, 3);
  if (!tokens.length) return [];
  const orFilter = tokens.map(tk => `nombre.ilike.%${tk}%`).join(",");
  const { data, error } = await supa
    .from("productos")
    .select("id,nombre,precio,stock,activo")
    .eq("activo", true)
    .or(orFilter)
    .limit(limit);
  if (error) {
    console.warn("searchProductsByText:", error.message);
    return [];
  }
  return data ?? [];
}

async function searchProductsByCategorySlug(slug, limit = 6) {
  if (!slug) return [];
  // Matchea por nombre de categoría en vista pública (si existe)
  const { data, error } = await supa
    .from("v_productos_publicos")
    .select("id,nombre,precio,stock,activo,categoria_slug")
    .eq("categoria_slug", slug)
    .limit(limit);
  if (!error && data?.length) return data;

  // Fallback: buscar por nombre contiene slug
  const { data: d2, error: e2 } = await supa
    .from("productos")
    .select("id,nombre,precio,stock,activo")
    .eq("activo", true)
    .ilike("nombre", `%${slug}%`)
    .limit(limit);
  if (e2) console.warn("searchProductsByCategorySlug:", e2.message);
  return d2 ?? [];
}

/* ==== Handler ==== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const userMsg = norm(userMsgRaw);

    // 0) ¿piden explícitamente una categoría? -> acción UI
    const slug = detectCategorySlug(userMsg);
    if (slug) {
      const prods = await searchProductsByCategorySlug(slug, 6);
      const intro = prods.length
        ? `Dale, te muestro *${slug}*.`
        : `Te abro *${slug}*. Si no ves opciones, decime y buscamos algo parecido.`;
      return res.status(200).json({
        reply: intro,
        action: "show_category",
        payload: { slug }
      });
    }

    // 1) ¿hay match por texto en productos? -> respuesta concreta (sin LLM)
    const productos = await searchProductsByText(userMsgRaw, 6);
    if (productos.length) {
      const lista = formatProductList(productos);
      return res.status(200).json({
        reply: `Encontré estas opciones:\n\n${lista}\n\n¿Querés que agregue alguna al carrito?`
      });
    }

    // 2) RAG a tu KB (si no hubo nada de productos)
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
      if (ctx?.length) contexto = ctx.map(r => r.content).join("\n");
    } catch (e) {
      console.warn("RAG falló:", e?.message);
    }

    // 3) LLM (con tono mozo, breve y sin inventar)
    const system = `
Sos *Paniquiños Bot*, mozo virtual de Paniquiños (Villa Elisa, Paraguay).
Contestá cálido, breve y natural. NO inventes precios/variedades.
Si falta info, ofrecé mostrar el catálogo por categoría o consultar al local.
Contexto (KB):
${contexto || "(sin contexto)"}`
      .trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsgRaw || "Hola" },
      ],
    });

    const llmText = completion.choices?.[0]?.message?.content?.trim()
      || "¿Querés que te muestre por categorías (empanadas, bocaditos, alfajores, tortas o combos)?";

    return res.status(200).json({
      reply: llmText
    });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
