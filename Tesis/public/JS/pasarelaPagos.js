// JS/pasarelaPagos.js
// Valida el snapshot del carrito contra la URL y muestra un mensaje claro.

import { supabase } from "./ScriptLogin.js"; // opcional

const qs = new URLSearchParams(location.search);
const snapshotRaw = sessionStorage.getItem("checkout_snapshot");
let snapshot = null;
try { snapshot = snapshotRaw ? JSON.parse(snapshotRaw) : null; } catch { snapshot = null; }

function putMessage(msg, type = "error") {
  let box = document.querySelector("[data-checkout-msg]");
  if (!box) {
    box = document.createElement("div");
    box.setAttribute("data-checkout-msg", "1");
    box.style.border = "2px solid #6f5c38";
    box.style.background = "#fff";
    box.style.borderRadius = "12px";
    box.style.padding = "14px";
    box.style.margin = "10px 0";
    document.body.prepend(box);
  }
  box.innerHTML = `<b>${type === "ok" ? "Listo" : "Atención"}:</b> ${msg}`;
}

function snapshotVigente(s) {
  if (!s?.ts) return false;
  return (Date.now() - Number(s.ts)) <= 5 * 60 * 1000; // 5min
}

function hasValidPedido(q) {
  const raw = q.get("pedido");
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v !== "" && v !== "null" && v !== "undefined";
}

async function init() {
  // REMOTO
  if (hasValidPedido(qs)) {
    const pedidoId = qs.get("pedido");
    if (!snapshot || snapshot.source !== "remote" || snapshot.pedidoId !== pedidoId || !snapshotVigente(snapshot)) {
      putMessage("No se encontró el resumen del pedido o está vencido. Volvé al carrito y repetí la operación.");
      return;
    }
    // (opcional) consultar total real en DB con supabase.rpc(...)
    putMessage(`Pedido #${pedidoId} listo para pagar.`, "ok");
    return;
  }

  // LOCAL
  if (qs.has("monto")) {
    const montoUrl = Number(qs.get("monto") || 0);
    if (!snapshot || snapshot.source !== "local" || !snapshotVigente(snapshot)) {
      putMessage("No se encontró el resumen de compra. Volvé al carrito para iniciar el pago.");
      return;
    }
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const total = Number(snapshot.total || 0);

    if (items.length === 0 || total <= 0) {
      putMessage("Tu carrito está vacío. Volvé al catálogo y añadí productos.");
      return;
    }
    if (Math.abs(total - montoUrl) > 1) {
      putMessage("Detectamos un desajuste en el total. Volvé al carrito y reintenta.");
      return;
    }

    putMessage(`Total a pagar: ${new Intl.NumberFormat("es-PY").format(total)} Gs`, "ok");
    return;
  }

  // Sin datos
  putMessage("Faltan datos del checkout. Accedé a esta página usando el botón “Comprar ahora” del carrito.");
}

init();
