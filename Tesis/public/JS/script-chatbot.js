// /public/JS/script-chatbot.js  (ESM)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Supabase (frontend) =========
   Nota: El ANON KEY puede permanecer aquí,
   no uses la SERVICE_ROLE KEY en el cliente. */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========= “Mini-Brain” (reglas rápidas) ========= */
function brain(text) {
  const t = text.toLowerCase();
  if (["hola", "buenas", "hey"].some(w => t.includes(w))) {
    return "¡Hola! 😊 ¿En qué puedo ayudarte hoy?";
  }
  if (t.includes("gracias")) {
    return "¡De nada! 🧁 ¡Un gusto ayudarte!";
  }
  if (t.includes("carrito")) {
    return "Puedo ayudarte a elegir, pero la compra la finalizas en el carrito 🛒.";
  }
  if (t.includes("abierto") || t.includes("hora") || t.includes("horario")) {
    return "Abrimos de lunes a sábado de 08:00 a 19:00 hs. ¡Te esperamos! 🕓";
  }
  return null; // dejar que siga el flujo
}

/* ========= Utilidades UI ========= */
function appendMessage(chatBody, text, sender = "bot") {
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  msg.innerHTML = `<p>${text}</p>`;
  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}
function showLoader(chatBody) {
  const loader = document.createElement("div");
  loader.id = "loader";
  loader.className = "msg bot loading";
  loader.innerHTML = `<p><i class="bi bi-three-dots"></i> Escribiendo…</p>`;
  chatBody.appendChild(loader);
  chatBody.scrollTop = chatBody.scrollHeight;
}
function hideLoader() { document.getElementById("loader")?.remove(); }
function saludoPorHora() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "☀️ ¡Buenos días";
  if (h >= 12 && h < 19) return "🌞 ¡Buenas tardes";
  return "🌙 ¡Buenas noches";
}

/* ========= Lookup rápido de productos por nombre =========
   Busca nombres que contengan la palabra clave. */
async function buscarProductosPorTexto(texto) {
  const kw = texto.toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(s => s.length >= 4)[0]; // primera palabra “significativa”

  if (!kw) return [];

  const { data, error } = await supabase
    .from("productos")
    .select("id,nombre,precio,activo")
    .ilike("nombre", `%${kw}%`)
    .eq("activo", true)
    .limit(8);

  if (error) {
    console.warn("[chat lookup] error:", error);
    return [];
  }
  return data || [];
}

/* ========= Inicio ========= */
document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody = document.getElementById("chat-body");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const toggler = document.querySelector(".chatbot-toggler");

  if (!chatContainer || !chatBody || !chatForm || !chatInput) {
    console.error("[chat] Faltan nodos del chat en el DOM.");
    return;
  }

  // Toggle panel
  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) {
      setTimeout(() => chatInput.focus(), 150);
    }
  });

  // Saludo inicial (con nombre si hay sesión)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    let nombre = null;
    if (user) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("nombre")
        .eq("id", user.id)
        .single();
      nombre = perfil?.nombre || user.email?.split("@")[0];
    }
    appendMessage(chatBody, `${saludoPorHora()}${nombre ? `, *${nombre}*` : ""}! 👋`, "bot");
    appendMessage(chatBody, "Soy *Paniquiños Bot*, ¿te ayudo con el menú o precios de hoy?", "bot");
  } catch (e) {
    appendMessage(chatBody, `${saludoPorHora()}! 👋`, "bot");
    appendMessage(chatBody, "Soy *Paniquiños Bot*, ¿te ayudo con el menú o precios de hoy?", "bot");
  }

  // Envío
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(chatBody, text, "user");
    chatInput.value = "";
    showLoader(chatBody);

    try {
      // 1) Reglas locales
      const quick = brain(text);
      if (quick) {
        hideLoader();
        appendMessage(chatBody, quick, "bot");
        return;
      }

      // 2) Lookup rápido en productos (ej: “tortas”, “empanada”)
      const encontrados = await buscarProductosPorTexto(text);
      if (encontrados.length) {
        const lista = encontrados
          .map(p => `- **${p.nombre}** — ${Number(p.precio).toLocaleString("es-PY")} Gs`)
          .join("<br>");
        hideLoader();
        appendMessage(
          chatBody,
          `Encontré estas opciones relacionadas:<br>${lista}`,
          "bot"
        );
        return;
      }

      // 3) Fallback a backend con RAG/LLM
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      const data = await res.json().catch(() => ({}));
      hideLoader();

      if (!res.ok) {
        console.error("[chat] HTTP error:", data);
        appendMessage(chatBody, "😓 No pude procesar tu mensaje ahora. Probá de nuevo más tarde.", "bot");
        return;
      }

      appendMessage(chatBody, data?.reply || "No pude responder ahora mismo 😅", "bot");
    } catch (err) {
      console.error("[chat] error general:", err);
      hideLoader();
      appendMessage(chatBody, "⚠️ Ocurrió un problema de conexión. Intentá de nuevo en unos segundos.", "bot");
    }
  });

  // Enter para enviar
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
