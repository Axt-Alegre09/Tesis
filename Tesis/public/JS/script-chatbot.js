// JS/script-chatbot.js
// Chat flotante: NLU local + reservas + backend de IA con respuestas naturales.
(() => {
  // 👉 Ahora apuntamos al endpoint de IA que hiciste:
  const CHAT_ENDPOINT = "/api/ask";

  // ---- Nodos ----
  const $ = (sel) => document.querySelector(sel);
  const chatInput       = $(".chat-input textarea");
  const sendChatBtn     = $(".chat-input i");
  const chatbox         = $(".chatbox");
  const chatbotCloseBtn = $(".close-btn");
  const chatbotToggler  = $(".chatbot-toggler");

  if (!chatInput || !sendChatBtn || !chatbox) {
    console.warn("[chatbot] Falta markup del chat.");
    return;
  }

  // ---- Helpers UI ----
  const inputIniHeight = chatInput.scrollHeight || 0;

  function createChatLiHTML(html, className) {
    const li = document.createElement("li");
    li.classList.add("chat", className);

    if (className === "incoming") {
      const img = document.createElement("img");
      img.className = "paniImg";
      img.alt = "";
      img.src = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinosico.ico";
      li.appendChild(img);
    }

    const bubble = document.createElement("div");
    bubble.className = "msg";
    bubble.innerHTML = html; // ← Render rico (ya sanitizado/transformado)
    li.appendChild(bubble);
    return li;
  }

  function appendIncomingHTML(html) {
    chatbox.append(createChatLiHTML(html, "incoming"));
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  function appendOutgoing(text) {
    const safe = escapeHTML(text);
    chatbox.append(createChatLiHTML(`<p>${safe}</p>`, "outgoing"));
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  function setSending(on) {
    if (!sendChatBtn) return;
    on ? (sendChatBtn.setAttribute("aria-disabled", "true"), sendChatBtn.classList.add("disabled"))
       : (sendChatBtn.removeAttribute("aria-disabled"), sendChatBtn.classList.remove("disabled"));
  }

  // ---- Mini markdown seguro (negritas, listas, saltos) ----
  const escapeHTML = (s="") =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  function mdLiteToHTML(text="") {
    // 1) escapar
    let t = escapeHTML(text);

    // 2) **negritas** y *itálicas*
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // 3) listas (- o • al inicio de línea)
    // separar por líneas y agrupar en <ul>
    const lines = t.split(/\r?\n/);
    const chunks = [];
    let listOpen = false;
    for (const line of lines) {
      const m = line.match(/^\s*(?:-|•)\s+(.*)$/);
      if (m) {
        if (!listOpen) { chunks.push("<ul>"); listOpen = true; }
        chunks.push(`<li>${m[1]}</li>`);
      } else {
        if (listOpen) { chunks.push("</ul>"); listOpen = false; }
        if (line.trim()) chunks.push(`<p>${line}</p>`);
        else chunks.push("<br/>");
      }
    }
    if (listOpen) chunks.push("</ul>");
    let html = chunks.join("");

    // 4) enlaces “http…”
    html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    return html;
  }

  // ---- Esperita para scripts de reservas ----
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

  // ---- Backend IA ----
  async function askBackendNatural(question) {
    if (!CHAT_ENDPOINT) return { ok:false, text:null };
    try {
      // usamos GET con query param ?question=
      const url = `${CHAT_ENDPOINT}?question=${encodeURIComponent(question)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      const data = await res.json();
      const text = data?.reply || "No tengo respuesta ahora.";
      return { ok:true, text };
    } catch (e) {
      console.error("[chatbot] backend error:", e);
      return { ok:false, text:"Oops, ocurrió un error. Intenta de nuevo." };
    }
  }

  // ---- Manejo principal ----
  async function handleChat() {
    const userMessage = (chatInput.value || "").trim();
    if (!userMessage) return;

    // Reset textarea
    chatInput.value = "";
    if (inputIniHeight) chatInput.style.height = `${inputIniHeight}px`;

    // Mensaje del usuario
    appendOutgoing(userMessage);

    // 1) NLU local: carrito/catálogo
    try {
      const local = await (window.ChatBrain?.handleMessage?.(userMessage));
      if (local && local.text) {
        appendIncomingHTML(mdLiteToHTML(local.text));
        return;
      }
    } catch (e) { console.warn("[chatbot] ChatBrain error:", e); }

    // 2) Reservas catering
    try {
      const ChatCatering = await waitFor(() => window.ChatCatering?.handle);
      if (ChatCatering) {
        const res = await window.ChatCatering.handle(userMessage);
        if (res && res.text) {
          appendIncomingHTML(mdLiteToHTML(res.text));
          return;
        }
      }
    } catch (e) { console.warn("[chatbot] ChatCatering error:", e); }

    // 3) Backend IA con estilo natural
    setSending(true);
    const loading = createChatLiHTML(`<p>Escribiendo…</p>`, "incoming");
    chatbox.appendChild(loading);
    chatbox.scrollTop = chatbox.scrollHeight;

    const { ok, text } = await askBackendNatural(userMessage);
    loading.querySelector(".msg").innerHTML =
      mdLiteToHTML(text || (ok ? "No tengo respuesta ahora." : "Oops, ocurrió un error."));

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
