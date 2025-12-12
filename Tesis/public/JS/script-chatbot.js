/**
 * CHATBOT PANIQUIÑOS - Frontend v3.0
 * - Sincronización con CartAPI
 * - Fix teclado móvil (header siempre visible)
 * - Estilo WhatsApp responsive
 */

const API_URL = "/api/ask";

// ===== ELEMENTOS DOM =====
const chatContainer = document.getElementById("chat-container");
const chatBody = document.getElementById("chat-body");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatToggler = document.getElementById("chatToggler");
const chatCloseBtn = document.getElementById("chatCloseBtn");
const chatBackdrop = document.getElementById("chatBackdrop");

// ===== ESTADO =====
let chatState = {};
let isOpen = false;
let isMobile = window.innerWidth <= 480;

// ===== INICIALIZACIÓN =====
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  setupMobileKeyboardFix();
  showWelcomeMessage();
});

function setupEventListeners() {
  // Toggle chat
  chatToggler?.addEventListener("click", toggleChat);
  chatCloseBtn?.addEventListener("click", closeChat);
  chatBackdrop?.addEventListener("click", closeChat);

  // Enviar mensaje
  chatForm?.addEventListener("submit", handleSubmit);

  // Textarea auto-resize
  chatInput?.addEventListener("input", autoResizeInput);

  // Enter para enviar (desktop), Shift+Enter para nueva línea
  chatInput?.addEventListener("keydown", handleKeydown);

  // Cerrar con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) closeChat();
  });

  // Detectar cambio de tamaño
  window.addEventListener("resize", () => {
    isMobile = window.innerWidth <= 480;
  });
}

// ===== FIX TECLADO MÓVIL =====
function setupMobileKeyboardFix() {
  if (!("visualViewport" in window)) return;

  const vv = window.visualViewport;

  function adjustForKeyboard() {
    if (!isOpen || !isMobile) return;

    // Altura visible actual (sin teclado = altura total, con teclado = altura reducida)
    const viewportHeight = vv.height;

    // Aplicar altura al contenedor
    chatContainer.style.height = `${viewportHeight}px`;

    // Scroll al final de los mensajes
    setTimeout(() => scrollToBottom(), 50);
  }

  vv.addEventListener("resize", adjustForKeyboard);
  vv.addEventListener("scroll", adjustForKeyboard);

  // También cuando el input recibe focus
  chatInput?.addEventListener("focus", () => {
    if (isMobile) {
      setTimeout(adjustForKeyboard, 100);
      setTimeout(adjustForKeyboard, 300);
    }
  });

  chatInput?.addEventListener("blur", () => {
    if (isMobile) {
      // Restaurar altura completa cuando se cierra el teclado
      setTimeout(() => {
        chatContainer.style.height = "";
        chatContainer.style.height = "100dvh";
      }, 100);
    }
  });
}

// ===== TOGGLE CHAT =====
function toggleChat() {
  isOpen ? closeChat() : openChat();
}

function openChat() {
  isOpen = true;
  chatContainer?.classList.add("open");
  chatToggler?.classList.add("active");
  chatBackdrop?.classList.add("active");

  // Focus en input después de animación
  setTimeout(() => {
    chatInput?.focus();
    scrollToBottom();
  }, 350);

  // Bloquear scroll del body en móvil
  if (isMobile) {
    document.body.style.overflow = "hidden";
  }
}

function closeChat() {
  isOpen = false;
  chatContainer?.classList.remove("open");
  chatToggler?.classList.remove("active");
  chatBackdrop?.classList.remove("active");

  // Restaurar scroll del body
  document.body.style.overflow = "";

  // Restaurar altura
  if (chatContainer) {
    chatContainer.style.height = "";
  }
}

// ===== MENSAJES =====
function appendMessage(text, sender) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${sender}`;

  const p = document.createElement("p");
  p.textContent = text;

  msgDiv.appendChild(p);
  chatBody?.appendChild(msgDiv);

  scrollToBottom();
}

function showLoader() {
  const loader = document.createElement("div");
  loader.className = "msg bot loading";
  loader.id = "chat-loader";
  loader.innerHTML = "<p>Escribiendo...</p>";
  chatBody?.appendChild(loader);
  scrollToBottom();
}

function hideLoader() {
  document.getElementById("chat-loader")?.remove();
}

function scrollToBottom() {
  if (chatBody) {
    chatBody.scrollTop = chatBody.scrollHeight;
  }
}

function showWelcomeMessage() {
  setTimeout(() => {
    appendMessage(
      "¡Hola! 👋 Soy el asistente de Paniquiños.\n\n" +
        "Puedo ayudarte a:\n" +
        "• Agregar productos al carrito\n" +
        "• Agendar un catering\n" +
        "• Responder tus consultas\n\n" +
        "¿En qué puedo ayudarte?",
      "bot"
    );
  }, 500);
}

// ===== AUTO-RESIZE TEXTAREA =====
function autoResizeInput() {
  if (!chatInput) return;
  chatInput.style.height = "auto";
  const newHeight = Math.min(chatInput.scrollHeight, 84);
  chatInput.style.height = newHeight + "px";
}

// ===== MANEJO DE TECLAS =====
function handleKeydown(e) {
  if (e.key === "Enter") {
    // En móvil: Enter = nueva línea (como WhatsApp)
    // En desktop: Enter = enviar, Shift+Enter = nueva línea
    if (!isMobile && !e.shiftKey) {
      e.preventDefault();
      chatForm?.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }
}

// ===== ENVÍO DE MENSAJE =====
async function handleSubmit(e) {
  e.preventDefault();

  const userMsg = chatInput?.value.trim();
  if (!userMsg) return;

  // Mostrar mensaje del usuario
  appendMessage(userMsg, "user");
  if (chatInput) {
    chatInput.value = "";
    chatInput.style.height = "auto";
  }

  showLoader();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, state: chatState }),
    });

    const data = await res.json();
    hideLoader();

    // Actualizar estado
    if (data.state) {
      chatState = data.state;
    }

    // Ejecutar acciones del carrito
    if (data.action) {
      await runAction(data.action);
    }

    // Mostrar respuesta
    if (data.reply) {
      appendMessage(data.reply, "bot");
    }
  } catch (err) {
    hideLoader();
    console.error("Error chatbot:", err);
    appendMessage("Lo siento, hubo un error. Por favor intentá de nuevo.", "bot");
  }
}

// ===== EJECUTAR ACCIONES DEL CARRITO =====
async function runAction(action) {
  if (!action || !action.type) return;

  switch (action.type) {
    case "ADD_TO_CART":
      if (window.CartAPI?.addById) {
        await window.CartAPI.addById(action.productId, action.qty || 1);
        await window.CartAPI.refreshBadge?.();
      }
      break;

    case "MULTIPLE":
      if (Array.isArray(action.actions)) {
        for (const subAction of action.actions) {
          await runAction(subAction);
        }
      }
      break;

    case "EMPTY_CART":
      if (window.CartAPI?.empty) {
        await window.CartAPI.empty();
        await window.CartAPI.refreshBadge?.();
      }
      break;

    default:
      console.warn("Acción desconocida:", action.type);
  }
}

// ===== EXPORTAR PARA USO EXTERNO =====
window.PaniquinosChat = {
  open: openChat,
  close: closeChat,
  toggle: toggleChat,
  sendMessage: async (msg) => {
    if (chatInput) {
      chatInput.value = msg;
      chatForm?.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  },
};