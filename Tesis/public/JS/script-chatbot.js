// /public/JS/script-chatbot.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  /* ========= Supabase ========= */
  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ====== ANIMACIÓN DE APERTURA / CIERRE ======
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) {
      setTimeout(() => chatInput.focus(), 200);
    }
  });

  // ====== FUNCIÓN PARA AGREGAR MENSAJES ======
  function appendMessage(text, sender = "bot", delay = 0) {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    msg.innerHTML = `<p>${text}</p>`;
    setTimeout(() => {
      chatBody.appendChild(msg);
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }, delay);
  }

  // ====== FUNCIÓN DE LOADING ======
  function showLoader() {
    const loader = document.createElement("div");
    loader.className = "msg bot loading";
    loader.id = "loader";
    loader.innerHTML = `<p><i class="bi bi-three-dots"></i> Escribiendo...</p>`;
    chatBody.appendChild(loader);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }

  function hideLoader() {
    document.getElementById("loader")?.remove();
  }

  // ====== SALUDO DINÁMICO SEGÚN HORA ======
  function getSaludo() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return "☀️ ¡Buenos días";
    if (hora >= 12 && hora < 19) return "🌞 ¡Buenas tardes";
    return "🌙 ¡Buenas noches";
  }

  async function saludoInicial() {
    const saludo = getSaludo();
    let nombreUsuario = null;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre")
          .eq("id", user.id)
          .single();

        nombreUsuario = perfil?.nombre || user.email?.split("@")[0];
      }
    } catch (e) {
      console.warn("⚠️ No se pudo obtener usuario:", e);
    }

    // ====== MENSAJES DINÁMICOS ======
    if (nombreUsuario) {
      appendMessage(`${saludo}, *${nombreUsuario}*! 👋`, "bot", 200);
      appendMessage(
        "🍪 Bienvenido/a de nuevo a *Paniquiños Bot*. Estoy para ayudarte con tus pedidos o productos favoritos.",
        "bot",
        1200
      );
    } else {
      appendMessage(`${saludo}! 👋`, "bot", 200);
      appendMessage(
        "Soy *Paniquiños Bot*, tu asistente virtual. 🧁",
        "bot",
        1200
      );
      appendMessage(
        "¿Querés ver nuestras opciones más populares de hoy?",
        "bot",
        2200
      );
    }
  }

  saludoInicial(); // se ejecuta al cargar el chat

  // ====== ENVÍO DE MENSAJE ======
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      // === 1️⃣ Intentar respuesta local con ChatBrain ===
      const localResponse = await window.ChatBrain.handleMessage(text);
      if (localResponse) {
        hideLoader();
        appendMessage(localResponse.text, "bot", 300);
        return;
      }

      // === 2️⃣ Consultar al backend (OpenAI vía /api/ask) ===
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("❌ Error HTTP:", data);
        appendMessage("😓 No pude procesar tu mensaje ahora. Intentá más tarde.", "bot");
        return;
      }

      appendMessage(data.reply || "No pude responder ahora mismo 😅", "bot", 200);
    } catch (err) {
      console.error("💥 Error general en chatbot:", err);
      hideLoader();
      appendMessage("⚠️ Ocurrió un problema de conexión. Revisá tu red o intentá de nuevo.", "bot");
    }
  });

  // ====== DETECTAR ENTER ======
  chatInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
