// JS/checkout-interceptor.js
// Intercepta el botón "Comprar ahora" para pedir login si es necesario

import { supabase } from './ScriptLogin.js';

console.log('🛡️ checkout-interceptor.js cargado');

// ============================================================================
// VERIFICAR SI USUARIO ESTÁ AUTENTICADO
// ============================================================================

async function isUserAuthenticated() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user !== null;
  } catch (error) {
    console.error('Error verificando autenticación:', error);
    return false;
  }
}

// ============================================================================
// REDIRIGIR A LOGIN CON RETURN URL
// ============================================================================

function redirectToLogin() {
  console.log('🔐 Preparando redirección a login...');
  
  // Usar CartMerger para capturar el carrito
  if (window.CartMerger && typeof window.CartMerger.capturar === 'function') {
    const capturado = window.CartMerger.capturar();
    if (capturado) {
      console.log('✅ Carrito capturado por CartMerger');
    }
  } else {
    console.warn('⚠️ CartMerger no disponible, intentando backup manual...');
    
    // Backup manual si CartMerger no está disponible
    try {
      const currentCart = localStorage.getItem('productos-en-carrito');
      if (currentCart) {
        sessionStorage.setItem('backup-cart-before-login', currentCart);
        console.log('💾 Backup manual creado');
      }
    } catch (error) {
      console.error('Error en backup manual:', error);
    }
  }
  
  // Guardar URL actual
  const currentUrl = window.location.href;
  sessionStorage.setItem('returnUrl', currentUrl);
  sessionStorage.setItem('fromCheckout', 'true');
  
  console.log('➡️ Redirigiendo a login...');
  window.location.href = 'login.html';
}

// ============================================================================
// INTERCEPTAR BOTÓN "COMPRAR AHORA"
// ============================================================================

export async function setupCheckoutInterceptor(buttonSelector = '#btn-comprar') {
  const btnComprar = document.querySelector(buttonSelector);
  
  if (!btnComprar) {
    console.warn('⚠️ Botón de compra no encontrado');
    return;
  }

  console.log('✅ Interceptor configurado en botón:', buttonSelector);

  // Guardar el handler original si existe
  const originalHandler = btnComprar.onclick;

  // Reemplazar con nuestro interceptor
  btnComprar.onclick = async function(e) {
    e.preventDefault();
    e.stopPropagation();

    console.log('🛒 Click en "Comprar ahora"');

    // Verificar que el carrito no esté vacío
    const snap = await window.CartAPI?.getSnapshot();
    if (!snap || !snap.items || snap.items.length === 0) {
      alert('Tu carrito está vacío');
      return;
    }

    console.log(`📦 Carrito tiene ${snap.items.length} productos`);

    // Verificar autenticación
    const isAuthenticated = await isUserAuthenticated();

    if (!isAuthenticated) {
      // Usuario NO logueado → Pedir login
      console.log('❌ Usuario no autenticado');
      
      const confirmar = confirm(
        '🔐 Necesitas iniciar sesión para completar tu compra.\n\n' +
        'Tus productos se mantendrán en el carrito.\n\n' +
        '¿Deseas iniciar sesión ahora?'
      );

      if (confirmar) {
        redirectToLogin();
      }
      return;
    }

    // Usuario SÍ logueado → Continuar con compra
    console.log('✅ Usuario autenticado, continuando con compra...');

    // Ejecutar el handler original si existe
    if (originalHandler) {
      originalHandler.call(btnComprar, e);
    } else {
      // Si no hay handler original, redirigir a pasarela
      proceedToCheckout(snap);
    }
  };
}

// ============================================================================
// PROCEDER AL CHECKOUT
// ============================================================================

function proceedToCheckout(snap) {
  const payload = {
    source: "local",
    items: snap.items.map(it => ({
      id: it.id,
      titulo: it.titulo,
      precio: Number(it.precio || 0),
      cantidad: Number(it.cantidad || 1),
      tienePromo: it.tienePromo || false,
      descuentoPorcentaje: Number(it.descuentoPorcentaje || 0),
      precioOriginal: Number(it.precioOriginal || it.precio)
    })),
    total: Number(snap.total || 0),
    ts: Date.now()
  };

  sessionStorage.setItem("checkout_snapshot", JSON.stringify(payload));
  sessionStorage.setItem("checkout", JSON.stringify(payload));

  const url = new URL("./pasarelaPagos.html", window.location.href);
  url.searchParams.set("monto", String(payload.total));
  
  console.log('➡️ Redirigiendo a pasarela de pagos');
  window.location.assign(url.toString());
}

// ============================================================================
// MANEJAR RETORNO DESPUÉS DEL LOGIN
// ============================================================================

export async function handleReturnFromLogin() {
  const fromCheckout = sessionStorage.getItem('fromCheckout');
  const returnUrl = sessionStorage.getItem('returnUrl');

  if (fromCheckout === 'true') {
    console.log('🔙 Usuario regresó después de hacer login');
    
    // Limpiar flags
    sessionStorage.removeItem('fromCheckout');
    sessionStorage.removeItem('returnUrl');

    // Esperar un momento para que se fusione el carrito
    await new Promise(resolve => setTimeout(resolve, 500));

    // Refrescar la página si es necesario
    if (returnUrl && returnUrl.includes('carrito.html')) {
      console.log('🔄 Recargando carrito...');
      window.location.reload();
    }
  }
}

// ============================================================================
// AUTO-INICIALIZACIÓN
// ============================================================================

// Manejar retorno desde login
document.addEventListener('DOMContentLoaded', async () => {
  await handleReturnFromLogin();
  
  // Configurar interceptor si estamos en la página del carrito
  if (window.location.pathname.includes('carrito.html')) {
    setupCheckoutInterceptor('#btn-comprar');
  }
});

console.log('✅ checkout-interceptor.js inicializado');