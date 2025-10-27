// JS/pasarelaPagos.js
// Guarda metodo_pago (String) y los detalles del pedido en public.detalles_pedido.
// Sin validar nada más. Default Efectivo si no hay selección.

import { supabase } from "./ScriptLogin.js";

const QS = new URLSearchParams(location.search);

// Mapa: value del radio -> etiqueta a guardar
const METODO_LABEL = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

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
  const title = type === "ok" ? "Listo: " : type === "warn" ? "Atención: " : "";
  box.innerHTML = `<b>${title}</b>${msg}`;
}

function setupMetodoPagoUI() {
  const radios = document.querySelectorAll(".metodo-radio");
  const panels = document.querySelectorAll(".metodo-panel");
  const show = (m) =>
    panels.forEach((p) => p.classList.toggle("disabled", p.dataset.metodo !== m));
  radios.forEach((r) => {
    r.addEventListener("change", () => show(r.value));
    if (r.checked) show(r.value);
  });
}

// Crea un pedido mínimo con metodo_pago (+ usuario_id si hay sesión)
async function crearPedidoMinimal(metodoPago, montoTotal) {
  const { data: { user } = {} } = await supabase.auth.getUser();
  const row = {
    metodo_pago: metodoPago,
    estado: "pendiente",
    estado_pago: "pendiente",
    monto_total: Number(montoTotal || 0) || 0
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
  // monto_total es opcional; si existe la columna, lo actualizamos también
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

// Inserta todos los ítems en detalles_pedido para un pedido dado
async function insertarDetalles(pedidoId, items) {
  const rows = (items || [])
    .filter(it => it && it.id) // esperamos id del producto
    .map(it => ({
      pedido_id: pedidoId,
      producto_id: String(it.id),
      cantidad: Number(it.cantidad || 1),
      precio_unitario: Number(it.precio || 0)
    }));

  if (!rows.length) return { count: 0 };

  const { error } = await supabase.from("detalles_pedido").insert(rows);
  if (error) throw error;
  return { count: rows.length };
}

async function init() {
  setupMetodoPagoUI();

  const form = document.getElementById("checkout-form");
  const success = document.getElementById("checkout-success");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1) Método de pago (default Efectivo)
    const raw = document.querySelector('input[name="metodo"]:checked')?.value || "efectivo";
    const metodoPago = METODO_LABEL[raw] || "Efectivo";

    // 2) Snapshot del carrito (local o remoto)
    let items = [];
    let total = 0;
    try {
      const snap = await window.CartAPI?.getSnapshot?.();
      items = Array.isArray(snap?.items) ? snap.items : [];
      total = Number(snap?.total || 0) || 0;
    } catch (err) {
      // Si no hay CartAPI, seguimos; podemos crear el pedido sin detalles
      console.warn("[checkout] No se pudo leer el carrito:", err);
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn?.setAttribute("disabled", "true");

    try {
      // 3) ¿Actualizar o crear pedido?
      const qsPedido = QS.get("pedido")?.trim();
      let pedido;

      if (qsPedido) {
        pedido = await actualizarMetodoPago(qsPedido, metodoPago, total);
      } else {
        pedido = await crearPedidoMinimal(metodoPago, total);
      }

      // 4) Insertar detalles (si hay items)
      if (items.length) {
        await insertarDetalles(pedido.id, items);
      }

      // 5) Vaciar carrito (si existe API)
      try { await window.CartAPI?.empty?.(); } catch {}

      // 6) UI de éxito
      putMessage(`Pedido confirmado (${pedido.id}). Método: <b>${pedido.metodo_pago}</b>.`, "ok");
      success?.classList.remove("disabled");
      form.classList.add("disabled");
      try { window.CartAPI?.refreshBadge?.(); } catch {}

      setTimeout(() => { window.location.assign("index.html"); }, 1200);
    } catch (err) {
      console.error(err);
      putMessage("No se pudo confirmar el pedido. Reintentá.");
      submitBtn?.removeAttribute("disabled");
    }
  });
}

init();
