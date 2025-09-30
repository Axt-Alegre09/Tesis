// JS/main.js
import { supabase } from "./ScriptLogin.js";

const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");
const numerito = document.querySelector("#numerito");

let CATALOGO = [];
let productosEnCarrito = [];

// -------- Utils --------
function formatearGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n)) + " Gs";
}
function slugFix(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, "-");
}

// Fallback estable
const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";

// TU base URL del proyecto (ajústala si tu ref cambiara)
const STORAGE_BASE =
  "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

/**
 * Convierte lo que haya en BD a una URL pública válida:
 * - Si ya es http(s) → la devuelve tal cual
 * - Si comienza con "productos/" → lo recorta
 * - Si es solo el archivo → lo concatena a STORAGE_BASE
 * - Siempre hace encodeURIComponent del nombre (por si acaso)
 */
function toPublicImageUrl(value) {
  if (!value) return IMG_FALLBACK;

  let v = String(value).trim();

  // ya es una URL completa
  if (/^https?:\/\//i.test(v)) return v;

  // si vino con prefijo 'productos/...', lo retiro
  if (v.toLowerCase().startsWith("productos/")) {
    v = v.slice("productos/".length);
  }

  // encode del nombre (por si hay espacios u otros chars)
  const encoded = encodeURIComponent(v);
  return STORAGE_BASE + encoded;
}

// -------- Fetch desde BD --------
async function fetchProductos() {
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .order("nombre");

  if (error) {
    console.error("❌ Error cargando productos:", error.message);
    return [];
  }

  const normalizados = (data || []).map(p => ({
    id: p.id,
    sku: p.sku ?? null,
    titulo: p.nombre,
    imagen: toPublicImageUrl(p.imagen), // <- construimos URL pública robusta
    precio: p.precio,
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));

  // 👀 debug: imprime 3 URLs para revisar rápidamente en la consola
  console.log("Ejemplos de URLs de imagen:", normalizados.slice(0, 3).map(x => x.imagen));

  return normalizados;
}

// -------- Render --------
function cargarProductos(productosElegidos) {
  contenedorProductos.innerHTML = "";

  if (!productosElegidos.length) {
    contenedorProductos.innerHTML = `<div class="alerta-vacia">No hay productos para mostrar.</div>`;
    return;
  }

  productosElegidos.forEach(producto => {
    const imgSrc = producto.imagen || IMG_FALLBACK;

    const div = document.createElement("div");
    div.classList.add("producto");
    div.innerHTML = `
      <img class="producto-imagen" src="${imgSrc}" alt="${producto.titulo}" />
      <div class="producto-detalles">
        <h3 class="producto-titulo">${producto.titulo}</h3>
        <b><p class="producto-precio">${formatearGs(producto.precio)}</p></b>
        <button class="producto-agregar" data-id="${producto.id}">Agregar</button>
      </div>
    `;

    const img = div.querySelector(".producto-imagen");
    img.addEventListener("error", () => { img.src = IMG_FALLBACK; });

    contenedorProductos.append(div);
  });

  actualizarBotonesAgregar();
}

function renderTodos() {
  tituloPrincipal.textContent = "Todos los productos";
  cargarProductos(CATALOGO);
}

// -------- Filtros por categoría --------
function activarBotonesCategorias() {
  botonesCategorias.forEach(boton => {
    boton.addEventListener("click", (e) => {
      botonesCategorias.forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");

      const filtro = slugFix(e.currentTarget.id);
      if (filtro && filtro !== "todos") {
        const productoCategoria = CATALOGO.find(p => p.categoria.id === filtro);
        tituloPrincipal.textContent = productoCategoria?.categoria?.nombre || "Productos";
        const productosBoton = CATALOGO.filter(p => p.categoria.id === filtro);
        cargarProductos(productosBoton);
      } else {
        renderTodos();
      }
    });
  });
}

// -------- Carrito --------
function actualizarBotonesAgregar() {
  const botonesAgregar = document.querySelectorAll(".producto-agregar");
  botonesAgregar.forEach(boton => {
    boton.addEventListener("click", agregarAlCarrito);
  });
}

function cargarCarritoLS() {
  const productosEnCarritoLS = localStorage.getItem("productos-en-carrito");
  productosEnCarrito = productosEnCarritoLS ? JSON.parse(productosEnCarritoLS) : [];
  actualizarNumerito();
}

function agregarAlCarrito(e) {
  const id = e.currentTarget.dataset.id;
  const productoAgregado = CATALOGO.find(p => p.id === id);
  if (!productoAgregado) return;

  const yaEsta = productosEnCarrito.find(p => p.id === id);
  if (yaEsta) {
    yaEsta.cantidad += 1;
  } else {
    productosEnCarrito.push({ ...productoAgregado, cantidad: 1 });
  }
  actualizarNumerito();
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
}

function actualizarNumerito() {
  const nuevoNumerito = productosEnCarrito.reduce((acc, p) => acc + (p.cantidad || 0), 0);
  numerito.textContent = String(nuevoNumerito);
}

// -------- Inicio --------
async function iniciarCatalogo() {
  cargarCarritoLS();
  CATALOGO = await fetchProductos();
  renderTodos();
  activarBotonesCategorias();
}

iniciarCatalogo();
