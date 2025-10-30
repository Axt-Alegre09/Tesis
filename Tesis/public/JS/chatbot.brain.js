// NO usar imports aquí (este archivo se carga como script normal).
// Se inicializa desde script-chatbot.js con ChatBrain.init(supabase)

(function () {
  const KEYWORDS = [
    "empanada", "empanadas", "torta", "tortas",
    "alfajor", "alfajores", "combo", "combos",
    "coca", "sandwich", "milanesa", "pan", "bocadito", "bocaditos"
  ];

  const greetingTriggers = ["hola", "buenas", "hey", "qué tal", "buen día"];
  const thanksTriggers = ["gracias", "muchas gracias", "te agradezco"];

  let supa = null;
  function setClient(client) { supa = client; }

  async function searchProducts(term, limit = 8) {
    if (!supa) return [];
    // Busca por coincidencia en nombre y sólo activos
    const { data, error } = await supa
      .from("productos")
      .select("nombre, precio")
      .ilike("nombre", `%${term}%`)
      .eq("activo", true)
      .limit(limit);

    if (error) {
      console.warn("searchProducts error:", error);
      return [];
    }
    return data ?? [];
  }

  function formatList(items) {
    if (!items.length) return null;
    const lines = items.map(p => `- **${p.nombre}** — ${Number(p.precio).toLocaleString('es-PY')} Gs`);
    return lines.join("\n");
  }

  async function handleMessage(text) {
    const lower = (text || "").toLowerCase().trim();

    // Saludos
    if (greetingTriggers.some(w => lower.includes(w))) {
      return { text: "¡Hola! 😊 ¿Qué te gustaría saber: tortas, empanadas, alfajores o combos?" };
    }

    // Agradecimientos
    if (thanksTriggers.some(w => lower.includes(w))) {
      return { text: "¡De nada! 🧁 Cualquier otra cosita, acá estoy." };
    }

    // Horarios (respuesta directa y amable, sin “no tengo info”)
    if (/(hora|abren|abiertos|cierre|apertura)/.test(lower)) {
      return { text: "Atendemos de **lunes a sábado de 08:00 a 19:00** 🕓. ¡Te esperamos!" };
    }

    // Detección de producto -> consulta a BD
    const matched = KEYWORDS.find(k => lower.includes(k));
    if (matched) {
      const results = await searchProducts(matched);
      if (results.length) {
        const list = formatList(results);
        return {
          text:
`En **${matched}** tengo:
${list}

¿Querés que te recomiende algo o te paso otros similares? 😊`
        };
      }
      // Si no hay coincidencias exactas, no negamos: ofrecemos alternativas
      return {
        text:
`No encontré coincidencias exactas con **${matched}** en el catálogo ahora mismo.
Puedo sugerirte opciones similares o buscar por otro nombre. ¿Qué te gustaría? 🙂`
      };
    }

    // Si no hay match, que lo atienda el backend (/api/ask)
    return null;
  }

  window.ChatBrain = { init: setClient, handleMessage };
})();
