// public/JS/script-chatbot.js (cargar con type="module")
// Versión 2.0 - Soporte para múltiples acciones y mejor manejo de estado

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody       = document.getElementById("chat-body");
  const chatForm       = document.getElementById("chat-form");
  const chatInput      = document.getElementById("chat-input");
  const toggler        = document.querySelector(".chatbot-toggler");

  // ===== Estado de la conversación =====
  const STATE_KEY = "paniq.chat.state.v2";
  
  const loadState = () => {
    try {
      const stored = sessionStorage.getItem(STATE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      // Validar que el estado no sea muy viejo (más de 30 min)
      const lastUpdate = parsed._lastUpdate || 0;
      if (Date.now() - lastUpdate > 30 * 60 * 1000) {
        sessionStorage.removeItem(STATE_KEY);
        return {};
      }
      return parsed;
    } catch {
      return {};
    }
  };
  
  const saveState = (s) => {
    try {
      s._lastUpdate = Date.now();
      sessionStorage.setItem(STATE_KEY, JSON.stringify(s || {}));
    } catch (e) {
      console.warn("No se pudo guardar el estado:", e);
    }
  };

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
    const existing = document.getElementById("loader");
    if (existing) return;
    
    const loader = document.createElement("div");
    loader.id = "loader";
    loader.className = "msg bot loading";
    loader.innerHTML = "<p>Escribiendo…</p>";
    chatBody.appendChild(loader);
    chatBody.scrollTop = chatBody.scrollHeight;
  };
  
  const hideLoader = () => {
    const loader = document.getElementById("loader");
    if (loader) loader.remove();
  };

  const saludo = () => {
    const h = new Date().getHours();
    if (h < 12) return "¡Buenos días! 🌅 Soy el asistente de Paniquiños. ¿Qué te gustaría hoy?";
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
    // Restaurar historial visible (últimos 6 mensajes)
    const recent = state.history.slice(-6);
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
          return null;
        }
        
        case "MULTIPLE": {
          // Procesar múltiples acciones
          for (const subAction of (action.actions || [])) {
            await runAction(subAction);
          }
          return null;
        }
        
        case "REMOVE_FROM_CART": {
          await window.CartAPI.removeProduct?.(action.product, action.qty || 1);
          await window.CartAPI.refreshBadge?.();
          return null;
        }
        
        case "CATERING_AGENDADO": {
          // Podrías mostrar una notificación especial o confetti 🎉
          console.log("✅ Catering agendado:", action.data);
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

    // Deshabilitar input mientras procesa
    chatInput.disabled = true;
    const submitBtn = chatForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      const currentState = loadState();

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          state: currentState,
        }),
      });

      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("HTTP", res.status, data);
        appendMessage("⚠️ Disculpá, hubo un problema. Intentá de nuevo.", "bot");
        return;
      }

      // Ejecutar acciones del carrito si existen
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
    } finally {
      // Re-habilitar input
      chatInput.disabled = false;
      if (submitBtn) submitBtn.disabled = false;
      chatInput.focus();
    }
  });

  // ===== Enter para enviar =====
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });

  // ===== Sugerencias rápidas =====
  const suggestions = [
    "¿Qué empanadas tienen?",
    "Quiero agendar un catering",
    "Dame 2 empanadas de carne",
    "¿Cuál es el horario?"
  ];

  function showSuggestions() {
    // Evitar mostrar si ya hay sugerencias
    if (chatBody.querySelector('.suggestions')) return;
    
    const suggDiv = document.createElement("div");
    suggDiv.className = "suggestions";
    suggDiv.innerHTML = suggestions
      .map(s => `<button class="suggestion-btn">${s}</button>`)
      .join("");
    chatBody.appendChild(suggDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
    
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
    setTimeout(showSuggestions, 800);
  }
  
  // ===== Botón para limpiar chat =====
  // Podrías agregar un botón en el header del chat que llame a esto
  window.clearChatHistory = () => {
    sessionStorage.removeItem(STATE_KEY);
    chatBody.innerHTML = '';
    appendMessage(saludo(), "bot");
    setTimeout(showSuggestions, 500);
  };
});