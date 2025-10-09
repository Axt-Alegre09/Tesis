// JS/cart-api.js
(function () {
  const LS_KEY = "productos-en-carrito";

  const read = () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch { return []; }
  };
  const write = (cart) => {
    localStorage.setItem(LS_KEY, JSON.stringify(cart || []));
    refreshBadge();
  };
  const total = (cart) =>
    (cart || []).reduce((a,p)=> a + Number(p.precio||0) * Number(p.cantidad||1), 0);

  function addLocal(item, qty=1) {
    const cart = read();
    const id = String(item.id);
    const i = cart.findIndex(p => String(p.id) === id);
    if (i >= 0) cart[i].cantidad = Number(cart[i].cantidad||1) + Number(qty||1);
    else cart.push({
      id,
      titulo: item.titulo || item.nombre || "",
      precio: Number(item.precio||0),
      imagen: item.imagen || null,
      cantidad: Number(qty||1),
    });
    write(cart);
    window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY }));
    return cart;
  }
  function removeLocal(id, qty=1) {
    const cart = read();
    const i = cart.findIndex(p => String(p.id) === String(id));
    if (i >= 0) {
      cart[i].cantidad = Math.max(0, Number(cart[i].cantidad||0) - Number(qty||1));
      if (cart[i].cantidad === 0) cart.splice(i,1);
      write(cart);
      window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY }));
    }
    return cart;
  }
  function setQtyLocal(id, qty) {
    const cart = read();
    const i = cart.findIndex(p => String(p.id) === String(id));
    if (i >= 0) {
      cart[i].cantidad = Math.max(1, Number(qty||1));
      write(cart);
      window.dispatchEvent(new StorageEvent("storage", { key: LS_KEY }));
    }
    return cart;
  }

  function refreshBadge() {
    try {
      const cart = read();
      const totalQty = cart.reduce((a,p)=> a + Number(p.cantidad||0), 0);
      const el = document.getElementById("numerito");
      if (el) el.textContent = String(totalQty);
    } catch {}
  }

  window.CartAPI = {
    async addById(productoId, qty=1) {
      const all = window.__PRODUCTS__ || [];
      const prod = all.find(p => String(p.id) === String(productoId));
      if (!prod) throw new Error("Producto no encontrado en __PRODUCTS__");
      addLocal({ id: prod.id, titulo: prod.nombre||prod.titulo, precio: prod.precio, imagen: prod.imagen }, qty);
      return true;
    },
    async addProduct(productObj, qty=1) { addLocal(productObj, qty); return true; },
    async remove({ id }) { removeLocal(id, 999999); return true; },
    async setQty({ id }, qty) { setQtyLocal(id, qty); return true; },

    getSnapshot() {
      const cart = read();
      return {
        mode: "local",
        items: cart.map(p => ({
          id: String(p.id),
          titulo: p.titulo,
          precio: Number(p.precio||0),
          cantidad: Number(p.cantidad||1),
          imagen: p.imagen || null,
        })),
        total: total(cart),
      };
    },
    refreshBadge,
    list() { return read(); },
    clear() { write([]); }
  };

  window.addEventListener("storage", (e) => {
    if (!e || e.key === null || e.key === LS_KEY) window.CartAPI.refreshBadge();
  });
  document.addEventListener("DOMContentLoaded", () => window.CartAPI.refreshBadge());
})();
