// public/JS/script-chatbot.js  (cargar con type="module")
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody       = document.getElementById("chat-body");
  const chatForm       = document.getElementById("chat-form");
  const chatInput      = document.getElementById("chat-input");
  const toggler        = document.querySelector(".chatbot-toggler");

  // ===== Supabase solo para saludo opcional =====
  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===== Memoria de charla (contexto corto) =====
  const STATE_KEY = "paniq.chat.state";
  const loadState  = () => JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
  const saveState  = (s) => sessionStorage.setItem(STATE_KEY, JSON.stringify(s || {}));

  // ===== UI helpers =====
  const appendMessage = (text, sender = "bot") => {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    msg.innerHTML = `<p>${text}</p>`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  };

  const showLoader = () => {
    const loader = document.createElement("div");
    loader.id = "loader";
    loader.className = "msg bot loading";
    loader.innerHTML = "<p>Escribiendo…</p>";
    chatBody.appendChild(loader);
    chatBody.scrollTop = chatBody.scrollHeight;
  };
  const hideLoader = () => document.getElementById("loader")?.remove();

  const saludo = () => {
    const h = new Date().getHours();
    if (h < 12) return "Hola. ¿Qué necesitás?";
    if (h < 19) return "Hola. ¿En qué puedo ayudarte hoy?";
    return "Hola. ¿Qué te paso por acá?";
  };

  // ===== Toggle panel =====
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) setTimeout(() => chatInput.focus(), 150);
  });

  // ===== Mensaje inicial mínimo =====
  appendMessage(saludo(), "bot");

  // ===== Ejecutores de acciones de carrito =====
  async function runAction(action) {
    if (!action || !window.CartAPI) return null;

    try {
      switch (action.type) {
        case "ADD_TO_CART": {
          await window.CartAPI.addProduct(action.product, action.qty || 1);
          await window.CartAPI.refreshBadge?.();
          return `Agregué ${action.qty || 1}× ${action.product?.nombre}.`;
        }
        case "REMOVE_FROM_CART": {
          await window.CartAPI.removeProduct?.(action.product, action.qty || 1);
          await window.CartAPI.refreshBadge?.();
          return `Quité ${action.qty || 1}× ${action.product?.nombre}.`;
        }
        case "GET_CART_TOTAL": {
          const total = await window.CartAPI.getTotal?.();
          return `Total: ${new Intl.NumberFormat("es-PY").format(Number(total || 0))} Gs.`;
        }
        default:
          return null;
      }
    } catch (e) {
      console.error("Cart action error:", e);
      return "No pude completar la acción del carrito.";
    }
  }

  // ===== Envío =====
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      const state = loadState();

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          state, // <- enviamos memoria de charla
        }),
      });

      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("HTTP", res.status, data);
        appendMessage("⚠️ Ocurrió un problema. Probá de nuevo.", "bot");
        return;
      }

      // Si vino acción, la ejecutamos y mostramos el resultado “dentro del chat”
      if (data.action) {
        const feedback = await runAction(data.action);
        if (feedback) {
          appendMessage(feedback, "bot");
        }
      }

      // Respuesta natural del bot
      if (data.reply) appendMessage(data.reply, "bot");

      // Guardar estado nuevo si viene
      if (data.state) saveState(data.state);
    } catch (err) {
      console.error("Chat error:", err);
      hideLoader();
      appendMessage("⚠️ Ocurrió un problema de conexión. Probá de nuevo.", "bot");
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
