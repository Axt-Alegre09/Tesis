// JS/cart-merger.js - Módulo INDEPENDIENTE para fusionar carrito de invitado
// NO modifica cart-api.js, trabaja como capa adicional

import { supabase } from './ScriptLogin.js';

console.log('🔄 cart-merger.js cargado');

// ============================================================================
// CAPTURAR CARRITO ANTES DE QUE SE LIMPIE
// ============================================================================

let carritoCapturado = null;

function capturarCarritoActual() {
  try {
    const cartString = localStorage.getItem('productos-en-carrito');
    if (cartString && cartString !== '[]') {
      const cart = JSON.parse(cartString);
      if (cart && cart.length > 0) {
        carritoCapturado = [...cart]; // Copia profunda
        console.log(`💾 Carrito capturado: ${cart.length} productos`);
        console.log('Productos:', cart.map(p => `${p.titulo} x${p.cantidad}`));
        return true;
      }
    }
  } catch (error) {
    console.error('Error capturando carrito:', error);
  }
  return false;
}

// ============================================================================
// FUSIONAR CARRITO AL HACER LOGIN
// ============================================================================

async function fusionarCarrito() {
  try {
    console.log('🔄 ===== INICIANDO FUSIÓN DE CARRITO =====');
    
    // Verificar si hay carrito capturado
    if (!carritoCapturado || carritoCapturado.length === 0) {
      console.log('ℹ️ No hay carrito capturado para fusionar');
      return;
    }

    console.log(`📦 Productos a fusionar: ${carritoCapturado.length}`);

    // Verificar que el usuario esté autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('⚠️ Usuario no autenticado');
      return;
    }

    console.log(`✅ Usuario: ${user.email}`);

    // Asegurar que existe un carrito remoto
    const { data: carritoId, error: errCarrito } = await supabase.rpc('asegurar_carrito');
    if (errCarrito) {
      console.error('❌ Error al asegurar carrito:', errCarrito);
      return;
    }

    console.log(`✅ Carrito remoto ID: ${carritoId}`);

    // Fusionar cada producto
    let exitosos = 0;
    let errores = 0;

    for (const producto of carritoCapturado) {
      try {
        console.log(`➕ Fusionando: ${producto.titulo}`);
        console.log(`   ID: ${producto.id}`);
        console.log(`   Cantidad: ${producto.cantidad}`);

        // Verificar si el producto ya existe en el carrito remoto
        const { data: itemExistente, error: errCheck } = await supabase
          .from('carrito_items')
          .select('id, cantidad')
          .eq('carrito_id', carritoId)
          .eq('producto_id', producto.id)
          .maybeSingle();

        if (errCheck) {
          console.error(`   ❌ Error verificando producto:`, errCheck);
          errores++;
          continue;
        }

        if (itemExistente) {
          // El producto ya existe, sumar cantidades
          const nuevaCantidad = Number(itemExistente.cantidad) + Number(producto.cantidad);
          console.log(`   📝 Actualizando cantidad: ${itemExistente.cantidad} → ${nuevaCantidad}`);

          const { error: errUpdate } = await supabase
            .from('carrito_items')
            .update({ cantidad: nuevaCantidad })
            .eq('id', itemExistente.id);

          if (errUpdate) {
            console.error(`   ❌ Error actualizando:`, errUpdate);
            errores++;
          } else {
            console.log(`   ✅ Cantidad actualizada`);
            exitosos++;
          }
        } else {
          // El producto no existe, insertarlo
          console.log(`   📝 Insertando nuevo producto`);

          const { error: errInsert } = await supabase
            .from('carrito_items')
            .insert({
              carrito_id: carritoId,
              producto_id: producto.id,
              cantidad: Number(producto.cantidad)
            });

          if (errInsert) {
            console.error(`   ❌ Error insertando:`, errInsert);
            errores++;
          } else {
            console.log(`   ✅ Producto insertado`);
            exitosos++;
          }
        }

        // Pequeña pausa entre operaciones
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error procesando ${producto.titulo}:`, error);
        errores++;
      }
    }

    console.log('📊 ===== RESULTADO DE FUSIÓN =====');
    console.log(`   Total: ${carritoCapturado.length}`);
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Errores: ${errores}`);

    if (exitosos > 0) {
      console.log('✅ Fusión completada exitosamente');
      
      // Limpiar carrito local SOLO si la fusión fue exitosa
      localStorage.removeItem('productos-en-carrito');
      localStorage.removeItem('carrito');
      console.log('🧹 Carrito local limpiado');

      // Limpiar carrito capturado
      carritoCapturado = null;

      // Refrescar badge si existe CartAPI
      if (window.CartAPI && typeof window.CartAPI.refreshBadge === 'function') {
        await window.CartAPI.refreshBadge();
        console.log('🔄 Badge actualizado');
      }

      // Refrescar la página si estamos en carrito.html
      if (window.location.pathname.includes('carrito.html')) {
        console.log('🔄 Recargando página del carrito...');
        setTimeout(() => window.location.reload(), 500);
      }
    } else {
      console.warn('⚠️ No se pudo fusionar ningún producto');
    }

  } catch (error) {
    console.error('❌ Error crítico en fusión:', error);
  }
}

// ============================================================================
// LISTENER DE AUTH STATE CHANGE
// ============================================================================

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log(`🔑 Auth event: ${event}`);

  if (event === 'SIGNED_IN' && session) {
    console.log('✅ Usuario hizo login');
    
    // Esperar un momento para que todo se estabilice
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Fusionar carrito
    await fusionarCarrito();
  }

  if (event === 'SIGNED_OUT') {
    console.log('👋 Usuario cerró sesión');
    carritoCapturado = null;
  }
});

// ============================================================================
// CAPTURAR CARRITO AL CARGAR LA PÁGINA
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 Página cargada, verificando carrito...');
  
  // Capturar el carrito actual por si acaso
  if (capturarCarritoActual()) {
    console.log('✅ Carrito capturado preventivamente');
  }
});

// ============================================================================
// EXPORTAR FUNCIÓN PARA USO MANUAL
// ============================================================================

window.CartMerger = {
  capturar: capturarCarritoActual,
  fusionar: fusionarCarrito,
  verCapturado: () => {
    console.log('Carrito capturado:', carritoCapturado);
    return carritoCapturado;
  }
};

console.log('✅ cart-merger.js inicializado');
console.log('💡 Usar CartMerger.verCapturado() para ver el carrito capturado');