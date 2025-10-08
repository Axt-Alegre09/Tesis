// JS/main.js
import { supabase } from "./ScriptLogin.js";

const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias   = document.querySelectorAll(".boton-categoria");
const tituloPrincipal     = document.querySelector("#titulo-principal");
const numerito            = document.querySelector("#numerito");

let CATALOGO = [];
let productosEnCarrito = []; // localStorage

// -------- Utils --------
const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

const formatearGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
const slugFix = (s) => String(s || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/\s+/g, "-");

function toPublicImageUrl(value) {
  if (!value) return IMG_FALLBACK;
  let v = String(value).trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (v.toLowerCase().startsWith("productos/")) v = v.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(v);
}

// -------- Fetch catálogo desde BD --------
async function fetchProductos() {
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .order("nombre");

  if (error) {
    console.error("❌ Error cargando productos:", error.message);
    return [];
  }

  return (data || []).map(p => ({
    id: p.id,
    sku: p.sku ?? null,
    titulo: p.nombre,
    imagen: toPublicImageUrl(p.imagen),
    precio: Number(p.precio || 0),
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));
}

// -------- Render catálogo --------
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

  activarBotonesAgregar();
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

// -------- Carrito (localStorage) --------
function cargarCarritoLS() {
  try {
    const ls = localStorage.getItem("productos-en-carrito");
    productosEnCarrito = ls ? JSON.parse(ls) : [];
  } catch {
    productosEnCarrito = [];
  }
}

function guardarCarritoLS() {
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
}

function actualizarNumerito() {
  const totalLocal = productosEnCarrito.reduce((a, p) => a + (p.cantidad || 0), 0);
  numerito.textContent = String(totalLocal);
}

function activarBotonesAgregar() {
  const botonesAgregar = document.querySelectorAll(".producto-agregar");
  botonesAgregar.forEach(boton => {
    boton.addEventListener("click", (e) => agregarAlCarrito(e.currentTarget.dataset.id, 1));
  });
}

function agregarAlCarrito(id, cant = 1) {
  const prod = CATALOGO.find(p => String(p.id) === String(id));
  if (!prod) return;

  const ya = productosEnCarrito.find(p => String(p.id) === String(id));
  if (ya) ya.cantidad += Number(cant || 1);
  else productosEnCarrito.push({ id: String(prod.id), titulo: prod.titulo, precio: prod.precio, imagen: prod.imagen, cantidad: Number(cant || 1) });

  guardarCarritoLS();
  actualizarNumerito();
}

// -------- Búsqueda --------
async function buscarProductos(q) {
  const query = (q || "").trim();
  if (!query) { renderTodos(); return; }

  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .or(`nombre.ilike.%${query}%, descripcion.ilike.%${query}%, categoria_nombre.ilike.%${query}%`)
    .order("nombre");

  if (error) {
    console.error("❌ Error en búsqueda:", error.message);
    return;
  }

  const resultados = (data || []).map(p => ({
    id: p.id,
    sku: p.sku ?? null,
    titulo: p.nombre,
    imagen: toPublicImageUrl(p.imagen),
    precio: Number(p.precio || 0),
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));

  tituloPrincipal.textContent = `Resultados para "${query}" (${resultados.length})`;
  cargarProductos(resultados);
}

// -------- Inicio --------
async function iniciarCatalogo() {
  cargarCarritoLS();
  CATALOGO = await fetchProductos();
  renderTodos();
  activarBotonesCategorias();
  actualizarNumerito();

  // deja el catálogo para el bot y construye índice
  window.__PRODUCTS__ = CATALOGO;
  window.ChatBrain?.buildIndex?.(CATALOGO);

  // Búsqueda
  const inputBusqueda = document.getElementById("searchInput");
  const formBusqueda = document.getElementById("searchForm");

  formBusqueda?.addEventListener("submit", (e) => {
    e.preventDefault();
    buscarProductos(inputBusqueda.value);
  });

  inputBusqueda?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") buscarProductos(inputBusqueda.value);
    if (inputBusqueda.value === "") renderTodos();
  });
}

iniciarCatalogo();

// Exponer una mínima API para el bot (por si la necesitás)
window.__ADD_TO_CART__ = (id, qty=1) => agregarAlCarrito(id, qty);
