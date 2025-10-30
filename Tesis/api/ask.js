// /api/ask.js
// Serverless (Vercel): KB + OpenAI embeddings + Supabase RPC (kb_search)

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

/* ==== Env checks (útiles para debug) ==== */
const REQUIRED_ENVS = ["OPENAI_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE"];
for (const k of REQUIRED_ENVS) {
  if (!process.env[k]) {
    console.warn(`[ask] Missing env ${k}`);
  }
}

/* ==== Clients ==== */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE // << CORREGIDO
);

/* ==== Helpers ==== */
function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function embed(text) {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text
  });
  return data[0].embedding;
}

async function kbSearch(question, match_count = 5) {
  const qEmb = await embed(question);
  const { data, error } = await supa.rpc("kb_search", {
    query_embedding: qEmb,
    match_count
  });
  if (error) throw error;
  return data || [];
}

/** Intenta extraer horarios si el chunk trae un JSON tipo:
 *  "Horarios: {"dom":"12:00-18:00","lun":"07:00-19:00",...}"
 */
function tryExtractSchedule(content = "") {
  const m = content.match(/Horarios:\s*({[^}]+})/);
  if (!m) return null;
  try {
    // Permite comillas sin escapar y recortes
    const jsonLike = m[1]
      .replace(/(\w+):/g, '"$1":')       // claves sin comillas -> "clave":
      .replace(/'/g, '"');               // comillas simples -> dobles
    return JSON.parse(jsonLike);
  } catch {
    return null;
  }
}

function buildReply(question, results) {
  // Caso especial: pregunta sobre domingos/sábados u "horario"
  const q = (question || "").toLowerCase();
  const r0 = results[0]?.content || "";
  const horarios = tryExtractSchedule(r0);

  if (horarios) {
    const wantDomingo = /domingo/.test(q);
    const wantSabado  = /s[áa]bado/.test(q);
    const wantHorario = /horario|abren|cierran|abierto/.test(q);

    if (wantDomingo && horarios.dom) {
      return `Sí, los domingos abrimos de ${horarios.dom}.`;
    }
    if (wantSabado && horarios.sab) {
      return `Los sábados abrimos de ${horarios.sab}.`;
    }
    if (wantHorario) {
      // Devuelve un resumen ordenado
      const order = ["lun","mar","mie","jue","vie","sab","dom"];
      const lines = order
        .filter(k => horarios[k])
        .map(k => {
          const map = { lun:"Lun", mar:"Mar", mie:"Mié", jue:"Jue", vie:"Vie", sab:"Sáb", dom:"Dom" };
          return `${map[k]}: ${horarios[k]}`;
        });
      if (lines.length) return `Horarios:\n${lines.join("\n")}`;
    }
  }

  // Fallback: devuelve el primer resultado “resumido”
  const snippet = r0.replace(/\s+/g, " ").slice(0, 280);
  return snippet ? `Según nuestra información: ${snippet}${r0.length > 280 ? "…" : ""}` :
                   "No encontré datos en la base por ahora.";
}

/* ==== Handler ==== */
export default async function handler(req, res) {
  setCORS(res);
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Soporta:
    //  - GET /api/ask?question=...
    //  - POST { question: "..." }
    //  - POST { messages: [{role, content}, ...] } (usa el último)
    let question =
      (req.method === "GET" ? req.query?.question : req.body?.question) || "";

    if (!question && Array.isArray(req.body?.messages)) {
      const last = req.body.messages.slice(-1)[0];
      question = last?.content || "";
    }

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "BAD_REQUEST", message: "Falta 'question'." });
    }

    const results = await kbSearch(question, 5);
    const reply = buildReply(question, results);

    return res.status(200).json({
      reply,
      // Si no querés exponer resultados, podés quitar esto:
      matches: results?.map(r => ({
        id: r.id,
        similarity: r.similarity,
        contentPreview: String(r.content || "").slice(0, 180)
      }))
    });
  } catch (err) {
    console.error("[/api/ask] ERROR:", err);
    return res.status(500).json({
      error: "FUNCTION_INVOCATION_FAILED",
      message: err?.message || String(err)
    });
  }
}
