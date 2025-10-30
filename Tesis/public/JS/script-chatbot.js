// Se carga con type="module" en el index
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.getElementById("chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  // ========= Supabase (cliente único) =========
  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Pasamos el client a ChatBrain (evita múltiples instancias GoTrue)
  window.ChatBrain?.init(supabase);

  // ====== Abrir / cerrar chat ======
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) {
      setTimeout(() => chatInput?.focus(), 160);
    }
  });

  // ====== Utils UI ======
  function appendMessage(text, sender = "bot", delay = 0) {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    msg.innerHTML = `<p>${text}</p>`;
    setTimeout(() => {
      chatBody.appendChild(msg);
      chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
    }, delay);
  }

  function showLoader() {
    const loader = document.createElement("div");
    loader.className = "msg bot loading";
    loader.id = "loader";
    loader.innerHTML = `<p>Escribiendo…</p>`;
    chatBody.appendChild(loader);
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }
  function hideLoader() { document.getElementById("loader")?.remove(); }

  // ====== Saludo inicial corto ======
  (function saludo() {
    appendMessage("👋 ¡Bienvenido! Soy *Paniquiños Bot*. Preguntame por *tortas*, *empanadas*, *alfajores* o *combos*.", "bot", 50);
  })();

  // ====== Envío ======
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      // 1) Intento local con catálogo (ChatBrain)
      const local = await window.ChatBrain.handleMessage(text);
      if (local) {
        hideLoader();
        appendMessage(local.text, "bot", 150);
        return;
      }

      // 2) Fallback a backend /api/ask (RAG/OpenAI)
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("HTTP error /api/ask:", data);
        appendMessage("No pude responder ahora mismo 😅 Probá de nuevo en un momento.", "bot");
        return;
      }

      appendMessage(data.reply || "No tengo respuesta ahora mismo 😅", "bot", 120);
    } catch (err) {
      console.error("Chat error:", err);
      hideLoader();
      appendMessage("⚠️ Ocurrió un problema de conexión. Probá de nuevo.", "bot");
    }
  });

  // Enter para enviar
  chatInput?.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
