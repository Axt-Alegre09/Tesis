// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ENV (asegurate que coincidan en Vercel):
// SUPABASE_URL
// SUPABASE_SERVICE_ROLE
// OPENAI_API_KEY
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

// Utilidad: busca productos por texto en 'nombre' (y solo activos)
async function buscarProductosPorTexto(q, limit = 6) {
  const term = q?.trim();
  if (!term) return { data: [], error: null };

  // heurística simple para consultas tipo “tienen empanadas?”, “torta”, “alfajor”
  const like = `%${term.replace(/[^\p{L}\p{N}\s]/gu, " ").trim()}%`;

  const { data, error } = await supa
    .from("productos")
    .select("id, nombre, precio, stock, activo")
    .ilike("nombre", like)
    .eq("activo", true)
    .limit(limit);

  return { data: data || [], error };
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Método no permitido" });

  try {
    const body = await (typeof req.body === "string" ? JSON.parse(req.body) : req.body);
    const userMsg = body?.messages?.[0]?.content?.toLowerCase()?.trim() || "";

    // 1) Intento directo a productos (fallback “inteligente”)
    let productos = [];
    {
      const palabrasClave =
        userMsg.length <= 60 // consultas cortas suelen ser “producto”
          ? userMsg
          : userMsg.split(/[?.!,]/)[0]; // primera oración

      const { data } = await buscarProductosPorTexto(palabrasClave);
      productos = data || [];
    }

    if (productos.length > 0) {
      // formateamos una respuesta natural y útil para la tienda
      const lista = productos
        .map(
          (p) =>
            `• **${p.nombre}** — ${Number(p.precio).toLocaleString("es-PY")} Gs` +
            (p.stock > 0 ? ` (stock: ${p.stock})` : ` (¡por encargo!)`)
        )
        .join("\n");

      const reply =
        `Te paso lo que encontré relacionado:\n\n${lista}\n\n` +
        `¿Querés que agregue alguno al carrito o te paso más opciones similares?`;
      return res.status(200).json({ reply });
    }

    // 2) Si no hubo match en productos, probamos RAG con kb
    let contexto = "No hay contexto adicional.";
    try {
      const emb = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: userMsg || "menu",
      });
      const embedding = emb.data[0].embedding;

      const { data: ctx } = await supa.rpc("kb_search", {
        query_embedding: embedding,
        match_count: 5,
      });

      if (ctx?.length) {
        contexto = ctx.map((r) => r.content).join("\n");
      }
    } catch (e) {
      // si kb falla, seguimos igual sin romper
      console.warn("kb_search falló (continuo sin RAG):", e?.message);
    }

    // 3) LLM para respuesta natural con tono cálido
    const system = `
Sos "Paniquiños Bot", asistente de una confitería de Paraguay.
Reglas:
- Tono amable, claro y conciso; emojis suaves, nada exagerado.
- NO inventes productos ni precios. Si no estás seguro, proponé alternativas (bocaditos, alfajores, tortas, combos).
- Si el usuario pide horarios, sugiere consultar el local o el sitio (no inventes horarios).
- Si no hay info suficiente, pedí una aclaración breve.
Contexto (si sirve):
${contexto}
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMsg || "Hola" },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "No pude responder ahora mismo 😅. ¿Podés reformular en pocas palabras?";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
