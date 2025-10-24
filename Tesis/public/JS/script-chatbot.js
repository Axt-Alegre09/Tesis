// JS/script-chatbot.js
// Chat flotante: envía mensajes, usa lógica local (ChatBrain) y reservas (ChatCatering),
// y si nada responde cae al backend opcional (CHAT_ENDPOINT).
(() => {
  // ---- Config opcional de backend (déjalo vacío si no usas servidor) ----
  const CHAT_ENDPOINT = "/api/chat"; // o "" para no usar backend

  // ---- Nodos (con defensas por si no existen) ----
  const $ = (sel) => document.querySelector(sel);
  const chatInput       = $(".chat-input textarea");
  const sendChatBtn     = $(".chat-input i");
  const chatbox         = $(".chatbox");
  const chatbotCloseBtn = $(".close-btn");
  const chatbotToggler  = $(".chatbot-toggler");

  if (!chatInput || !sendChatBtn || !chatbox) {
    console.warn("[chatbot] Falta markup del chat. Revisa el HTML.");
    return; // salimos silenciosamente
  }

  // ---- Utiles ----
  const inputIniHeight = chatInput.scrollHeight || 0;

  function createChatLi(message, className) {
    const li = document.createElement("li");
    li.classList.add("chat", className);

    if (className === "incoming") {
      const img = document.createElement("img");
      img.className = "paniImg";
      img.alt = "";
      img.src = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinosico.ico";
      li.appendChild(img);
    }
    const p = document.createElement("p");
    p.textContent = String(message ?? "");
    li.appendChild(p);
    return li;
  }

  function appendIncoming(text) {
    chatbox.append(createChatLi(text, "incoming"));
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  function appendOutgoing(text) {
    chatbox.append(createChatLi(text, "outgoing"));
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  function setSending(on) {
    if (!sendChatBtn) return;
    if (on) {
      sendChatBtn.setAttribute("aria-disabled", "true");
      sendChatBtn.classList.add("disabled");
    } else {
      sendChatBtn.removeAttribute("aria-disabled");
      sendChatBtn.classList.remove("disabled");
    }
  }

  // Espera hasta que fn() devuelva algo truthy (o se acabe el timeout)
  function waitFor(fn, { interval = 50, timeout = 800 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        try {
          const v = fn();
          if (v) return resolve(v);
        } catch {}
        if (Date.now() - start >= timeout) return resolve(null);
        setTimeout(tick, interval);
      };
      tick();
    });
  }

  // ---- Backend opcional ----
  async function askBackend(messages) {
    if (!CHAT_ENDPOINT) return { ok: false, text: null };
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return { ok: true, text: data?.reply || null };
    } catch (e) {
      console.error("[chatbot] backend error:", e);
      return { ok: false, text: "Oops, ocurrió un error. Intenta de nuevo." };
    }
  }

  // ---- Manejo principal ----
  const MESSAGES = [];

  async function handleChat() {
    const userMessage = (chatInput.value || "").trim();
    if (!userMessage) return;

    // Reset textarea
    chatInput.value = "";
    if (inputIniHeight) chatInput.style.height = `${inputIniHeight}px`;

    // Pinta salida del usuario
    appendOutgoing(userMessage);

    // 1) Intento NLU local (carrito/catálogo)
    try {
      const local = await (window.ChatBrain?.handleMessage?.(userMessage));
      if (local && local.text) {
        appendIncoming(local.text);
        return;
      }
    } catch (e) {
      console.warn("[chatbot] ChatBrain error:", e);
      // seguimos…
    }

    // 2) Intento reservas catering (espera breve por si el script aún carga)
    try {
      const ChatCatering = await waitFor(() => window.ChatCatering?.handle);
      if (ChatCatering) {
        const res = await window.ChatCatering.handle(userMessage);
        if (res && res.text) {
          appendIncoming(res.text);
          return;
        }
      }
    } catch (e) {
      console.warn("[chatbot] ChatCatering error:", e);
      // seguimos…
    }

    // 3) Backend (si está configurado)
    MESSAGES.push({ role: "user", content: userMessage });
    if (MESSAGES.length > 20) MESSAGES.splice(0, MESSAGES.length - 20);

    setSending(true);
    const loadingLi = createChatLi("Cargando...", "incoming");
    chatbox.appendChild(loadingLi);
    chatbox.scrollTop = chatbox.scrollHeight;

    const { ok, text } = await askBackend(MESSAGES);
    loadingLi.querySelector("p").textContent =
      text || (ok ? "No tengo respuesta ahora." : "Oops, ocurrió un error. Intenta de nuevo.");

    setSending(false);
  }

  // ---- Listeners ----
  chatInput.addEventListener("input", () => {
    chatInput.style.height = `${inputIniHeight}px`;
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    chatbox.scrollTop = chatbox.scrollHeight;
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
      e.preventDefault();
      handleChat();
    }
  });

  sendChatBtn.addEventListener("click", handleChat);

  chatbotToggler?.addEventListener("click", () => {
    document.body.classList.toggle("show-chatbot");
  });
  chatbotCloseBtn?.addEventListener("click", () => {
    document.body.classList.remove("show-chatbot");
  });
})();
