// JS/main.js
import { supabase } from "./ScriptLogin.js";

const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");

let CATALOGO = [];

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n||0)) + " Gs";
const slug = (s) => String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g,"-");
const toImg = (v) => {
  if (!v) return IMG_FALLBACK;
  let s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.toLowerCase().startsWith("productos/")) s = s.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(s);
};

async function fetchProductos() {
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .order("nombre");
  if (error) { console.error("Carga catálogo:", error); return []; }
  return (data||[]).map(p => ({
    id: p.id,
    nombre: p.nombre,
    titulo: p.nombre,
    imagen: toImg(p.imagen),
    precio: p.precio,
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));
}

function render(productos) {
  contenedorProductos.innerHTML = "";
  if (!productos.length) {
    contenedorProductos.innerHTML = `<div class="alerta-vacia">No hay productos para mostrar.</div>`;
    return;
  }
  for (const producto of productos) {
    const div = document.createElement("div");
    div.className = "producto";
    div.innerHTML = `
      <img class="producto-imagen" src="${producto.imagen || IMG_FALLBACK}" alt="${producto.titulo}">
      <div class="producto-detalles">
        <h3 class="producto-titulo">${producto.titulo}</h3>
        <b><p class="producto-precio">${fmtGs(producto.precio)}</p></b>
        <button class="producto-agregar" data-id="${producto.id}">Agregar</button>
      </div>`;
    div.querySelector(".producto-imagen")?.addEventListener("error", (e) => e.currentTarget.src = IMG_FALLBACK);
    contenedorProductos.appendChild(div);
  }
  document.querySelectorAll(".producto-agregar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      try {
        // Preferimos addById si __PRODUCTS__ está cargado
        await window.CartAPI.addById(id, 1);
      } catch {
        // Fallback seguro para invitados
        const prod = CATALOGO.find(p => String(p.id) === String(id));
        if (prod) {
          await window.CartAPI.addProduct({
            id: prod.id, titulo: prod.titulo, precio: prod.precio, imagen: prod.imagen
          }, 1);
        }
      }
    });
  });
}

function wireCategorias() {
  botonesCategorias.forEach(boton => {
    boton.addEventListener("click", () => {
      botonesCategorias.forEach(b => b.classList.remove("active"));
      boton.classList.add("active");
      const filtro = slug(boton.id);
      if (filtro && filtro !== "todos") {
        const alguno = CATALOGO.find(p => p.categoria.id === filtro);
        tituloPrincipal.textContent = alguno?.categoria?.nombre || "Productos";
        render(CATALOGO.filter(p => p.categoria.id === filtro));
      } else {
        tituloPrincipal.textContent = "Todos los productos";
        render(CATALOGO);
      }
    });
  });
}

async function init() {
  CATALOGO = await fetchProductos();

  // Catálogo accesible para el Chat y CartAPI.addById
  window.__PRODUCTS__ = CATALOGO.map(p => ({
    id: p.id, nombre: p.nombre, titulo: p.titulo, precio: p.precio, imagen: p.imagen
  }));

  render(CATALOGO);
  wireCategorias();
  window.CartAPI.refreshBadge();

  // Búsqueda
  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");
  form?.addEventListener("submit", (e)=>{ e.preventDefault(); doSearch(input.value); });
  input?.addEventListener("keyup", (e)=>{
    if (e.key === "Enter") doSearch(input.value);
    if (!input.value) { tituloPrincipal.textContent = "Todos los productos"; render(CATALOGO); }
  });
}
async function doSearch(q) {
  const s = (q||"").trim();
  if (!s) { tituloPrincipal.textContent = "Todos los productos"; render(CATALOGO); return; }
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .or(`nombre.ilike.%${s}%, descripcion.ilike.%${s}%, categoria_nombre.ilike.%${s}%`)
    .order("nombre");
  if (error) { console.error("buscar:", error); return; }
  const resultados = (data||[]).map(p=>({
    id:p.id, nombre:p.nombre, titulo:p.nombre, imagen: toImg(p.imagen), precio:p.precio,
    categoria:{ id:p.categoria_slug, nombre:p.categoria_nombre }
  }));
  tituloPrincipal.textContent = `Resultados para "${s}" (${resultados.length})`;
  render(resultados);
}

init();
