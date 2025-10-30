// /api/ask.js
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

// ========= CONFIG =========
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  try {
    const { messages } = req.body;
    const question = messages?.[0]?.content?.toLowerCase().trim();

    console.log("🟢 Nueva consulta recibida:", question);

    // ======== 1️⃣ Embedding de la pregunta ========
    console.log("📦 Generando embedding...");
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const embedding = embeddingResponse.data[0].embedding;
    console.log("✅ Embedding generado correctamente. Longitud:", embedding.length);

    // ======== 2️⃣ Buscar contexto RAG en Supabase ========
    console.log("🔍 Buscando contexto en Supabase con kb_search...");
    const { data: context, error } = await supabase.rpc("kb_search", {
      query_embedding: embedding,
      match_count: 5,
    });

    if (error) {
      console.error("❌ Error kb_search:", error);
    } else {
      console.log(`✅ Contexto recuperado (${context?.length || 0} coincidencias).`);
    }

    const contextText =
      context?.map((r) => r.content).join("\n") ||
      "No se encontró información contextual relevante.";

    // ======== 3️⃣ Generar respuesta con OpenAI ========
    console.log("💬 Solicitando respuesta a OpenAI...");

    const prompt = `
Sos *Paniquiños Bot*, un asistente cálido y simpático de la confitería Paniquiños 🍰.
Usá un tono amable, natural y paraguayo neutral.
Nunca inventes productos que no existan en la base de datos.
Si no sabés algo, admitilo con empatía. Podés sugerir consultar a un empleado.
Respondé con frases breves, naturales y con emojis si queda bien.
Si el usuario pide agregar productos al carrito, confirmá con el nombre real del producto y el precio.

Contexto de productos:
${contextText}

Usuario: ${question}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.7,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Lo siento, no pude generar una respuesta en este momento.";

    console.log("✅ Respuesta generada:", reply.slice(0, 100) + "...");

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("💥 Error interno en /api/ask:", err);
    return res.status(500).json({
      error: "Error interno del servidor",
      detail: err.message,
    });
  }
}
