// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/**
 * ENV requeridas:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE
 * - OPENAI_API_KEY
 */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* ============== Utils base ============== */
const toPY = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-PY");
};
const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

const tokenize = (s) => norm(s).split(" ").filter(Boolean);
const has = (t, ...words) => words.some(w => t.includes(w));

/* ============== Catálogo (cache en memoria) ============== */
// Traigo de la vista v_productos_publicos (id, nombre, precio, categoria_nombre, imagen/url_imagen)
let _cache = { at: 0, items: [] };
const CACHE_MS = 1000 * 60 * 3; // 3 min

async function loadCatalog() {
  const now = Date.now();
  if (now - _cache.at < CACHE_MS && _cache.items.length) return _cache.items;

  const { data, error } = await supa
    .from("v_productos_publicos")
    .select("id, nombre, precio, categoria_nombre");
  if (error) {
    console.warn("loadCatalog:", error.message);
    return _cache.items || [];
  }
  const items = (data || []).map(p => ({
    id: p.id,
    nombre: String(p.nombre || "").trim(),
    precio: Number(p.precio || 0),
    categoria: String(p.categoria_nombre || "").trim(),
    nNombre: norm(p.nombre || ""),
    nCat: norm(p.categoria_nombre || "")
  }));
  _cache = { at: now, items };
  return items;
}

/* ============== Sinónimos de categoría ============== */
const CATEGORY_MAP = [
  { key: "empanadas",  terms: ["empanada", "empanadas", "mandioca", "saltena", "salteña"] },
  { key: "bocaditos",  terms: ["bocadito", "bocaditos", "saladitos", "chipitas", "mini"] },
  { key: "alfajores",  terms: ["alfajor", "alfajores"] },
  { key: "tortas",     terms: ["torta", "tortas", "minitorta", "mini torta", "pastel"] },
  { key: "combos",     terms: ["combo", "combos", "promos", "promo"] },
  { key: "confiteria", terms: ["confiteria", "dulces", "postres"] },
  { key: "panificados",terms: ["pan", "panes", "panificados", "chipa"] },
  { key: "rostiseria", terms: ["rostiseria", "rosticeria", "pollos", "tartas"] },
];

function detectCategoryByWords(t) {
  const txt = norm(t);
  for (const { key, terms } of CATEGORY_MAP) {
    if (terms.some(w => txt.includes(norm(w)))) return key;
  }
  return null;
}

/* ============== Fuzzy matching local (productos) ============== */
// Levenshtein simple para coincidencia flexible
function levenshtein(a, b) {
  const s = a, t = b;
  const m = s.length, n = t.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function fuzzyScoreProduct(p, qTokens) {
  // Puntos por tokens contenidos + penalización por distancia
  const nameToks = tokenize(p.nNombre);
  let overlap = 0;
  for (const qt of qTokens) if (nameToks.includes(qt)) overlap += 2;
  // distancia mínima a cualquier token del nombre
  let minLev = Infinity;
  for (const nt of nameToks) {
    for (const qt of qTokens) {
      minLev = Math.min(minLev, levenshtein(nt, qt));
    }
  }
  const levPart = Number.isFinite(minLev) ? Math.max(0, 6 - minLev) : 0;
  // bonus si la categoría coincide con alguna palabra
  const catHit = qTokens.some(t => p.nCat.includes(t)) ? 2 : 0;
  return overlap + levPart + catHit;
}

async function fuzzyFindProducts(userText, limit = 6, preferCat = null) {
  const cat = preferCat || detectCategoryByWords(userText);
  const items = await loadCatalog();
  const qTokens = tokenize(userText);
  let pool = items;

  if (cat) {
    const nCat = norm(cat);
    const within = items.filter(p => p.nCat.includes(nCat));
    if (within.length) pool = within;
  }

  // Si no hay tokens, devolvemos por precio/alfabético
  if (!qTokens.length) {
    return pool
      .slice()
      .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)))
      .slice(0, limit);
  }

  const ranked = pool
    .map(p => ({ p, s: fuzzyScoreProduct(p, qTokens) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map(x => x.p);

  // Si nada superó 0, caemos a búsqueda ilike básica
  if (!ranked.length) {
    const tokens = qTokens.slice(0, 3);
    const or = tokens.map(tk => `nombre.ilike.%${tk}%`).join(",");
    const { data, error } = await supa
      .from("v_productos_publicos")
      .select("id, nombre, precio, categoria_nombre")
      .or(or)
      .limit(limit);
    if (!error && data?.length) {
      return data.map(p => ({
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio || 0),
        categoria: p.categoria_nombre,
        nNombre: norm(p.nombre),
        nCat: norm(p.categoria_nombre || "")
      }));
    }
  }

  return ranked;
}

async function fuzzyFindOne(userText, preferCat = null) {
  const list = await fuzzyFindProducts(userText, 1, preferCat);
  return list?.[0] || null;
}

function formatList(arr) {
  if (!arr?.length) return "No encontré coincidencias.";
  return arr.map(p => `• **${p.nombre}** — ${toPY(p.precio)} Gs`).join("\n");
}

/* ============== KB (RAG) para info general ============== */
async function kbAnswer(userMsgRaw) {
  try {
    const emb = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: userMsgRaw || "menu",
    });
    const { data, error } = await supa.rpc("kb_search", {
      query_embedding: emb.data[0].embedding,
      match_count: 5,
    });
    if (error) {
      console.warn("kb_search:", error.message);
      return "";
    }
    return (data || []).map(r => r.content).join("\n");
  } catch (e) {
    console.warn("RAG fail:", e?.message);
    return "";
  }
}

/* ============== NLU de acciones de carrito ============== */
function parseQty(text) {
  const m = text.match(/\b(\d+)\b/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}
function stripVerbsForHint(text) {
  // Quitamos verbos/complementos típicos para quedarnos con el "objeto"
  let t = norm(text);
  t = t.replace(/\b(agrega|agregame|agregar|sumar|pone|poner|anade|anadir|quita|quitar|remueve|remover|saca|sacar|elimina|eliminar)\b/g, " ");
  t = t.replace(/\b(al|a|la|las|los|el|de|del|por|para|mi|me|carrito|al carrito)\b/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t || norm(text);
}

/* ============== Handler principal ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const t = norm(userMsgRaw);

    /* ---- 1) Acciones de carrito (agregar/quitar/total) ---- */
    if (has(t, "agrega", "agregame", "sumar", "pone", "poner", "anade", "anadir")) {
      const qty = parseQty(t);
      const hint = stripVerbsForHint(t);
      // Si el mensaje menciona una categoría, la priorizamos
      const preferCat = detectCategoryByWords(t);
      const prod = await fuzzyFindOne(hint, preferCat);
      if (prod) {
        return res.status(200).json({
          reply: `Ok, agregué ${qty}× ${prod.nombre}.`,
          action: { type: "ADD_TO_CART", product: { id: prod.id, nombre: prod.nombre, precio: prod.precio }, qty }
        });
      }
      return res.status(200).json({ reply: "No identifiqué ese producto. ¿El nombre exacto?" });
    }

    if (has(t, "quita", "quitar", "remueve", "remover", "saca", "sacar", "elimina", "eliminar")) {
      const qty = parseQty(t);
      const hint = stripVerbsForHint(t);
      const preferCat = detectCategoryByWords(t);
      const prod = await fuzzyFindOne(hint, preferCat);
      if (prod) {
        return res.status(200).json({
          reply: `Listo, quité ${qty}× ${prod.nombre}.`,
          action: { type: "REMOVE_FROM_CART", product: { id: prod.id, nombre: prod.nombre }, qty }
        });
      }
      return res.status(200).json({ reply: "No identifiqué cuál quitar. Decime el nombre." });
    }

    if (has(t, "total", "cuanto sale", "cuanto es", "cuánto sale", "cuánto es", "monto", "pagar")) {
      return res.status(200).json({
        reply: "Este es tu total:",
        action: { type: "GET_CART_TOTAL" }
      });
    }

    /* ---- 2) Consultas de precio/listado por categoría o texto ---- */
    if (has(t, "precio", "precios", "cuesta", "vale", "valen", "costo") || has(t, "tenes", "tienes", "hay", "dispones", "busco", "quiero")) {
      const cat = detectCategoryByWords(t);
      const list = cat
        ? await fuzzyFindProducts(t, 6, cat)
        : await fuzzyFindProducts(t, 6, null);

      if (list.length) {
        const header = cat ? `${cat[0].toUpperCase() + cat.slice(1)}:` : "Te paso opciones:";
        return res.status(200).json({
          reply: `${header}\n\n${formatList(list)}\n\n¿Querés alguno?`
        });
      }
    }

    // También si solo preguntan por la categoría (“empanadas?”, “bocaditos?”)
    const askedCat = detectCategoryByWords(t);
    if (askedCat) {
      const list = await fuzzyFindProducts(t, 6, askedCat);
      if (list.length) {
        return res.status(200).json({
          reply: `${askedCat[0].toUpperCase() + askedCat.slice(1)}:\n\n${formatList(list)}\n\n¿Te agrego alguno?`
        });
      }
    }

    /* ---- 3) Fallback semántico a KB (horarios, feriados, IG, etc.) ---- */
    const contexto = await kbAnswer(userMsgRaw);
    const system = `
Sos "Paniquiños Bot", mozo virtual de Paniquiños. Estilo: directo, amable y breve.
Reglas:
- Respuestas cortas (1–2 líneas), siempre dentro del chat.
- No inventes precios ni productos. Si no sabés, decí “No tengo ese dato” y ofrecé ver el catálogo o preguntar otra cosa.
Contexto (puede estar vacío):
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
