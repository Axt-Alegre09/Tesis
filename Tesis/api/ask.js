// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE
 * - OPENAI_API_KEY
 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ============== Utils ============== */
const toPY = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-PY");
};
const norm = (s = "") =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const has = (t, ...words) => words.some(w => t.includes(w));

/* ============== Cat/Intent helpers ============== */
const CATEGORY_MAP = [
  { key: "empanadas",  terms: ["empanada", "empanadas"] },
  { key: "bocaditos",  terms: ["bocadito", "bocaditos", "saladitos"] },
  { key: "alfajores",  terms: ["alfajor", "alfajores"] },
  { key: "tortas",     terms: ["torta", "tortas", "minitorta", "mini torta"] },
  { key: "combos",     terms: ["combo", "combos"] },
  { key: "confitería", terms: ["confiteria", "confitería", "dulces"] },
  { key: "panificados",terms: ["pan", "panes", "panificados"] },
  { key: "rostisería", terms: ["rostiseria", "rosticeria", "rostisería", "rosticería"] },
];
function detectCategory(q) {
  const t = norm(q);
  for (const { key, terms } of CATEGORY_MAP) if (terms.some(w => t.includes(w))) return key;
  return null;
}

/* ============== BD helpers ============== */
function rowToSimple(p) {
  return {
    id: p.id,
    nombre: p.nombre,
    precio: Number(p.precio || 0),
    categoria: p.categoria_nombre || null,
  };
}

async function findProductsByText(q, limit = 6) {
  const t = norm(q);
  if (!t) return [];
  const tokens = t.split(" ").filter(Boolean).slice(0, 4);
  const or = tokens.map(x => `nombre.ilike.%${x}%`).join(",");
  const { data, error } = await supa
    .from("v_productos_publicos")
    .select("id, nombre, precio, categoria_nombre")
    .or(or)
    .limit(limit);
  if (error) { console.warn("findProductsByText:", error.message); return []; }
  return (data || []).map(rowToSimple);
}

async function findProductsByCategory(cat, limit = 6) {
  const { data, error } = await supa
    .from("v_productos_publicos")
    .select("id, nombre, precio, categoria_nombre")
    .ilike("categoria_nombre", `%${cat}%`)
    .limit(limit);
  if (error) { console.warn("findProductsByCategory:", error.message); return []; }
  return (data || []).map(rowToSimple);
}

async function findFirstProductLike(q) {
  const list = await findProductsByText(q, 1);
  return list?.[0] || null;
}

function listWithPrices(arr) {
  if (!arr.length) return "No encontré coincidencias.";
  return arr.map(p => `• **${p.nombre}** — ${toPY(p.precio)} Gs`).join("\n");
}

/* ============== KB (RAG) ============== */
async function kbLookup(userMsgRaw) {
  try {
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userMsgRaw || "menu",
    });
    const { data, error } = await supa.rpc("kb_search", {
      query_embedding: emb.data[0].embedding,
      match_count: 5,
    });
    if (error) { console.warn("kb_search:", error.message); return ""; }
    return (data || []).map(r => r.content).join("\n");
  } catch (e) {
    console.warn("RAG fail:", e?.message);
    return "";
  }
}

/* ============== NLU simple (carrito) ============== */
function parseQty(text) {
  const m = text.match(/\b(\d+)\b/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}
function extractProductHint(text) {
  let t = text.replace(/\b(agrega?r?|sumar?|pon(e|er)?|añadi(r|me)?|quitar?|remover?|saca?r?|elimina?r?)\b/g, " ");
  t = t.replace(/\b(al|a|la|las|los|el|de|del|por|para|mi|me|al carrito|carrito)\b/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t.length ? t : text;
}

/* ============== Handler ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const t = norm(userMsgRaw);

    // -- Carrito: agregar
    if (has(t, "agrega", "agregame", "sumar", "pone", "poner", "añadi", "añade")) {
      const qty = parseQty(t);
      const hint = extractProductHint(t);
      const prod = await findFirstProductLike(hint);
      if (prod) {
        return res.status(200).json({
          reply: `Agrego ${qty}× ${prod.nombre}.`,
          action: { type: "ADD_TO_CART", product: { id: prod.id, nombre: prod.nombre, precio: prod.precio }, qty }
        });
      }
      return res.status(200).json({ reply: `No ubiqué ese producto. ¿Nombre exacto?` });
    }

    // -- Carrito: quitar
    if (has(t, "quita", "quitar", "remueve", "remover", "saca", "sacar", "elimina", "eliminar")) {
      const qty = parseQty(t);
      const hint = extractProductHint(t);
      const prod = await findFirstProductLike(hint);
      if (prod) {
        return res.status(200).json({
          reply: `Quito ${qty}× ${prod.nombre}.`,
          action: { type: "REMOVE_FROM_CART", product: { id: prod.id, nombre: prod.nombre }, qty }
        });
      }
      return res.status(200).json({ reply: `No identifiqué cuál quitar. Decime el nombre.` });
    }

    // -- Carrito: total
    if (has(t, "total", "cuanto sale", "cuánto sale", "cuanto es", "cuánto es", "monto", "pagar")) {
      return res.status(200).json({
        reply: `Este es tu total:`,
        action: { type: "GET_CART_TOTAL" }
      });
    }

    // -- Consultas de “precios de X”
    if (has(t, "precio", "precios", "cuesta", "vale", "valen", "costo")) {
      const cat = detectCategory(t);
      const list = cat ? await findProductsByCategory(cat, 6) : await findProductsByText(t, 6);
      if (list.length) {
        return res.status(200).json({ reply: `${listWithPrices(list)}\n\n¿Te agrego alguno?` });
      }
    }

    // -- Descubrimiento por categoría/consulta (“¿tenés empanadas?”)
    const askedCat = detectCategory(t);
    if (askedCat) {
      const list = await findProductsByCategory(askedCat, 6);
      if (list.length) {
        return res.status(200).json({
          reply: `${askedCat.charAt(0).toUpperCase() + askedCat.slice(1)}:\n\n${listWithPrices(list)}\n\n¿Querés alguno?`
        });
      }
    }

    // -- Fallback con KB (horarios, IG, feriados, etc.)
    const contexto = await kbLookup(userMsgRaw);
    const system = `
Sos *Paniquiños Bot*, mozo virtual. Estilo: directo, amable y breve.
Reglas de respuesta:
- Máximo 1–2 líneas. Sin discursos ni explicaciones largas.
- Nunca abras secciones ni “mostrás categorías”. Respondé SIEMPRE dentro del chat.
- No inventes precios/sabores: si no hay datos, decí “No tengo ese dato” y ofrecé ver el catálogo o preguntar por otra cosa.
Contexto:
${contexto || "(sin contexto de KB)"}`
      .trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsgRaw || "Hola" },
      ],
    });

    const llmText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "¿Qué te gustaría pedir o consultar?";
    return res.status(200).json({ reply: llmText });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
