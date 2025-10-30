import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);

export default async function handler(req, res) {
  const question = req.query.question || "Hola, ¿cómo puedo ayudarte?";

  try {
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const query_embedding = data[0].embedding;

    const { data: matches, error } = await supa.rpc("kb_search", {
      query_embedding,
      match_count: 5,
    });
    if (error) throw error;

    const reply = await buildReply(question, matches);
    res.status(200).json({ reply, matches });
  } catch (err) {
    console.error("🔥 /api/ask error:", err);
    res.status(500).json({ error: err.message });
  }
}

async function buildReply(question, matches) {
  if (!matches?.length)
    return "Lo siento 😔, por ahora no tengo información sobre eso. ¿Querés preguntarme otra cosa?";

  const context = matches.map(m => m.content).join("\n");

  const prompt = `
Eres *PaniBot*, el asistente de la confitería Paniquiños 🍰.
Habla breve, cálido y claro. Usa listas y negritas cuando ayude; evita datos técnicos o IDs.
Si el usuario pregunta por productos, incluye 2–5 bullets con nombres/mini detalles si los hay.
Si pregunta por horarios o dirección, respóndelo primero y ofrece ayuda extra al final.

Pregunta del cliente: "${question}"

Información disponible:
${context}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: prompt }],
    temperature: 0.7,
  });

  return completion.choices[0].message.content.trim();
}
