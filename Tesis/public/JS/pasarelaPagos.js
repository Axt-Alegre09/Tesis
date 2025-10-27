// JS/pasarelaPagos.js
// - Mantiene tu flujo actual (crear/actualizar 'pedidos').
// - ADICIONAL: inserta snapshot completo en 'public.pedidos_snapshot'.
// - Sin validaciones estrictas; método de pago default 'Efectivo'.

import { supabase } from "./ScriptLogin.js";

const QS = new URLSearchParams(location.search);
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

const METODO_LABEL = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

// ---------------- UI helpers ----------------
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
  const efTotal = document.getElementById("efectivo-total");
  if (efTotal) efTotal.value = fmtGs(snapshotTotal);
}

// -------------- Lectura de carrito/items --------------
async function getItemsFromCartAPI() {
  try {
    const snap = await window.CartAPI?.getSnapshot?.();
    const items = Array.isArray(snap?.items) ? snap.items : [];
    return items.map((it) => ({
      id: String(it.id),
      cantidad: Number(it.cantidad || 1),
      precio: Number(it.precio || 0),
      titulo: it.titulo || null,
      imagen: it.imagen || null,
    }));
  } catch {
    return [];
  }
}

async function getItemsFromDB() {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user?.id) return [];

    const { data: carritoId } = await supabase.rpc("asegurar_carrito");
    if (!carritoId) return [];

    const { data: items } = await supabase
      .from("carrito_items")
      .select("producto_id, cantidad")
      .eq("carrito_id", carritoId);

    if (!items?.length) return [];

    const ids = items.map((i) => i.producto_id);
    const { data: prods } = await supabase
      .from("v_productos_publicos")
      .select("id, nombre, precio, imagen")
      .in("id", ids);

    const map = new Map((prods || []).map((p) => [String(p.id), p]));
    return items.map((i) => {
      const p = map.get(String(i.producto_id)) || {};
      return {
        id: String(i.producto_id),
        cantidad: Number(i.cantidad || 1),
        precio: Number(p.precio || 0),
        titulo: p.nombre || null,
        imagen: p.imagen || null,
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

// -------------- Lectura formulario (sin validar) --------------
const v = (id) => document.getElementById(id)?.value?.trim() || "";

function readProfileForm() {
  return {
    ruc: v("ruc"),
    razon: v("razon"),
    tel: v("tel"),
    mail: v("mail"),
    contacto: v("contacto"),
    ciudad: v("ciudad"),
    barrio: v("barrio"),
    depto: v("depto"),
    postal: v("postal"),
    calle1: v("calle1"),
    calle2: v("calle2"),
    nro: v("nro"),
    hora_desde: v("hora-desde") || null,
    hora_hasta: v("hora-hasta") || null,
  };
}

// -------------- Pedidos (como tenés hoy) --------------
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
  return data;
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

async function insertarDetallesPedido(pedidoId, items) {
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

// -------------- NUEVO: snapshot aparte --------------
async function insertCheckoutSnapshot({ pedido, metodoPago, items, profile, total }) {
  const { data: { user } = {} } = await supabase.auth.getUser();
  const row = {
    pedido_id: pedido?.id || null,
    usuario_id: user?.id || null,
    metodo_pago: metodoPago || "Efectivo",
    total: Number(total || 0) || 0,
    ruc: profile.ruc, razon: profile.razon, tel: profile.tel, mail: profile.mail, contacto: profile.contacto,
    ciudad: profile.ciudad, barrio: profile.barrio, depto: profile.depto, postal: profile.postal,
    calle1: profile.calle1, calle2: profile.calle2, nro: profile.nro,
    hora_desde: profile.hora_desde || null,
    hora_hasta: profile.hora_hasta || null,
    items: items?.length ? items.map(it => ({
      id: it.id, titulo: it.titulo, cantidad: it.cantidad, precio: it.precio, imagen: it.imagen || null
    })) : [],
    extra: {},  // por si luego querés guardar algo adicional
  };
  const { error } = await supabase.from("pedidos_snapshot").insert(row);
  if (error) throw error;
}

// -------------- INIT --------------
async function init() {
  // Mensaje inicial
  putMessage("Completá los datos y presioná Pagar.", "ok");

  // Mostrar total en panel Efectivo (si hay snapshot de carrito)
  let snapshotTotal = 0;
  try {
    const snap = await window.CartAPI?.getSnapshot?.();
    snapshotTotal = Number(snap?.total || 0);
  } catch {}
  setupMetodoPagoUI(snapshotTotal);

  const form = document.getElementById("checkout-form");
  const success = document.getElementById("checkout-success");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn?.setAttribute("disabled", "true");

    try {
      // 1) Método de pago (default Efectivo, sin validación)
      const raw = document.querySelector('input[name="metodo"]:checked')?.value || "efectivo";
      const metodoPago = METODO_LABEL[raw] || "Efectivo";

      // 2) Items: primero CartAPI; si no hay, desde BD
      let items = await getItemsFromCartAPI();
      if (!items.length) items = await getItemsFromDB();
      let total = computeTotal(items);

      // 3) Perfil/dirección desde el form (sin validar)
      const profile = readProfileForm();

      // 4) Crear o actualizar 'pedidos' (lo que ya usás)
      const qsPedido = QS.get("pedido")?.trim();
      let pedido;
      if (qsPedido) {
        pedido = await actualizarMetodoPago(qsPedido, metodoPago, total);
      } else {
        pedido = await crearPedidoMinimal(metodoPago, total);
      }

      // 5) Insertar detalles en 'detalles_pedido' (opcional pero recomendado)
      if (items.length) {
        await insertarDetallesPedido(pedido.id, items);
        if (!Number(pedido.monto_total)) {
          const nuevoTotal = computeTotal(items);
          if (nuevoTotal > 0) {
            await supabase.from("pedidos").update({ monto_total: nuevoTotal }).eq("id", pedido.id);
            total = nuevoTotal;
          }
        }
      }

      // 6) NUEVO: snapshot completo en tabla aparte
      await insertCheckoutSnapshot({ pedido, metodoPago, items, profile, total });

      // 7) Vaciar carrito si existe API
      try { await window.CartAPI?.empty?.(); } catch {}

      // 8) Feedback
      putMessage(`✅ Pedido confirmado. N°: ${pedido.id} — Total: ${fmtGs(total)} — Método: ${pedido.metodo_pago}`, "ok");
      success?.classList.remove("disabled");
      form.classList.add("disabled");
      try { window.CartAPI?.refreshBadge?.(); } catch {}

      setTimeout(() => { window.location.assign("index.html"); }, 1200);
    } catch (err) {
      console.error("[checkout] Error:", err);
      const msg = err?.message || err?.error_description || "No se pudo confirmar la compra.";
      putMessage(msg, "err");
      submitBtn?.removeAttribute("disabled");
    }
  });
}

init();
