// JS/cart-page.js
(function(){
  const vacioEl   = document.getElementById("carrito-vacio");
  const listaEl   = document.getElementById("carrito-productos");
  const accEl     = document.getElementById("carrito-acciones");
  const totalEl   = document.getElementById("total");
  const btnVaciar = document.getElementById("carrito-acciones-vaciar");

  const IMG_FALLBACK = "https://placehold.co/96";
  const fmt = (n)=> new Intl.NumberFormat("es-PY").format(Number(n||0)) + " Gs";

  function render(){
    const snap = window.CartAPI.getSnapshot();
    if (!snap.items.length) {
      vacioEl.classList.remove("disabled");
      listaEl.classList.add("disabled");
      accEl.classList.add("disabled");
      totalEl.textContent = fmt(0);
      window.CartAPI.refreshBadge();
      return;
    }
    vacioEl.classList.add("disabled");
    listaEl.classList.remove("disabled");
    accEl.classList.remove("disabled");

    listaEl.innerHTML = snap.items.map(it => `
      <div class="carrito-producto" data-id="${it.id}">
        <img class="carrito-producto-imagen" src="${it.imagen||IMG_FALLBACK}" alt="">
        <div class="carrito-producto-titulo"><h6>Título</h6><h4>${it.titulo}</h4></div>
        <div class="carrito-producto-cantidad">
          <h6>Cantidad</h6>
          <div class="qty-ctrl">
            <button class="menos">−</button>
            <span class="qty">${it.cantidad}</span>
            <button class="mas">+</button>
          </div>
        </div>
        <div class="carrito-producto-precio"><h6>Precio</h6><p>${fmt(it.precio)}</p></div>
        <div class="carrito-producto-subtotal"><h6>Subtotal</h6><p>${fmt(it.precio * it.cantidad)}</p></div>
        <button class="carrito-producto-eliminar">🗑️</button>
      </div>
    `).join("");

    totalEl.textContent = fmt(snap.total);

    // wiring
    listaEl.querySelectorAll(".mas").forEach(b=>{
      b.addEventListener("click", async (e)=>{
        const id = e.currentTarget.closest(".carrito-producto").dataset.id;
        const row = snap.items.find(r=>r.id===id);
        await window.CartAPI.setQty({ id }, Number(row.cantidad)+1);
        render();
      });
    });
    listaEl.querySelectorAll(".menos").forEach(b=>{
      b.addEventListener("click", async (e)=>{
        const id = e.currentTarget.closest(".carrito-producto").dataset.id;
        const row = snap.items.find(r=>r.id===id);
        if (row.cantidad > 1) await window.CartAPI.setQty({ id }, Number(row.cantidad)-1);
        else await window.CartAPI.remove({ id });
        render();
      });
    });
    listaEl.querySelectorAll(".carrito-producto-eliminar").forEach(b=>{
      b.addEventListener("click", async (e)=>{
        const id = e.currentTarget.closest(".carrito-producto").dataset.id;
        await window.CartAPI.remove({ id });
        render();
      });
    });

    window.CartAPI.refreshBadge();
  }

  btnVaciar?.addEventListener("click", async ()=>{
    await window.CartAPI.clear();
    render();
  });

  document.addEventListener("DOMContentLoaded", render);
  window.addEventListener("storage", (e)=>{
    if (!e || e.key === null || e.key === "productos-en-carrito") render();
  });
})();
