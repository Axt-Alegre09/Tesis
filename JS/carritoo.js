let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito")) || [];

const contenedorCarritoVacio = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado = document.querySelector("#carrito-comprado");

const botonVaciar  = document.querySelector("#carrito-acciones-vaciar");
const botonComprar = document.querySelector("#carrito-acciones-comprar");
const totalEl      = document.querySelector("#total");

function setEstado(estado) {
  if (estado === "vacio") {
    contenedorCarritoVacio.classList.remove("disabled");
    contenedorCarritoProductos.classList.add("disabled");
    contenedorCarritoAcciones.classList.add("disabled");
    contenedorCarritoComprado.classList.add("disabled");
  } else if (estado === "conItems") {
    contenedorCarritoVacio.classList.add("disabled");
    contenedorCarritoProductos.classList.remove("disabled");
    contenedorCarritoAcciones.classList.remove("disabled");
    contenedorCarritoComprado.classList.add("disabled");
  } else if (estado === "comprado") {
    contenedorCarritoVacio.classList.add("disabled");
    contenedorCarritoProductos.classList.add("disabled");
    contenedorCarritoAcciones.classList.add("disabled");
    contenedorCarritoComprado.classList.remove("disabled");
  }
}

function cargarProductosCarrito() {
  if (!productosEnCarrito || productosEnCarrito.length === 0) {
    contenedorCarritoProductos.innerHTML = ""; // limpia cards
    totalEl && (totalEl.textContent = formatearGs(0));
    setEstado("vacio");
    return;
  }

  setEstado("conItems");
  contenedorCarritoProductos.innerHTML = ""; // re-render

  productosEnCarrito.forEach((producto) => {
    const precio = Number(producto.precio);
    const div = document.createElement("div");
    div.classList.add("carrito-producto");
    div.innerHTML = `
      <img class="carrito-producto-imagen" src="${producto.imagen}" alt="${producto.titulo}">
      <div class="carrito-producto-titulo">
        <b><h6>Título</h6>
        <h4>${producto.titulo}</h4></b>
      </div>
      <div class="carrito-producto-cantidad">
        <h6>Cantidad</h6>
        <p>${producto.cantidad}</p>
      </div>
      <div class="carrito-producto-precio">
        <h6>Precio</h6>
        <p>${formatearGs(precio)}</p>
      </div>
      <div class="carrito-producto-subtotal">
        <h6>Subtotal</h6>
        <p>${formatearGs(precio * producto.cantidad)}</p>
      </div>
      <button class="carrito-producto-eliminar" data-id="${String(producto.id)}">
        <i class="bi bi-trash"></i>
      </button>
    `;
    contenedorCarritoProductos.append(div);
  });

  contenedorCarritoProductos
    .querySelectorAll(".carrito-producto-eliminar")
    .forEach(btn => btn.addEventListener("click", eliminarDelCarrito));

  actualizarTotal();
}

function eliminarDelCarrito(e) {
  const id = e.currentTarget.dataset.id;
  productosEnCarrito = productosEnCarrito.filter(p => String(p.id) !== String(id));
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  cargarProductosCarrito();
}

botonVaciar?.addEventListener("click", () => {
  productosEnCarrito = [];
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  cargarProductosCarrito(); // limpia sin recargar página
});

botonComprar?.addEventListener("click", () => {
  productosEnCarrito = [];
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  setEstado("comprado");
});

function actualizarTotal() {
  if (!totalEl) return;
  const total = productosEnCarrito.reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
  totalEl.textContent = formatearGs(total);
}

function formatearGs(n) {
  return new Intl.NumberFormat("es-PY").format(n) + " Gs";
}

// iniciar
cargarProductosCarrito();
