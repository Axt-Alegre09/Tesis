// JS/pasarelaPagos.js
// Valida contexto + ejecuta RPC al pagar + log claro de errores.

import { supabase } from "./JS/ScriptLogin.js";

const QS = new URLSearchParams(location.search);

// ---------- Utils ----------
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

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
    box.style.maxWidth = "980px";
    box.style.fontSize = "14px";
    document.body.prepend(box);
  }
  const title = (type === "ok" ? "Listo" : "Atención") + ": ";
  box.innerHTML = `<b>${title}</b>${msg}`;
}

function hasValidPedido(qs = QS) {
  const raw = qs.get("pedido");
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v !== "" && v !== "null" && v !== "undefined";
}

function snapshotVigente(snap) {
  if (!snap || !snap.ts) return false;
  return (Date.now() - Number(snap.ts)) <= 5 * 60 * 1000; // 5 min
}

function readSnapshot() {
  let a = null, b = null;
  try { a = JSON.parse(sessionStorage.getItem("checkout_snapshot")); } catch {}
  try { b = JSON.parse(sessionStorage.getItem("checkout")); } catch {}
  if (a && b) return (Number(a.ts || 0) >= Number(b.ts || 0)) ? a : b;
  return a || b || null;
}

// ---------- Ejecutar el RPC (compra real) ----------
async function confirmarCompra() {
  console.log("[checkout] confirmando compra…");
  const { data: sess } = await supabase.auth.getSession();
  if (!sess?.session?.user?.id) {
    console.warn("[checkout] No hay sesión, abortando RPC.");
    throw new Error("Debes iniciar sesión para confirmar la compra.");
  }

  // Llamada al RPC (usa carrito_items del usuario y vacía al terminar)
  const { data, error } = await supabase.rpc("checkout_crear_pedido");
  if (error) {
    console.error("[checkout] RPC error:", error);
    throw error;
  }
  console.log("[checkout] RPC ok:", data);
  return data; // { pedido_id, items, total }
}

// ---------- UI principal ----------
async function init() {
  // Mostrar contexto (invitado o remoto con pedido)
  const snapshot = readSnapshot();

  if (hasValidPedido(QS)) {
    const pedidoId = QS.get("pedido");
    if (!snapshotVigente(snapshot) || snapshot?.source !== "remote" || snapshot?.pedidoId !== pedidoId) {
      putMessage("No se encontró el resumen del pedido o está vencido. Volvé al carrito y repetí la operación.");
    } else {
      putMessage(`Pedido listo para pagar.`, "ok");
    }
  } else if (QS.has("monto")) {
    const montoUrl = Number(QS.get("monto") || 0);
    const isSourceLocal = snapshot?.source === "local" || snapshot?.source === "legacy";
    if (!snapshotVigente(snapshot) || !isSourceLocal) {
      putMessage("No se encontró el resumen de compra. Volvé al carrito para iniciar el pago.");
    } else {
      const totalSnap = Number(snapshot.total || 0);
      if (Math.abs(totalSnap - montoUrl) > 1) {
        putMessage("Detectamos un desajuste en el total. Volvé al carrito y reintentá.");
      } else {
        putMessage(`Total a pagar: ${fmtGs(totalSnap)}. Completá el formulario y simulá el pago.`, "ok");
      }
    }
  } else {
    putMessage('Faltan datos del checkout. Accedé aquí usando “Comprar ahora” del carrito.');
  }

  // Enganchar el botón Pagar (submit del form)
  const form = document.getElementById("checkout-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Debug de sesión
    const { data: sess } = await supabase.auth.getSession();
    console.log("[checkout] session.user:", sess?.session?.user);

    try {
      // 1) Ejecutamos el RPC (guarda pedido + detalle y vacía carrito)
      const res = await confirmarCompra(); // { pedido_id, items, total }
      // 2) Guardar un snapshot “remote” para esta página (opcional)
      const snap = {
        source: "remote",
        pedidoId: res?.[0]?.pedido_id || res?.pedido_id,
        ts: Date.now(),
        items: res?.[0]?.items ?? res?.items,
        total: res?.[0]?.total ?? res?.total
      };
      sessionStorage.setItem("checkout_snapshot", JSON.stringify(snap));

      // 3) Mostrar éxito y botones
      document.getElementById("checkout-success")?.classList.remove("disabled");
      putMessage(`✅ Pedido confirmado. N°: ${snap.pedidoId || "(s/d)"} — Total: ${fmtGs(snap.total || 0)}.`, "ok");

      // 4) (Opcional) deshabilitar botón pagar para no duplicar
      const btn = form.querySelector('button[type="submit"]');
      btn?.setAttribute("disabled", "true");
    } catch (err) {
      // Errores comunes: no logueado, RLS, policies, o carrito vacío
      console.error("[checkout] Error general:", err);
      const msg = err?.message || err?.error_description || "No se pudo confirmar la compra.";
      putMessage(msg);
      alert(msg);
    }
  });
}

init();
