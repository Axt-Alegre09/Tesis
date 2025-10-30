(() => {
  const CHAT_ENDPOINT = "/api/ask";

  const $ = s => document.querySelector(s);
  const chatInput       = $(".chat-input textarea");
  const sendChatBtn     = $(".chat-input i");
  const chatbox         = $(".chatbox");
  const chatbotCloseBtn = $(".close-btn");
  const chatbotToggler  = $(".chatbot-toggler");

  if (!chatInput || !sendChatBtn || !chatbox) return;

  // —— Quick chips (se inyectan bajo el chatbox)
  const quickbar = document.createElement("div");
  quickbar.className = "quickbar";
  quickbar.innerHTML = `
    <button class="quick-chip" data-cmd="promos">Promos de hoy</button>
    <button class="quick-chip" data-cmd="ver total">Ver total</button>
    <button class="quick-chip" data-cmd="vaciar carrito">Vaciar carrito</button>
    <button class="quick-chip" data-cmd="catering">Catering</button>
  `;
  chatbox.after(quickbar);
  quickbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".quick-chip");
    if (!btn) return;
    chatInput.value = btn.dataset.cmd;
    sendChatBtn.click();
  });

  const inputIniHeight = chatInput.scrollHeight || 0;

  // —— Helpers de UI
  const escapeHTML = (s="") => s
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");

  function bubble(className, { text=null, html=null }) {
    const li = document.createElement("li");
    li.classList.add("chat", className);
    if (className === "incoming") {
      const img = document.createElement("img");
      img.className = "paniImg"; img.alt = "";
      img.src = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinosico.ico";
      li.appendChild(img);
    }
    const p = document.createElement("p");
    if (html) {
      p.classList.add("msg-card");
      p.innerHTML = html;
    } else {
      p.textContent = String(text ?? "");
    }
    li.appendChild(p);
    return li;
  }
  function appendIncomingText(text) {
    chatbox.append(bubble("incoming", { text }));
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  function appendIncomingHTML(html) {
    chatbox.append(bubble("incoming", { html }));
    chatbox.scrollTop = chatbox.scrollHeight;
  }
  function appendOutgoing(text) {
    chatbox.append(bubble("outgoing", { text }));
    chatbox.scrollTop = chatbox.scrollHeight;
  }

  function setSending(on) {
    if (!sendChatBtn) return;
    sendChatBtn.classList.toggle("disabled", !!on);
    if (on) sendChatBtn.setAttribute("aria-disabled","true");
    else    sendChatBtn.removeAttribute("aria-disabled");
  }

  async function askBackend(messages) {
    if (!CHAT_ENDPOINT) return { ok:false, text:null };
    try {
      const res = await fetch(CHAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ messages })
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return { ok:true, text: data?.reply || null, rich: data?.rich || null };
    } catch (e) {
      console.error("[chatbot] backend error:", e);
      return { ok:false, text:"Oops, ocurrió un error. Intenta de nuevo." };
    }
  }

  // —— Tarjetitas ricas (promos/productos)
  function renderPromos(promos=[]) {
    if (!promos.length) return;
    const html = `
      <h4>Promos activas</h4>
      <ul class="msg-list">
        ${promos.map(p => `<li><b>${escapeHTML(p.title)}</b> — ${escapeHTML(p.detail)}</li>`).join("")}
      </ul>
      <div class="msg-actions">
        ${promos.map(p => `<button class="btn-primary" data-payload="${escapeHTML(p.cta?.payload||"")}">${escapeHTML(p.cta?.text||"Ver")}</button>`).join("")}
      </div>
    `;
    appendIncomingHTML(html);
  }

  function renderProducts(products=[]) {
    if (!products.length) return;
    const html = `
      <h4>Te puede gustar</h4>
      <ul class="msg-list">
        ${products.slice(0,5).map(p => `
          <li>
            <b>${escapeHTML(p.nombre)}</b> — ${new Intl.NumberFormat("es-PY").format(p.precio)} Gs
            <div class="msg-actions">
              <button class="btn-ghost" data-add="${escapeHTML(p.id)}">Agregar</button>
            </div>
          </li>`).join("")}
      </ul>
    `;
    appendIncomingHTML(html);
  }

  // Acciones de los botones dentro de tarjetas:
  document.addEventListener("click", async (e) => {
    const add = e.target.closest("[data-add]");
    if (add && window.CartAPI?.addById) {
      try {
        await window.CartAPI.addById(add.dataset.add, 1);
        appendIncomingText("✅ Agregué ese producto al carrito.");
      } catch {
        appendIncomingText("No pude agregarlo ahora 🙈");
      }
    }
    const payload = e.target.closest("[data-payload]")?.dataset.payload;
    if (payload) {
      chatInput.value = payload;
      sendChatBtn.click();
    }
  });

  // —— Loop principal
  const MESSAGES = [];

  async function handleChat() {
    const userMessage = (chatInput.value||"").trim();
    if (!userMessage) return;

    chatInput.value = "";
    if (inputIniHeight) chatInput.style.height = `${inputIniHeight}px`;
    appendOutgoing(userMessage);

    // 1) NLU local (tu ChatBrain)
    try {
      const local = await (window.ChatBrain?.handleMessage?.(userMessage));
      if (local && (local.text || local.html || local.products || local.promos)) {
        if (local.text) appendIncomingText(local.text);
        if (local.promos?.length) renderPromos(local.promos);
        if (local.products?.length) renderProducts(local.products);
        return;
      }
    } catch (e){ console.warn("[chatbot] ChatBrain:", e); }

    // 2) Catering
    try {
      const ChatCatering = window.ChatCatering?.handle ? window.ChatCatering : null;
      if (ChatCatering) {
        const res = await window.ChatCatering.handle(userMessage);
        if (res && res.text) { appendIncomingText(res.text); return; }
      }
    } catch (e){ console.warn("[chatbot] ChatCatering:", e); }

    // 3) Backend
    MESSAGES.push({ role:"user", content:userMessage });
    if (MESSAGES.length > 20) MESSAGES.splice(0, MESSAGES.length - 20);

    setSending(true);
    const loading = bubble("incoming", { text:"…" });
    loading.classList.add("loading");
    loading.querySelector("p").textContent = "Escribiendo…";
    chatbox.appendChild(loading);
    chatbox.scrollTop = chatbox.scrollHeight;

    let ok=false, text=null, rich=null;
    try {
      const res = await askBackend(MESSAGES);
      ok = res.ok; text = res.text; rich = res.rich;
    } finally {
      loading.remove();
      setSending(false);
    }

    if (rich?.promos?.length) renderPromos(rich.promos);
    if (rich?.products?.length) renderProducts(rich.products);
    appendIncomingText(text || (ok ? "No tengo respuesta ahora." : "Oops, ocurrió un error."));
  }

  chatInput.addEventListener("input", () => {
    chatInput.style.height = `${inputIniHeight}px`;
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 120)}px`;
    chatbox.scrollTop = chatbox.scrollHeight;
  });
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 800) {
      e.preventDefault(); handleChat();
    }
  });
  sendChatBtn.addEventListener("click", handleChat);

  chatbotToggler?.addEventListener("click", () => {
    document.body.classList.toggle("show-chatbot");
  });
  $(".chatbot .close-btn")?.addEventListener("click", () => {
    document.body.classList.remove("show-chatbot");
  });
})();
