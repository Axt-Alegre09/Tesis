// JS/main.js
import { supabase } from "./ScriptLogin.js";
import "./cart-api.js"; // asegura CartAPI en window

const contenedorProductos = document.querySelector("#contenedor-productos");
const botonesCategorias = document.querySelectorAll(".boton-categoria");
const tituloPrincipal = document.querySelector("#titulo-principal");

let CATALOGO = []; // cache del catálogo público

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
const slug = (s) =>
  String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g, "-");

const toImg = (v) => {
  if (!v) return IMG_FALLBACK;
  let s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.toLowerCase().startsWith("productos/")) s = s.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(s);
};

/* =================== Data sources =================== */

// Flag post-compra (para “inmediatas” y UX)
const justBought = sessionStorage.getItem("just_bought") === "1";
if (justBought) sessionStorage.removeItem("just_bought");

// 1) Catálogo público (vista v_productos_publicos)
async function fetchProductosCatalogo() {
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .order("nombre");
  if (error) {
    console.error("Carga catálogo:", error);
    return [];
  }
  return (data || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    titulo: p.nombre,
    imagen: toImg(p.imagen || p.url_imagen),
    precio: p.precio,
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));
}

// 2) Populares para portada
async function fetchPopularesPortada(limit = 12) {
  const { data, error } = await supabase
    .from("populares_para_portada")
    .select("*")
    .limit(limit);
  if (error) {
    console.error("Populares:", error);
    return [];
  }
  return (data || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    titulo: p.nombre,
    imagen: toImg(p.url_imagen || p.imagen),
    precio: p.precio
  }));
}

// 3) Recomendaciones personalizadas (RPC ML)
async function fetchPensadoParaVos(limit = 12) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .rpc("recomendaciones_productos_para_usuario", { p_usuario: user.id, p_limite: limit });
  if (error) {
    console.error("Recos RPC:", error);
    return [];
  }
  return (data || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    titulo: p.nombre,
    imagen: toImg(p.url_imagen || p.imagen),
    precio: p.precio
  }));
}

// 4) NUEVO: recos inmediatas post-compra
async function fetchInmediatas(limit = 12) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .rpc("recomendaciones_inmediatas", { p_usuario: user.id, p_limite: limit });
  if (error) {
    console.warn("Inmediatas RPC:", error);
    return [];
  }
  return (data || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    titulo: p.nombre,
    imagen: toImg(p.url_imagen || p.imagen),
    precio: p.precio,
    motivo: p.motivo
  }));
}

/* =================== UI render =================== */

function montar(productos) {
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
    div.querySelector(".producto-imagen")?.addEventListener("error", (e) => (e.currentTarget.src = IMG_FALLBACK));
    contenedorProductos.appendChild(div);
  }
  // handler Agregar
  document.querySelectorAll(".producto-agregar").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const id = e.currentTarget.dataset.id;
      const prod = [...CATALOGO].find((p) => String(p.id) === String(id)) || null;
      const fallbackProd = prod || (() => {
        const card = e.currentTarget.closest(".producto");
        const nombre = card?.querySelector(".producto-titulo")?.textContent?.trim() || "Producto";
        const precioText = card?.querySelector(".producto-precio")?.textContent || "0";
        const precioNum = Number((precioText.replace(/[^\d]/g, "")) || 0);
        return { id, nombre, titulo: nombre, precio: precioNum, imagen: card?.querySelector("img")?.src || IMG_FALLBACK };
      })();

      try {
        await window.CartAPI.addProduct(fallbackProd, 1);
        await window.CartAPI.refreshBadge();
      } catch (err) {
        console.error("addProduct:", err);
        alert("No se pudo agregar. Intenta de nuevo.");
      }
    });
  });
}

function wireCategorias() {
  botonesCategorias.forEach((boton) => {
    boton.addEventListener("click", () => {
      botonesCategorias.forEach((b) => b.classList.remove("active"));
      boton.classList.add("active");
      const filtro = slug(boton.id);
      if (filtro && filtro !== "todos") {
        const alguno = CATALOGO.find((p) => p.categoria.id === filtro);
        tituloPrincipal.textContent = alguno?.categoria?.nombre || "Productos";
        montar(CATALOGO.filter((p) => p.categoria.id === filtro));
      } else {
        tituloPrincipal.textContent = "Todos los productos";
        montar(CATALOGO);
      }
    });
  });
}

/* =================== Búsqueda =================== */

async function buscar(q) {
  const s = (q || "").trim();
  if (!s) {
    tituloPrincipal.textContent = "Todos los productos";
    montar(CATALOGO);
    return;
  }
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("*")
    .or(`nombre.ilike.%${s}%, descripcion.ilike.%${s}%, categoria_nombre.ilike.%${s}%`)
    .order("nombre");
  if (error) {
    console.error("buscar:", error);
    return;
  }
  const resultados = (data || []).map((p) => ({
    id: p.id,
    nombre: p.nombre,
    titulo: p.nombre,
    imagen: toImg(p.imagen || p.url_imagen),
    precio: p.precio,
    categoria: { id: p.categoria_slug, nombre: p.categoria_nombre }
  }));
  tituloPrincipal.textContent = `Resultados para "${s}" (${resultados.length})`;
  montar(resultados);
}

/* =================== Init =================== */

async function init() {
  // 1) Cargar catálogo base
  CATALOGO = await fetchProductosCatalogo();
  window.__PRODUCTS__ = CATALOGO.map((p) => ({ id: p.id, nombre: p.nombre, titulo: p.titulo, precio: p.precio, imagen: p.imagen }));

  // 2) Home feed: Inmediatas → ML → Populares → Catálogo
  let itemsHome = [];
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Inmediatas si hay compra reciente
      const inmediatas = await fetchInmediatas(12);
      if (inmediatas.length) {
        tituloPrincipal.textContent = "Pensado para vos";
        itemsHome = inmediatas;
      }

      // ML si no hubo inmediatas
      if (!itemsHome.length) {
        const recos = await fetchPensadoParaVos(12);
        if (recos.length) {
          tituloPrincipal.textContent = "Pensado para vos";
          itemsHome = recos;
        }
      }
    }

    // Populares si no hay user/recos
    if (!itemsHome.length) {
      const pop = await fetchPopularesPortada(12);
      if (pop.length) {
        tituloPrincipal.textContent = "Populares";
        itemsHome = pop;
      }
    }

    // Fallback catálogo
    if (!itemsHome.length) {
      tituloPrincipal.textContent = "Todos los productos";
      itemsHome = CATALOGO;
    }
  } catch (e) {
    console.warn("Home feed:", e);
    tituloPrincipal.textContent = "Todos los productos";
    itemsHome = CATALOGO;
  }

  montar(itemsHome);
  wireCategorias();
  await window.CartAPI.refreshBadge();

  // 3) Búsqueda
  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    buscar(input.value);
  });
  input?.addEventListener("keyup", (e) => {
    if (e.key === "Enter") buscar(input.value);
    if (!input.value) {
      tituloPrincipal.textContent = "Todos los productos";
      montar(CATALOGO);
    }
  });
}

init();
