// public/JS/script-chatbot.js (cargar con type="module")
// Versión 2.2 - UX Mejorado estilo WhatsApp + Sincronización CartAPI

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody       = document.getElementById("chat-body");
  const chatForm       = document.getElementById("chat-form");
  const chatInput      = document.getElementById("chat-input");
  const toggler        = document.getElementById("chatToggler") || document.querySelector(".chatbot-toggler");
  const closeBtn       = document.getElementById("chatCloseBtn");
  const backdrop       = document.getElementById("chatBackdrop");
  

  
  // Agregar esto al inicio de tu chatbot.js
function setVH() {
  const vh = window.visualViewport 
    ? window.visualViewport.height * 0.01 
    : window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

setVH();

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', setVH);
}



  // Detectar si es móvil
  const isMobile = () => window.innerWidth <= 480;

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
  const scrollToBottom = () => {
    if (chatBody) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  };
  
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
    scrollToBottom();
  };
  
  // Auto-resize del textarea (máximo 2 líneas)
  const autoResize = () => {
    if (!chatInput) return;
    chatInput.style.height = 'auto';
    const maxHeight = 84; // ~2 líneas
    chatInput.style.height = Math.min(chatInput.scrollHeight, maxHeight) + 'px';
  };
  
  chatInput?.addEventListener('input', autoResize);

  const showLoader = () => {
    const existing = document.getElementById("loader");
    if (existing) return;
    
    const loader = document.createElement("div");
    loader.id = "loader";
    loader.className = "msg bot loading";
    loader.innerHTML = "<p>Escribiendo</p>";
    chatBody.appendChild(loader);
    scrollToBottom();
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

  // ===== Toggle panel (abrir/cerrar) =====
  const openChat = () => {
    chatContainer.classList.add("open");
    toggler?.classList.add("active");
    if (!isMobile()) backdrop?.classList.add("active");
    setTimeout(() => chatInput?.focus(), 150);
    scrollToBottom();
  };
  
  const closeChat = () => {
    chatContainer.classList.remove("open");
    toggler?.classList.remove("active");
    backdrop?.classList.remove("active");
  };
  
  // Botón flotante
  toggler?.addEventListener("click", () => {
    if (chatContainer.classList.contains("open")) {
      closeChat();
    } else {
      openChat();
    }
  });
  
  // Botón X en header
  closeBtn?.addEventListener("click", closeChat);
  
  // Click en backdrop (solo desktop)
  backdrop?.addEventListener("click", closeChat);
  
  // Escape para cerrar
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && chatContainer.classList.contains("open")) {
      closeChat();
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
    if (!action) return null;
    
    // Verificar que CartAPI existe
    if (!window.CartAPI) {
      console.warn("⚠️ CartAPI no disponible - el carrito no se actualizará");
      return null;
    }

    console.log("🛒 Ejecutando action:", action.type);

    try {
      switch (action.type) {
        case "ADD_TO_CART": {
          // Usar addById que busca el producto en window.__PRODUCTS__ o BD
          console.log("➕ Agregando producto ID:", action.productId, "x", action.qty);
          await window.CartAPI.addById(action.productId, action.qty || 1);
          await window.CartAPI.refreshBadge?.();
          return null;
        }
        
        case "MULTIPLE": {
          // Procesar múltiples acciones
          console.log("📦 Procesando", action.actions?.length, "acciones");
          for (const subAction of (action.actions || [])) {
            await runAction(subAction);
          }
          return null;
        }
        
        case "EMPTY_CART": {
          console.log("🗑️ Vaciando carrito");
          await window.CartAPI.empty?.();
          await window.CartAPI.refreshBadge?.();
          return null;
        }
        
        case "REMOVE_FROM_CART": {
          await window.CartAPI.remove?.({ id: action.productId });
          await window.CartAPI.refreshBadge?.();
          return null;
        }
        
        case "CATERING_AGENDADO": {
          console.log("✅ Catering agendado:", action.data);
          return null;
        }
        
        default:
          console.warn("Action no reconocida:", action.type);
          return null;
      }
    } catch (e) {
      console.error("❌ Cart action error:", e);
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
    chatInput.style.height = 'auto'; // Resetear altura
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
        console.log("🎯 Acción recibida del backend:", data.action);
        const feedback = await runAction(data.action);
        if (feedback) {
          appendMessage(feedback, "bot");
        }
      }

      // Mostrar respuesta del bot
      if (data.reply) {
        appendMessage(data.reply, "bot");
      }
      
      // Asegurar scroll al final
      scrollToBottom();

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

  // ===== Manejo de teclas en el input =====
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      if (isMobile()) {
        // MÓVIL: Enter hace nueva línea (como WhatsApp)
        // No hacemos nada especial, el textarea acepta Enter
        return;
      } else {
        // DESKTOP: Enter envía, Shift+Enter nueva línea
        if (e.shiftKey) {
          // Shift+Enter: permite nueva línea
          return;
        } else {
          // Enter solo: envía mensaje
          e.preventDefault();
          chatForm.requestSubmit();
        }
      }
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
    scrollToBottom();
    
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