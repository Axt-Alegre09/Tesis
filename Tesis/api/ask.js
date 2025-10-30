// api/ask.js — Backend inteligente con contexto real
export default async function handler(req, res) {
  const json = (data, status = 200) => res.status(status).json(data);

  try {
    if (req.method !== "POST" && req.method !== "GET")
      return json({ reply: "Método no permitido." }, 405);

    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, OPENAI_API_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !OPENAI_API_KEY)
      return json({ reply: "⚠️ Faltan variables de entorno necesarias." }, 200);

    /* ========= UTILIDADES ========= */
    const fetchJSON = async (...a) => {
      const r = await fetch(...a);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    };

    const clean = (s = "") =>
      s.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .trim();

    const formatGs = (n) =>
      new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

    /* ========= INPUT ========= */
    const q =
      req.method === "GET"
        ? req.query?.question || "hola"
        : req.body?.messages?.slice(-1)?.[0]?.content || "hola";

    /* ========= SUPABASE ========= */
    const headers = {
      apikey: SUPABASE_SERVICE_ROLE,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
    };

    // Info del negocio
    const [info] = await fetchJSON(`${SUPABASE_URL}/rest/v1/negocio_info?select=*`, {
      headers,
    });

    // Productos activos
    const productos = await fetchJSON(
      `${SUPABASE_URL}/rest/v1/productos?select=id,nombre,descripcion,precio,stock,activo,imagen&activo=eq.true`,
      { headers }
    );

    /* ========= RESPUESTAS DIRECTAS ========= */
    const texto = clean(q);

    // Coincidencia directa de producto
    const match = productos.find((p) =>
      clean(p.nombre).includes(texto.replace("tienen ", ""))
    );
    if (match) {
      const precio = formatGs(match.precio);
      const reply = `Sí 😊 tenemos ${match.nombre} a ${precio}${
        match.stock > 0
          ? " — listo para disfrutar!"
          : " (ahora sin stock, pero pronto vuelve)"
      }`;
      return json({ reply });
    }

    // Horarios
    const horario =
      info?.horario ||
      "Lunes a Sábado de 07:00 a 19:00 (hora de Paraguay)";
    const direccion = info?.direccion || "Villa Elisa, Paraguay";
    if (/hora|abren|cierran|horario|abierto/i.test(texto)) {
      return json({
        reply: `Atendemos ${horario}. Nos encontramos en ${direccion}. 🕒`,
      });
    }

    // Teléfono / contacto
    if (/telefono|teléfono|whats|contacto/i.test(texto)) {
      return json({
        reply: `Podés escribirnos al ${
          info?.telefono || "0991 234 567"
        } 📞 o venir directamente a ${direccion}.`,
      });
    }

    /* ========= OPENAI ========= */
    const systemPrompt = `
Sos “Paniquiños Bot”, el mozo digital de la confitería Paniquiños en Paraguay.
Tono: amable, con voseo y naturalidad (nada robótico).
Usá 0–2 emojis, solo cuando sumen. No inventes información.

Tu conocimiento proviene de estos datos:
Negocio: ${JSON.stringify(info || {}, null, 2)}
Productos: ${JSON.stringify(productos.slice(0, 40), null, 2)}

Reglas:
- Si el producto no existe, decí que no lo tenemos actualmente.
- Si preguntan por recomendaciones, ofrecé 2 o 3 productos del catálogo con su precio.
- Respondé con calidez y cercanía, como si fueras un mozo atendiendo en mostrador.
- No uses lenguaje de bot ni frases genéricas tipo “estoy para ayudarte”.
`;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: q },
        ],
      }),
    });

    const j = await r.json();
    const reply =
      j?.choices?.[0]?.message?.content?.trim() ||
      "No tengo el dato exacto, pero te puedo sugerir algo rico 😋";

    return json({ reply });
  } catch (e) {
    console.error("❌ /api/ask ERROR:", e);
    return json({
      reply: "Estoy con un pequeño problema para responder 🙈. Probá de nuevo.",
    });
  }
}
