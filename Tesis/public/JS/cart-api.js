// JS/cart-api.js
window.CartAPI = {
  add(item, qty=1) {
    const raw = localStorage.getItem('productos-en-carrito');
    const cart = raw ? JSON.parse(raw) : [];
    const i = cart.findIndex(p => String(p.id) === String(item.id));
    if (i >= 0) cart[i].cantidad = Number(cart[i].cantidad||1) + Number(qty||1);
    else cart.push({...item, cantidad:Number(qty||1)});
    localStorage.setItem('productos-en-carrito', JSON.stringify(cart));
    try {
      const totalQty = cart.reduce((a,p)=>a + Number(p.cantidad||0), 0);
      document.getElementById('numerito')?.replaceChildren(document.createTextNode(totalQty));
    } catch {}
    return cart;
  },
  removeById(id, qty=1){
    const raw = localStorage.getItem('productos-en-carrito');
    const cart = raw ? JSON.parse(raw) : [];
    const i = cart.findIndex(p => String(p.id) === String(id));
    if (i >= 0) {
      cart[i].cantidad = Math.max(0, Number(cart[i].cantidad||0) - Number(qty||1));
      if (cart[i].cantidad === 0) cart.splice(i,1);
      localStorage.setItem('productos-en-carrito', JSON.stringify(cart));
    }
    return cart;
  },
  list(){ try { return JSON.parse(localStorage.getItem('productos-en-carrito')) || []; } catch { return []; } }
};
