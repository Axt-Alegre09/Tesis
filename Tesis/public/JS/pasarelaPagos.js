// JS/pasarelaPagos.js - VERSIÓN SIN MÓDULOS
// Compatible con checkout.js - Se ejecuta DESPUÉS de todos los scripts

(async function() {
  console.log("🔵 pasarelaPagos.js - Iniciando (sin módulos)...");

  // Esperar a que supabase esté disponible
  let supabase;
  let intentos = 0;
  while (!window.supabase && intentos < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    intentos++;
  }

  if (!window.supabase) {
    console.error("❌ Supabase no está disponible");
    return;
  }

  supabase = window.supabase;
  console.log("✅ Supabase cargado");

  const $ = (id) => document.getElementById(id);
  const fmtPY = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

  // ============ OBTENER DATOS DEL CARRITO ============
  function getCartData() {
    // 1. Intentar desde sessionStorage
    try {
      const snap = JSON.parse(
        sessionStorage.getItem("checkout_snapshot") || 
        sessionStorage.getItem("checkout") || 
        "null"
      );
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
        const total = cart.reduce((a, it) => 
          a + Number(it.precio || 0) * Number(it.cantidad || 1), 0
        );
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

    const total = Number(
      cartData.total || 
      items.reduce((a, it) => a + it.precio * it.cantidad, 0)
    );

    const metodoInput = document.querySelector('input[name="metodo"]:checked');
    const metodo = metodoInput ? metodoInput.value : "efectivo";

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

    return payload;
  }

  // ============ GUARDAR PEDIDO EN BD ============
  async function guardarPedidoEnBD() {
    console.log("🔵 Iniciando guardarPedidoEnBD...");

    try {
      // 1. Verificar usuario
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) {
        console.error("❌ No hay usuario autenticado");
        throw new Error("Debes iniciar sesión");
      }
      const user = userData.user;
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
      console.log("📦 Payload:", JSON.stringify(payload, null, 2));
      
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

      // 5. Guardar en window
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

    console.log("✅ Formulario encontrado");

    // Interceptar ANTES del submit
    form.addEventListener("submit", async function(e) {
      console.log("🔵 Submit interceptado por pasarelaPagos.js");

      // Verificar datos
      const cartData = getCartData();
      if (!cartData || !cartData.items || cartData.items.length === 0) {
        console.warn("⚠️ No hay items, saltando guardado");
        return;
      }

      // Guardar en BD (asíncrono, no bloquea)
      guardarPedidoEnBD().then(result => {
        if (result.success) {
          console.log("✅ Pedido guardado:", result.pedido_id);
        } else {
          console.error("❌ Error guardando:", result.error);
        }
      });

      // NO prevenir - dejar que checkout.js maneje
    }, { capture: true });

    console.log("✅ Interceptor configurado");
  }

  // ============ INICIALIZACIÓN ============
  async function init() {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🔵 Inicializando pasarelaPagos.js");
    console.log("📍 URL:", window.location.pathname);
    
    // Esperar a que el formulario exista
    let form = $("#checkout-form");
    let intentos = 0;
    
    while (!form && intentos < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      form = $("#checkout-form");
      intentos++;
    }

    if (!form) {
      console.error("❌ Formulario no encontrado después de esperar");
      return;
    }

    console.log("✅ Formulario encontrado");

    // Verificar carrito
    const cartData = getCartData();
    console.log("🛒 Carrito:");
    console.log("  - Items:", cartData?.items?.length || 0);
    console.log("  - Total:", fmtPY(cartData?.total || 0));
    
    // Setup interceptor
    setupFormInterceptor();

    console.log("✅ pasarelaPagos.js listo");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  }

  // Ejecutar init
  init();

  // Exponer para testing
  window.testGuardarPedido = guardarPedidoEnBD;
  console.log("💡 Tip: window.testGuardarPedido() para testing");

})();