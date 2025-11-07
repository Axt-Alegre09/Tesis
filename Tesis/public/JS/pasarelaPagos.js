// JS/pasarelaPagos.js - VERSIÓN CON ESPERA AL DOM

(async function() {
  console.log("🔵 pasarelaPagos.js - Iniciando...");

  // ============ ESPERAR AL DOM ============
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
  }
  console.log("✅ DOM cargado");

  // ============ ESPERAR SUPABASE ============
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
      console.log("🚀 Payload construido");

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
      console.error("❌ Error:", err.message);
      return { success: false, error: err.message };
    }
  }

  // ============ INTERCEPTOR FUERTE ============
  function setupInterceptor() {
    const form = $("#checkout-form");
    
    if (!form) {
      console.error("❌ Formulario #checkout-form no encontrado");
      console.log("🔍 Elementos en página:", document.querySelectorAll('form').length, "forms");
      return;
    }

    console.log("✅ Formulario encontrado:", form.id);

    // 🔥 GUARDAR HANDLER ORIGINAL
    const originalOnSubmit = form.onsubmit;
    
    // 🔥 REMOVER TODOS LOS LISTENERS EXISTENTES (clonar el form)
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);
    
    // 🔥 ASIGNAR NUEVO HANDLER AL FORM CLONADO
    newForm.onsubmit = async function(e) {
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("🔵 SUBMIT INTERCEPTADO POR PASARELA");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const cartData = getCartData();
      if (!cartData?.items?.length) {
        console.warn("⚠️ Carrito vacío");
        alert("El carrito está vacío");
        return false;
      }

      console.log("🔵 Guardando en BD...");

      const result = await guardarPedidoEnBD();

      if (!result.success) {
        alert("❌ Error: " + result.error);
        return false;
      }

      console.log("✅ Pedido guardado:", result.pedido_id);
      console.log("🔵 Ejecutando checkout.js...");

      // 🔥 EJECUTAR EL HANDLER ORIGINAL DE CHECKOUT.JS
      if (originalOnSubmit) {
        const fakeEvent = new Event('submit', { bubbles: false, cancelable: true });
        return originalOnSubmit.call(newForm, fakeEvent);
      }

      // Si no hay handler original, mostrar éxito manualmente
      alert("✅ Pedido creado con éxito!");
      window.location.reload();

      return false;
    };

    console.log("✅ Interceptor configurado exitosamente");
  }

  // ============ INIT ============
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🔵 Inicializando pasarelaPagos.js");
  
  // Esperar a que el formulario exista
  let form = $("#checkout-form");
  let intentos = 0;
  
  while (!form && intentos < 100) {
    await new Promise(resolve => setTimeout(resolve, 50));
    form = $("#checkout-form");
    intentos++;
  }

  if (!form) {
    console.error("❌ Formulario no encontrado después de", intentos * 50, "ms");
    console.log("🔍 Forms en página:", document.querySelectorAll('form'));
    return;
  }

  console.log("✅ Formulario encontrado después de", intentos * 50, "ms");

  const cartData = getCartData();
  console.log("🛒 Items:", cartData?.items?.length || 0);
  console.log("💰 Total:", fmtPY(cartData?.total || 0));
  
  setupInterceptor();

  console.log("✅ pasarelaPagos.js LISTO");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  window.testGuardarPedido = guardarPedidoEnBD;
  console.log("💡 window.testGuardarPedido() disponible");

})();