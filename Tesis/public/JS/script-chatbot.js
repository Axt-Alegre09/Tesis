(() => {
  // Elementos del DOM
  const chatInput = document.querySelector(".chat-input textarea");
  const sendChatBtn = document.querySelector(".chat-input i");
  const chatbox = document.querySelector(".chatbox");
  const chatbotCloseBtn = document.querySelector(".close-btn");
  const chatbotToggler = document.querySelector(".chatbot-toggler");

 const CHAT_ENDPOINT = "/api/chat";


  // Historial para dar contexto al modelo
  const MESSAGES = [];
  let userMessage = "";
  const inputIniHeight = chatInput ? chatInput.scrollHeight : 0;

  // Utilidad: crea <li> entrante/saliente
  function createChatLi(message, className) {
    const li = document.createElement("li");
    li.classList.add("chat", className);

    if (className === "incoming") {
      const img = document.createElement("img");
      img.className = "paniImg";
      img.alt = "";
      img.src =
        "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinosico.ico";
      li.appendChild(img);
    }

    const p = document.createElement("p");
    p.textContent = message;
    li.appendChild(p);
    return li;
  }

  // Llamada al backend (serverless/express) para obtener respuesta del bot
  async function generateResponse(incomingLi) {
    const messageElement = incomingLi.querySelector("p");
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: MESSAGES })
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();
      messageElement.textContent = data?.reply || "Lo siento, no pude responder ahora.";
    } catch (err) {
      console.error("[chatbot] Error:", err);
      messageElement.textContent = "Oops, ocurrió un error. Intenta de nuevo.";
    } finally {
      chatbox?.scrollTo(0, chatbox.scrollHeight);
      // Rehabilitamos el botón enviar si lo deshabilitamos
      sendChatBtn?.removeAttribute("aria-disabled");
      sendChatBtn?.classList.remove("disabled");
    }
  }

  // Maneja el envío del mensaje del usuario
  function handleChat() {
    if (!chatInput) return;
    userMessage = (chatInput.value || "").trim();
    if (!userMessage) return;

    // Limpia y reajusta textarea
    chatInput.value = "";
    if (inputIniHeight) chatInput.style.height = `${inputIniHeight}px`;

    // Muestra el mensaje del usuario
    chatbox?.append(createChatLi(userMessage, "outgoing"));
    chatbox?.scrollTo(0, chatbox.scrollHeight);

    // Guarda en historial (limitamos a últimas 20 entradas por prolijidad)
    MESSAGES.push({ role: "user", content: userMessage });
    if (MESSAGES.length > 20) MESSAGES.splice(0, MESSAGES.length - 20);

    // Deshabilita el botón mientras carga para evitar spam
    sendChatBtn?.setAttribute("aria-disabled", "true");
    sendChatBtn?.classList.add("disabled");

    // Muestra “Cargando…” y llama al backend
    setTimeout(() => {
      const incomingLi = createChatLi("Cargando...", "incoming");
      chatbox?.appendChild(incomingLi);
      chatbox?.scrollTo(0, chatbox.scrollHeight);
      generateResponse(incomingLi);
    }, 200);
  }

  // Auto-resize del textarea
  chatInput?.addEventListener("input", () => {
    chatInput.style.height = `${inputIniHeight}px`;
    chatInput.style.height = `${chatInput.scrollHeight}px`;
  });

  // Enviar con Enter (sin Shift) en pantallas > 800px
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
      e.preventDefault();
      handleChat();
    }
  });

  // Click en el botón de enviar
  sendChatBtn?.addEventListener("click", handleChat);

  // Mostrar / ocultar chat
  chatbotToggler?.addEventListener("click", () => {
    document.body.classList.toggle("show-chatbot");
  });
  chatbotCloseBtn?.addEventListener("click", () => {
    document.body.classList.remove("show-chatbot");
  });
})();
