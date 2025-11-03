// public/JS/script-chatbot.js (cargar con type="module")
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody       = document.getElementById("chat-body");
  const chatForm       = document.getElementById("chat-form");
  const chatInput      = document.getElementById("chat-input");
  const toggler        = document.querySelector(".chatbot-toggler");

  // ===== Estado de la conversación =====
  const STATE_KEY = "paniq.chat.state";
  const loadState  = () => JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}");
  const saveState  = (s) => sessionStorage.setItem(STATE_KEY, JSON.stringify(s || {}));

  // ===== UI helpers =====
  const appendMessage = (text, sender = "bot") => {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    
    // Convertir markdown básico a HTML
    const html = text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    
    msg.innerHTML = `<p>${html}</p>`;
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
    if (h < 12) return "¡Buenos días! 🌅 Soy el asistente de Paniquiños. ¿Qué te gustaría pedir hoy?";
    if (h < 19) return "¡Hola! 👋 Soy el asistente de Paniquiños. ¿En qué puedo ayudarte?";
    return "¡Buenas noches! 🌙 Soy el asistente de Paniquiños. ¿Qué se te antoja?";
  };

  // ===== Toggle panel =====
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) {
      setTimeout(() => chatInput.focus(), 150);
    }
  });

  // ===== Mensaje inicial =====
  const state = loadState();
  if (!state.history || state.history.length === 0) {
    appendMessage(saludo(), "bot");
  } else {
    // Restaurar historial visible (últimos 5 mensajes)
    const recent = state.history.slice(-5);
    recent.forEach(msg => {
      appendMessage(msg.content, msg.role === "user" ? "user" : "bot");
    });
  }

  // ===== Ejecutores de acciones de carrito =====
  async function runAction(action) {
    if (!action || !window.CartAPI) return null;

    try {
      switch (action.type) {
        case "ADD_TO_CART": {
          await window.CartAPI.addProduct(action.product, action.qty || 1);
          await window.CartAPI.refreshBadge?.();
          // El feedback lo da el backend directamente
          return null;
        }
        case "REMOVE_FROM_CART": {
          await window.CartAPI.removeProduct?.(action.product, action.qty || 1);
          await window.CartAPI.refreshBadge?.();
          return null;
        }
        case "GET_CART_TOTAL": {
          // Ya el backend responde con el total
          return null;
        }
        default:
          return null;
      }
    } catch (e) {
      console.error("Cart action error:", e);
      return "Hubo un problema con el carrito. Intentá de nuevo.";
    }
  }

  // ===== Envío de mensaje =====
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
          state,
        }),
      });

      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("HTTP", res.status, data);
        appendMessage("⚠️ Disculpá, hubo un problema. Intentá de nuevo por favor.", "bot");
        return;
      }

      // Ejecutar acción de carrito si existe
      if (data.action) {
        const feedback = await runAction(data.action);
        if (feedback) {
          appendMessage(feedback, "bot");
        }
      }

      // Mostrar respuesta del bot
      if (data.reply) {
        appendMessage(data.reply, "bot");
      }

      // Guardar estado actualizado
      if (data.state) {
        saveState(data.state);
      }

    } catch (err) {
      console.error("Chat error:", err);
      hideLoader();
      appendMessage("⚠️ No pude conectarme. Verificá tu conexión e intentá de nuevo.", "bot");
    }
  });

  // ===== Enter para enviar =====
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  // ===== Sugerencias rápidas (opcional) =====
  const suggestions = [
    "¿Qué empanadas tienen?",
    "Mostrame el total",
    "¿Tienen tortas?",
    "Agregame 2 alfajores"
  ];

  // Podrías agregar botones de sugerencias si querés
  function showSuggestions() {
    const suggDiv = document.createElement("div");
    suggDiv.className = "suggestions";
    suggDiv.innerHTML = suggestions
      .map(s => `<button class="suggestion-btn">${s}</button>`)
      .join("");
    chatBody.appendChild(suggDiv);
    
    suggDiv.querySelectorAll(".suggestion-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        chatInput.value = btn.textContent;
        chatForm.requestSubmit();
        suggDiv.remove();
      });
    });
  }

  // Mostrar sugerencias al inicio si no hay historial
  if (!state.history || state.history.length === 0) {
    setTimeout(showSuggestions, 1000);
  }
});