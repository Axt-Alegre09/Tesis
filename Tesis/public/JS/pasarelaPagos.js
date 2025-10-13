// JS/pasarelaPagos.js (REEMPLAZO COMPLETO)
import { supabase } from "./JS/ScriptLogin.js";

const QS = new URLSearchParams(location.search);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

function putMessage(msg, type = "error") {
  let box = document.querySelector("[data-checkout-msg]");
  if (!box) {
    box = document.createElement("div");
    box.setAttribute("data-checkout-msg", "1");
    box.className = type === "ok" ? "alert alert-success" : "alert alert-warning";
    box.style.maxWidth = "980px";
    box.style.margin = "10px auto";
    box.style.fontSize = "14px";
    document.body.prepend(box);
  } else {
    box.className = type === "ok" ? "alert alert-success" : "alert alert-warning";
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

function toggleMetodosUI() {
  const value = $('input[name="metodo"]:checked')?.value || "transferencia";
  $$('.metodo-panel').forEach(p => p.classList.add("disabled"));
  $(`.metodo-panel[data-metodo="${value}"]`)?.classList.remove("disabled");
}

async function initUI(snapshot, total) {
  // set total en efectivo si corresponde
  const efectivoTotal = $("#efectivo-total");
  if (efectivoTotal) efectivoTotal.value = fmtGs(total);

  // radios de método
  $$('input[name="metodo"]').forEach(r => r.addEventListener("change", toggleMetodosUI));
  toggleMetodosUI();

  // botón PDF (stub)
  $("#btn-descargar-factura")?.addEventListener("click", () => {
    alert("Demo: aquí podrías generar un PDF con la factura.");
  });
}

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const submitBtn = form.querySelector('button[type="submit"]');
  const successBox = $("#checkout-success");

  // datos de contexto
  const snapshot = readSnapshot();
  const totalSnap = Number(snapshot?.total || QS.get("monto") || 0);

  // validación mínima
  if (totalSnap <= 0) {
    alert("No encuentro el total. Volvé al carrito y reintentá.");
    return;
  }

  // estado UI
  submitBtn.disabled = true;
  const prevText = submitBtn.textContent;
  submitBtn.textContent = "Procesando…";

  try {
    // usuario
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      alert("Debes iniciar sesión para confirmar la compra.");
      return;
    }

    // Llamar al RPC que guarda el pedido + detalles y vacía el carrito
    const { data, error } = await supabase.rpc("checkout_crear_pedido");
    if (error) throw error;

    const row = (data && data[0]) || {};
    const pedidoId = row.pedido_id || row.id || null;
    const items = Number(row.items || 0);
    const total = Number(row.total || totalSnap);

    // Mostrar éxito
    if (successBox) successBox.classList.remove("disabled");
    form.classList.add("disabled");

    putMessage(
      `Pedido confirmado ✅<br> Nro: <code>${pedidoId || "(sin-id)"}</code> — Ítems: <b>${items}</b> — Total: <b>${fmtGs(total)}</b>`,
      "ok"
    );

    // limpiar snapshot local y actualizar badge del carrito
    try { sessionStorage.removeItem("checkout_snapshot"); sessionStorage.removeItem("checkout"); } catch {}
    await window.CartAPI?.refreshBadge?.();

    // opcional: redirigir en unos segundos
    // setTimeout(()=> location.assign("index.html"), 2500);

  } catch (err) {
    console.error("[checkout] RPC error:", err);
    alert(err?.message || "No se pudo confirmar el pedido.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = prevText;
  }
}

async function init() {
  const snapshot = readSnapshot();

  // Flujo por pedidoId (remoto) — hoy no lo usamos, pero mantenemos la lógica
  if (hasValidPedido(QS)) {
    const pedidoId = QS.get("pedido");
    if (!snapshotVigente(snapshot) || snapshot?.source !== "remote" || snapshot?.pedidoId !== pedidoId) {
      putMessage("No se encontró el resumen del pedido o está vencido. Volvé al carrito y repetí la operación.");
      return;
    }
    putMessage(`Pedido #${pedidoId} listo para pagar.`, "ok");
    await initUI(snapshot, Number(snapshot.total || 0));
    $("#checkout-form")?.addEventListener("submit", handleSubmit);
    return;
  }

  // Flujo local (invitado / o simplemente total en URL)
  if (QS.has("monto")) {
    const montoUrl = Number(QS.get("monto") || 0);
    const isSourceOk = snapshot?.source === "local" || snapshot?.source === "legacy";

    if (!snapshotVigente(snapshot) || !isSourceOk) {
      putMessage("No se encontró el resumen de compra. Volvé al carrito para iniciar el pago.");
      return;
    }
    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const totalSnap = Number(snapshot.total || 0);
    if (!items.length || totalSnap <= 0) {
      putMessage("Tu carrito está vacío. Volvé al catálogo y añadí productos.");
      return;
    }
    if (Math.abs(totalSnap - montoUrl) > 1) {
      putMessage("Detectamos un desajuste en el total. Volvé al carrito y reintentá.");
      return;
    }

    putMessage(`Total a pagar: ${fmtGs(totalSnap)}. Completá el formulario y simulá el pago.`, "ok");
    await initUI(snapshot, totalSnap);
    $("#checkout-form")?.addEventListener("submit", handleSubmit);
    return;
  }

  // sin contexto
  putMessage('Faltan datos del checkout. Accedé con el botón “Comprar ahora” del carrito.');
  await initUI(null, 0);
}

init();
