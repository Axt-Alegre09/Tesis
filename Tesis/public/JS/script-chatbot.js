/* public/JS/script-chatbot.js
   Controlador principal del chatbot Paniquiños Bot */

const chatContainer = document.querySelector("#chat-body");
const input = document.querySelector("#chat-input");
const form = document.querySelector("#chat-form");

// estado local
let loadingMsg = null;

/* ========= UTILIDADES ========= */
function appendMessage(text, sender = "bot") {
  const msg = document.createElement("div");
  msg.className = `msg ${sender}`;
  msg.innerHTML = `<p>${text}</p>`;
  chatContainer.appendChild(msg);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function setLoading(state) {
  if (state) {
    loadingMsg = document.createElement("div");
    loadingMsg.className = "msg bot loading";
    loadingMsg.innerHTML = `<p>Escribiendo...</p>`;
    chatContainer.appendChild(loadingMsg);
  } else if (loadingMsg) {
    loadingMsg.remove();
    loadingMsg = null;
  }
}

/* ========= MENSAJE INICIAL ========= */
window.addEventListener("DOMContentLoaded", () => {
  appendMessage("¡Hola! 👋 ¿En qué puedo ayudarte hoy?");
});

/* ========= ENVÍO ========= */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const userText = input.value.trim();
  if (!userText) return;

  appendMessage(userText, "user");
  input.value = "";

  // intenta primero resolver con el cerebro local
  setLoading(true);
  const local = await window.ChatBrain.handleMessage(userText);
  if (local?.text) {
    setLoading(false);
    appendMessage(local.text, "bot");
    return;
  }

  // si no lo maneja el cerebro local, pregunta al backend
  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: userText }],
      }),
    });
    const data = await res.json();
    setLoading(false);

    appendMessage(data.reply || "No pude responder ahora mismo 😅", "bot");
  } catch (err) {
    setLoading(false);
    console.error("Error:", err);
    appendMessage("Hubo un error de conexión 😢", "bot");
  }
});
