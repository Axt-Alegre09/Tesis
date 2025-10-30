// JS/script-chatbot.js
// Chat flotante: usa lógica local (ChatBrain) y reservas (ChatCatering).
// Si nada responde, consulta al backend semántico (/api/ask).
(() => {
  // ---- Endpoint del backend semántico ----
  // Si usas Vercel: /api/ask debe existir (ask.js).
  const CHAT_ENDPOINT = "/api/ask";

  // ---- Nodos ----
  const $ = (sel) => document.querySelector(sel);
  const chatInput       = $(".chat-input textarea");
  const sendChatBtn     = $(".chat-input i");
  const chatbox         = $(".chatbox");
  const chatbotCloseBtn = $(".close-btn");
  const chatbotToggler  = $(".chatbot-toggler");

  if (!chatInput || !sendChatBtn || !chatbox) {
    console.warn("[chatbot] Falta markup del chat. Revisa el HTML.");
    return;
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

  // ---- Backend semántico (/api/ask) ----
  async function askBackend(question) {
    if (!CHAT_ENDPOINT) return { ok: false, text: null };
    try {
      // /api/ask soportado como GET ?question=
      const url = `${CHAT_ENDPOINT}?question=${encodeURIComponent(question)}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      return { ok: true, text: parseAskResponse(data) };
    } catch (e) {
      console.error("[chatbot] backend error:", e);
      return { ok: false, text: "Oops, ocurrió un error. Intenta de nuevo." };
    }
  }

  // Interpreta la respuesta del /api/ask:
  // - Si viene {reply: "..."} lo usa directo
  // - Si viene array de matches [{content, similarity, meta...}], arma un texto útil
  function parseAskResponse(data) {
    // Caso 1: objeto con reply
    if (data && typeof data === "object" && !Array.isArray(data) && data.reply) {
      return String(data.reply);
    }

    // Caso 2: array de matches (kb_search)
    if (Array.isArray(data) && data.length) {
      const top = data[0];
      const txt = String(top.content ?? "").trim();

      // Intento extraer "Horarios: { ... }" si existe
      const m = txt.match(/Horarios:\s*({[\s\S]*?})/i);
      if (m) {
        try {
          const horarios = JSON.parse(m[1]);
          const map = {
            lun: "Lun", mar: "Mar", mie: "Mié", jue: "Jue",
            vie: "Vie", sab: "Sáb", dom: "Dom"
          };
          const lineas = Object.keys(map)
            .filter(k => k in horarios)
            .map(k => `${map[k]}: ${horarios[k]}`);
          if (lineas.length) {
            return "🕒 Horarios:\n" + lineas.join("\n");
          }
        } catch {}
      }

      // Si no hay horarios, devolvemos el contenido recortado
      if (txt) return txt.slice(0, 220) + (txt.length > 220 ? "…" : "");

      // Si no hay content, mostramos algo genérico
      return "Tengo información relacionada pero no pude formatearla. Probá preguntarme de otra forma (ej: “¿Abren los domingos?”).";
    }

    // Default
    return "No encontré información relacionada 😕";
  }

  // ---- Manejo principal ----
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
    }

    // 3) Backend semántico
    setSending(true);
    const loadingLi = createChatLi("Cargando...", "incoming");
    chatbox.appendChild(loadingLi);
    chatbox.scrollTop = chatbox.scrollHeight;

    const { ok, text } = await askBackend(userMessage);
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
