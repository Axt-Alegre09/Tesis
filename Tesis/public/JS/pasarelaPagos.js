// JS/pasarelaPagos.js - VERSIÓN CORREGIDA SIN DUPLICADOS

(async function() {
  console.log("🔵 pasarelaPagos.js - Iniciando...");

  // Esperar al DOM
  if (document.readyState === 'loading') {
    await new Promise(function(resolve) {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  console.log("✅ DOM cargado");

  // Esperar Supabase
  let supabase;
  let intentos = 0;
  while (!window.supabase && intentos < 50) {
    await new Promise(function(resolve) {
      setTimeout(resolve, 100);
    });
    intentos++;
  }

  if (!window.supabase) {
    console.error("❌ Supabase no disponible");
    return;
  }

  supabase = window.supabase;
  console.log("✅ Supabase cargado");

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

    const items = cartData.items.map(function(it) {
      return {
        id: String(it.id || ''),
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

    return {
      source: cartData.source || "local",
      items: items,
      total: total,
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
  }

  // ============ GUARDAR EN BD ============
  async function guardarPedidoEnBD() {
    console.log("🔵 Guardando pedido en BD...");

    try {
      const userData = await supabase.auth.getUser();
      
      if (userData.error || !userData.data || !userData.data.user) {
        throw new Error("Usuario no autenticado");
      }
      
      const user = userData.data.user;
      console.log("✅ Usuario:", user.id);

      const cartData = getCartData();
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        throw new Error("Carrito vacío");
      }
      console.log("✅ Carrito:", cartData.items.length, "items");

      const payload = buildPayload(cartData);
      console.log("🚀 Payload construido");

      const rpcResult = await supabase.rpc("crear_pedido_desde_checkout", {
        p_usuario: user.id,
        p_checkout: payload
      });

      if (rpcResult.error) {
        throw rpcResult.error;
      }

      const result = Array.isArray(rpcResult.data) ? rpcResult.data[0] : rpcResult.data;
      const pedidoId = result ? result.pedido_id : null;
      
      if (!pedidoId) {
        throw new Error("No se recibió pedido_id");
      }

      console.log("✅ Pedido creado:", pedidoId);

      window.__pedido_creado__ = {
        pedido_id: pedidoId,
        snapshot_id: result.snapshot_id,
        total: payload.total,
        metodo: payload.metodo_pago
      };

      // Limpiar carrito
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

      return { success: true, pedido_id: pedidoId };

    } catch (err) {
      console.error("❌ Error:", err.message);
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

      const cartData = getCartData();
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        alert("El carrito está vacío");
        return false;
      }

      console.log("🔵 Guardando en BD primero...");

      const resultado = await guardarPedidoEnBD();

      if (!resultado.success) {
        alert("Error al guardar el pedido: " + resultado.error);
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
  
  // REUSAR la variable intentos ya declarada arriba
  let form = $("#checkout-form");
  intentos = 0; // Resetear el contador
  
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

  window.testGuardarPedido = guardarPedidoEnBD;
  console.log("💡 window.testGuardarPedido() disponible");

})();