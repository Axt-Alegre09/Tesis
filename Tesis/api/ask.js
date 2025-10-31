// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV en Vercel:
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

/* ============== BD helpers ============== */

async function findProductsByText(q, limit = 6) {
  const t = norm(q);
  if (!t) return [];
  const tokens = t.split(" ").filter(Boolean).slice(0, 4);
  const or = tokens.map(x => `nombre.ilike.%${x}%`).join(",");
  const { data, error } = await supa
    .from("v_productos_publicos")
    .select("id, nombre, precio, url_imagen, imagen, categoria_nombre")
    .or(or)
    .limit(limit);
  if (error) {
    console.warn("findProductsByText:", error.message);
    return [];
  }
  return data ?? [];
}

async function findFirstProductLike(q) {
  const list = await findProductsByText(q, 1);
  return list?.[0] || null;
}

function formatPrices(arr) {
  return arr.map(p => `• **${p.nombre}** — ${toPY(p.precio)} Gs`).join("\n");
}

/* ============== KB (RAG) ============== */
async function kbLookup(userMsgRaw) {
  let contexto = "";
  try {
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userMsgRaw || "menu",
    });
    const { data: ctx, error } = await supa.rpc("kb_search", {
      query_embedding: emb.data[0].embedding,
      match_count: 5,
    });
    if (error) console.warn("kb_search error:", error.message);
    if (ctx?.length) contexto = ctx.map(r => r.content).join("\n");
  } catch (e) {
    console.warn("RAG fail:", e?.message);
  }
  return contexto;
}

/* ============== NLU muy enfocado (regex) ============== */
function parseQty(text) {
  const m = text.match(/\b(\d+)\b/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

function extractProductHint(text) {
  // ejemplo: “2 empanadas de carne”, “agrega 3 alfajores”, “quitar combo 1”
  // devolvemos lo que no sea verbo/stopword para buscar
  let t = text.replace(/\b(agrega?r?|sumar?|pon(e|er)?|añadi(r|me)?|quitar?|remover?|saca?r?)\b/g, " ");
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

    // -------- INTENCIONES DE CARRITO (cliente ejecuta) --------
    // ADD
    if (has(t, "agrega", "agregame", "sumar", "pone", "poner", "añadi", "añadime", "añade", "agregar")) {
      const qty = parseQty(t);
      const hint = extractProductHint(t);
      const prod = await findFirstProductLike(hint);
      if (prod) {
        return res.status(200).json({
          reply: `¡Listo! Voy a agregar **${qty}× ${prod.nombre}** al carrito 🧺`,
          action: { type: "ADD_TO_CART", product: { id: prod.id, nombre: prod.nombre, precio: Number(prod.precio) }, qty }
        });
      } else {
        return res.status(200).json({
          reply: `No ubiqué ese producto todavía. ¿Querés que te muestre opciones relacionadas?`
        });
      }
    }

    // REMOVE
    if (has(t, "quita", "quitar", "remueve", "remover", "saca", "sacar", "elimina", "eliminar")) {
      const qty = parseQty(t);
      const hint = extractProductHint(t);
      const prod = await findFirstProductLike(hint);
      if (prod) {
        return res.status(200).json({
          reply: `Ok, quito **${qty}× ${prod.nombre}** del carrito.`,
          action: { type: "REMOVE_FROM_CART", product: { id: prod.id, nombre: prod.nombre }, qty }
        });
      } else {
        return res.status(200).json({ reply: `No identifiqué el producto a quitar. Decime el nombre exacto, por fa 😅` });
      }
    }

    // TOTAL / RESUMEN
    if (has(t, "total", "cuanto sale", "cuánto sale", "cuanto es", "cuánto es", "monto", "pagar")) {
      return res.status(200).json({
        reply: `Te digo el total actual del carrito 👇`,
        action: { type: "GET_CART_TOTAL" }
      });
    }

    // -------- PREGUNTAS DE PRECIOS (respuesta con BD) --------
    if (has(t, "precio", "precios", "cuesta", "vale", "valen", "costo", "cuánto")) {
      const list = await findProductsByText(t, 6);
      if (list.length) {
        return res.status(200).json({
          reply: `Mirá estos precios:\n\n${formatPrices(list)}\n\n¿Te agrego alguno al carrito?`
        });
      }
    }

    // -------- DESCUBRIMIENTO POR TEXTO (BD) --------
    const candidates = await findProductsByText(t, 6);
    if (candidates.length) {
      return res.status(200).json({
        reply: `Tengo esto relacionado:\n\n${formatPrices(candidates)}\n\n¿Querés que te agregue alguno? Decime el nombre o cantidad.`
      });
    }

    // -------- RAG (KB: horarios, feriados, IG, contacto, etc.) --------
    const contexto = await kbLookup(userMsgRaw);
    const system = `
Sos *Paniquiños Bot*, mozo virtual de Paniquiños (Villa Elisa, PY).
Hablás breve, natural y amable. No inventes datos: usá el Contexto si responde la pregunta.
Si no hay datos, ofrecé ver el catálogo o ayudar con el carrito.
Contexto:
${contexto || "(sin contexto de KB)"}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsgRaw || "Hola" },
      ],
    });

    const llmText =
      completion.choices?.[0]?.message?.content?.trim() ||
      "¿Querés que te muestre el menú por categorías o te ayudo con el carrito?";

    return res.status(200).json({ reply: llmText });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
