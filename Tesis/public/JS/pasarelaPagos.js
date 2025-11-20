// ============================================================================
// pasarelaPagos.js - VERSIÓN CON TRACKING DE PROMOCIONES
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase inicializado con tracking de promociones");

// OBTENER DATOS DEL FORMULARIO
// ============================================================================

function getFormData() {
  const form = document.querySelector("#checkout-form");
  if (!form) {
    console.error("Formulario no encontrado");
    return null;
  }

  const formData = new FormData(form);
  const data = {};

  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  console.log("Datos del formulario capturados");
  return data;
}

// ============================================================================
// OBTENER CARRITO CON SOPORTE DE PROMOCIONES
// ============================================================================

function getCartFromSessionStorage() {
  // 1. Primero intentar desde localStorage (donde lo guardó checkout.js)
  const storedCartLocal = localStorage.getItem("carrito");
  if (storedCartLocal) {
    try {
      const cartData = JSON.parse(storedCartLocal);
      console.log("Carrito obtenido desde localStorage");
      console.log("   Items:", cartData.items?.length || 0);
      console.log("   Total:", cartData.total || 0);
      
      // Detectar si hay promociones
      const tienePromos = cartData.items?.some(item => item.tienePromo);
      if (tienePromos) {
        console.log("Se detectaron items con promoción!");
      }
      
      return cartData;
    } catch (err) {
      console.warn("Error parseando localStorage:", err);
    }
  }

  // 2. Fallback: sessionStorage
  const storedCart = sessionStorage.getItem("carrito");
  if (storedCart) {
    try {
      const cartData = JSON.parse(storedCart);
      console.log("Carrito obtenido desde sessionStorage");
      return cartData;
    } catch (err) {
      console.warn("Error parseando sessionStorage:", err);
    }
  }

  // 3. Fallback: URL param
  const params = new URLSearchParams(window.location.search);
  const monto = params.get("monto");
  
  if (monto) {
    console.log("Carrito obtenido desde URL param (monto):", monto);
    return {
      items: [],
      total: Number(monto)
    };
  }

  console.error("Carrito no encontrado");
  return null;
}

// CALCULAR DESCUENTOS TOTALES
// ============================================================================

function calcularDescuentos(items) {
  let totalSinDescuento = 0;
  let totalConDescuento = 0;
  let descuentoTotal = 0;

  (items || []).forEach(item => {
    const cantidad = Number(item.cantidad || 1);
    const precio = Number(item.precio);
    
    // NUEVO: Calcular precio original si tiene descuento
    let precioOriginal = precio;
    if (item.tienePromo && item.descuentoPorcentaje > 0) {
      // Si tiene 5% de descuento, el precio actual es el 95% del original
      // precio_original = precio_actual / (1 - descuento/100)
      precioOriginal = precio / (1 - item.descuentoPorcentaje/100);
    }
    
    totalSinDescuento += precioOriginal * cantidad;
    totalConDescuento += precio * cantidad;
    
    if (item.tienePromo) {
      const descuentoItem = (precioOriginal - precio) * cantidad;
      descuentoTotal += descuentoItem;
      
      console.log(`  ${item.titulo}: ${item.descuentoPorcentaje}% OFF`);
      console.log(`      Original calculado: ${precioOriginal} x ${cantidad}`);
      console.log(`      Final: ${precio} x ${cantidad}`);
      console.log(`      Ahorro: ${descuentoItem}`);
    }
  });

  console.log(`Total sin descuento: ${totalSinDescuento}`);
  console.log(`Total con descuento: ${totalConDescuento}`);
  console.log(`Ahorro total: ${descuentoTotal}`);

  return {
    totalSinDescuento,
    totalConDescuento,
    descuentoTotal,
    tienePromos: descuentoTotal > 0
  };
}

// ============================================================================
// CONSTRUIR PAYLOAD CON SOPORTE DE PROMOCIONES
// ============================================================================

function buildPayload(cartData, formData, metodo) {
  console.log(" buildPayload() - Construyendo con tracking de promociones...");

  if (!cartData) {
    throw new Error("Cart data vacío");
  }

  // Procesar items con detalle de promociones
  const items = [];
  const itemsDetalle = [];
  
  if (Array.isArray(cartData.items) && cartData.items.length > 0) {
    for (const item of cartData.items) {
      if (!item.id || !item.precio || !item.cantidad) continue;
      
      // Para RPC crear_pedido_desde_checkout
      items.push({
        id: item.id,
        precio: Number(item.precio),
        cantidad: Number(item.cantidad),
        nombre: item.titulo || item.nombre || "Sin nombre"
      });
      
      // Para tabla pedido_detalle_items
      const cantidad = Number(item.cantidad || 1);
      const precioUnitario = item.tienePromo && item.precioOriginal 
        ? Number(item.precioOriginal) 
        : Number(item.precio);
      const descuentoAplicado = item.tienePromo && item.precioOriginal
        ? (Number(item.precioOriginal) - Number(item.precio)) * cantidad
        : 0;
      
      itemsDetalle.push({
        producto_nombre: item.titulo || item.nombre || "Producto",
        cantidad: cantidad,
        precio_unitario: precioUnitario,
        descuento_aplicado: descuentoAplicado,
        subtotal: Number(item.precio) * cantidad
      });
    }
  }

  // Calcular totales con descuentos
  const descuentos = calcularDescuentos(cartData.items);

  const total = Number(cartData.total || 0);
  const metodo_pago = metodo || "transferencia";

  const payload = {
    items,
    itemsDetalle, // Nuevo: detalle para guardar
    total,
    metodo_pago,
    // Datos de promociones
    tienePromos: descuentos.tienePromos,
    descuentoTotal: descuentos.descuentoTotal,
    totalSinDescuento: descuentos.totalSinDescuento,
    // Datos del cliente
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

  console.log("Payload construido con datos de promociones");
  return payload;
}

// ============================================================================
// GUARDAR PEDIDO CON TRACKING DE PROMOCIONES
// ============================================================================

async function guardarPedidoEnBD(usuario, email, cartData, formData, metodo) {
  try {
    console.log("Guardando pedido con tracking de promociones...");

    const payload = buildPayload(cartData, formData, metodo);

    // 1. Crear pedido principal
    const { data, error } = await supabase.rpc("crear_pedido_desde_checkout", {
      p_usuario: usuario,
      p_checkout: payload
    });

    if (error) {
      console.error("Error en RPC:", error);
      throw error;
    }

    console.log("Pedido creado");

    const resultado = data[0];
    const pedidoId = resultado.pedido_id;

    // 2. Si hay promociones, registrarlas
    if (payload.tienePromos && payload.descuentoTotal > 0) {
      console.log("Registrando promociones aplicadas...");
      
      const { error: errorPromo } = await supabase
        .from("pedidos_con_promo")
        .insert({
          pedido_id: pedidoId,
          descuento_total: payload.descuentoTotal,
          monto_sin_descuento: payload.totalSinDescuento,
          monto_con_descuento: payload.total
        });

      if (errorPromo) {
        console.error("Error guardando promoción (no crítico):", errorPromo);
      } else {
        console.log("Promoción registrada correctamente");
        console.log(`   Descuento total: Gs ${payload.descuentoTotal}`);
      }
    }

    // 3. Guardar detalle de items
    if (payload.itemsDetalle && payload.itemsDetalle.length > 0) {
      console.log("Guardando detalle de items...");
      
      const itemsConPedidoId = payload.itemsDetalle.map(item => ({
        ...item,
        pedido_id: pedidoId
      }));
      
      const { error: errorDetalle } = await supabase
        .from("pedido_detalle_items")
        .insert(itemsConPedidoId);

      if (errorDetalle) {
        console.error("Error guardando detalle de items (no crítico):", errorDetalle);
      } else {
        console.log("Detalle de items guardado");
      }
    }

    return {
      pedido_id: pedidoId,
      snapshot_id: resultado.snapshot_id,
      debug_msg: resultado.debug_msg,
      tienePromos: payload.tienePromos,
      descuentoTotal: payload.descuentoTotal
    };
    
  } catch (err) {
    console.error("Error guardando pedido:", err);
    throw err;
  }
}

// INTERCEPTAR FORM SUBMIT
// ============================================================================

function setupFormInterceptor() {
  const form = document.querySelector("#checkout-form");

  if (!form) {
    console.log("Esperando formulario #checkout-form...");
    setTimeout(setupFormInterceptor, 100);
    return;
  }

  console.log("Formulario encontrado");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log(" PROCESANDO PEDIDO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      // 1. Obtener usuario
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("Usuario no autenticado");
      }

      const usuario = userData.user.id;
      const email = userData.user.email;

      // 2. Obtener carrito
      const cartData = getCartFromSessionStorage();
      if (!cartData || cartData.total === 0) {
        throw new Error("Carrito vacío o total = 0");
      }

      // 3. Obtener datos del formulario
      const formData = getFormData();
      if (!formData) {
        throw new Error("No se pudieron obtener datos del formulario");
      }

      // 4. Método de pago
      const metodoSeleccionado = document.querySelector(
        'input[name="metodo"]:checked'
      )?.value || "transferencia";

      // 5. Guardar pedido con tracking de promociones
      const resultado = await guardarPedidoEnBD(
        usuario,
        email,
        cartData,
        formData,
        metodoSeleccionado
      );

      console.log("Pedido creado exitosamente");
      console.log("   ID: " + resultado.pedido_id);
      
      if (resultado.tienePromos) {
        console.log("  Con promociones aplicadas");
        console.log("   Ahorro total: Gs " + resultado.descuentoTotal);
      }

      // 6. Limpiar carrito
      sessionStorage.removeItem("carrito");
      localStorage.removeItem("carrito");
      localStorage.removeItem("productos-en-carrito");
      console.log("Carrito limpiado");

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(" PEDIDO COMPLETADO");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (err) {
      console.error("Error en submit:", err);
      alert("Error: " + err.message);
    }
  });

  console.log("Interceptor configurado");
}

// ============================================================================
// INICIALIZAR
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("pasarelaPagos.js - Versión con tracking de promociones");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  setupFormInterceptor();

  const cartData = getCartFromSessionStorage();
  if (cartData) {
    console.log("Carrito cargado:");
    console.log("   Items:", cartData.items?.length || 0);
    console.log("   Total:", new Intl.NumberFormat("es-PY").format(cartData.total || 0), "Gs");
    
    // Detectar promociones
    const tienePromos = cartData.items?.some(item => item.tienePromo);
    if (tienePromos) {
      console.log(" Contiene items con promoción");
    }
  }

  console.log(" Módulo listo");
});
