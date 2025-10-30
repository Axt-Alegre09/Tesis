// api/ask.js  (Pages Router)
export default async function handler(req, res) {
  const json = (data, status = 200) =>
    res.status(status).json(data || { reply: "Sin respuesta." });

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ reply: "Método no permitido." }, 405);
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
    const TZ = "America/Asuncion";

    if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
      return json({ reply: "Faltan variables de entorno en el servidor." }, 200);
    }

    // ---------- Utiles ----------
    const fetchJSON = async (...a) => {
      const r = await fetch(...a);
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    };

    const isPromoWindowNow = (d = new Date()) => {
      try {
        const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
        const day = local.getDay(); // 5 = viernes
        const hh = local.getHours();
        const mm = local.getMinutes();
        return day === 5 && (hh > 16 && (hh < 19 || (hh === 19 && mm === 0)));
      } catch { return false; }
    };

    const getPromos = () => (isPromoWindowNow()
      ? [{
          id: "emp-2x1",
          title: "2x1 en Empanadas",
          detail: "Válido hoy de 17:00 a 19:00 (hora de Asunción). 🥟✨",
          cta: { text: "Ver empanadas", payload: "ver empanadas" },
        }]
      : []);

    // ---------- Supabase ----------
    async function supaSelect(table, params) {
      const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
      Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
      return await fetchJSON(url.toString(), {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        },
        cache: "no-store",
      });
    }

    // Busca productos activos; si pasás "q", agrega OR nombre/descripcion ilike
    async function getProductosActivos({ q = null, limit = 50 } = {}) {
      const base = new URL(`${SUPABASE_URL}/rest/v1/productos`);
      base.searchParams.set("select", "id,nombre,descripcion,precio,imagen,activo,categoria_id");
      base.searchParams.set("activo", "eq.true");
      base.searchParams.set("limit", String(limit));
      if (q) base.searchParams.set("or", `nombre.ilike.*${q}*,descripcion.ilike.*${q}*`);

      try {
        return await fetchJSON(base.toString(), {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
          },
          cache: "no-store",
        });
      } catch (e) {
        console.error("[ask] productos error:", e);
        return [];
      }
    }

    async function kbSearch(embedding, matchCount = 5) {
      try {
        return await fetchJSON(`${SUPABASE_URL}/rest/v1/rpc/kb_search`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ query_embedding: embedding, match_count: matchCount }),
        });
      } catch (e) {
        console.warn("[ask] kb_search warn:", e);
        return [];
      }
    }

    // ---------- OpenAI ----------
    async function openaiChat(messages, temperature = 0.5, model = "gpt-4o-mini") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, messages, temperature }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      return j?.choices?.[0]?.message?.content?.trim() || null;
    }
    async function openaiEmbedding(input, model = "text-embedding-3-small") {
      const r = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, input }),
      });
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      return j?.data?.[0]?.embedding || null;
    }

    // ---------- Keywordizer para preguntas ("tienen tortas?")
    const DOMAIN_WORDS = [
      "empanada","empanadas","torta","tortas","alfajor","alfajores","bocadito","bocaditos",
      "combo","combos","pan","panes","panificados","milanesa","milanesas","croissant","croissants",
      "flan","pastaflora","pasta","flora","pai","tartas","tarta","sandwich","sándwich"
    ];
    function keywordize(s="") {
      const t = String(s).toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
        .replace(/[^a-z0-9áéíóúñ\s]/g," ")
        .replace(/\s+/g," ")
        .trim();
      const toks = t.split(" ").filter(Boolean);
      const keep = new Set();
      for (const w of toks) {
        if (w.length >= 4) keep.add(w);
        if (DOMAIN_WORDS.includes(w)) keep.add(w.replace(/s$/, "")); // singulariza simple
      }
      // preferimos 1–2 palabras
      return Array.from(keep).slice(0, 2).join(" ");
    }

    // ---------- Core ----------
    const input =
      req.method === "GET"
        ? { messages: [{ role: "user", content: (req.query?.question || "Hola").slice(0, 2000) }] }
        : (req.body || {});

    const messages = Array.isArray(input.messages) ? input.messages.slice(-8) : [];
    const lastUser = messages.slice().reverse().find(m => m.role === "user")?.content || "";

    // negocio_info (si existe)
    const info = (await supaSelect("negocio_info", { select: "*", limit: "1" }))[0] || {};
    const promos = getPromos();

    // Productos base (activos) + productos coincidentes por keyword
    const kw = keywordize(lastUser);               // <- "tienen tortas?" -> "torta"
    const matched = kw ? await getProductosActivos({ q: kw, limit: 24 }) : [];
    const catalog = await getProductosActivos({ q: null, limit: 60 });
    // Subset para el LLM: priorizamos coincidencias, y completamos con catálogo
    const subset = [...matched, ...catalog].slice(0, 30);

    // RAG (opcional) si es pregunta informativa
    let kbText = "";
    try {
      const needKb = /horario|direccion|dirección|telefono|teléfono|whats|ubicacion|ubicación|quien|quién|historia|info|informacion|información|servicio/i.test(lastUser);
      if (needKb && lastUser) {
        const emb = await openaiEmbedding(lastUser);
        if (emb) {
          const hits = await kbSearch(emb, 5);
          kbText = Array.isArray(hits) ? hits.map(h => h?.content).filter(Boolean).join("\n") : "";
        }
      }
    } catch (e) {
      console.warn("[ask] RAG warn:", e);
    }

    // Prompt estilo mozo (voseo, conciso, sin inventar)
    const systemPrompt = `
Sos “Paniquiños Bot”, el mozo digital de una confitería en Paraguay.
Tono: cálido, cercano y profesional (voseo). Soná natural, no robótico.
Usá 0–2 emojis cuando sumen (😊🥟). No abuses.
Reglas:
- Respondé SIEMPRE en español.
- Usá SOLO negocioInfo, productos y KB provistos. Si no está, decí que no tenés ese dato.
- Precios con formato "99.999 Gs".
- Si hay promo activa y es pertinente, mencionála UNA vez y seguí.
- Sé breve (1–3 frases); si listás, bullets de hasta 5 ítems máx.
- No inventes sabores/tamaños/disponibilidad.
Contexto negocioInfo:
${JSON.stringify(info, null, 2)}
Productos relevantes (coincidencias + catálogo):
${JSON.stringify(subset, null, 2)}
Promos activas:
${JSON.stringify(promos, null, 2)}
${kbText ? `KB verificada:\n${kbText}` : ""}
`.trim();

    const llmMessages = [{ role: "system", content: systemPrompt }, ...messages];

    let reply;
    try {
      reply = await openaiChat(llmMessages, 0.5, "gpt-4o-mini");
      if (!reply) reply = "Ahora mismo no tengo ese dato exacto, pero te puedo sugerir algo 😊";
    } catch (e) {
      console.error("[/api/ask] LLM error:", e);
      reply = "Estoy con un problemita para responder completo 🙈. ¿Querés que te recomiende algo del menú?";
    }

    const rich = {};
    if (promos.length) rich.promos = promos;
    if (matched.length) {
      // devolvemos coincidencias para botoncitos “Agregar”
      rich.products = matched.slice(0, 8).map(p => ({
        id: p.id, nombre: p.nombre, precio: Number(p.precio || 0), imagen: p.imagen || null
      }));
    }

    return json({ reply, rich }, 200);

  } catch (e) {
    console.error("[/api/ask] ERROR:", e);
    return json({ reply: "El asistente no está disponible ahora. Probá de nuevo en un rato." }, 200);
  }
}
