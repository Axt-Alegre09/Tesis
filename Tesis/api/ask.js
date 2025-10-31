// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV obligatorias:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE
 * - OPENAI_API_KEY
 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Service Role: SOLO en servidor
const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* ============== Utils ============== */
const toPY = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-PY");
};
const norm = (s = "") =>
  s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const has = (t, ...words) => words.some((w) => t.includes(w));

/* ============== Categorías & NLU ============== */
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

function parseQty(text) {
  const m = text.match(/\b(\d+)\b/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}
function extractProductHint(text) {
  let t = text.replace(/\b(agrega?r?|sumar?|pon(e|er)?|añadi(r|me)?|quitar?|remover?|saca?r?|elimina?r?)\b/gi, " ");
  t = t.replace(/\b(al|a|la|las|los|el|de|del|por|para|mi|me|carrito|al carrito)\b/gi, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t.length ? t : text;
}

/* ============== DB helpers ============== */
const cols = "id, nombre, precio, categoria_nombre";

const rowToSimple = (p) => ({
  id: p.id,
  nombre: p.nombre,
  precio: Number(p.precio || 0),
  categoria: p.categoria_nombre || null,
});

async function findByText(q, limit = 6) {
  const t = norm(q);
  if (!t) return [];
  const tokens = t.split(" ").filter(Boolean).slice(0, 4);
  const or = tokens.map((x) => `nombre.ilike.%${x}%`).join(",");
  const { data, error } = await supa
    .from("v_productos_publicos")
    .select(cols)
    .or(or)
    .limit(limit);
  if (error) { console.warn("findByText:", error.message); return []; }
  return (data || []).map(rowToSimple);
}

async function findByCategory(cat, limit = 6) {
  const { data, error } = await supa
    .from("v_productos_publicos")
    .select(cols)
    .ilike("categoria_nombre", `%${cat}%`)
    .order("nombre", { ascending: true })
    .limit(limit);
  if (error) { console.warn("findByCategory:", error.message); return []; }
  return (data || []).map(rowToSimple);
}

async function findFirstLike(q) {
  const list = await findByText(q, 1);
  return list?.[0] || null;
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
    return (data || []).map((r) => r.content).join("\n");
  } catch (e) {
    console.warn("RAG fail:", e?.message);
    return "";
  }
}

/* ============== Core reply builders ============== */
function listTop3(arr) {
  if (!arr.length) return "No encontré coincidencias.";
  const top = arr.slice(0, 3);
  const bullets = top.map((p) => `• ${p.nombre} — ${toPY(p.precio)} Gs`).join("\n");
  const more = arr.length > 3 ? `\n…y ${arr.length - 3} más. Decime cuál querés.` : "\n¿Te agrego alguno?";
  return `${bullets}\n${more}`;
}

function shortPriceLine(p) {
  return `${p.nombre}: ${toPY(p.precio)} Gs.`;
}

/* ============== Handler ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const t = norm(userMsgRaw);

    // Estado que viene del cliente (memoria de la charla)
    const stateIn = body?.state || {}; // { lastCategory, lastProduct, lastListIds:[], lastListNames:[] }
    const stateOut = { ...stateIn };

    // ========== 1) Intents de carrito (ADD / REMOVE / TOTAL) ==========
    if (has(t, "agrega", "agregame", "sumar", "pone", "poner", "añade", "añadime", "agregar")) {
      const qty = parseQty(t);

      // Referencias: “esa”, “primera”, “uno”
      let prod = null;
      if (has(t, "esa", "ese", "primera", "primero")) {
        // Si el cliente nos pasó la última lista, usamos el 1°
        if (stateIn.lastListIds?.length && stateIn.lastListNames?.length) {
          prod = await findFirstLike(stateIn.lastListNames[0]) || null;
        } else if (stateIn.lastProduct?.nombre) {
          prod = await findFirstLike(stateIn.lastProduct.nombre) || null;
        }
      }

      // Si no hay referencia contextual, intentamos por texto
      if (!prod) {
        const hint = extractProductHint(t);
        prod = await findFirstLike(hint);
      }

      if (prod) {
        stateOut.lastProduct = { id: prod.id, nombre: prod.nombre };
        return res.status(200).json({
          reply: `Listo, agregué ${qty}× ${prod.nombre}.`,
          action: { type: "ADD_TO_CART", product: { id: prod.id, nombre: prod.nombre, precio: prod.precio }, qty },
          state: stateOut,
        });
      }
      return res.status(200).json({ reply: `No ubiqué el producto. Decime el nombre exacto.`, state: stateOut });
    }

    if (has(t, "quita", "quitar", "remueve", "remover", "saca", "sacar", "elimina", "eliminar")) {
      const qty = parseQty(t);
      let prod = null;

      if (has(t, "esa", "ese", "primera", "primero")) {
        if (stateIn.lastListIds?.length && stateIn.lastListNames?.length) {
          prod = await findFirstLike(stateIn.lastListNames[0]) || null;
        } else if (stateIn.lastProduct?.nombre) {
          prod = await findFirstLike(stateIn.lastProduct.nombre) || null;
        }
      }
      if (!prod) {
        const hint = extractProductHint(t);
        prod = await findFirstLike(hint);
      }

      if (prod) {
        stateOut.lastProduct = { id: prod.id, nombre: prod.nombre };
        return res.status(200).json({
          reply: `Ok, quité ${qty}× ${prod.nombre}.`,
          action: { type: "REMOVE_FROM_CART", product: { id: prod.id, nombre: prod.nombre }, qty },
          state: stateOut,
        });
      }
      return res.status(200).json({ reply: `No identifiqué cuál quitar. Decime el nombre.`, state: stateOut });
    }

    if (has(t, "total", "cuanto sale", "cuánto sale", "cuanto es", "cuánto es", "monto", "pagar")) {
      return res.status(200).json({
        reply: `Este es tu total 👇`,
        action: { type: "GET_CART_TOTAL" },
        state: stateOut,
      });
    }

    // ========== 2) Preguntas de precio “precio de X” ==========
    if (has(t, "precio", "precios", "cuesta", "vale", "valen", "costo")) {
      const cat = detectCategory(t);
      const list = cat ? await findByCategory(cat, 6) : await findByText(t, 6);
      if (list.length) {
        const first = list[0];
        stateOut.lastCategory = cat || first.categoria || stateOut.lastCategory || null;
        stateOut.lastProduct  = { id: first.id, nombre: first.nombre };
        stateOut.lastListIds  = list.map((x) => x.id);
        stateOut.lastListNames = list.map((x) => x.nombre);
        return res.status(200).json({
          reply: list.length === 1 ? shortPriceLine(first) : listTop3(list),
          state: stateOut,
        });
      }
    }

    // ========== 3) Descubrimiento por categoría (“¿tenés empanadas?”) ==========
    const askedCat = detectCategory(t);
    if (askedCat) {
      const list = await findByCategory(askedCat, 6);
      if (list.length) {
        stateOut.lastCategory = askedCat;
        stateOut.lastProduct  = { id: list[0].id, nombre: list[0].nombre };
        stateOut.lastListIds  = list.map((x) => x.id);
        stateOut.lastListNames = list.map((x) => x.nombre);
        return res.status(200).json({
          reply: `${askedCat.charAt(0).toUpperCase() + askedCat.slice(1)}:\n${listTop3(list)}`,
          state: stateOut,
        });
      }
    }

    // ========== 4) Preguntas tipo “¿qué tiene…?” usando el contexto ==========
    if (has(t, "que tiene", "qué tiene", "ingrediente", "ingredientes", "de que es", "de qué es")) {
      let prod = null;
      if (stateIn.lastProduct?.nombre) prod = await findFirstLike(stateIn.lastProduct.nombre);
      if (!prod && stateIn.lastListNames?.length) prod = await findFirstLike(stateIn.lastListNames[0]);
      if (prod) {
        stateOut.lastProduct = { id: prod.id, nombre: prod.nombre };
        // No tenemos descripción en v_productos_publicos; respondemos útil sin inventar
        return res.status(200).json({
          reply: `${prod.nombre}: no tengo descripción interna. Te puedo confirmar precio (${toPY(prod.precio)} Gs) y agregarte al carrito.`,
          state: stateOut,
        });
      }
    }

    // ========== 5) Fallback con RAG (horarios, IG, feriados, etc.) ==========
    const contexto = await kbLookup(userMsgRaw);
    const system = `
Sos *Paniquiños Bot*, mozo virtual. Estilo directo, breve y cálido.
Reglas:
- Respondé en 1–2 líneas como humano; sin listas largas ni “secciones”.
- No inventes precios ni sabores. Si falta dato, decí “No tengo ese dato” y ofrecé ver el catálogo o preguntar otra cosa.
Contexto:
${contexto || "(sin contexto de KB)"}
`.trim();

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
    return res.status(200).json({ reply: llmText, state: stateOut });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
