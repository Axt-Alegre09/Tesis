// JS/pasarelaPagos.js
// Guarda metodo_pago (String) y los detalles del pedido.
// No valida datos sensibles. Default: Efectivo.

import { supabase } from "./ScriptLogin.js";

const QS = new URLSearchParams(location.search);
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

// ================= UI helpers =================
function putMessage(msg, type = "info") {
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
  const title =
    type === "ok" ? "Listo: " : type === "warn" ? "Atención: " : type === "err" ? "Error: " : "";
  box.innerHTML = `<b>${title}</b>${msg}`;
}

function setupMetodoPagoUI(snapshotTotal = 0) {
  const radios = document.querySelectorAll(".metodo-radio");
  const panels = document.querySelectorAll(".metodo-panel");

  const show = (m) =>
    panels.forEach((p) => p.classList.toggle("disabled", p.getAttribute("data-metodo") !== m));

  radios.forEach((r) => {
    r.addEventListener("change", () => show(r.value));
    if (r.checked) show(r.value);
  });

  // Completar el total en el panel de efectivo
  const efTotal = document.getElementById("efectivo-total");
  if (efTotal) efTotal.value = fmtGs(snapshotTotal);
}

// ================= Métodos de pago =================
const METODO_LABEL = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

// ================== Helpers items ==================
async function getItemsFromCartAPI() {
  try {
    const snap = await window.CartAPI?.getSnapshot?.();
    const items = Array.isArray(snap?.items) ? snap.items : [];
    return items.map((it) => ({
      id: String(it.id),
      cantidad: Number(it.cantidad || 1),
      precio: Number(it.precio || 0),
      titulo: it.titulo || null,
    }));
  } catch {
    return [];
  }
}

async function getItemsFromDB() {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user?.id) return [];

    // asegurar carrito (función RPC existente en tu proyecto)
    const { data: carritoId, error: e1 } = await supabase.rpc("asegurar_carrito");
    if (e1 || !carritoId) return [];

    // items del carrito
    const { data: items, error: e2 } = await supabase
      .from("carrito_items")
      .select("producto_id, cantidad")
      .eq("carrito_id", carritoId);
    if (e2 || !items?.length) return [];

    // precios y nombres de productos
    const ids = items.map((i) => i.producto_id);
    const { data: prods, error: e3 } = await supabase
      .from("v_productos_publicos")
      .select("id, nombre, precio")
      .in("id", ids);
    if (e3) return [];

    const map = new Map(prods.map((p) => [String(p.id), p]));
    return items.map((i) => {
      const p = map.get(String(i.producto_id)) || {};
      return {
        id: String(i.producto_id),
        cantidad: Number(i.cantidad || 1),
        precio: Number(p.precio || 0),
        titulo: p.nombre || null,
      };
    });
  } catch {
    return [];
  }
}

function computeTotal(items) {
  return items.reduce(
    (a, it) => a + Number(it.precio || 0) * Number(it.cantidad || 1),
    0
  );
}

async function insertarDetalles(pedidoId, items) {
  if (!items?.length) return;
  const rows = items.map((it) => ({
    pedido_id: pedidoId,
    producto_id: it.id,
    cantidad: it.cantidad,
    precio_unitario: it.precio,
  }));
  const { error } = await supabase.from("detalles_pedido").insert(rows);
  if (error) throw error;
}

// ================== Pedidos (crear/actualizar) ==================
async function crearPedidoMinimal(metodoPago, montoTotal) {
  const { data: { user } = {} } = await supabase.auth.getUser();

  const row = {
    metodo_pago: metodoPago,
    estado: "pendiente",
    estado_pago: "pendiente",
    monto_total: Number(montoTotal || 0) || 0,
  };
  if (user?.id) row.usuario_id = user.id;

  const { data, error } = await supabase
    .from("pedidos")
    .insert([row])
    .select("id, metodo_pago, monto_total")
    .single();

  if (error) throw error;
  return data; // { id, metodo_pago, monto_total }
}

async function actualizarMetodoPago(pedidoId, metodoPago, montoTotal) {
  const patch = { metodo_pago: metodoPago };
  if (typeof montoTotal !== "undefined") patch.monto_total = Number(montoTotal || 0) || 0;

  const { data, error } = await supabase
    .from("pedidos")
    .update(patch)
    .eq("id", pedidoId)
    .select("id, metodo_pago, monto_total")
    .single();

  if (error) throw error;
  return data;
}

// ================== Init (UI + Submit) ==================
async function init() {
  // contexto visual
  putMessage("Completá los datos y presioná Pagar.", "ok");

  // setear totales para efectivo si hay snapshot de carrito
  let snapshotTotal = 0;
  try {
    const snap = await window.CartAPI?.getSnapshot?.();
    snapshotTotal = Number(snap?.total || 0);
  } catch {}
  setupMetodoPagoUI(snapshotTotal);

  const form = document.getElementById("checkout-form");
  const success = document.getElementById("checkout-success");
  const btnFactura = document.getElementById("btn-descargar-factura");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn?.setAttribute("disabled", "true");

    try {
      // 1) Método de pago (default Efectivo)
      const raw = document.querySelector('input[name="metodo"]:checked')?.value || "efectivo";
      const metodoPago = METODO_LABEL[raw] || "Efectivo";

      // 2) Ítems: primero CartAPI, si no hay, leer desde BD
      let items = await getItemsFromCartAPI();
      if (!items.length) items = await getItemsFromDB();
      let total = computeTotal(items); // puede ser 0 si realmente no hay ítems

      // 3) Crear o actualizar pedido
      const qsPedido = QS.get("pedido")?.trim();
      let pedido;
      if (qsPedido) {
        pedido = await actualizarMetodoPago(qsPedido, metodoPago, total);
      } else {
        pedido = await crearPedidoMinimal(metodoPago, total);
      }

      // 4) Insertar detalles
      if (items.length) {
        await insertarDetalles(pedido.id, items);
        // Si quedó total en 0, actualizar con el calculado
        if (!Number(pedido.monto_total)) {
          const nuevoTotal = computeTotal(items);
          if (nuevoTotal > 0) {
            await supabase.from("pedidos").update({ monto_total: nuevoTotal }).eq("id", pedido.id);
            total = nuevoTotal;
          }
        }
      }

      // 5) Vaciar carrito si existe API
      try {
        await window.CartAPI?.empty?.();
      } catch {}

      // 6) Feedback visual + navegación
      putMessage(`✅ Pedido confirmado. N°: ${pedido.id} — Total: ${fmtGs(total)} — Método: ${pedido.metodo_pago}`, "ok");
      success?.classList.remove("disabled");
      form.classList.add("disabled");
      try { window.CartAPI?.refreshBadge?.(); } catch {}

      // (opcional) botón de factura si lo usás
      if (btnFactura) {
        btnFactura.onclick = () => alert("Generación de factura simulada (puedes integrar jsPDF).");
      }

      setTimeout(() => {
        window.location.assign("index.html");
      }, 1200);
    } catch (err) {
      console.error("[checkout] Error:", err);
      const msg = err?.message || err?.error_description || "No se pudo confirmar la compra.";
      putMessage(msg, "err");
      submitBtn?.removeAttribute("disabled");
    }
  });
}

// Boot
init();
