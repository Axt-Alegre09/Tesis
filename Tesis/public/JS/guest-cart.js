// JS/guest-cart.js - Manejo de carrito para usuarios invitados

import { supabase } from './ScriptLogin.js';

console.log('🛒 guest-cart.js cargado');

// ============================================================================
// CONSTANTES
// ============================================================================

const GUEST_CART_KEY = 'guest-carrito';
const GUEST_FLAG_KEY = 'is-guest-mode';

// ============================================================================
// VERIFICAR SI HAY CARRITO DE INVITADO
// ============================================================================

export function hasGuestCart() {
  const guestCart = localStorage.getItem(GUEST_CART_KEY);
  return guestCart !== null && guestCart !== 'null';
}

// ============================================================================
// GUARDAR CARRITO COMO INVITADO
// ============================================================================

export function saveAsGuestCart() {
  try {
    // Obtener carrito actual
    const currentCart = localStorage.getItem('productos-en-carrito');
    
    if (currentCart) {
      // Guardarlo como carrito de invitado
      localStorage.setItem(GUEST_CART_KEY, currentCart);
      localStorage.setItem(GUEST_FLAG_KEY, 'true');
      console.log('✅ Carrito guardado como invitado');
      return true;
    }
  } catch (error) {
    console.error('❌ Error guardando carrito de invitado:', error);
  }
  return false;
}

// ============================================================================
// FUSIONAR CARRITO DE INVITADO AL HACER LOGIN
// ============================================================================

export async function mergeGuestCartOnLogin() {
  try {
    // Verificar si hay carrito de invitado
    if (!hasGuestCart()) {
      console.log('ℹ️ No hay carrito de invitado para fusionar');
      return;
    }

    // Verificar si el usuario está autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('⚠️ Usuario no autenticado, no se puede fusionar carrito');
      return;
    }

    console.log('🔄 Fusionando carrito de invitado...');

    // Obtener carrito de invitado
    const guestCartRaw = localStorage.getItem(GUEST_CART_KEY);
    const guestCart = JSON.parse(guestCartRaw || '[]');

    // Obtener carrito actual del usuario (si existe)
    const userCartRaw = localStorage.getItem('productos-en-carrito');
    const userCart = JSON.parse(userCartRaw || '[]');

    // Fusionar carritos (evitar duplicados)
    const mergedCart = [...userCart];
    
    guestCart.forEach(guestItem => {
      const existingIndex = mergedCart.findIndex(item => item.id === guestItem.id);
      
      if (existingIndex >= 0) {
        // Si el producto ya existe, sumar cantidades
        mergedCart[existingIndex].cantidad = 
          Number(mergedCart[existingIndex].cantidad) + Number(guestItem.cantidad);
        console.log(`  ➕ Sumado: ${guestItem.titulo} (cantidad: ${guestItem.cantidad})`);
      } else {
        // Si no existe, agregarlo
        mergedCart.push(guestItem);
        console.log(`  ✅ Agregado: ${guestItem.titulo} (cantidad: ${guestItem.cantidad})`);
      }
    });

    // Guardar carrito fusionado
    localStorage.setItem('productos-en-carrito', JSON.stringify(mergedCart));

    // Limpiar carrito de invitado
    localStorage.removeItem(GUEST_CART_KEY);
    localStorage.removeItem(GUEST_FLAG_KEY);

    // Actualizar badge si CartAPI está disponible
    if (window.CartAPI && typeof window.CartAPI.refreshBadge === 'function') {
      window.CartAPI.refreshBadge();
    }

    console.log('✅ Carrito fusionado exitosamente');
    console.log(`   Total de productos: ${mergedCart.length}`);

    return mergedCart;

  } catch (error) {
    console.error('❌ Error fusionando carrito de invitado:', error);
  }
}

// ============================================================================
// VERIFICAR Y FUSIONAR EN AUTH STATE CHANGE
// ============================================================================

export function setupGuestCartMerge() {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      console.log('🔑 Usuario hizo login, verificando carrito de invitado...');
      await mergeGuestCartOnLogin();
    }
  });
}

// ============================================================================
// HABILITAR MODO INVITADO
// ============================================================================

export function enableGuestMode() {
  localStorage.setItem(GUEST_FLAG_KEY, 'true');
  console.log('👤 Modo invitado habilitado');
}

// ============================================================================
// VERIFICAR SI ESTÁ EN MODO INVITADO
// ============================================================================

export function isGuestMode() {
  return localStorage.getItem(GUEST_FLAG_KEY) === 'true';
}

// ============================================================================
// AUTO-INICIALIZACIÓN
// ============================================================================

// Configurar fusión automática al hacer login
setupGuestCartMerge();

console.log('✅ guest-cart.js inicializado');