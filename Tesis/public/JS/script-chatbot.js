// JS/script-chatbot.js  (type="module")
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody  = document.getElementById("chat-body");
  const chatForm  = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler   = document.querySelector(".chatbot-toggler");

  // ===== Supabase solo para saludo dinámico =====
  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ===== UI helpers =====
  const appendMessage = (text, sender = "bot") => {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    // Permite ** y \n básicos
    const safe = String(text || "")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br/>");
    msg.innerHTML = `<p>${safe}</p>`;
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
    if (h < 12) return "☀️ ¡Buenos días";
    if (h < 19) return "🌞 ¡Buenas tardes";
    return "🌙 ¡Buenas noches";
  };

  // ===== Toggle panel =====
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) setTimeout(() => chatInput.focus(), 150);
  });

  // ===== Mensaje inicial =====
  (async () => {
    try {
      let nombre = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("perfiles").select("nombre").eq("id", user.id).single();
        nombre = data?.nombre || user.email?.split("@")[0];
      }
      appendMessage(`${saludo()}${nombre ? `, <b>${nombre}</b>` : ""}! 👋 Soy <b>Paniquiños Bot</b>. Pedime <b>tortas</b>, <b>empanadas</b>, <b>alfajores</b> o <b>combos</b>.`);
    } catch {
      appendMessage(`${saludo()}! 👋 Soy <b>Paniquiños Bot</b>. ¿Te ayudo con el menú?`);
    }
  })();

  // ===== Ejecutar acciones del backend =====
  const runAction = async (action, payload) => {
    if (!action) return;
    switch (action) {
      case "show_category": {
        const slug = payload?.slug;
        if (!slug) return;
        // Simula click en el botón de categoría si existe
        const btn = document.getElementById(slug);
        if (btn) btn.click();
        // si no existe, intentamos buscar
        else {
          const search = document.getElementById("searchInput");
          if (search) {
            search.value = slug;
            // dispara submit de búsqueda si existe
            document.getElementById("searchForm")?.requestSubmit();
          }
        }
        break;
      }
      // Futuros casos: "cart_add", "cart_total", etc.
      default:
        break;
    }
  };

  // ===== Envío =====
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      // Cerebro local primero
      const brain = window.ChatBrain && typeof window.ChatBrain.handleMessage === "function"
        ? window.ChatBrain
        : { handleMessage: async () => null };

      const local = await brain.handleMessage(text);
      if (local) {
        hideLoader();
        appendMessage(local.text || "👌", "bot");
        if (local.action) await runAction(local.action, local.payload);
        return;
      }

      // Backend
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      const data = await res.json();
      hideLoader();
      if (!res.ok) {
        console.error("HTTP", res.status, data);
        appendMessage("⚠️ Ocurrió un problema. Probá de nuevo.", "bot");
        return;
      }
      appendMessage(data.reply || "No pude responder ahora mismo 😅", "bot");
      if (data.action) await runAction(data.action, data.payload);
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
