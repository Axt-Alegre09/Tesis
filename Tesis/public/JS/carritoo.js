// JS/carritoo.js
import { supabase } from "./ScriptLogin.js";

let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito") || "[]");

const contenedorCarritoVacio     = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones  = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado  = document.querySelector("#carrito-comprado");

const botonVaciar  = document.querySelector("#carrito-acciones-vaciar");
const botonComprar = document.querySelector("#carrito-acciones-comprar");
const totalEl      = document.querySelector("#total");

const IMG_FALLBACK = "https://placehold.co/256x256?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

// Helper para loguear errores de Supabase bien detallados
function logSupabaseError(prefix, err) {
  const out = {
    message: err?.message ?? String(err),
    details: err?.details,
    hint: err?.hint,
    code: err?.code,
    name: err?.name
  };
  console.error(prefix, out);
  return out;
}


function toPublicImageUrl(value) {
  if (!value) return IMG_FALLBACK;
  let v = String(value).trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (v.toLowerCase().startsWith("productos/")) v = v.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(v);
}

function formatearGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n)) + " Gs";
}

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

// ------ Auth ------
async function obtenerUsuarioId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// ------ Remoto: leer carrito + productos ------
async function fetchCarritoRemoto() {
  const { data: carritoId, error: errEns } = await supabase.rpc("asegurar_carrito");
  if (errEns) { logSupabaseError("[carrito] asegurar_carrito", errEns); throw errEns; }

  const { data: items, error: errItems } = await supabase
    .from("carrito_items")
    .select("id, producto_id, cantidad")
    .eq("carrito_id", carritoId);

  if (errItems) { logSupabaseError("[carrito] items", errItems); throw errItems; }

  if (!items || items.length === 0) return [];

  const ids = items.map(i => i.producto_id);
  const { data: prods, error: errProds } = await supabase
    .from("v_productos_publicos")
    .select("id, nombre, precio, imagen")
    .in("id", ids);

  if (errProds) { logSupabaseError("[carrito] productos", errProds); throw errProds; }

  const mapProd = new Map(prods.map(p => [p.id, p]));
  return items.map(i => {
    const p = mapProd.get(i.producto_id);
    return {
      id: i.producto_id,
      titulo: p?.nombre || "Producto",
      precio: Number(p?.precio || 0),
      imagen: toPublicImageUrl(p?.imagen || ""),
      cantidad: Number(i.cantidad || 0),
      _itemId: i.id
    };
  });
}


// ------ Remoto: acciones ------
async function eliminarItemRemoto(itemId) {
  const { error } = await supabase.from("carrito_items").delete().eq("id", itemId);
  if (error) { console.error(error); return false; }
  return true;
}

async function vaciarCarritoRemoto() {
  const { error } = await supabase.rpc("carrito_vaciar");
  if (error) { console.error(error); return false; }
  return true;
}

async function checkoutRemoto() {
  const { data, error } = await supabase.rpc("carrito_checkout_v2");
  if (error) throw error;
  return data; // <- uuid del pedido
}



// ------ Render ------
function renderLocal() {
  if (!productosEnCarrito || productosEnCarrito.length === 0) {
    contenedorCarritoProductos.innerHTML = "";
    totalEl && (totalEl.textContent = formatearGs(0));
    setEstado("vacio");
    return;
  }

  setEstado("conItems");
  contenedorCarritoProductos.innerHTML = "";

  productosEnCarrito.forEach((producto) => {
    const precio = Number(producto.precio);
    const img = producto.imagen || IMG_FALLBACK;

    const div = document.createElement("div");
    div.classList.add("carrito-producto");
    div.innerHTML = `
      <img class="carrito-producto-imagen" src="${img}" alt="${producto.titulo}">
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
    .forEach(btn => btn.addEventListener("click", eliminarDelCarritoLocal));

  actualizarTotalLocal();
}

function renderRemoto(items) {
  if (!items || items.length === 0) {
    contenedorCarritoProductos.innerHTML = "";
    totalEl && (totalEl.textContent = formatearGs(0));
    setEstado("vacio");
    return;
  }

  setEstado("conItems");
  contenedorCarritoProductos.innerHTML = "";

  items.forEach((producto) => {
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
      <button class="carrito-producto-eliminar" data-itemid="${producto._itemId}">
        <i class="bi bi-trash"></i>
      </button>
    `;
    const img = div.querySelector(".carrito-producto-imagen");
    img.addEventListener("error", () => { img.src = IMG_FALLBACK; });

    contenedorCarritoProductos.append(div);
  });

  contenedorCarritoProductos
    .querySelectorAll(".carrito-producto-eliminar")
    .forEach(btn => btn.addEventListener("click", eliminarDelCarritoRemoto));

  actualizarTotalRemoto(items);
}

// ------ Acciones locales ------
function eliminarDelCarritoLocal(e) {
  const id = e.currentTarget.dataset.id;
  productosEnCarrito = productosEnCarrito.filter(p => String(p.id) !== String(id));
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  renderLocal();
}

function actualizarTotalLocal() {
  if (!totalEl) return;
  const total = productosEnCarrito.reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
  totalEl.textContent = formatearGs(total);
}

// ------ Acciones remotas ------
async function eliminarDelCarritoRemoto(e) {
  const itemId = e.currentTarget.dataset.itemid;
  const ok = await eliminarItemRemoto(itemId);
  if (!ok) return;
  await cargarCarrito(); // recargar vista
}

function actualizarTotalRemoto(items) {
  if (!totalEl) return;
  const total = items.reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
  totalEl.textContent = formatearGs(total);
}

// ------ Botones ------
botonVaciar?.addEventListener("click", async () => {
  const uid = await obtenerUsuarioId();
  if (uid) {
    const ok = await vaciarCarritoRemoto();
    if (ok) await cargarCarrito();
  } else {
    productosEnCarrito = [];
    localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
    renderLocal();
  }
});

botonComprar?.addEventListener("click", async () => {
  const uid = await obtenerUsuarioId();

  // Deshabilitar mientras procesa (evita doble click)
  botonComprar.setAttribute("disabled", "true");
  botonComprar.textContent = "Procesando…";

  if (uid) {
    try {
      const pedidoId = await checkoutRemoto();
      console.log("Pedido creado:", pedidoId);
      setEstado("comprado");
      // TODO: si querés, redirigir a pagina de confirmación:
      // window.location.href = `confirmacion.html?pedido=${pedidoId}`;
    } catch (e) {
      logSupabaseError("[checkout] Error final", e);
      alert("No se pudo completar el pedido. Intenta de nuevo.");
    } finally {
      // Rehabilitá el botón si no pasaste a “comprado”
      if (!contenedorCarritoComprado || contenedorCarritoComprado.classList.contains("disabled")) {
        botonComprar.removeAttribute("disabled");
        botonComprar.textContent = "Comprar ahora";
      }
    }
  } else {
    try {
      if (!productosEnCarrito || productosEnCarrito.length === 0) {
        alert("Tu carrito está vacío.");
        return;
      }
      // flujo sin login: ejemplo redirigir a pasarela local
      window.location.href = "pasarelaPagos.html";
    } finally {
      botonComprar.removeAttribute("disabled");
      botonComprar.textContent = "Comprar ahora";
    }
  }
});

// ------ Carga inicial ------
async function cargarCarrito() {
  const uid = await obtenerUsuarioId();
  if (uid) {
    try {
      const items = await fetchCarritoRemoto();
      renderRemoto(items);
    } catch (e) {
      console.error("Error cargando carrito remoto, usando local:", e);
      renderLocal();
    }
  } else {
    renderLocal();
  }
}

cargarCarrito();
