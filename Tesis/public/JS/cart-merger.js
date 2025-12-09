// JS/cart-merger.js - CON DETECCIÓN DE ERRORES Y SOLUCIÓN ALTERNATIVA
import { supabase } from './ScriptLogin.js';

console.log('🟢 CART-MERGER CARGADO');

let carritoCapturado = null;
let fusionEnProceso = false;

function capturarCarrito() {
  try {
    const cartString = localStorage.getItem('productos-en-carrito');
    if (!cartString || cartString === '[]' || cartString === 'null') return false;
    
    const cart = JSON.parse(cartString);
    if (!Array.isArray(cart) || cart.length === 0) return false;
    
    carritoCapturado = JSON.parse(JSON.stringify(cart));
    console.log(`💾 CARRITO CAPTURADO: ${cart.length} productos`);
    cart.forEach((p, i) => console.log(`   ${i + 1}. ${p.titulo} x${p.cantidad}`));
    
    sessionStorage.setItem('carrito-capturado-backup', JSON.stringify(cart));
    return true;
  } catch (error) {
    console.error('Error capturando:', error);
    return false;
  }
}

// ============================================================================
// FUSIÓN CON DETECCIÓN DE ERRORES
// ============================================================================

async function fusionarCarritoConSession(session) {
  if (fusionEnProceso) {
    console.log('⏳ Fusión en proceso...');
    return;
  }
  
  fusionEnProceso = true;
  
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 FUSIÓN - MÉTODO CON DETECCIÓN DE ERRORES');
    console.log('═══════════════════════════════════════════════════');
    
    // Recuperar carrito
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
    console.log(`✅ User ID: ${user.id}`);
    
    // ============================================
    // INTENTO 1: USAR CartAPI (el más seguro)
    // ============================================
    
    console.log('');
    console.log('📝 Método 1: Usando CartAPI.addProduct()...');
    
    let exitosos = 0;
    let errores = 0;
    
    for (let i = 0; i < carritoCapturado.length; i++) {
      const producto = carritoCapturado[i];
      
      console.log(`[${i + 1}/${carritoCapturado.length}] ${producto.titulo}`);
      
      try {
        // Usar CartAPI que ya tiene toda la lógica
        await window.CartAPI.addById(producto.id, producto.cantidad);
        console.log(`   ✅ Agregado via CartAPI`);
        exitosos++;
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`   ❌ Error via CartAPI:`, error.message);
        
        // ============================================
        // INTENTO 2: INSERCIÓN DIRECTA (fallback)
        // ============================================
        
        try {
          console.log(`   🔄 Intentando inserción directa...`);
          
          // Buscar carrito del usuario
          let { data: carrito, error: errorBuscar } = await supabase
            .from('carritos')
            .select('id')
            .eq('usuario_id', user.id)
            .maybeSingle();
          
          console.log(`   📊 Resultado buscar carrito:`, { carrito, error: errorBuscar?.message });
          
          if (errorBuscar) {
            console.error(`   ❌ Error buscando carrito (RLS?):`, errorBuscar);
            errores++;
            continue;
          }
          
          // Si no existe, crear carrito
          if (!carrito) {
            console.log(`   📝 Creando carrito nuevo...`);
            
            const { data: nuevoCarrito, error: errorCrear } = await supabase
              .from('carritos')
              .insert({ usuario_id: user.id })
              .select('id')
              .single();
            
            console.log(`   📊 Resultado crear carrito:`, { nuevoCarrito, error: errorCrear?.message });
            
            if (errorCrear) {
              console.error(`   ❌ Error creando carrito (RLS?):`, errorCrear);
              errores++;
              continue;
            }
            
            carrito = nuevoCarrito;
          }
          
          const carritoId = carrito.id;
          console.log(`   ✅ Carrito ID: ${carritoId}`);
          
          // Verificar si producto ya existe
          const { data: itemExistente, error: errCheck } = await supabase
            .from('carrito_items')
            .select('id, cantidad')
            .eq('carrito_id', carritoId)
            .eq('producto_id', producto.id)
            .maybeSingle();
          
          console.log(`   📊 Item existente:`, { existe: !!itemExistente, error: errCheck?.message });
          
          if (errCheck) {
            console.error(`   ❌ Error verificando item (RLS?):`, errCheck);
            errores++;
            continue;
          }
          
          if (itemExistente) {
            // Actualizar
            const nuevaCantidad = Number(itemExistente.cantidad) + Number(producto.cantidad);
            console.log(`   📝 Actualizando cantidad: ${itemExistente.cantidad} → ${nuevaCantidad}`);
            
            const { error: errUpdate } = await supabase
              .from('carrito_items')
              .update({ cantidad: nuevaCantidad })
              .eq('id', itemExistente.id);
            
            if (errUpdate) {
              console.error(`   ❌ Error actualizando (RLS?):`, errUpdate);
              errores++;
            } else {
              console.log(`   ✅ Actualizado via DB directa`);
              exitosos++;
            }
          } else {
            // Insertar
            console.log(`   📝 Insertando item...`);
            
            const { error: errInsert } = await supabase
              .from('carrito_items')
              .insert({
                carrito_id: carritoId,
                producto_id: producto.id,
                cantidad: Number(producto.cantidad)
              });
            
            if (errInsert) {
              console.error(`   ❌ Error insertando (RLS?):`, errInsert);
              console.error(`   Detalles completos:`, JSON.stringify(errInsert, null, 2));
              errores++;
            } else {
              console.log(`   ✅ Insertado via DB directa`);
              exitosos++;
            }
          }
          
        } catch (error2) {
          console.error(`   ❌ Error en fallback:`, error2);
          errores++;
        }
      }
    }
    
    // Resultado
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('📊 RESULTADO FINAL');
    console.log('═══════════════════════════════════════════════════');
    console.log(`   Total:     ${carritoCapturado.length}`);
    console.log(`   ✅ Exitosos: ${exitosos}`);
    console.log(`   ❌ Errores:  ${errores}`);
    
    if (exitosos > 0) {
      console.log('');
      console.log('✅ FUSIÓN COMPLETADA (al menos parcialmente)');
      
      // Limpiar
      localStorage.removeItem('productos-en-carrito');
      localStorage.removeItem('carrito');
      sessionStorage.removeItem('carrito-capturado-backup');
      carritoCapturado = null;
      
      // Refrescar
      if (window.CartAPI?.refreshBadge) {
        await window.CartAPI.refreshBadge();
      }
      
      // Recargar
      if (window.location.pathname.includes('carrito.html')) {
        console.log('🔄 Recargando página...');
        setTimeout(() => window.location.reload(), 800);
      }
      
    } else {
      console.log('');
      console.log('❌ NO SE PUDO FUSIONAR NINGÚN PRODUCTO');
      console.log('');
      console.log('🔧 POSIBLES CAUSAS:');
      console.log('   1. RLS (Row Level Security) bloqueando acceso');
      console.log('   2. Tabla "carritos" no existe o tiene otro nombre');
      console.log('   3. Columna "usuario_id" no existe');
      console.log('');
      console.log('💡 SOLUCIÓN:');
      console.log('   Ve a Supabase > Authentication > Policies');
      console.log('   Habilita políticas para:');
      console.log('   - tabla "carritos" (INSERT, SELECT)');
      console.log('   - tabla "carrito_items" (INSERT, SELECT, UPDATE)');
    }
    
    console.log('═══════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR CRÍTICO EN FUSIÓN:');
    console.error(error);
    console.error('Stack:', error.stack);
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