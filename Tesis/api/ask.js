// api/ask.js
import fetch from "node-fetch"; // si estás en Vercel no hace falta, pero en local sí

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ reply: "Método no permitido." });
  }

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  const TZ = "America/Asuncion";

  const json = (data, status = 200) =>
    res.status(status).json(data || { reply: "Sin respuesta." });

  const ensureEnv = () => {
    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE)
      throw new Error("Faltan variables de entorno.");
  };

  ensureEnv();

  async function supaSelect(table, columns) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        },
      });
      return r.ok ? await r.json() : [];
    } catch {
      return [];
    }
  }

  async function openaiChat(messages) {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.5,
      }),
    });
    const j = await r.json();
    return j?.choices?.[0]?.message?.content?.trim();
  }

  async function runAsk({ messages }) {
    const lastUser =
      messages.slice().reverse().find((m) => m.role === "user")?.content || "";

    const productos = await supaSelect(
      "productos",
      "id,nombre,descripcion,precio,imagen,activo"
    );
    const info = await supaSelect("negocio_info", "*");

    const systemPrompt = `
Eres "Paniquiños Bot", el mozo digital de una confitería en Paraguay.
Tono: cálido, directo y amable.
Habla solo de lo que sepas (productos, negocio, horarios).
Si no tenés info, sé sincero.
    `;

    const msgs = [
      { role: "system", content: systemPrompt },
      { role: "system", content: `negocio:\n${JSON.stringify(info)}` },
      { role: "system", content: `productos:\n${JSON.stringify(productos.slice(0, 8))}` },
      ...messages,
    ];

    try {
      const reply =
        (await openaiChat(msgs)) ||
        "No tengo ese dato exacto, pero puedo contarte sobre lo que ofrecemos 😊";
      return { reply };
    } catch (e) {
      console.error("error runAsk:", e);
      return {
        reply: "Estoy teniendo un problema para responder. Probá de nuevo en un rato 🙈",
      };
    }
  }

  try {
    if (req.method === "GET") {
      const q = req.query?.question || "Hola";
      const data = await runAsk({
        messages: [{ role: "user", content: q }],
      });
      return json(data);
    }

    const body = req.body || {};
    const data = await runAsk(body);
    return json(data);
  } catch (e) {
    console.error("ask error:", e);
    return json({
      reply:
        "Ocurrió un error interno. Revisá la configuración o variables de entorno.",
    });
  }
}
