// JS/pasarelaPagos.js - VERSIÓN CORREGIDA
// Asegura que los items se envíen correctamente al RPC

import { supabase } from "./ScriptLogin.js";

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
  const prefix = type === "ok" ? "✅ Listo: " : type === "err" ? "❌ Error: " : type === "warn" ? "⚠️ Atención: " : "";
  box.innerHTML = `<b>${prefix}</b>${msg}`;
}

function readSnapshotFromSession() {
  try {
    const raw = sessionStorage.getItem("checkout_snapshot") ?? sessionStorage.getItem("checkout");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getFormValue(id) { 
  return ($(id)?.value ?? "").trim(); 
}

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
  
  // CRÍTICO: Asegurar que items sea un array válido
  let items = [];
  if (Array.isArray(snap.items) && snap.items.length > 0) {
    items = snap.items;
  } else {
    // Fallback: intentar leer del localStorage si no hay snapshot
    try {
      const cartLocal = JSON.parse(localStorage.getItem('productos-en-carrito') || '[]');
      items = cartLocal;
    } catch {
      items = [];
    }
  }

  console.log("📦 Items desde snapshot/localStorage:", items);

  // Validar que items tenga datos
  if (!items || items.length === 0) {
    console.error("❌ No hay items en el carrito");
    throw new Error("El carrito está vacío");
  }

  // Calcular total
  const total = Number(
    snap.total ||
    items.reduce((a, it) => a + Number(it.precio || 0) * Number(it.cantidad || 1), 0)
  ) || 0;

  console.log("💰 Total calculado:", total);

  const metodo = document.querySelector('input[name="metodo"]:checked')?.value || "transferencia";

  // CRÍTICO: Formatear items correctamente
  const itemsFormateados = items.map(it => {
    const item = {
      id: String(it.id || ''),  // Convertir a string por si acaso
      titulo: String(it.titulo || it.nombre || 'Producto'),
      precio: Number(it.precio || 0),
      cantidad: Number(it.cantidad || 1)
    };
    console.log("📝 Item formateado:", item);
    return item;
  });

  const payload = {
    source: snap.source || "local",
    items: itemsFormateados,
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

  console.log("🚀 Payload completo a enviar:", JSON.stringify(payload, null, 2));

  return payload;
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
  
  // Scroll suave al éxito
  $("#checkout-success")?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------- Submit (capturing para evitar dobles envíos) ----------------
async function onSubmitCapture(ev) {
  ev.preventDefault();
  ev.stopImmediatePropagation();

  console.log("🔵 Iniciando proceso de pago...");

  const btn = $("#checkout-form button[type='submit']");
  btn?.setAttribute("disabled", "true");

  try {
    // 1. Verificar usuario
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { 
      toast("Debes iniciar sesión para pagar.", "err"); 
      btn?.removeAttribute("disabled"); 
      return; 
    }
    console.log("✅ Usuario autenticado:", user.id);

    // 2. Construir payload
    let payload;
    try {
      payload = buildPayloadFromUI();
    } catch (err) {
      toast(err.message || "Error al construir el pedido", "err");
      btn?.removeAttribute("disabled");
      return;
    }

    // 3. Validar items
    if (!payload.items?.length) {
      toast("Tu carrito está vacío o no se pudo leer el snapshot.", "err");
      btn?.removeAttribute("disabled");
      return;
    }
    console.log("✅ Payload construido con", payload.items.length, "items");

    // 4. Llamar al RPC
    console.log("🔵 Llamando a crear_pedido_desde_checkout...");
    const { data, error } = await supabase.rpc("crear_pedido_desde_checkout", {
      p_usuario: user.id,
      p_checkout: payload
    });

    if (error) {
      console.error("❌ Error del RPC:", error);
      throw error;
    }

    console.log("✅ Respuesta del RPC:", data);

    const { pedido_id, snapshot_id } = (data || [])[0] || {};
    
    if (!pedido_id) {
      throw new Error("No se recibió el ID del pedido");
    }

    console.log("✅ Pedido creado:", pedido_id);
    window.__pedido_ok__ = { pedido_id, snapshot_id };

    // 5. Limpieza
    try { 
      await window.CartAPI?.empty?.(); 
      console.log("✅ Carrito vaciado");
    } catch (e) {
      console.warn("⚠️ Error al vaciar carrito:", e);
    }
    
    sessionStorage.removeItem("checkout_snapshot");
    sessionStorage.removeItem("checkout");
    localStorage.removeItem("productos-en-carrito");
    console.log("✅ Storage limpiado");

    // 6. Mostrar éxito
    toast(`Pedido confirmado. Total: ${fmtPY(payload.total)} — Método: ${payload.metodo_pago}`, "ok");
    showSuccess(payload.total, { pedido_id, metodo_pago: payload.metodo_pago });

  } catch (err) {
    console.error("❌ Error completo:", err);
    console.error("Stack:", err.stack);
    toast(err?.message || err?.error_description || "No se pudo confirmar la compra.", "err");
    btn?.removeAttribute("disabled");
  }
}

(function init() {
  console.log("🔵 Inicializando pasarelaPagos.js");
  setupMetodoPagoUI();
  const form = $("#checkout-form");
  if (form) {
    form.addEventListener("submit", onSubmitCapture, { capture: true });
    console.log("✅ Event listener de submit registrado");
  } else {
    console.error("❌ No se encontró el formulario #checkout-form");
  }
})();