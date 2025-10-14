// JS/pasarelaPagos.js
// Valida contexto + ejecuta RPC al pagar + toggles de método + logs claros

import { supabase } from "./ScriptLogin.js";

const QS = new URLSearchParams(location.search);
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
  // Llamada al RPC: guarda pedido + detalle y vacía carrito
  const { data, error } = await supabase.rpc("checkout_crear_pedido");
  if (error) {
    console.error("[checkout] RPC error:", error);
    throw error;
  }
  console.log("[checkout] RPC ok:", data);
  return data; // { pedido_id, items, total } o array con 1 fila
}

// === Toggle de paneles de método de pago ===
function setupMetodoPagoUI(snapshotTotal = 0) {
  const radios = document.querySelectorAll(".metodo-radio");
  const panels = document.querySelectorAll(".metodo-panel");

  function showPanel(metodo) {
    panels.forEach((p) => {
      p.classList.toggle("disabled", p.getAttribute("data-metodo") !== metodo);
    });
  }

  radios.forEach((r) => {
    r.addEventListener("change", () => showPanel(r.value));
    if (r.checked) showPanel(r.value);
  });

  // Completar el total en el panel de efectivo
  const efTotal = document.getElementById("efectivo-total");
  if (efTotal) {
    efTotal.value = fmtGs(snapshotTotal);
  }
}

// ---------- UI principal ----------
async function init() {
  const snapshot = readSnapshot();

  // Mostrar contexto de checkout
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

  // Configurar UI de métodos de pago con total del snapshot
  const snapTotal = Number(snapshot?.total || 0);
  setupMetodoPagoUI(snapTotal);

  // Enganchar submit (Pagar)
  const form = document.getElementById("checkout-form");
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const { data: sess } = await supabase.auth.getSession();
    console.log("[checkout] session.user:", sess?.session?.user);

    try {
      // 1) Ejecutar el RPC
      const res = await confirmarCompra(); // { pedido_id, items, total } o [ {…} ]
      const payload = Array.isArray(res) ? res[0] : res;

      // 2) Guardar snapshot remoto
      const snap = {
        source: "remote",
        pedidoId: payload?.pedido_id,
        ts: Date.now(),
        items: payload?.items,
        total: payload?.total
      };
      sessionStorage.setItem("checkout_snapshot", JSON.stringify(snap));

      // 3) Feedback visual
      document.getElementById("checkout-success")?.classList.remove("disabled");
      putMessage(`✅ Pedido confirmado. N°: ${snap.pedidoId || "(s/d)"} — Total: ${fmtGs(snap.total || 0)}.`, "ok");

      // 4) Evitar doble submit
      form.querySelector('button[type="submit"]')?.setAttribute("disabled", "true");

      // 5) Marcar post-compra y redirigir a Home (para “inmediatas”)
      sessionStorage.setItem("just_bought", "1");
      setTimeout(() => {
        window.location.assign("index.html");
      }, 900); // pequeño delay
    } catch (err) {
      console.error("[checkout] Error general:", err);
      const msg = err?.message || err?.error_description || "No se pudo confirmar la compra.";
      putMessage(msg);
    }
  });
}

// Inicializar
(function boot() {
  // Inicializa paneles según snapshot, antes del init principal
  let snap = null;
  try { snap = JSON.parse(sessionStorage.getItem("checkout_snapshot")); } catch {}
  try {
    const legacy = JSON.parse(sessionStorage.getItem("checkout"));
    if (!snap || (legacy?.ts && legacy.ts > (snap?.ts || 0))) snap = legacy;
  } catch {}
  const total = Number(snap?.total || 0);
  setupMetodoPagoUI(total);

  init();
})();
