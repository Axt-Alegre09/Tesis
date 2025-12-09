// JS/cart-merger.js - VERSIÓN SIN RPC (crea carrito directamente)
import { supabase } from './ScriptLogin.js';

console.log('🟢 CART-MERGER CARGADO');

let carritoCapturado = null;
let fusionEnProceso = false;

function capturarCarrito() {
  try {
    const cartString = localStorage.getItem('productos-en-carrito');
    
    if (!cartString || cartString === '[]' || cartString === 'null') {
      return false;
    }
    
    const cart = JSON.parse(cartString);
    
    if (!Array.isArray(cart) || cart.length === 0) {
      return false;
    }
    
    carritoCapturado = JSON.parse(JSON.stringify(cart));
    
    console.log(`💾 CARRITO CAPTURADO: ${cart.length} productos`);
    cart.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.titulo} x${p.cantidad}`);
    });
    
    sessionStorage.setItem('carrito-capturado-backup', JSON.stringify(cart));
    return true;
    
  } catch (error) {
    console.error('Error capturando carrito:', error);
    return false;
  }
}

// ============================================================================
// FUSIÓN SIN RPC - CREA CARRITO DIRECTAMENTE
// ============================================================================

async function fusionarCarritoConSession(session) {
  if (fusionEnProceso) {
    console.log('⏳ Fusión en proceso...');
    return;
  }
  
  fusionEnProceso = true;
  
  try {
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 FUSIÓN DE CARRITO - MÉTODO DIRECTO');
    console.log('═══════════════════════════════════════════════════');
    
    // Recuperar carrito capturado
    if (!carritoCapturado || carritoCapturado.length === 0) {
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
    
    const user = session.user;
    console.log(`📦 Productos a fusionar: ${carritoCapturado.length}`);
    console.log(`✅ Usuario: ${user.email}`);
    
    // ============================================
    // MÉTODO DIRECTO - SIN RPC
    // ============================================
    
    // Paso 1: Buscar o crear carrito
    console.log('🔄 Buscando carrito del usuario...');
    
    let { data: carrito, error: errorBuscar } = await supabase
      .from('carritos')
      .select('id')
      .eq('usuario_id', user.id)
      .maybeSingle();
    
    if (errorBuscar) {
      console.error('❌ Error buscando carrito:', errorBuscar);
      fusionEnProceso = false;
      return;
    }
    
    // Si no existe, crear uno nuevo
    if (!carrito) {
      console.log('📝 Creando nuevo carrito...');
      
      const { data: nuevoCarrito, error: errorCrear } = await supabase
        .from('carritos')
        .insert({ usuario_id: user.id })
        .select('id')
        .single();
      
      if (errorCrear) {
        console.error('❌ Error creando carrito:', errorCrear);
        fusionEnProceso = false;
        return;
      }
      
      carrito = nuevoCarrito;
      console.log(`✅ Carrito creado: ${carrito.id}`);
    } else {
      console.log(`✅ Carrito encontrado: ${carrito.id}`);
    }
    
    const carritoId = carrito.id;
    
    // Paso 2: Fusionar productos
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
          // Actualizar
          const nuevaCantidad = Number(itemExistente.cantidad) + Number(producto.cantidad);
          console.log(`   📝 Actualizando: ${itemExistente.cantidad} → ${nuevaCantidad}`);
          
          const { error: errUpdate } = await supabase
            .from('carrito_items')
            .update({ cantidad: nuevaCantidad })
            .eq('id', itemExistente.id);
          
          if (errUpdate) {
            console.error(`   ❌ Error:`, errUpdate.message);
            errores++;
          } else {
            console.log(`   ✅ Actualizado`);
            exitosos++;
          }
          
        } else {
          // Insertar
          console.log(`   📝 Insertando...`);
          
          const { error: errInsert } = await supabase
            .from('carrito_items')
            .insert({
              carrito_id: carritoId,
              producto_id: producto.id,
              cantidad: Number(producto.cantidad)
            });
          
          if (errInsert) {
            console.error(`   ❌ Error:`, errInsert.message);
            errores++;
          } else {
            console.log(`   ✅ Insertado`);
            exitosos++;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Error:`, error.message);
        errores++;
      }
    }
    
    // Resultado
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 RESULTADO');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Total:     ${carritoCapturado.length}`);
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Errores:  ${errores}`);
    
    if (exitosos > 0) {
      console.log('');
      console.log('✅ FUSIÓN COMPLETADA');
      
      // Limpiar
      localStorage.removeItem('productos-en-carrito');
      localStorage.removeItem('carrito');
      sessionStorage.removeItem('carrito-capturado-backup');
      carritoCapturado = null;
      
      // Refrescar
      if (window.CartAPI?.refreshBadge) {
        await window.CartAPI.refreshBadge();
      }
      
      // Recargar si es carrito.html
      if (window.location.pathname.includes('carrito.html')) {
        console.log('🔄 Recargando...');
        setTimeout(() => window.location.reload(), 800);
      }
      
    } else {
      console.log('⚠️ No se fusionó ningún producto');
    }
    
    console.log('═══════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR CRÍTICO:');
    console.error(error);
  } finally {
    fusionEnProceso = false;
  }
}

// ============================================================================
// LISTENER
// ============================================================================

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session) {
    console.log('✅ LOGIN DETECTADO');
    console.log('⏳ Esperando 500ms...');
    await new Promise(resolve => setTimeout(resolve, 500));
    await fusionarCarritoConSession(session);
  }
  
  if (event === 'SIGNED_OUT') {
    carritoCapturado = null;
  }
});

// ============================================================================
// INIT
// ============================================================================

setTimeout(() => {
  if (capturarCarrito()) {
    console.log('✅ Carrito capturado preventivamente');
  }
}, 500);

// ============================================================================
// API
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
  verCapturado: () => carritoCapturado,
  estado: () => ({
    carritoCapturado,
    cantidadProductos: carritoCapturado?.length || 0,
    fusionEnProceso
  })
};

console.log('🎉 CART-MERGER LISTO');