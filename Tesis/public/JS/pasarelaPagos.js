// JS/pasarelaPagos.js - VERSIÓN CON INTERCEPTOR BLOQUEANTE

(async function() {
  console.log("🔵 pasarelaPagos.js - Iniciando...");

  // Esperar Supabase
  let supabase;
  let intentos = 0;
  while (!window.supabase && intentos < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    intentos++;
  }

  if (!window.supabase) {
    console.error("❌ Supabase no disponible");
    return;
  }

  supabase = window.supabase;
  console.log("✅ Supabase cargado");

  const $ = (id) => document.getElementById(id);
  const fmtPY = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

  // ============ DATOS DEL CARRITO ============
  function getCartData() {
    try {
      const snap = JSON.parse(
        sessionStorage.getItem("checkout_snapshot") || 
        sessionStorage.getItem("checkout") || 
        "null"
      );
      if (snap?.items?.length > 0) {
        console.log("✅ Datos desde sessionStorage");
        return snap;
      }
    } catch (e) {}

    try {
      const cart = JSON.parse(localStorage.getItem("productos-en-carrito") || "[]");
      if (cart.length > 0) {
        const total = cart.reduce((a, it) => 
          a + Number(it.precio || 0) * Number(it.cantidad || 1), 0
        );
        console.log("✅ Datos desde localStorage");
        return { items: cart, total, source: "local" };
      }
    } catch (e) {}

    console.error("❌ Carrito vacío");
    return { items: [], total: 0, source: "none" };
  }

  // ============ CONSTRUIR PAYLOAD ============
  function buildPayload(cartData) {
    if (!cartData?.items?.length) {
      throw new Error("El carrito está vacío");
    }

    const items = cartData.items.map(it => ({
      id: String(it.id || ''),
      titulo: String(it.titulo || it.nombre || 'Producto'),
      precio: Number(it.precio || 0),
      cantidad: Number(it.cantidad || 1)
    }));

    const total = Number(
      cartData.total || 
      items.reduce((a, it) => a + it.precio * it.cantidad, 0)
    );

    const metodoInput = document.querySelector('input[name="metodo"]:checked');
    const metodo = metodoInput?.value || "efectivo";

    const getValue = (id) => {
      const el = $(id);
      return el ? (el.value || "").trim() : "";
    };

    return {
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
  }

  // ============ GUARDAR EN BD ============
  async function guardarPedidoEnBD() {
    console.log("🔵 Guardando pedido en BD...");

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        throw new Error("Usuario no autenticado");
      }
      const user = userData.user;
      console.log("✅ Usuario:", user.id);

      const cartData = getCartData();
      if (!cartData?.items?.length) {
        throw new Error("Carrito vacío");
      }
      console.log("✅ Carrito:", cartData.items.length, "items");

      const payload = buildPayload(cartData);
      console.log("🚀 Payload:", payload);

      const { data, error } = await supabase.rpc("crear_pedido_desde_checkout", {
        p_usuario: user.id,
        p_checkout: payload
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const pedidoId = result?.pedido_id;
      
      if (!pedidoId) {
        throw new Error("No se recibió pedido_id");
      }

      console.log("✅ Pedido creado:", pedidoId);

      window.__pedido_creado__ = {
        pedido_id: pedidoId,
        snapshot_id: result?.snapshot_id,
        total: payload.total,
        metodo: payload.metodo_pago
      };

      // Limpiar carrito
      try {
        if (window.CartAPI?.empty) {
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
      console.error("❌ Error:", err);
      return { success: false, error: err.message };
    }
  }

  // ============ INTERCEPTOR FUERTE ============
  function setupInterceptor() {
    const form = $("#checkout-form");
    
    if (!form) {
      console.error("❌ Formulario no encontrado");
      return;
    }

    console.log("✅ Configurando interceptor...");

    // 🔥 GUARDAR EL HANDLER ORIGINAL
    const originalHandler = form.onsubmit;

    // 🔥 REEMPLAZAR COMPLETAMENTE
    form.onsubmit = async function(e) {
      console.log("🔵 ═══════════════════════════════");
      console.log("🔵 SUBMIT INTERCEPTADO");
      console.log("🔵 ═══════════════════════════════");

      // NO prevenir todavía, solo verificar
      const cartData = getCartData();
      if (!cartData?.items?.length) {
        console.warn("⚠️ Carrito vacío, dejando pasar a checkout.js");
        if (originalHandler) {
          return originalHandler.call(form, e);
        }
        return;
      }

      // 🔥 PREVENIR Y GUARDAR EN BD PRIMERO
      e.preventDefault();
      e.stopPropagation();

      console.log("🔵 Guardando en BD antes de continuar...");

      const result = await guardarPedidoEnBD();

      if (!result.success) {
        alert("Error al guardar el pedido: " + result.error);
        return false;
      }

      console.log("✅ Pedido guardado exitosamente");
      console.log("🔵 Ejecutando checkout.js...");

      // 🔥 AHORA SÍ, EJECUTAR CHECKOUT.JS
      if (originalHandler) {
        // Crear un nuevo evento para pasarle
        const newEvent = new Event('submit', {
          bubbles: true,
          cancelable: true
        });
        return originalHandler.call(form, newEvent);
      }

      return false;
    };

    console.log("✅ Interceptor configurado");
  }

  // ============ INIT ============
  async function init() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔵 Inicializando pasarelaPagos.js");
    
    let form = $("#checkout-form");
    let intentos = 0;
    
    while (!form && intentos < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      form = $("#checkout-form");
      intentos++;
    }

    if (!form) {
      console.error("❌ Formulario no encontrado");
      return;
    }

    const cartData = getCartData();
    console.log("🛒 Items:", cartData?.items?.length || 0);
    console.log("💰 Total:", fmtPY(cartData?.total || 0));
    
    setupInterceptor();

    console.log("✅ pasarelaPagos.js LISTO");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  await init();

  window.testGuardarPedido = guardarPedidoEnBD;
  console.log("💡 window.testGuardarPedido() disponible");

})();