// JS/pasarelaPagos.js
// Flujo único: toma snapshot del carrito + datos del formulario,
// llama al RPC `crear_pedido_desde_checkout` (servidor) y muestra la pantalla de éxito.
// No rompe tu checkout.js (intercepta el submit en "capture" para evitar dobles envíos).

import { supabase } from "./JS/ScriptLogin.js";

const $  = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtPY = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

// ---------------- UI: chips del éxito ----------------
function stylePill(el) {
  if (!el) return;
  el.style.display = "inline-block";
  el.style.padding = ".25rem .6rem";
  el.style.borderRadius = "999px";
  el.style.border = "1px solid #cdbf9a";
  el.style.background = "#f7f3ea";
  el.style.color = "#5b4a25";
  el.style.fontSize = ".85rem";
}

// ---------------- Helpers ----------------
function toast(msg, type = "info") {
  let box = document.querySelector("[data-checkout-msg]");
  if (!box) {
    box = document.createElement("div");
    box.dataset.checkoutMsg = "1";
    box.style.cssText = "border:2px solid #6f5c38;background:#fff;border-radius:12px;padding:14px;margin:10px 0;max-width:980px;font-size:14px";
    document.body.prepend(box);
  }
  const prefix = type === "ok" ? "Listo: " : type === "err" ? "Error: " : type === "warn" ? "Atención: " : "";
  box.innerHTML = `<b>${prefix}</b>${msg}`;
}

function readSnapshotFromSession() {
  try {
    const raw = sessionStorage.getItem("checkout_snapshot") ?? sessionStorage.getItem("checkout");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function getFormValue(id) { return ($(id)?.value ?? "").trim(); }

// Paneles de método de pago + total efectivo
function setupMetodoPagoUI() {
  const radios = $$(".metodo-radio");
  const panels = $$(".metodo-panel");
  const show = (m) => panels.forEach(p => p.classList.toggle("disabled", p.dataset.metodo !== m));
  radios.forEach(r => {
    r.addEventListener("change", () => show(r.value));
    if (r.checked) show(r.value);
  });

  const snap = readSnapshotFromSession();
  const efTotal = $("#efectivo-total");
  if (efTotal && Number(snap?.total || 0) > 0) efTotal.value = fmtPY(snap.total);
}

function buildPayloadFromUI() {
  const snap = readSnapshotFromSession() || {};
  const items = Array.isArray(snap.items) ? snap.items : [];
  const total = Number(
    snap.total ||
    items.reduce((a, it) => a + Number(it.precio || 0) * Number(it.cantidad || 1), 0)
  ) || 0;

  const metodo = document.querySelector('input[name="metodo"]:checked')?.value || "transferencia";

  return {
    source: snap.source || "local",
    items: items.map(it => ({
      id: it.id, // productos.id (UUID)
      titulo: it.titulo,
      precio: Number(it.precio || 0),
      cantidad: Number(it.cantidad || 1)
    })),
    total,
    ruc:        getFormValue("ruc"),
    razon:      getFormValue("razon"),
    tel:        getFormValue("tel"),
    mail:       getFormValue("mail"),
    contacto:   getFormValue("contacto"),
    ciudad:     getFormValue("ciudad"),
    barrio:     getFormValue("barrio"),
    depto:      getFormValue("depto"),
    postal:     getFormValue("postal"),
    calle1:     getFormValue("calle1"),
    calle2:     getFormValue("calle2"),
    nro:        getFormValue("nro"),
    hora_desde: getFormValue("hora-desde"),
    hora_hasta: getFormValue("hora-hasta"),
    metodo_pago: metodo
  };
}

function showSuccess(total, meta = {}) {
  $("#checkout-form")?.classList.add("disabled");
  $("#checkout-success")?.classList.remove("disabled");

  const pedidoId = meta.pedido_id || window.__pedido_ok__?.pedido_id || "";
  const pedidoShort = pedidoId ? pedidoId.slice(0, 8) : "—";

  const pillPedido = $("#pill-pedido");
  const pillTotal  = $("#pill-total");
  const pillMetodo = $("#pill-metodo");

  if (pillPedido) { pillPedido.textContent = `Pedido: ${pedidoShort}`; stylePill(pillPedido); }
  if (pillTotal)  { pillTotal.textContent  = `Total: ${fmtPY(total)}`;  stylePill(pillTotal);  }
  if (pillMetodo && meta.metodo_pago) {
    pillMetodo.textContent = `Pago: ${meta.metodo_pago}`;
    stylePill(pillMetodo);
  }

  try { window.CartAPI?.refreshBadge?.(); } catch {}
  // Si preferís volver al inicio automático, descomentá:
  // setTimeout(() => location.assign("index.html"), 1200);
}

// ---------------- Submit (capturing para evitar dobles envíos) ----------------
async function onSubmitCapture(ev) {
  ev.preventDefault();
  ev.stopImmediatePropagation(); // evita que otro listener (checkout.js) procese el submit también

  const btn = $("#checkout-form button[type='submit']");
  btn?.setAttribute("disabled", "true");

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast("Debes iniciar sesión para pagar.", "err"); btn?.removeAttribute("disabled"); return; }

    const payload = buildPayloadFromUI();
    if (!payload.items?.length) {
      toast("Tu carrito está vacío o no se pudo leer el snapshot.", "err");
      btn?.removeAttribute("disabled");
      return;
    }

    const { data, error } = await supabase.rpc("crear_pedido_desde_checkout", {
      p_usuario: user.id,
      p_checkout: payload
    });
    if (error) throw error;

    const { pedido_id, snapshot_id } = (data || [])[0] || {};
    window.__pedido_ok__ = { pedido_id, snapshot_id };

    // Limpieza carrito + snapshot local
    try { await window.CartAPI?.empty?.(); } catch {}
    sessionStorage.removeItem("checkout_snapshot");
    sessionStorage.removeItem("checkout");

    toast(`✅ Pedido confirmado. Total: ${fmtPY(payload.total)} — Método: ${payload.metodo_pago}`, "ok");
    showSuccess(payload.total, { pedido_id, metodo_pago: payload.metodo_pago });
  } catch (err) {
    console.error("[pasarelaPagos] submit error:", err);
    toast(err?.message || err?.error_description || "No se pudo confirmar la compra.", "err");
    btn?.removeAttribute("disabled");
  }
}

(function init() {
  setupMetodoPagoUI();
  const form = $("#checkout-form");
  if (form) form.addEventListener("submit", onSubmitCapture, { capture: true });
})();
