// public/JS/script-chatbot.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody       = document.getElementById("chat-body");
  const chatForm       = document.getElementById("chat-form");
  const chatInput      = document.getElementById("chat-input");
  const toggler        = document.querySelector(".chatbot-toggler");

  // Supabase solo para nombre (si hay sesión)
  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const appendMessage = (text, sender = "bot") => {
    const msg = document.createElement("div");
    msg.className = `msg ${sender}`;
    msg.innerHTML = `<p>${text}</p>`;
    chatBody.appendChild(msg);
    chatBody.scrollTop = chatBody.scrollHeight;
  };
  const showLoader = () => {
    const el = document.createElement("div");
    el.id = "loader";
    el.className = "msg bot loading";
    el.innerHTML = "<p>Escribiendo…</p>";
    chatBody.appendChild(el);
    chatBody.scrollTop = chatBody.scrollHeight;
  };
  const hideLoader = () => document.getElementById("loader")?.remove();

  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) setTimeout(() => chatInput.focus(), 150);
  });

  // Saludo ULTRA corto
  (async () => {
    try {
      let nombre = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("perfiles").select("nombre").eq("id", user.id).single();
        nombre = data?.nombre || null;
      }
      appendMessage(`Hola${nombre ? `, *${nombre}*` : ""}. ¿Qué necesitás?`, "bot");
    } catch {
      appendMessage("Hola. ¿Qué necesitás?", "bot");
    }
  })();

  // Helpers carrito (usa CartAPI si existe; no abre secciones)
  const PRODUCTS = () => (window.__PRODUCTS__ || []).map(p => ({
    id: String(p.id), nombre: p.nombre || p.titulo || "Producto",
    precio: Number(p.precio || 0), imagen: p.imagen
  }));

  async function addToCartById(id, qty = 1) {
    const prod = PRODUCTS().find(p => String(p.id) === String(id));
    if (!prod) throw new Error("Producto no encontrado");
    if (!window.CartAPI?.addProduct) throw new Error("CartAPI.addProduct no disponible");
    await window.CartAPI.addProduct(prod, qty);
    await window.CartAPI.refreshBadge?.();
    return prod;
  }
  async function removeFromCartById(id, qty = 1) {
    if (window.CartAPI?.removeProduct) {
      await window.CartAPI.removeProduct(String(id), qty);
      await window.CartAPI.refreshBadge?.();
      return;
    }
    // fallback localStorage
    const raw = localStorage.getItem("carrito");
    let items = [];
    try { items = JSON.parse(raw || "[]"); } catch {}
    let rest = qty;
    items = items.flatMap(it => {
      if (String(it.id) !== String(id)) return [it];
      const cant = Number(it.cantidad || it.qty || 1);
      const quitar = Math.min(rest, cant);
      rest -= quitar;
      const nueva = cant - quitar;
      return nueva > 0 ? [{ ...it, cantidad: nueva }] : [];
    });
    localStorage.setItem("carrito", JSON.stringify(items));
    await window.CartAPI?.refreshBadge?.();
  }
  async function getCartSummary() {
    if (window.CartAPI?.getSummary) return await window.CartAPI.getSummary();
    let items = [];
    try { items = JSON.parse(localStorage.getItem("carrito") || "[]"); } catch {}
    const total = items.reduce((s, it) => s + Number(it.precio || 0) * Number(it.cantidad || it.qty || 1), 0);
    return { total, items };
  }
  const toPY = (v) => Number(v||0).toLocaleString("es-PY");

  // Envío
  chatForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    chatInput.value = "";
    showLoader();

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      const data = await res.json();
      hideLoader();

      if (!res.ok) {
        console.error("HTTP", res.status, data);
        appendMessage("Ocurrió un problema. Probá de nuevo.", "bot");
        return;
      }

      if (data?.reply) appendMessage(data.reply, "bot");

      // Acciones (carrito) – nunca abre secciones
      const act = data?.action;
      if (act?.type) {
        try {
          if (act.type === "ADD_TO_CART") {
            const { product, qty = 1 } = act;
            const p = await addToCartById(product.id, qty);
            appendMessage(`Agregado: ${qty}× ${p?.nombre}.`, "bot");
          } else if (act.type === "REMOVE_FROM_CART") {
            const { product, qty = 1 } = act;
            await removeFromCartById(product.id, qty);
            appendMessage(`Quitado: ${qty}×.`, "bot");
          } else if (act.type === "GET_CART_TOTAL") {
            const { total, items } = await getCartSummary();
            const lines = (items || [])
              .map(it => `• ${it.cantidad || it.qty || 1}× ${it.nombre || it.titulo} — ${toPY(it.precio || 0)} Gs`)
              .join("\n");
            appendMessage(`${lines ? `${lines}\n\n` : ""}Total: **${toPY(total)} Gs**.`, "bot");
          }
        } catch (err) {
          console.error("Action error:", err);
          appendMessage("No pude hacer esa acción del carrito.", "bot");
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      hideLoader();
      appendMessage("Problema de conexión. Probá de nuevo.", "bot");
    }
  });

  // Enter = enviar
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.requestSubmit();
    }
  });
});
