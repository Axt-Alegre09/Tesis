// /public/JS/script-chatbot.js
// Cargado con <script type="module"> en index.html

document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.getElementById("chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  // Sanitiza texto plano y soporta saltos de línea
  const renderText = (text) => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  };

  // UI helpers
  const appendMessage = (text, who = "bot") => {
    const el = document.createElement("div");
    el.className = `msg ${who}`;
    el.appendChild(renderText(text));
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  };
  const setLoading = (on) => {
    if (on) {
      const el = document.createElement("div");
      el.id = "chat-loader";
      el.className = "msg bot";
      el.appendChild(renderText("Escribiendo…"));
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

  // Bienvenida
  const saludo = (() => {
    const h = new Date().getHours();
    if (h < 12) return "☀️ ¡Buenos días!";
    if (h < 19) return "🌞 ¡Buenas tardes!";
    return "🌙 ¡Buenas noches!";
  })();
  appendMessage(`${saludo} Soy Paniquiños Bot. ¿Te ayudo a elegir algo del menú hoy?`);

  // Envío
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    setLoading(true);

    try {
      // Respuestas locales rápidas
      const lower = text.toLowerCase();
      if (["hola", "buenas", "hey"].some((w) => lower.includes(w))) {
        setLoading(false);
        appendMessage("¡Hola! 😊 ¿Querés ver empanadas, bocaditos, alfajores, tortas o combos?");
        return;
      }
      if (lower.includes("gracias")) {
        setLoading(false);
        appendMessage("¡De nada! 🧁");
        return;
      }

      // Backend (búsqueda de productos + RAG)
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        console.error("ask error:", data);
        appendMessage("No pude responder ahora mismo 😅. ¿Podés repetir en pocas palabras?");
        return;
      }

      appendMessage(String(data.reply || "Hmm… no estoy seguro. ¿Podés reformular?"));
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
