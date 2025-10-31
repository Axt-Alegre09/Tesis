/* JS/chatbot.brain.js
   Cerebro local: cubre saludos / gracias / horarios / categorías frecuentes,
   devuelve { text, action?, payload? } o null para delegar al backend.
*/
window.ChatBrain = (() => {
  const norm = (s) => (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  // mapa de palabras → slug de tu UI
  const CAT_ALIASES = [
    { slug: "bocaditos",   keys: ["bocadito", "bocaditos", "saladitos", "chipitas"] },
    { slug: "confiteria",  keys: ["confiteria", "confitería", "dulces", "alfajor", "alfajores"] },
    { slug: "panificados", keys: ["pan", "panes", "panificados"] },
    { slug: "rosticeria",  keys: ["rosticeria", "rostiseria", "rosticería", "rostisería", "empanada", "empanadas"] },
    { slug: "tortas",      keys: ["torta", "tortas", "minitorta", "mini torta"] },
    { slug: "combos",      keys: ["combo", "combos"] },
  ];

  function detectCategorySlug(q) {
    const t = norm(q);
    for (const { slug, keys } of CAT_ALIASES) {
      if (keys.some(k => t.includes(k))) return slug;
    }
    return null;
  }

  const intents = [
    {
      match: (t) => /\b(hola|buenas|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(t),
      reply: () => "¡Hola! 😊 Soy *Paniquiños Bot*. ¿Buscás *tortas*, *empanadas*, *alfajores*, *combos* u otra cosita?"
    },
    {
      match: (t) => /\b(gracias|gracia|thank)\b/.test(t),
      reply: () => "¡De nada! 💛 Si querés, te muestro rápido por categoría."
    },
    {
      match: (t) => /\b(horario|hora|abren|cierran|abierto|abiertos)\b/.test(t),
      reply: () => "Abrimos de lunes a sábado de 08:00 a 19:00 🕓. ¿Querés ver algo del menú?"
    },
    {
      match: (t) => !!detectCategorySlug(t),
      reply: (_t) => {
        const slug = detectCategorySlug(_t);
        return { text: "Dale, te muestro esa categoría 👇", action: "show_category", payload: { slug } };
      }
    },
  ];

  async function handleMessage(text) {
    const t = norm(text);
    for (const i of intents) {
      if (i.match(t)) {
        const r = i.reply(t);
        if (typeof r === "object") return r;
        return { text: r };
      }
    }
    return null;
  }

  return { handleMessage };
})();
