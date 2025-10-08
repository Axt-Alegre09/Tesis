// JS/cart-api.js (shim compatible con ChatBrain)
(function () {
  function _read() {
    try { return JSON.parse(localStorage.getItem('productos-en-carrito')) || []; }
    catch { return []; }
  }
  function _write(cart) {
    localStorage.setItem('productos-en-carrito', JSON.stringify(cart || []));
    try {
      const totalQty = (cart || []).reduce((a,p)=>a + Number(p.cantidad||0), 0);
      document.getElementById('numerito')?.replaceChildren(document.createTextNode(totalQty));
    } catch {}
  }
  function _total(cart) {
    return (cart || []).reduce((a,p)=> a + Number(p.precio||0) * Number(p.cantidad||1), 0);
  }

  // Métodos base
  function add(item, qty=1) {
    const cart = _read();
    const id = String(item.id);
    const i = cart.findIndex(p => String(p.id) === id);
    if (i >= 0) cart[i].cantidad = Number(cart[i].cantidad||1) + Number(qty||1);
    else cart.push({ id, titulo:item.titulo||item.nombre||"", precio:Number(item.precio||0), imagen:item.imagen||null, cantidad:Number(qty||1) });
    _write(cart);
    return cart;
  }
  function removeById(id, qty=1) {
    const cart = _read();
    const i = cart.findIndex(p => String(p.id) === String(id));
    if (i >= 0) {
      cart[i].cantidad = Math.max(0, Number(cart[i].cantidad||0) - Number(qty||1));
      if (cart[i].cantidad === 0) cart.splice(i,1);
      _write(cart);
    }
    return cart;
  }
  function setQtyById(id, qty) {
    const cart = _read();
    const i = cart.findIndex(p => String(p.id) === String(id));
    if (i >= 0) {
      cart[i].cantidad = Math.max(1, Number(qty||1));
      _write(cart);
    }
    return cart;
  }

  // API que espera ChatBrain
  window.CartAPI = {
    // remoto si hay UUID; aquí lo tratamos igual (local)
    async addById(productoId, qty=1) {
      const all = window.__PRODUCTS__ || [];
      const prod = all.find(p => String(p.id) === String(productoId));
      if (!prod) throw new Error("Producto no encontrado en __PRODUCTS__");
      add({ id: prod.id, titulo: prod.nombre||prod.titulo, precio: prod.precio, imagen: prod.imagen }, qty);
      return true;
    },
    async addProduct(productObj, qty=1) {
      add(productObj, qty);
      return true;
    },
    async remove({ id }) { removeById(id, 999999); return true; },
    async setQty({ id }, qty) { setQtyById(id, qty); return true; },

    // para que el bot “vea” el carrito y el total
    getSnapshot() {
      const cart = _read();
      return {
        mode: "local",
        items: cart.map(p => ({
          id: String(p.id),
          titulo: p.titulo,
          precio: Number(p.precio||0),
          cantidad: Number(p.cantidad||1),
          imagen: p.imagen || null
        })),
        total: _total(cart)
      };
    },
    refresh() { /* noop en local */ },

    // por si algún otro script lo usa
    add, removeById,
    list() { return _read(); }
  };

    window.ChatBrain = window.ChatBrain || {};
    window.ChatBrain.buildIndex = function (productos) {
    // Guarda el catálogo para el NLU
    window.__PRODUCTS__ = Array.isArray(productos) ? productos : [];
    // invalida índice previo para reconstruir
    window.__PRODUCT_INDEX__ = null;
    // fuerza una construcción perezosa en el próximo uso
    return true;
};
})();
