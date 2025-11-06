// JS/pasarelaPagos.js - VERSIÓN FINAL CORREGIDA
// Compatible con checkout.js existente

import { supabase } from "./ScriptLogin.js";

console.log("🔵 pasarelaPagos.js - Cargando...");

const $ = (id) => document.getElementById(id);
const fmtPY = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

// ============ OBTENER DATOS DEL CARRITO ============
function getCartData() {
  // 1. Intentar desde sessionStorage (checkout_snapshot)
  try {
    const snap = JSON.parse(sessionStorage.getItem("checkout_snapshot") || sessionStorage.getItem("checkout") || "null");
    if (snap && snap.items && snap.items.length > 0) {
      console.log("✅ Datos desde sessionStorage:", snap);
      return snap;
    }
  } catch (e) {
    console.warn("⚠️ Error leyendo sessionStorage:", e);
  }

  // 2. Intentar desde localStorage
  try {
    const cart = JSON.parse(localStorage.getItem("productos-en-carrito") || "[]");
    if (cart && cart.length > 0) {
      const total = cart.reduce((a, it) => a + Number(it.precio || 0) * Number(it.cantidad || 1), 0);
      console.log("✅ Datos desde localStorage:", { items: cart, total });
      return { items: cart, total, source: "local" };
    }
  } catch (e) {
    console.warn("⚠️ Error leyendo localStorage:", e);
  }

  console.error("❌ No se encontraron datos del carrito");
  return { items: [], total: 0, source: "none" };
}

// ============ CONSTRUIR PAYLOAD ============
function buildPayload(cartData) {
  if (!cartData || !cartData.items || cartData.items.length === 0) {
    throw new Error("El carrito está vacío");
  }

  const items = cartData.items.map(it => ({
    id: String(it.id || ''),
    titulo: String(it.titulo || it.nombre || 'Producto'),
    precio: Number(it.precio || 0),
    cantidad: Number(it.cantidad || 1)
  }));

  const total = Number(cartData.total || items.reduce((a, it) => a + it.precio * it.cantidad, 0));

  // Obtener método de pago
  const metodoInput = document.querySelector('input[name="metodo"]:checked');
  const metodo = metodoInput ? metodoInput.value : "efectivo";

  // Función helper para obtener valores de inputs
  const getValue = (id) => {
    const el = $(id);
    return el ? (el.value || "").trim() : "";
  };

  const payload = {
    source: cartData.source || "local",
    items,
    total,
    ruc: getValue("ruc"),
    razon: getValue("razon"),
    tel: getValue("tel"),
    mail: getValue("mail"),
    contacto: getValue("contacto"),
    ciudad: getValue("ciudad"),
    barrio: getValue("barrio"),
    depto: getValue("depto"),
    postal: getValue("postal"),
    calle1: getValue("calle1"),
    calle2: getValue("calle2"),
    nro: getValue("nro"),
    hora_desde: getValue("hora-desde"),
    hora_hasta: getValue("hora-hasta"),
    metodo_pago: metodo
  };

  console.log("🚀 Payload construido:");
  console.log("  - Items:", items.length);
  console.log("  - Total:", fmtPY(total));
  console.log("  - Método:", metodo);
  console.log("  - Payload completo:", JSON.stringify(payload, null, 2));

  return payload;
}

// ============ GUARDAR PEDIDO EN BD ============
async function guardarPedidoEnBD() {
  console.log("🔵 Iniciando guardarPedidoEnBD...");

  try {
    // 1. Verificar usuario
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("❌ No hay usuario autenticado");
      throw new Error("Debes iniciar sesión");
    }
    console.log("✅ Usuario autenticado:", user.id);

    // 2. Obtener datos del carrito
    const cartData = getCartData();
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      console.error("❌ Carrito vacío");
      throw new Error("El carrito está vacío");
    }
    console.log("✅ Carrito con", cartData.items.length, "items");

    // 3. Construir payload
    const payload = buildPayload(cartData);

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

    const result = Array.isArray(data) ? data[0] : data;
    const pedidoId = result?.pedido_id;
    
    if (!pedidoId) {
      console.error("❌ No se recibió pedido_id");
      throw new Error("No se pudo crear el pedido");
    }

    console.log("✅ Pedido creado exitosamente:", pedidoId);

    // 5. Guardar en window para acceso global
    window.__pedido_creado__ = {
      pedido_id: pedidoId,
      snapshot_id: result?.snapshot_id,
      total: payload.total,
      metodo: payload.metodo_pago
    };

    // 6. Limpiar carrito
    try {
      if (window.CartAPI && window.CartAPI.empty) {
        await window.CartAPI.empty();
        console.log("✅ Carrito vaciado via CartAPI");
      }
    } catch (e) {
      console.warn("⚠️ Error al vaciar CartAPI:", e);
    }

    // Limpiar storage
    try {
      localStorage.removeItem("productos-en-carrito");
      sessionStorage.removeItem("checkout_snapshot");
      sessionStorage.removeItem("checkout");
      console.log("✅ Storage limpiado");
    } catch (e) {
      console.warn("⚠️ Error al limpiar storage:", e);
    }

    return { success: true, pedido_id: pedidoId };

  } catch (err) {
    console.error("❌ Error en guardarPedidoEnBD:", err);
    console.error("Stack:", err.stack);
    return { success: false, error: err.message };
  }
}

// ============ INTERCEPTAR SUBMIT ============
function setupFormInterceptor() {
  const form = $("#checkout-form");
  
  if (!form) {
    console.error("❌ No se encontró #checkout-form");
    return;
  }

  console.log("✅ Formulario encontrado, configurando interceptor...");

  // Guardar el handler original de checkout.js
  const originalSubmit = form.onsubmit;

  // Nuevo handler que ejecuta ANTES
  form.addEventListener("submit", async function(e) {
    console.log("🔵 Submit interceptado por pasarelaPagos.js");

    // Verificar que haya datos
    const cartData = getCartData();
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      console.warn("⚠️ No hay items en el carrito, saltando guardado en BD");
      return; // Dejar que checkout.js maneje
    }

    // Guardar en BD de forma asíncrona (no blocking)
    guardarPedidoEnBD().then(result => {
      if (result.success) {
        console.log("✅ Pedido guardado en BD:", result.pedido_id);
      } else {
        console.error("❌ Error al guardar pedido:", result.error);
      }
    });

    // NO prevenir el evento - dejar que checkout.js continúe
    // El formulario seguirá su flujo normal
  }, { capture: true, once: false });

  console.log("✅ Interceptor configurado");
}

// ============ INICIALIZACIÓN ============
function init() {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔵 Inicializando pasarelaPagos.js");
  console.log("📍 URL:", window.location.pathname);
  console.log("📄 readyState:", document.readyState);
  
  // Verificar datos del carrito
  const cartData = getCartData();
  console.log("🛒 Carrito:");
  console.log("  - Items:", cartData?.items?.length || 0);
  console.log("  - Total:", fmtPY(cartData?.total || 0));
  
  // Setup interceptor del formulario
  setupFormInterceptor();

  console.log("✅ pasarelaPagos.js listo");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
}

// Esperar a que el DOM esté completamente cargado
if (document.readyState === "loading") {
  console.log("⏳ DOM aún cargando, esperando DOMContentLoaded...");
  document.addEventListener("DOMContentLoaded", init);
} else {
  console.log("✅ DOM ya está listo, ejecutando init...");
  // Agregar un pequeño delay para asegurar que TODO esté listo
  setTimeout(init, 100);
}

// Exponer función para testing manual
window.testGuardarPedido = guardarPedidoEnBD;
console.log("💡 Tip: Ejecuta window.testGuardarPedido() para probar manualmente");