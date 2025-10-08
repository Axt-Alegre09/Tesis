// JS/cart-api.js  (usar como <script type="module" ...>)
import { supabase } from "./JS/ScriptLogin.js";

// ---------- helpers local ----------
function _read() {
  try { return JSON.parse(localStorage.getItem("productos-en-carrito")) || []; }
  catch { return []; }
}
function _write(cart) {
  localStorage.setItem("productos-en-carrito", JSON.stringify(cart || []));
  try {
    const totalQty = (cart || []).reduce((a,p)=>a + Number(p.cantidad||0), 0);
    document.getElementById("numerito")?.replaceChildren(document.createTextNode(totalQty));
  } catch {}
}
function _total(cart) {
  return (cart || []).reduce((a,p)=> a + Number(p.precio||0) * Number(p.cantidad||1), 0);
}

// ---------- helpers remoto ----------
async function getUid() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}
async function contarRemoto() {
  const uid = await getUid();
  if (!uid) return null;
  const { data, error } = await supabase.rpc("carrito_contar");
  if (error) { console.error("[CartAPI] carrito_contar:", error); return 0; }
  return data ?? 0;
}
async function addRemoto(productoId, qty=1) {
  const { error } = await supabase.rpc("carrito_agregar_item", {
    p_producto_id: productoId, p_delta: qty
  });
  if (error) throw error;
}
async function listarRemoto() {
  const uid = await getUid();
  if (!uid) return null;

  // Traemos items y los unimos con v_productos_publicos (igual que tu carrito)
  const { data: carritoId, error: e0 } = await supabase.rpc("asegurar_carrito");
  if (e0) { console.error("[CartAPI] asegurar_carrito:", e0); return { items:[], total:0 }; }

  const { data: items, error: e1 } = await supabase
    .from("carrito_items")
    .select("id, producto_id, cantidad")
    .eq("carrito_id", carritoId);

  if (e1) { console.error("[CartAPI] carrito_items:", e1); return { items:[], total:0 }; }
  if (!items?.length) return { items:[], total:0 };

  const ids = items.map(i => i.producto_id);
  const { data: prods, error: e2 } = await supabase
    .from("v_productos_publicos")
    .select("id, nombre, precio, imagen")
    .in("id", ids);

  if (e2) { console.error("[CartAPI] productos:", e2); return { items:[], total:0 }; }

  const map = new Map(prods.map(p => [p.id, p]));
  const merged = items.map(i => {
    const p = map.get(i.producto_id);
    return {
      id: String(p?.id || i.producto_id),
      titulo: p?.nombre || "Producto",
      precio: Number(p?.precio || 0),
      cantidad: Number(i.cantidad || 1),
      imagen: p?.imagen || null
    };
  });

  return { items: merged, total: merged.reduce((a,p)=>a + p.precio * p.cantidad, 0) };
}

// ---------- API pública esperada por ChatBrain ----------
window.CartAPI = {
  async addById(productoId, qty=1) {
    const uid = await getUid();
    if (uid) {
      await addRemoto(productoId, qty);
      // actualizar numerito con la cuenta remota
      const n = await contarRemoto();
      if (n !== null) document.getElementById("numerito")?.replaceChildren(document.createTextNode(n));
      return true;
    }
    // sin sesión: local
    const all = window.__PRODUCTS__ || [];
    const prod = all.find(p => String(p.id) === String(productoId));
    if (!prod) throw new Error("Producto no encontrado");
    const cart = _read();
    const i = cart.findIndex(p => String(p.id) === String(prod.id));
    if (i >= 0) cart[i].cantidad = Number(cart[i].cantidad||1) + Number(qty||1);
    else cart.push({ id:String(prod.id), titulo:prod.nombre||prod.titulo, precio:Number(prod.precio||0), imagen:prod.imagen||null, cantidad:Number(qty||1) });
    _write(cart);
    return true;
  },

  async addProduct(productObj, qty=1) {
    // Si parece UUID y hay sesión, mejor ir remoto por id
    if (productObj?.id && /^[0-9a-f-]{36}$/i.test(String(productObj.id)) && await getUid()) {
      return this.addById(String(productObj.id), qty);
    }
    // local
    const cart = _read();
    const id = String(productObj.id);
    const i = cart.findIndex(p => String(p.id) === id);
    if (i >= 0) cart[i].cantidad = Number(cart[i].cantidad||1) + Number(qty||1);
    else cart.push({ id, titulo:productObj.titulo||productObj.nombre||"", precio:Number(productObj.precio||0), imagen:productObj.imagen||null, cantidad:Number(qty||1) });
    _write(cart);
    return true;
  },

  // En este proyecto no manejamos remover remoto por nombre desde el bot.
  async remove({ id }) {
    // local only (el carrito.html ya resuelve remoto con papelera)
    const cart = _read().filter(p => String(p.id) !== String(id));
    _write(cart);
    return true;
  },
  async setQty({ id }, qty) {
    const cart = _read();
    const i = cart.findIndex(p => String(p.id) === String(id));
    if (i >= 0) { cart[i].cantidad = Math.max(1, Number(qty||1)); _write(cart); }
    return true;
  },

  async getSnapshot() {
    const uid = await getUid();
    if (uid) {
      const { items, total } = await listarRemoto();
      return { mode:"remote", items, total };
    }
    const cart = _read();
    return {
      mode: "local",
      items: cart.map(p => ({ id:String(p.id), titulo:p.titulo, precio:Number(p.precio||0), cantidad:Number(p.cantidad||1), imagen:p.imagen||null })),
      total: _total(cart)
    };
  },

  refresh(){ /* no-op aquí */ },

  // util para el bot: guardar catálogo para indexar
  // (main.js ya la llama tras cargar productos)
  buildIndex(productos){
    window.__PRODUCTS__ = Array.isArray(productos) ? productos : [];
    window.__PRODUCT_INDEX__ = null; // invalida índice previo
    return true;
  }
};
