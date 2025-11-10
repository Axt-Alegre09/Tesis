
// JS/pasarelaPagos.js - VERSIÓN FINAL CON MÓDULOS
import { supabase } from "./ScriptLogin.js";

(async function() {
  console.log("🔵 pasarelaPagos.js - Iniciando...");

  // Esperar al DOM
  if (document.readyState === 'loading') {
    await new Promise(function(resolve) {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  console.log("✅ DOM cargado");
  console.log("✅ Supabase importado correctamente");

  const $ = function(id) {
    return document.getElementById(id);
  };
  
  const fmtPY = function(n) {
    return new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
  };

  // ============ DATOS DEL CARRITO ============
  function getCartData() {
    try {
      const snap = JSON.parse(
        sessionStorage.getItem("checkout_snapshot") || 
        sessionStorage.getItem("checkout") || 
        "null"
      );
      if (snap && snap.items && snap.items.length > 0) {
        console.log("✅ Datos desde sessionStorage");
        return snap;
      }
    } catch (e) {
      console.warn("Error leyendo sessionStorage");
    }

    try {
      const cart = JSON.parse(localStorage.getItem("productos-en-carrito") || "[]");
      if (cart.length > 0) {
        const total = cart.reduce(function(a, it) {
          return a + Number(it.precio || 0) * Number(it.cantidad || 1);
        }, 0);
        console.log("✅ Datos desde localStorage");
        return { items: cart, total: total, source: "local" };
      }
    } catch (e) {
      console.warn("Error leyendo localStorage");
    }

    console.error("❌ Carrito vacío");
    return { items: [], total: 0, source: "none" };
  }

  // ============ CONSTRUIR PAYLOAD ============
  function buildPayload(cartData) {
    if (!cartData || !cartData.items || cartData.items.length === 0) {
      throw new Error("El carrito está vacío");
    }

    // Validar formato UUID
    function isValidUUID(str) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    }

    const items = cartData.items.map(function(it) {
      const id = String(it.id || '');
      
      // Validar que el ID sea UUID válido
      if (!isValidUUID(id)) {
        console.error("❌ ID inválido para producto:", it);
        throw new Error(`Producto con ID inválido: ${it.titulo || it.nombre || 'sin nombre'}`);
      }

      return {
        id: id,
        titulo: String(it.titulo || it.nombre || 'Producto'),
        precio: Number(it.precio || 0),
        cantidad: Number(it.cantidad || 1)
      };
    });

    const total = Number(
      cartData.total || 
      items.reduce(function(a, it) {
        return a + it.precio * it.cantidad;
      }, 0)
    );

    const metodoInput = document.querySelector('input[name="metodo"]:checked');
    const metodo = metodoInput ? metodoInput.value : "efectivo";

    const getValue = function(id) {
      const el = $(id);
      return el ? (el.value || "").trim() : "";
    };

    const payload = {
      source: cartData.source || "local",
      items: items,
      total: total,
      ruc: getValue("ruc") || "Sin RUC",
      razon: getValue("razon") || "Cliente",
      tel: getValue("tel") || "Sin teléfono",
      mail: getValue("mail") || "sin@email.com",
      contacto: getValue("contacto") || "Sin contacto",
      ciudad: getValue("ciudad") || "Sin ciudad",
      barrio: getValue("barrio") || "Sin barrio",
      depto: getValue("depto") || "Sin depto",
      postal: getValue("postal") || "Sin postal",
      calle1: getValue("calle1") || "Sin calle",
      calle2: getValue("calle2") || "",
      nro: getValue("nro") || "S/N",
      hora_desde: getValue("hora-desde") || "09:00",
      hora_hasta: getValue("hora-hasta") || "18:00",
      metodo_pago: metodo
    };

    console.log("📦 Payload construido:", payload);
    return payload;
  }

  // ============ GUARDAR EN BD ============
  async function guardarPedidoEnBD() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔵 Guardando pedido en BD...");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    try {
      // 1. Verificar usuario
      const userData = await supabase.auth.getUser();
      
      if (userData.error || !userData.data || !userData.data.user) {
        throw new Error("Usuario no autenticado");
      }
      
      const user = userData.data.user;
      console.log("✅ Usuario:", user.id);
      console.log("   Email:", user.email);

      // 2. Obtener datos del carrito
      const cartData = getCartData();
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        throw new Error("Carrito vacío");
      }
      console.log("✅ Carrito:", cartData.items.length, "items");
      console.log("   Items:", cartData.items);

      // 3. Construir payload (con validación UUID)
      const payload = buildPayload(cartData);
      console.log("✅ Payload construido");

      // 4. Llamar a la función RPC
      console.log("🚀 Llamando a crear_pedido_desde_checkout...");
      console.log("   Payload completo:", JSON.stringify(payload, null, 2));

      const rpcResult = await supabase.rpc("crear_pedido_desde_checkout", {
        p_usuario: user.id,
        p_checkout: payload
      });

      if (rpcResult.error) {
        console.error("❌ Error RPC:", rpcResult.error);
        throw rpcResult.error;
      }

      console.log("✅ RPC ejecutado exitosamente");
      console.log("   Respuesta:", rpcResult.data);

      // 5. Extraer IDs del resultado
      const result = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
      const pedidoId = result ? result.pedido_id : null;
      
      if (!pedidoId) {
        throw new Error("No se recibió pedido_id del servidor");
      }

      console.log("✅ Pedido creado exitosamente");
      console.log("   ID del pedido:", pedidoId);
      console.log("   Snapshot ID:", result.snapshot_id);

      // 6. Guardar info global para usar en checkout.js
      window.__pedido_creado__ = {
        pedido_id: pedidoId,
        snapshot_id: result.snapshot_id,
        total: payload.total,
        metodo: payload.metodo_pago
      };

      // 7. Limpiar carrito
      console.log("🧹 Limpiando carrito...");
      try {
        if (window.CartAPI && window.CartAPI.empty) {
          await window.CartAPI.empty();
        }
        localStorage.removeItem("productos-en-carrito");
        sessionStorage.removeItem("checkout_snapshot");
        sessionStorage.removeItem("checkout");
        console.log("✅ Carrito limpiado");
      } catch (e) {
        console.warn("⚠️ Error limpiando:", e);
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("✅ PEDIDO GUARDADO EXITOSAMENTE");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return { success: true, pedido_id: pedidoId };

    } catch (err) {
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("❌ ERROR AL GUARDAR PEDIDO");
      console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.error("Mensaje:", err.message);
      console.error("Detalles:", err);
      console.error("Stack:", err.stack);
      
      return { success: false, error: err.message };
    }
  }

  // ============ INTERCEPTOR ============
  function setupInterceptor() {
    const form = $("#checkout-form");
    
    if (!form) {
      console.error("❌ Formulario no encontrado");
      return;
    }

    console.log("✅ Formulario encontrado");

    // Guardar el handler original
    const checkoutOriginal = form.onsubmit;
    
    // Reemplazar completamente
    form.onsubmit = async function(evento) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔵 SUBMIT INTERCEPTADO");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      evento.preventDefault();
      evento.stopPropagation();

      // Verificar carrito antes de proceder
      const cartData = getCartData();
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        alert("El carrito está vacío");
        return false;
      }

      console.log("🔵 Guardando en BD primero...");

      const resultado = await guardarPedidoEnBD();

      if (!resultado.success) {
        alert("Error al guardar el pedido: " + resultado.error);
        console.error("❌ No se pudo guardar el pedido");
        return false;
      }

      console.log("✅ Pedido guardado exitosamente");
      console.log("🔵 Ejecutando checkout.js...");

      // Ejecutar handler original
      if (checkoutOriginal) {
        return checkoutOriginal.call(form, evento);
      }

      return false;
    };

    console.log("✅ Interceptor configurado");
  }

  // ============ INIT ============
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔵 Inicializando pasarelaPagos.js");
  
  let form = $("#checkout-form");
  let intentos = 0;
  
  while (!form && intentos < 50) {
    await new Promise(function(resolve) {
      setTimeout(resolve, 100);
    });
    form = $("#checkout-form");
    intentos++;
  }

  if (!form) {
    console.error("❌ Formulario no encontrado después de esperar");
    return;
  }

  console.log("✅ Formulario encontrado");

  const cartData = getCartData();
  console.log("🛒 Items:", cartData.items ? cartData.items.length : 0);
  console.log("💰 Total:", fmtPY(cartData.total || 0));
  
  setupInterceptor();

  console.log("✅ pasarelaPagos.js LISTO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Exponer función para debug
  window.testGuardarPedido = guardarPedidoEnBD;
  console.log("💡 window.testGuardarPedido() disponible para testing");

})();