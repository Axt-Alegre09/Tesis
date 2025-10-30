// /public/JS/script-chatbot.js
document.addEventListener("DOMContentLoaded", () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  // ====== ANIMACIÓN DE APERTURA / CIERRE ======
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) {
      setTimeout(() => chatInput.focus(), 200);
    }
  });

  // ====== FUNCIÓN PARA AGREGAR MENSAJES ======
  function appendMessage(text, sender = "bot", delay = 0) {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    msg.innerHTML = `<p>${text}</p>`;
    setTimeout(() => {
      chatBody.appendChild(msg);
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }, delay);
  }

  // ====== FUNCIÓN DE LOADING ======
  function showLoader() {
    const loader = document.createElement("div");
    loader.className = "msg bot loading";
    loader.id = "loader";
    loader.innerHTML = `<p><i class="bi bi-three-dots"></i> Escribiendo...</p>`;
    chatBody.appendChild(loader);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }

  function hideLoader() {
    document.getElementById("loader")?.remove();
  }

  // ====== MENSAJE DE BIENVENIDA ======
  appendMessage("¡Hola! 👋 Soy *Paniquiños Bot*. ¿Qué te gustaría saber hoy?", "bot", 300);

  // ====== ENVÍO DE MENSAJE ======
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      // === 1️⃣ Intentar respuesta local con ChatBrain ===
      const localResponse = await window.ChatBrain.handleMessage(text);
      if (localResponse) {
        hideLoader();
        appendMessage(localResponse.text, "bot", 300);
        return;
      }

      // === 2️⃣ Consultar al backend (OpenAI vía /api/ask) ===
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("❌ Error HTTP:", data);
        appendMessage("😓 No pude procesar tu mensaje ahora. Intentá más tarde.", "bot");
        return;
      }

      appendMessage(data.reply || "No pude responder ahora mismo 😅", "bot", 200);
    } catch (err) {
      console.error("💥 Error general en chatbot:", err);
      hideLoader();
      appendMessage("⚠️ Ocurrió un problema de conexión. Revisá tu red o intentá de nuevo.", "bot");
    }
  });

  // ====== DETECTAR ENTER ======
  chatInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
