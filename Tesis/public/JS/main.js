// JS/main.js
import { supabase } from "./ScriptLogin.js";

const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");
const numerito = document.querySelector("#numerito");

let CATALOGO = [];
let productosEnCarrito = []; // fallback local

// -------- Utils --------
function formatearGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n)) + " Gs";
}
function slugFix(s) {
  return String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, "-");
}

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

function toPublicImageUrl(value) {
  if (!value) return IMG_FALLBACK;
  let v = String(value).trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (v.toLowerCase().startsWith("productos/")) v = v.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(v);
}

// -------- Auth helpers --------
async function obtenerUsuarioId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

// -------- RPC carrito (remoto) --------
async function agregarAlCarritoRemoto(productoId, delta = 1) {
  const { error } = await supabase.rpc("carrito_agregar_item", {
    p_producto_id: productoId,
    p_delta: delta
  });
  if (error) {
    console.error("carrito_agregar_item error:", error);
    return false;
  }
  return true;
}

async function contarCarritoRemoto() {
  const uid = await obtenerUsuarioId();
  if (!uid) return null; // sin sesión → usar local
  const { data, error } = await supabase.rpc("carrito_contar");
  if (error) {
    console.error("carrito_contar error:", error);
    return 0;
  }
  return data ?? 0;
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
    precio: p.precio,
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));
}

// -------- Buscar en BD --------
async function buscarProductos(q) {
  if (!q || q.trim() === "") {
    renderTodos();
    return;
  }

  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .or(`nombre.ilike.%${q}%, descripcion.ilike.%${q}%, categoria_nombre.ilike.%${q}%`)
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
    precio: p.precio,
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));

  tituloPrincipal.textContent = `Resultados para "${q}" (${resultados.length})`;
  cargarProductos(resultados);
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

// -------- Carrito (agregar) --------
function actualizarBotonesAgregar() {
  const botonesAgregar = document.querySelectorAll(".producto-agregar");
  botonesAgregar.forEach(boton => {
    boton.addEventListener("click", agregarAlCarrito);
  });
}

function cargarCarritoLS() {
  const ls = localStorage.getItem("productos-en-carrito");
  productosEnCarrito = ls ? JSON.parse(ls) : [];
}

async function agregarAlCarrito(e) {
  const id = e.currentTarget.dataset.id;
  const prod = CATALOGO.find(p => p.id === id);
  if (!prod) return;

  const uid = await obtenerUsuarioId();
  if (uid) {
    const ok = await agregarAlCarritoRemoto(id, 1);
    if (!ok) return;
  } else {
    // fallback local
    const ya = productosEnCarrito.find(p => p.id === id);
    if (ya) ya.cantidad += 1;
    else productosEnCarrito.push({ ...prod, cantidad: 1 });
    localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  }

  await actualizarNumerito();
}

async function actualizarNumerito() {
  const remoto = await contarCarritoRemoto();
  if (remoto !== null) {
    numerito.textContent = String(remoto);
  } else {
    const totalLocal = productosEnCarrito.reduce((a, p) => a + (p.cantidad || 0), 0);
    numerito.textContent = String(totalLocal);
  }
}

// -------- Inicio --------
async function iniciarCatalogo() {
  cargarCarritoLS();
  CATALOGO = await fetchProductos();
  renderTodos();
  activarBotonesCategorias();
  await actualizarNumerito();

  // Búsqueda
  const inputBusqueda = document.getElementById("searchInput");
  const formBusqueda = document.getElementById("searchForm");

  formBusqueda?.addEventListener("submit", (e) => {
    e.preventDefault();
    buscarProductos(inputBusqueda.value);
  });

  inputBusqueda?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") buscarProductos(inputBusqueda.value);
    if (inputBusqueda.value === "") renderTodos(); // reset si borras texto
  });
}

iniciarCatalogo();
