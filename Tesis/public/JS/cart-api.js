// JS/cart-api.js
// CartAPI CON SOPORTE COMPLETO DE PROMOS + MIGRACIÓN DE CARRITO INVITADO + LOGS
import { supabase } from "./ScriptLogin.js";

// ---------- Utils ----------
const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n||0)) + " Gs";

const toImg = (v) => {
  if (!v) return IMG_FALLBACK;
  let s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.toLowerCase().startsWith("productos/")) s = s.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(s);
};

async function getUserId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// ---------- Local (storage) con tracking de promos ----------
function _readLocal() {
  try { return JSON.parse(localStorage.getItem("productos-en-carrito") || "[]"); }
  catch { return []; }
}

function _writeLocal(cart) {
  localStorage.setItem("productos-en-carrito", JSON.stringify(cart || []));
  
  // IMPORTANTE: También guardar en formato "carrito" para checkout
  const cartData = {
    items: cart,
    total: _totalLocal(cart)
  };
  localStorage.setItem("carrito", JSON.stringify(cartData));
  
  console.log("💾 Carrito guardado:", {
    items: cart.length,
    conPromo: cart.filter(p => p.tienePromo).length,
    sinPromo: cart.filter(p => !p.tienePromo).length
  });
  
  refreshBadge();
}

function _totalLocal(cart) {
  return (cart || []).reduce((a,p) => {
    const precio = p.tienePromo && p.precioConPromo 
      ? Number(p.precioConPromo) 
      : Number(p.precio);
    return a + precio * Number(p.cantidad||1);
  }, 0);
}

function _addLocal(prod, qty=1) {
  qty = Math.max(1, Number(qty));
  const cart = _readLocal();
  const id = String(prod.id);
  const i = cart.findIndex(p => String(p.id) === id);
  
  // Detectar si el título indica promoción (fallback)
  const tituloIndicaPromo = prod.titulo && (
    prod.titulo.includes('% OFF') || 
    prod.titulo.includes('descuento') ||
    prod.titulo.includes('promo')
  );
  
  // Determinar si tiene promo
  const tienePromo = prod.tienePromo || tituloIndicaPromo || false;
  
  // Calcular precios
  const precioOriginal = Number(prod.precioOriginal || prod.precio || 0);
  const precioConPromo = tienePromo && prod.precioConPromo 
    ? Number(prod.precioConPromo) 
    : Number(prod.precio);
  const precioFinal = tienePromo ? precioConPromo : precioOriginal;
  
  // Calcular descuento
  let descuentoPorcentaje = Number(prod.descuentoPorcentaje || 0);
  if (tienePromo && !descuentoPorcentaje && precioOriginal > precioFinal) {
    descuentoPorcentaje = Math.round(((precioOriginal - precioFinal) / precioOriginal) * 100);
  }
  
  console.log("➕ Agregando producto:", {
    nombre: prod.titulo || prod.nombre,
    tienePromo,
    precioOriginal,
    precioFinal,
    descuentoPorcentaje: descuentoPorcentaje + "%"
  });
  
  if (i >= 0) {
    cart[i].cantidad = Number(cart[i].cantidad||1) + qty;
  } else {
    cart.push({
      id,
      titulo: prod.titulo || prod.nombre || "",
      precio: precioFinal,
      precioOriginal: precioOriginal,
      precioConPromo: precioFinal,
      tienePromo: tienePromo,
      descuentoPorcentaje: descuentoPorcentaje,
      cantidad: qty,
      imagen: prod.imagen ? toImg(prod.imagen) : null
    });
  }
  
  _writeLocal(cart);
  return true;
}

function _setQtyLocal(id, qty) {
  qty = Math.max(1, Number(qty));
  const cart = _readLocal();
  const i = cart.findIndex(p => String(p.id) === id);
  if (i >= 0) {
    cart[i].cantidad = qty;
    _writeLocal(cart);
  }
  return true;
}

function _removeLocal(id) {
  const cart = _readLocal().filter(p => String(p.id) !== String(id));
  _writeLocal(cart);
  return true;
}

function _emptyLocal() {
  console.log("🗑️ Vaciando carrito local");
  _writeLocal([]);
  localStorage.removeItem("carrito");
  return true;
}

// ---------- Remoto (DB) ----------
async function _asegurarCarrito() {
  const { data, error } = await supabase.rpc("asegurar_carrito");
  if (error) throw error;
  return data;
}

async function _addRemote(productoId, qty=1) {
  qty = Math.max(1, Number(qty));
  const carritoId = await _asegurarCarrito();

  const { data: item, error: e2 } = await supabase
    .from("carrito_items")
    .select("id, cantidad")
    .eq("carrito_id", carritoId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (e2) throw e2;

  if (item) {
    const nueva = Number(item.cantidad||1) + qty;
    const { error: e3 } = await supabase
      .from("carrito_items")
      .update({ cantidad: nueva })
      .eq("id", item.id);
    if (e3) throw e3;
  } else {
    const { error: e4 } = await supabase
      .from("carrito_items")
      .insert({ carrito_id: carritoId, producto_id: productoId, cantidad: qty });
    if (e4) throw e4;
  }
  return true;
}

async function _fetchRemoteItems() {
  const carritoId = await _asegurarCarrito();

  const { data: items, error: errItems } = await supabase
    .from("carrito_items")
    .select("id, producto_id, cantidad")
    .eq("carrito_id", carritoId);
  if (errItems) throw errItems;

  if (!items || !items.length) return [];

  const ids = items.map(i => i.producto_id);
  
  // Usar la vista con promos
  const { data: prods, error: errProds } = await supabase
    .from("productos_con_promos")
    .select("*")
    .in("id", ids);
  if (errProds) throw errProds;

  const map = new Map(prods.map(p => [p.id, p]));
  
  return items.map(i => {
    const p = map.get(i.producto_id);
    const tienePromo = p?.tiene_promo || false;
    const precioOriginal = parseFloat(p?.precio_original || 0);
    const precioFinal = tienePromo 
      ? parseFloat(p?.precio_con_promo) 
      : precioOriginal;
    
    return {
      id: i.producto_id,
      titulo: p?.nombre || "Producto",
      precio: precioFinal,
      precioOriginal: precioOriginal,
      precioConPromo: precioFinal,
      tienePromo: tienePromo,
      descuentoPorcentaje: parseFloat(p?.descuento_porcentaje || 0),
      cantidad: Number(i.cantidad || 1),
      imagen: toImg(p?.imagen || ""),
      _itemId: i.id
    };
  });
}

async function _setQtyRemote(itemId, qty) {
  qty = Math.max(1, Number(qty));
  const { error } = await supabase
    .from("carrito_items")
    .update({ cantidad: qty })
    .eq("id", itemId);
  if (error) throw error;
  return true;
}

async function _removeRemote(itemId) {
  const { error } = await supabase.from("carrito_items").delete().eq("id", itemId);
  if (error) throw error;
  return true;
}

async function _emptyRemote() {
  const { error } = await supabase.rpc("carrito_vaciar");
  if (error) throw error;
  return true;
}

// ========== MIGRACIÓN DE CARRITO LOCAL → REMOTO (CON FUSIÓN + LOGS) ==========
async function migrateToRemote() {
  console.log("═══════════════════════════════════════");
  console.log("🔄 INICIANDO MIGRACIÓN DE CARRITO");
  console.log("═══════════════════════════════════════");
  
  const uid = await getUserId();
  console.log("👤 Usuario ID:", uid || "NO AUTENTICADO");
  
  if (!uid) {
    console.warn("⚠️ No hay usuario logueado, no se puede migrar");
    return { success: false, message: "Usuario no autenticado" };
  }

  const localCart = _readLocal();
  console.log("📦 Carrito local:", localCart.length, "items");
  
  if (!localCart || localCart.length === 0) {
    console.log("ℹ️ Carrito local vacío, nada que migrar");
    return { success: true, itemsMigrados: 0, itemsFusionados: 0 };
  }

  console.log("📋 Items a migrar:");
  localCart.forEach((item, idx) => {
    console.log(`   ${idx + 1}. ${item.titulo} - ${item.cantidad}x - ${fmtGs(item.precio)}`);
  });
  
  let migrados = 0;
  let fusionados = 0;
  let errores = 0;

  for (const item of localCart) {
    try {
      console.log(`\n🔄 Procesando: ${item.titulo}`);
      
      // Verificar si el producto ya existe en el carrito remoto
      const carritoId = await _asegurarCarrito();
      console.log(`   ✓ Carrito ID: ${carritoId}`);
      
      const { data: existente, error: e1 } = await supabase
        .from("carrito_items")
        .select("id, cantidad")
        .eq("carrito_id", carritoId)
        .eq("producto_id", item.id)
        .maybeSingle();
      
      if (e1) throw e1;
      
      if (existente) {
        // ⭐ FUSIÓN: Sumar cantidades
        const cantidadAnterior = Number(existente.cantidad || 1);
        const cantidadNueva = Number(item.cantidad || 1);
        const cantidadTotal = cantidadAnterior + cantidadNueva;
        
        console.log(`   🔗 FUSIÓN detectada:`);
        console.log(`      Cantidad en BD: ${cantidadAnterior}`);
        console.log(`      Cantidad local: ${cantidadNueva}`);
        console.log(`      Total: ${cantidadTotal}`);
        
        const { error: e2 } = await supabase
          .from("carrito_items")
          .update({ cantidad: cantidadTotal })
          .eq("id", existente.id);
        
        if (e2) throw e2;
        
        console.log(`   ✅ FUSIONADO exitosamente`);
        fusionados++;
      } else {
        // Agregar nuevo
        console.log(`   ➕ Agregando como nuevo (${item.cantidad}x)`);
        await _addRemote(item.id, item.cantidad);
        console.log(`   ✅ AGREGADO exitosamente`);
      }
      
      migrados++;
    } catch (error) {
      console.error(`   ❌ Error con ${item.titulo}:`, error);
      errores++;
    }
  }

  // Limpiar carrito local después de migrar
  console.log("\n🗑️ Limpiando carrito local...");
  _emptyLocal();
  
  console.log("\n═══════════════════════════════════════");
  console.log("✅ MIGRACIÓN COMPLETADA:");
  console.log(`   • Productos procesados: ${migrados}`);
  console.log(`   • Productos fusionados: ${fusionados}`);
  console.log(`   • Productos nuevos: ${migrados - fusionados}`);
  console.log(`   • Errores: ${errores}`);
  console.log("═══════════════════════════════════════");
  
  return {
    success: true,
    itemsMigrados: migrados,
    itemsFusionados: fusionados,
    errores: errores
  };
}

// ---------- API pública ----------
async function getSnapshot() {
  const uid = await getUserId();
  if (uid) {
    try {
      const items = await _fetchRemoteItems();
      const total = items.reduce((a,p)=> {
        const precio = p.tienePromo ? p.precioConPromo : p.precioOriginal;
        return a + Number(precio) * Number(p.cantidad||1);
      }, 0);
      
      console.log("📊 Snapshot remoto:", {
        items: items.length,
        conPromo: items.filter(i => i.tienePromo).length,
        total
      });
      
      return { mode: "remote", items, total };
    } catch {
      // fallback local si falla
    }
  }
  
  const cart = _readLocal();
  const total = _totalLocal(cart);
  
  console.log("📊 Snapshot local:", {
    items: cart.length,
    conPromo: cart.filter(i => i.tienePromo).length,
    total
  });
  
  return {
    mode: "local",
    items: cart.map(p => ({ ...p, imagen: toImg(p.imagen) })),
    total: total
  };
}

async function addById(productoId, qty=1) {
  const uid = await getUserId();
  if (uid) return _addRemote(productoId, qty);
  
  const all = window.__PRODUCTS__ || [];
  const prod = all.find(p => String(p.id) === String(productoId));
  if (!prod) throw new Error("Producto no encontrado");
  return _addLocal(prod, qty);
}

async function addProduct(productObj, qty=1) {
  const uid = await getUserId();
  
  const productoCompleto = {
    ...productObj,
    tienePromo: productObj.tienePromo || false,
    descuentoPorcentaje: Number(productObj.descuentoPorcentaje || 0),
    precioOriginal: Number(productObj.precioOriginal || productObj.precio || 0),
    precioConPromo: productObj.tienePromo 
      ? Number(productObj.precio) 
      : Number(productObj.precioOriginal || productObj.precio)
  };
  
  console.log("CartAPI.addProduct:", {
    nombre: productoCompleto.titulo || productoCompleto.nombre,
    tienePromo: productoCompleto.tienePromo,
    descuento: productoCompleto.descuentoPorcentaje + "%"
  });
  
  if (uid && productObj?.id) {
    return _addRemote(String(productObj.id), qty);
  }
  
  return _addLocal(productoCompleto, qty);
}

async function setQty({ itemId, id }, qty) {
  const uid = await getUserId();
  if (uid && itemId) return _setQtyRemote(itemId, qty);
  if (!uid && id)    return _setQtyLocal(id, qty);
  return false;
}

async function remove({ itemId, id }) {
  const uid = await getUserId();
  if (uid && itemId) return _removeRemote(itemId);
  if (!uid && id)    return _removeLocal(id);
  return false;
}

async function empty() {
  const uid = await getUserId();
  if (uid) return _emptyRemote();
  return _emptyLocal();
}

async function refreshBadge() {
  const el = document.getElementById("numerito");
  if (!el) return;
  const snap = await getSnapshot();
  const totalQty = (snap.items || []).reduce((a,p)=> a + Number(p.cantidad||0), 0);
  el.textContent = String(totalQty);
}

function verificarCarrito() {
  const cart = _readLocal();
  const conPromo = cart.filter(p => p.tienePromo);
  const sinPromo = cart.filter(p => !p.tienePromo);
  
  console.log("Estado del carrito:");
  console.log(`   Total: ${cart.length} productos`);
  console.log(`   Con promoción: ${conPromo.length}`);
  console.log(`   Sin promoción: ${sinPromo.length}`);
  
  if (conPromo.length > 0) {
    console.log("Productos con descuento:");
    conPromo.forEach(p => {
      console.log(`   - ${p.titulo}: ${p.descuentoPorcentaje}% OFF`);
      console.log(`     Original: ${fmtGs(p.precioOriginal)}`);
      console.log(`     Final: ${fmtGs(p.precio)}`);
    });
  }
}

window.CartAPI = {
  getSnapshot, 
  addById, 
  addProduct, 
  setQty, 
  remove, 
  empty,
  refreshBadge,
  verificarCarrito,
  migrateToRemote
};

console.log("✅ CartAPI cargado con soporte de promociones + modo invitado");
console.log("Usar CartAPI.verificarCarrito() para ver el estado actual");