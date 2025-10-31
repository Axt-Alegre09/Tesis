// public/JS/script-chatbot.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
      appendMessage(`${saludo()}${nombre ? `, *${nombre}*` : ""}! 👋 Soy *Paniquiños Bot*. Podés preguntarme por *tortas*, *empanadas*, *alfajores* o *combos*.`);
    } catch {
      appendMessage(`${saludo()}! 👋 Soy *Paniquiños Bot*. ¿Querés conocer las promos o el menú de hoy?`);
    }
  })();

  // ===== Envío =====
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      const brain = window.ChatBrain && typeof window.ChatBrain.handleMessage === "function"
        ? window.ChatBrain
        : { handleMessage: async () => null };

      const local = await brain.handleMessage(text);
      if (local) {
        hideLoader();
        appendMessage(local.text, "bot");
        return;
      }

      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("HTTP", res.status, data);
        appendMessage("⚠️ Ocurrió un problema al comunicar con el mozo virtual. Intentá de nuevo.", "bot");
        return;
      }

      appendMessage(data.reply || "No pude responder ahora mismo 😅", "bot");
    } catch (err) {
      console.error("Chat error:", err);
      hideLoader();
      appendMessage("⚠️ Error de conexión. Intentá nuevamente.", "bot");
    }
  });

  // ===== Enter para enviar =====
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
