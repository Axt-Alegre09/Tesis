// ============================================================================
// pasarelaPagos.js - VERSIÓN FINAL CORREGIDA
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase inicializado");

// ============================================================================
// OBTENER DATOS DEL FORMULARIO
// ============================================================================

function getFormData() {
  const form = document.querySelector("#checkout-form");
  if (!form) {
    console.error("❌ Formulario no encontrado");
    return null;
  }

  const formData = new FormData(form);
  const data = {};

  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  console.log("📋 Datos del formulario capturados:", data);
  return data;
}

// ============================================================================
// OBTENER CARRITO - CON FALLBACK A URL PARAM
// ============================================================================

function getCartFromSessionStorage() {
  // 1. Intentar desde sessionStorage
  const storedCart = sessionStorage.getItem("carrito");
  if (storedCart) {
    try {
      const cartData = JSON.parse(storedCart);
      console.log("✅ Carrito obtenido desde sessionStorage");
      return cartData;
    } catch (err) {
      console.warn("⚠️ Error parseando sessionStorage:", err);
    }
  }

  // 2. Fallback: Construir desde URL param (monto)
  const params = new URLSearchParams(window.location.search);
  const monto = params.get("monto");
  
  if (monto) {
    console.log("✅ Carrito obtenido desde URL param (monto):", monto);
    // Retornar carrito mínimo con el monto
    return {
      items: [],
      total: Number(monto)
    };
  }

  console.error("❌ Carrito no encontrado en sessionStorage ni URL");
  return null;
}

// ============================================================================
// CONSTRUIR PAYLOAD CON DATOS CLIENTE
// ============================================================================

function buildPayload(cartData, formData, metodo) {
  console.log("🔵 buildPayload() - Iniciando...");
  console.log("   cartData recibido:", cartData);

  if (!cartData) {
    throw new Error("Cart data vacío");
  }

  // Procesar items - pueden estar vacíos si vinieron desde URL
  const items = [];
  if (Array.isArray(cartData.items) && cartData.items.length > 0) {
    for (const item of cartData.items) {
      if (!item.id || !item.precio || !item.cantidad) continue;
      items.push({
        id: item.id,
        precio: Number(item.precio),
        cantidad: Number(item.cantidad),
        nombre: item.nombre || "Sin nombre"
      });
    }
  }

  console.log("✅ Items procesados:", items.length);

  const total = Number(cartData.total || 0);
  console.log("💰 Total calculado:", total);

  const metodo_pago = metodo || "transferencia";
  console.log("💳 Método de pago:", metodo_pago);

  console.log("👤 Datos del cliente:", {
    razon: formData?.razon || "",
    ruc: formData?.ruc || "",
    tel: formData?.tel || "",
    mail: formData?.mail || "",
    contacto: formData?.contacto || "",
    ciudad: formData?.ciudad || "",
    barrio: formData?.barrio || "",
    depto: formData?.depto || "",
    postal: formData?.postal || "",
    calle1: formData?.calle1 || "",
    calle2: formData?.calle2 || "",
    nro: formData?.nro || ""
  });

  const payload = {
    items,
    total,
    metodo_pago,
    razon: formData?.razon || "",
    ruc: formData?.ruc || "",
    tel: formData?.tel || "",
    mail: formData?.mail || "",
    contacto: formData?.contacto || "",
    ciudad: formData?.ciudad || "",
    barrio: formData?.barrio || "",
    depto: formData?.depto || "",
    postal: formData?.postal || "",
    calle1: formData?.calle1 || "",
    calle2: formData?.calle2 || "",
    nro: formData?.nro || ""
  };

  console.log("✅ Payload construido completo");
  return payload;
}

// ============================================================================
// GUARDAR PEDIDO EN BD
// ============================================================================

async function guardarPedidoEnBD(usuario, email, cartData, formData, metodo) {
  try {
    console.log("🔵 Guardando pedido en BD...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    console.log("✅ Usuario:", usuario);
    console.log("   Email:", email);

    const payload = buildPayload(cartData, formData, metodo);

    console.log("✅ Payload construido");
    console.log("🚀 Llamando a crear_pedido_desde_checkout...");

    const { data, error } = await supabase.rpc("crear_pedido_desde_checkout", {
      p_usuario: usuario,
      p_checkout: payload
    });

    if (error) {
      console.error("❌ Error en RPC:", error);
      throw error;
    }

    console.log("✅ RPC ejecutado exitosamente");
    console.log("   Respuesta:", data);

    if (!data || data.length === 0) {
      throw new Error("RPC retornó respuesta vacía");
    }

    const resultado = data[0];
    console.log("🔍 DEBUG_MSG COMPLETO:");
    console.log("   " + resultado.debug_msg);

    return {
      pedido_id: resultado.pedido_id,
      snapshot_id: resultado.snapshot_id,
      debug_msg: resultado.debug_msg
    };
  } catch (err) {
    console.error("❌ Error guardando pedido:", err);
    throw err;
  }
}

// ============================================================================
// INTERCEPTAR FORM SUBMIT
// ============================================================================

function setupFormInterceptor() {
  const form = document.querySelector("#checkout-form");

  if (!form) {
    console.log("⏳ Esperando formulario #checkout-form...");
    setTimeout(setupFormInterceptor, 100);
    return;
  }

  console.log("✅ Formulario encontrado inmediatamente");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔵 SUBMIT INTERCEPTADO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      // 1. Obtener datos del usuario
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("Usuario no autenticado");
      }

      const usuario = userData.user.id;
      const email = userData.user.email;

      // 2. Obtener datos del carrito (con fallback a URL)
      const cartData = getCartFromSessionStorage();
      if (!cartData || cartData.total === 0) {
        throw new Error("Carrito vacío o total = 0");
      }

      // 3. OBTENER DATOS DEL FORMULARIO
      const formData = getFormData();
      if (!formData) {
        throw new Error("No se pudieron obtener datos del formulario");
      }

      // 4. Obtener método de pago seleccionado
      const metodoSeleccionado = document.querySelector(
        'input[name="metodo"]:checked'
      )?.value || "transferencia";

      console.log("🔵 Guardando en BD primero...");

      // 5. Guardar pedido en BD
      const resultado = await guardarPedidoEnBD(
        usuario,
        email,
        cartData,
        formData,
        metodoSeleccionado
      );

      console.log("✅ Pedido creado exitosamente");
      console.log("   ID del pedido:", resultado.pedido_id);

      // 6. Limpiar carrito
      console.log("🧹 Limpiando carrito...");
      sessionStorage.removeItem("carrito");
      localStorage.removeItem("carrito");
      console.log("✅ Carrito limpiado");

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ PEDIDO GUARDADO EXITOSAMENTE");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (err) {
      console.error("❌ Error en submit:", err);
      alert("Error: " + err.message);
    }
  });

  console.log("✅ Interceptor configurado correctamente");
}

// ============================================================================
// INICIALIZAR
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ checkout-tarjetas.js cargado correctamente");
  console.log("🔵 pasarelaPagos.js - Iniciando...");

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔵 Inicializando pasarelaPagos.js");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  setupFormInterceptor();

  const cartData = getCartFromSessionStorage();
  if (cartData) {
    console.log("🛒 Items:", cartData.items?.length || 0);
    console.log("💰 Total:", new Intl.NumberFormat("es-PY").format(cartData.total || 0), "Gs");
  }

  console.log("✅ pasarelaPagos.js LISTO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
});