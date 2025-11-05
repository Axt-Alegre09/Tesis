// JS/cart-api.js
// CartAPI CON SOPORTE DE PROMOS
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

// ---------- Local (storage) ----------
function _readLocal() {
  try { return JSON.parse(localStorage.getItem("productos-en-carrito") || "[]"); }
  catch { return []; }
}
function _writeLocal(cart) {
  localStorage.setItem("productos-en-carrito", JSON.stringify(cart || []));
  refreshBadge();
}
function _totalLocal(cart) {
  return (cart || []).reduce((a,p) => {
    // Usar precio con promo si existe, sino precio normal
    const precio = p.tienePromo ? (p.precioConPromo || p.precio) : p.precio;
    return a + Number(precio||0) * Number(p.cantidad||1);
  }, 0);
}
function _addLocal(prod, qty=1) {
  qty = Math.max(1, Number(qty));
  const cart = _readLocal();
  const id = String(prod.id);
  const i = cart.findIndex(p => String(p.id) === id);
  
  // Usar precio con promo si existe
  const precioFinal = prod.tienePromo ? (prod.precioConPromo || prod.precio) : prod.precio;
  
  if (i >= 0) {
    cart[i].cantidad = Number(cart[i].cantidad||1) + qty;
  } else {
    cart.push({
      id,
      titulo: prod.titulo || prod.nombre || "",
      precio: Number(precioFinal||0),
      precioOriginal: Number(prod.precio || prod.precioOriginal || 0),
      tienePromo: prod.tienePromo || false,
      descuentoPorcentaje: Number(prod.descuentoPorcentaje || 0),
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
  const i = cart.findIndex(p => String(p.id) === String(id));
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
  _writeLocal([]);
  return true;
}

// ---------- Remoto (DB) ----------
async function _asegurarCarrito() {
  const { data, error } = await supabase.rpc("asegurar_carrito");
  if (error) throw error;
  return data; // carrito_id (uuid)
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
    const precioFinal = p?.tiene_promo 
      ? parseFloat(p.precio_con_promo) 
      : parseFloat(p?.precio_original || 0);
    
    return {
      id: i.producto_id,
      titulo: p?.nombre || "Producto",
      precio: precioFinal,
      precioOriginal: parseFloat(p?.precio_original || 0),
      tienePromo: p?.tiene_promo || false,
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

// ---------- API pública ----------
async function getSnapshot() {
  const uid = await getUserId();
  if (uid) {
    try {
      const items = await _fetchRemoteItems();
      const total = items.reduce((a,p)=> {
        const precio = p.tienePromo ? p.precio : p.precioOriginal;
        return a + Number(precio) * Number(p.cantidad||1);
      }, 0);
      return { mode: "remote", items, total };
    } catch {
      // fallback local si falla
    }
  }
  const cart = _readLocal();
  return {
    mode: "local",
    items: cart.map(p => ({ ...p, imagen: toImg(p.imagen) })),
    total: _totalLocal(cart)
  };
}

async function addById(productoId, qty=1) {
  const uid = await getUserId();
  if (uid) return _addRemote(productoId, qty);
  // invitado: intentar tener el objeto desde __PRODUCTS__
  const all = window.__PRODUCTS__ || [];
  const prod = all.find(p => String(p.id) === String(productoId));
  if (!prod) throw new Error("Producto no encontrado para invitado; usa addProduct(obj, qty).");
  return _addLocal(prod, qty);
}

// USAR SIEMPRE DESDE UI (decide local/remote solo)
async function addProduct(productObj, qty=1) {
  const uid = await getUserId();
  if (uid && productObj?.id) return _addRemote(String(productObj.id), qty);
  return _addLocal(productObj, qty);
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

window.CartAPI = {
  // core
  getSnapshot, addById, addProduct, setQty, remove, empty,
  // helpers UI
  refreshBadge,
};