// public/JS/script-chatbot.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

document.addEventListener("DOMContentLoaded", async () => {
  const chatContainer = document.querySelector(".chat-container");
  const chatBody       = document.getElementById("chat-body");
  const chatForm       = document.getElementById("chat-form");
  const chatInput      = document.getElementById("chat-input");
  const toggler        = document.querySelector(".chatbot-toggler");

  // ===== Supabase (solo para saludo dinámico) =====
  const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  /* ===== UI ===== */
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

  toggler?.addEventListener("click", () => {
    chatContainer.classList.toggle("open");
    toggler.classList.toggle("active");
    if (chatContainer.classList.contains("open")) setTimeout(() => chatInput.focus(), 150);
  });

  // Mensaje inicial
  (async () => {
    try {
      let nombre = null;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("perfiles").select("nombre").eq("id", user.id).single();
        nombre = data?.nombre || user.email?.split("@")[0];
      }
      appendMessage(`${saludo()}${nombre ? `, *${nombre}*` : ""}! 👋 Soy *Paniquiños Bot*. Hablame como a un mozo: “precios de alfajores”, “agregá 2 empanadas de carne”, “total del carrito”…`);
    } catch {
      appendMessage(`${saludo()}! 👋 Soy *Paniquiños Bot*. ¿Menú, precios o carrito?`);
    }
  })();

  /* ===== Integración de carrito (defensiva) ===== */
  const PRODUCTS = () => (window.__PRODUCTS__ || []).map(p => ({
    id: String(p.id),
    nombre: p.nombre || p.titulo || "Producto",
    precio: Number(p.precio || 0),
    imagen: p.imagen,
  }));

  async function addToCartById(id, qty = 1) {
    const prod = PRODUCTS().find(p => String(p.id) === String(id));
    if (!prod) throw new Error("Producto no encontrado en catálogo del cliente");
    if (!window.CartAPI?.addProduct) throw new Error("CartAPI.addProduct no disponible");
    await window.CartAPI.addProduct(prod, qty);
    await window.CartAPI.refreshBadge?.();
    return prod;
  }

  async function removeFromCartById(id, qty = 1) {
    // Se apoya en APIs existentes o en localStorage (fallback)
    if (window.CartAPI?.removeProduct) {
      await window.CartAPI.removeProduct(String(id), qty);
      await window.CartAPI.refreshBadge?.();
      return;
    }
    // Fallback: localStorage "carrito"
    const raw = localStorage.getItem("carrito");
    let items = [];
    try { items = JSON.parse(raw || "[]"); } catch {}
    let rest = qty;
    items = items.flatMap(it => {
      if (String(it.id) !== String(id)) return [it];
      const cantidad = Number(it.cantidad || it.qty || 1);
      const quitar = Math.min(rest, cantidad);
      rest -= quitar;
      const nueva = cantidad - quitar;
      if (nueva > 0) return [{ ...it, cantidad: nueva }];
      return [];
    });
    localStorage.setItem("carrito", JSON.stringify(items));
    await window.CartAPI?.refreshBadge?.();
  }

  async function getCartSummary() {
    if (window.CartAPI?.getSummary) {
      return await window.CartAPI.getSummary();
    }
    // Fallback: localStorage
    let items = [];
    try { items = JSON.parse(localStorage.getItem("carrito") || "[]"); } catch {}
    const total = items.reduce((s, it) => s + Number(it.precio || 0) * Number(it.cantidad || it.qty || 1), 0);
    return { total, items };
  }

  /* ===== Envío ===== */
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
        appendMessage("⚠️ Ocurrió un problema. Probá de nuevo.", "bot");
        return;
      }

      if (data?.reply) appendMessage(data.reply, "bot");

      // === Ejecutar acciones solicitadas por el backend ===
      const act = data?.action;
      if (act && typeof act === "object" && act.type) {
        try {
          switch (act.type) {
            case "ADD_TO_CART": {
              const { product, qty = 1 } = act;
              const p = await addToCartById(product.id, qty);
              appendMessage(`Agregado ✅ ${qty}× ${p?.nombre}. ¿Algo más?`, "bot");
              break;
            }
            case "REMOVE_FROM_CART": {
              const { product, qty = 1 } = act;
              await removeFromCartById(product.id, qty);
              appendMessage(`Listo, quité ${qty}× del producto.`, "bot");
              break;
            }
            case "GET_CART_TOTAL": {
              const { total, items } = await getCartSummary();
              const lineas = (items || [])
                .map(it => `• ${it.cantidad || it.qty || 1}× ${it.nombre || it.titulo} — ${toPY(it.precio || 0)} Gs`)
                .join("\n");
              appendMessage(
                `${lineas ? `${lineas}\n\n` : ""}Total: **${toPY(total)} Gs**. ¿Confirmás el pedido o agregamos algo más?`,
                "bot"
              );
              break;
            }
            default:
              // si llega algo desconocido, solo lo logeamos
              console.warn("Acción no manejada:", act);
          }
        } catch (err) {
          console.error("Action error:", err);
          appendMessage("No pude realizar esa acción del carrito 😢. Probá otra vez.", "bot");
        }
      }
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

  // Util local para formateo
  function toPY(v) {
    const n = Number(v || 0);
    return n.toLocaleString("es-PY");
  }
});
