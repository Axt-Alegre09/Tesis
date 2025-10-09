// JS/pasarelaPagos.js
// Valida el contexto del checkout (remoto/local) y muestra un aviso claro en la pasarela.
// No depende de Supabase aquí; la consulta real del pedido puede hacerse en otro módulo si lo necesitas.

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
  // válido por 5 minutos
  return (Date.now() - Number(snap.ts)) <= 5 * 60 * 1000;
}

// Lee snapshot desde sessionStorage (acepta nueva y legacy) y devuelve el más reciente.
function readSnapshot() {
  let a = null, b = null;
  try { a = JSON.parse(sessionStorage.getItem("checkout_snapshot")); } catch {}
  try { b = JSON.parse(sessionStorage.getItem("checkout")); } catch {}
  if (a && b) return (Number(a.ts || 0) >= Number(b.ts || 0)) ? a : b;
  return a || b || null;
}

// ---------- Lógica principal ----------
async function init() {
  const snapshot = readSnapshot();

  // ====== MODO REMOTO: viene un pedido de la BD ======
  if (hasValidPedido(QS)) {
    const pedidoId = QS.get("pedido");

    if (!snapshotVigente(snapshot) || snapshot?.source !== "remote" || snapshot?.pedidoId !== pedidoId) {
      putMessage(
        "No se encontró el resumen del pedido o está vencido. Volvé al carrito y repetí la operación."
      );
      return;
    }

    // (Opcional) Aquí podrías consultar a tu backend/DB para leer el total real por pedidoId
    // y mostrarlo, por ejemplo:
    // const total = await fetchTotalDePedido(pedidoId);
    // putMessage(`Pedido #${pedidoId} listo para pagar. Total: ${fmtGs(total)}.`, "ok");
    return;
  }

  // ====== MODO LOCAL: compra de invitado usando snapshot + ?monto= ======
  if (QS.has("monto")) {
    const montoUrl = Number(QS.get("monto") || 0);

    // Acepta snapshots con source "local" o "legacy"
    const isSourceLocal = snapshot?.source === "local" || snapshot?.source === "legacy";

    if (!snapshotVigente(snapshot) || !isSourceLocal) {
      putMessage("No se encontró el resumen de compra. Volvé al carrito para iniciar el pago.");
      return;
    }

    const items = Array.isArray(snapshot.items) ? snapshot.items : [];
    const totalSnap = Number(snapshot.total || 0);

    if (!items.length || totalSnap <= 0) {
      putMessage("Tu carrito está vacío. Volvé al catálogo y añadí productos.");
      return;
    }

    // Tolerancia mínima por redondeo
    if (Math.abs(totalSnap - montoUrl) > 1) {
      putMessage("Detectamos un desajuste en el total. Volvé al carrito y reintentá.");
      return;
    }

    putMessage(`Total a pagar: ${fmtGs(totalSnap)}. Completá el formulario y simulá el pago.`, "ok");
    return;
  }

  // ====== SIN CONTEXTO ======
  putMessage('Faltan datos del checkout. Accedé a esta página usando el botón “Comprar ahora” del carrito.');
}

init();
