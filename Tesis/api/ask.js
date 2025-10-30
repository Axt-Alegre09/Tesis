// /api/ask.js
import 'dotenv/config';
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { question } = req.query;
  if (!question) return res.status(400).json({ error: 'Falta pregunta' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question
  });

  const { data: results } = await supa.rpc('kb_search', {
    query_embedding: data[0].embedding,
    match_count: 5
  });

  res.status(200).json(results);
}
