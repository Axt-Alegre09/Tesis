

/* Pequeño “cerebro” local: si entiende la intención, responde directo
   y evitamos llamar al backend innecesariamente. */
window.ChatBrain = (() => {
  const intents = [
    {
      match: (t) => /\b(hola|buenas|hey|qué tal)\b/.test(t),
      reply: () => "¡Hola! 😊 ¿Qué te gustaría saber: tortas, empanadas, alfajores o combos?"
    },
    {
      match: (t) => /\b(gracias|gracia|thank)\b/.test(t),
      reply: () => "¡De nada! 💛 ¿Te ayudo con algo más?"
    },
    {
      match: (t) => /\b(hora|abierto|abren|cierran)\b/.test(t),
      reply: () => "Abrimos de lunes a sábado de 08:00 a 19:00 🕓."
    },
  ];

  // Normalizador simple
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

  async function handleMessage(text) {
    const t = norm(text);

    // Intents rápidos
    for (const i of intents) if (i.match(t)) return { text: i.reply(t) };

    // Nada claro: que responda el backend
    return null;
  }

  return { handleMessage };
})();

