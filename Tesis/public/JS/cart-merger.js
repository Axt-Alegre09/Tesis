// JS/cart-merger.js - VERSIÓN CORREGIDA (usa session directamente)
import { supabase } from './ScriptLogin.js';

console.log('🟢🟢🟢 CART-MERGER.JS CARGADO CORRECTAMENTE 🟢🟢🟢');
console.log('%c✅ Módulo de fusión de carrito activo', 'background: #00ff00; color: #000; font-size: 16px; padding: 5px;');

let carritoCapturado = null;
let fusionEnProceso = false;

function autoDiagnostico() {
  console.log('🔍 === AUTO-DIAGNÓSTICO ===');
  
  if (!supabase) {
    console.error('❌ Supabase no disponible');
    return false;
  }
  console.log('✅ Supabase disponible');
  
  if (!window.CartAPI) {
    console.warn('⚠️ CartAPI no disponible aún');
  } else {
    console.log('✅ CartAPI disponible');
  }
  
  try {
    const test = localStorage.getItem('test');
    console.log('✅ localStorage funcional');
  } catch (e) {
    console.error('❌ localStorage no funcional');
    return false;
  }
  
  console.log('✅ Todo OK para funcionar');
  return true;
}

function capturarCarrito() {
  try {
    console.log('📸 Intentando capturar carrito...');
    
    const cartString = localStorage.getItem('productos-en-carrito');
    console.log('📦 localStorage["productos-en-carrito"]:', cartString);
    
    if (!cartString || cartString === '[]' || cartString === 'null') {
      console.log('ℹ️ No hay productos en localStorage');
      return false;
    }
    
    const cart = JSON.parse(cartString);
    
    if (!Array.isArray(cart) || cart.length === 0) {
      console.log('ℹ️ Carrito vacío o inválido');
      return false;
    }
    
    carritoCapturado = JSON.parse(JSON.stringify(cart));
    
    console.log(`%c💾 CARRITO CAPTURADO: ${cart.length} productos`, 'background: #4CAF50; color: white; font-size: 14px; padding: 4px;');
    cart.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.titulo} x${p.cantidad} (ID: ${p.id})`);
    });
    
    sessionStorage.setItem('carrito-capturado-backup', JSON.stringify(cart));
    
    return true;
    
  } catch (error) {
    console.error('❌ Error capturando carrito:', error);
    return false;
  }
}

// ============================================================================
// FUSIONAR CARRITO - USA SESSION DIRECTAMENTE (NO getUser)
// ============================================================================

async function fusionarCarritoConSession(session) {
  if (fusionEnProceso) {
    console.log('⏳ Fusión ya en proceso, esperando...');
    return;
  }
  
  fusionEnProceso = true;
  
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 INICIANDO FUSIÓN DE CARRITO');
    console.log('═══════════════════════════════════════════════════');
    
    // Intentar recuperar de sessionStorage si no tenemos captura
    if (!carritoCapturado || carritoCapturado.length === 0) {
      console.log('📂 Intentando recuperar de sessionStorage...');
      const backup = sessionStorage.getItem('carrito-capturado-backup');
      if (backup) {
        carritoCapturado = JSON.parse(backup);
        console.log(`✅ Recuperado: ${carritoCapturado.length} productos`);
      }
    }
    
    if (!carritoCapturado || carritoCapturado.length === 0) {
      console.log('ℹ️ No hay carrito para fusionar');
      fusionEnProceso = false;
      return;
    }
    
    console.log(`📦 Productos a fusionar: ${carritoCapturado.length}`);
    
    // ✅ USAR SESSION DIRECTAMENTE (no llamar getUser de nuevo)
    const user = session.user;
    console.log(`✅ Usuario autenticado: ${user.email}`);
    console.log(`✅ User ID: ${user.id}`);
    
    // Asegurar carrito remoto
    console.log('🔄 Asegurando carrito remoto...');
    const { data: carritoId, error: errCarrito } = await supabase.rpc('asegurar_carrito');
    
    if (errCarrito) {
      console.error('❌ Error asegurando carrito:', errCarrito);
      console.error('Detalles:', JSON.stringify(errCarrito, null, 2));
      fusionEnProceso = false;
      return;
    }
    
    console.log(`✅ Carrito remoto ID: ${carritoId}`);
    console.log('');
    console.log('─────────────────────────────────────────────────');
    console.log('📝 FUSIONANDO PRODUCTOS...');
    console.log('─────────────────────────────────────────────────');
    
    let exitosos = 0;
    let errores = 0;
    
    for (let i = 0; i < carritoCapturado.length; i++) {
      const producto = carritoCapturado[i];
      
      console.log('');
      console.log(`[${i + 1}/${carritoCapturado.length}] ${producto.titulo}`);
      console.log(`   📋 ID: ${producto.id}`);
      console.log(`   📊 Cantidad: ${producto.cantidad}`);
      
      try {
        // Verificar si ya existe
        const { data: itemExistente, error: errCheck } = await supabase
          .from('carrito_items')
          .select('id, cantidad')
          .eq('carrito_id', carritoId)
          .eq('producto_id', producto.id)
          .maybeSingle();
        
        if (errCheck) {
          console.error(`   ❌ Error verificando:`, errCheck.message);
          errores++;
          continue;
        }
        
        if (itemExistente) {
          // Actualizar cantidad
          const nuevaCantidad = Number(itemExistente.cantidad) + Number(producto.cantidad);
          console.log(`   📝 Ya existe, actualizando: ${itemExistente.cantidad} → ${nuevaCantidad}`);
          
          const { error: errUpdate } = await supabase
            .from('carrito_items')
            .update({ cantidad: nuevaCantidad })
            .eq('id', itemExistente.id);
          
          if (errUpdate) {
            console.error(`   ❌ Error actualizando:`, errUpdate.message);
            errores++;
          } else {
            console.log(`   ✅ Cantidad actualizada`);
            exitosos++;
          }
          
        } else {
          // Insertar nuevo
          console.log(`   📝 Insertando nuevo producto...`);
          
          const { error: errInsert } = await supabase
            .from('carrito_items')
            .insert({
              carrito_id: carritoId,
              producto_id: producto.id,
              cantidad: Number(producto.cantidad)
            });
          
          if (errInsert) {
            console.error(`   ❌ Error insertando:`, errInsert.message);
            console.error(`   Detalles:`, errInsert);
            errores++;
          } else {
            console.log(`   ✅ Producto insertado`);
            exitosos++;
          }
        }
        
        // Pausa entre operaciones
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`   ❌ Error procesando:`, error.message);
        errores++;
      }
    }
    
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 RESULTADO DE FUSIÓN');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Total:     ${carritoCapturado.length} productos`);
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Errores:  ${errores}`);
    
    if (exitosos > 0) {
      console.log('');
      console.log('%c✅ FUSIÓN COMPLETADA EXITOSAMENTE', 'background: #4CAF50; color: white; font-size: 16px; padding: 8px;');
      
      // Limpiar localStorage
      console.log('🧹 Limpiando carrito local...');
      localStorage.removeItem('productos-en-carrito');
      localStorage.removeItem('carrito');
      
      // Limpiar sessionStorage
      sessionStorage.removeItem('carrito-capturado-backup');
      
      // Limpiar variable
      carritoCapturado = null;
      
      console.log('✅ Limpieza completada');
      
      // Refrescar badge
      if (window.CartAPI && typeof window.CartAPI.refreshBadge === 'function') {
        await window.CartAPI.refreshBadge();
        console.log('🔄 Badge actualizado');
      }
      
      // Recargar si estamos en carrito.html
      if (window.location.pathname.includes('carrito.html')) {
        console.log('🔄 Recargando página en 1 segundo...');
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
      
    } else {
      console.log('');
      console.log('%c⚠️ NO SE FUSIONÓ NINGÚN PRODUCTO', 'background: #ff9800; color: white; font-size: 16px; padding: 8px;');
      console.log('💾 Manteniendo carrito capturado para reintentar');
    }
    
    console.log('═══════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════');
    console.error('❌ ERROR CRÍTICO EN FUSIÓN');
    console.error('═══════════════════════════════════════════════════');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    console.error('═══════════════════════════════════════════════════');
  } finally {
    fusionEnProceso = false;
  }
}

// ============================================================================
// LISTENER DE AUTH - USA SESSION DIRECTAMENTE
// ============================================================================

console.log('🔌 Configurando listener de autenticación...');

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(`🔑 Auth Event: ${event}`);
  
  if (event === 'SIGNED_IN' && session) {
    console.log('✅ LOGIN DETECTADO!');
    console.log(`👤 Usuario: ${session.user.email}`);
    
    // Esperar un poco para que todo se estabilice
    console.log('⏳ Esperando 500ms...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // ✅ EJECUTAR FUSIÓN PASANDO EL SESSION
    await fusionarCarritoConSession(session);
  }
  
  if (event === 'SIGNED_OUT') {
    console.log('👋 LOGOUT DETECTADO');
    carritoCapturado = null;
  }
});

console.log('✅ Listener configurado');

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

setTimeout(() => {
  autoDiagnostico();
  
  if (capturarCarrito()) {
    console.log('%c✅ Carrito capturado preventivamente', 'background: #2196F3; color: white; font-size: 12px; padding: 4px;');
  }
}, 500);

// ============================================================================
// API PÚBLICA
// ============================================================================

window.CartMerger = {
  capturar: capturarCarrito,
  fusionar: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await fusionarCarritoConSession(session);
    } else {
      console.error('No hay sesión activa');
    }
  },
  verCapturado: () => {
    console.log('Carrito capturado:', carritoCapturado);
    return carritoCapturado;
  },
  diagnostico: autoDiagnostico,
  estado: () => {
    return {
      carritoCapturado: carritoCapturado,
      cantidadProductos: carritoCapturado ? carritoCapturado.length : 0,
      fusionEnProceso: fusionEnProceso
    };
  }
};

console.log('');
console.log('%c🎉 CART-MERGER LISTO PARA USAR', 'background: #673AB7; color: white; font-size: 18px; padding: 10px;');
console.log('%cComandos disponibles:', 'font-weight: bold; font-size: 14px;');
console.log('  CartMerger.verCapturado()  - Ver carrito capturado');
console.log('  CartMerger.capturar()      - Capturar carrito manualmente');
console.log('  CartMerger.fusionar()      - Fusionar manualmente');
console.log('  CartMerger.diagnostico()   - Ejecutar diagnóstico');
console.log('  CartMerger.estado()        - Ver estado actual');
console.log('');