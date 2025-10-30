// /public/JS/script-chatbot.js
// Nota: este archivo se carga con <script type="module"> en index.html.
// Evitá importarlo dos veces para no ver el warning de múltiples GoTrueClient.

document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  // UI helpers
  const appendMessage = (text, who = "bot") => {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.innerHTML = `<p>${text}</p>`;
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  };
  const setLoading = (on) => {
    if (on) {
      const el = document.createElement("div");
      el.id = "chat-loader";
      el.className = "msg bot";
      el.innerHTML = `<p><span class="dots">Escribiendo…</span></p>`;
      chatBody.appendChild(el);
      chatBody.scrollTop = chatBody.scrollHeight;
    } else {
      document.getElementById("chat-loader")?.remove();
    }
  };

  // Apertura / cierre
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) {
      setTimeout(() => chatInput.focus(), 150);
    }
  });

  // Mensaje de bienvenida (no llames a Supabase aquí para evitar el warning)
  const saludo = (() => {
    const h = new Date().getHours();
    if (h < 12) return "☀️ ¡Buenos días!";
    if (h < 19) return "🌞 ¡Buenas tardes!";
    return "🌙 ¡Buenas noches!";
  })();
  appendMessage(`${saludo} Soy *Paniquiños Bot*. ¿Te ayudo a elegir algo del menú hoy?`);

  // Envío
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    appendMessage(text, "user");
    chatInput.value = "";
    setLoading(true);

    try {
      // 1) intento “local” mínimo (saludo / gracias)
      const lower = text.toLowerCase();
      if (["hola", "buenas", "hey"].some((w) => lower.includes(w))) {
        setLoading(false);
        appendMessage("¡Hola! 😊 ¿Qué te gustaría saber: tortas, empanadas, alfajores o combos?");
        return;
      }
      if (lower.includes("gracias")) {
        setLoading(false);
        appendMessage("¡De nada! 🧁");
        return;
      }

      // 2) backend con RAG + búsqueda de productos
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        appendMessage("No pude responder ahora mismo 😅. ¿Podés repetir en pocas palabras?");
        console.error("ask error:", data);
        return;
      }
      appendMessage(data.reply || "Hmm… no estoy seguro. ¿Podés reformular?");
    } catch (err) {
      setLoading(false);
      console.error("chat error:", err);
      appendMessage("Hubo un problema de conexión 😓. Probá de nuevo.");
    }
  });

  // Enter para enviar
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
