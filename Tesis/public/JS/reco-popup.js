// JS/reco-popup.js
import { supabase } from "./ScriptLogin.js";

const OVERLAY_ID = "recoModalOverlay";
const LIST_ID = "recoList";

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

// Formateo Gs PY
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

function openReco() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.hidden = false;
}
function closeReco() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.hidden = true;
}

function cardHTML(p) {
  const id = p.id ?? p.producto_id ?? p.slug ?? "";
  const nombre = p.nombre ?? p.titulo ?? "Producto";
  const precio = p.precio ?? p.price ?? 0;
  const imgPath = p.imagen_url || p.img || p.imagen || p.image_path || "";
  const img = imgPath?.startsWith("http") ? imgPath : (imgPath ? (STORAGE_BASE + imgPath) : IMG_FALLBACK);

  return `
    <article class="reco-card" data-id="${id}">
      <div class="reco-imgwrap">
        <img src="${img}" alt="${nombre}">
      </div>
      <div>
        <h3 class="reco-title">${nombre}</h3>
        <div class="reco-price">${fmtGs(precio)}</div>
      </div>
      <div class="reco-actions">
        <button class="reco-btn primary" data-add="${id}">Agregar</button>
        <button class="reco-btn ghost" data-view="${id}">Ver</button>
      </div>
    </article>
  `;
}

function renderList(items = []) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div style="padding:16px">No tenemos recomendaciones por ahora. ¡Explorá nuestros <a href="#contenedor-productos">productos</a>!</div>`;
    return;
  }
  list.innerHTML = items.map(cardHTML).join("");
}

// RPC recomendaciones (ajusta parámetros si tu función usa otros nombres)
async function tryRpcRecomendaciones(userId, limit = 8) {
  const { data, error } = await supabase.rpc("recomendaciones_productos_para_usuario", {
    p_usuario: userId, p_limite: limit
  });
  if (!error && data?.length) return { data };
  return { data: [], error: error ?? new Error("Sin resultados de RPC") };
}

// Fallback: productos públicos
async function fetchFallback(limit = 8) {
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("id, nombre, precio, imagen_url")
    .limit(limit);
  if (error) {
    console.warn("Fallback error:", error.message);
    return [];
  }
  return data ?? [];
}

async function loadRecommendations() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await tryRpcRecomendaciones(user.id, 8);
      if (data?.length) return data;
    }
    return await fetchFallback(8);
  } catch (e) {
    console.warn("loadRecommendations error:", e);
    return [];
  }
}

function wireModalActions() {
  const overlay = document.getElementById(OVERLAY_ID);
  const closeBtn = document.getElementById("recoCloseBtn");
  const closeSecondary = document.getElementById("recoCloseSecondary");

  closeBtn?.addEventListener("click", () => closeReco());
  closeSecondary?.addEventListener("click", () => closeReco());

  overlay?.addEventListener("click", (ev) => {
    if (ev.target === overlay) closeReco();
  });

  // Delegación: Agregar / Ver
  const list = document.getElementById(LIST_ID);
  list?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;
    const card = btn.closest(".reco-card");
    const id = card?.dataset?.id;
    if (!id) return;

    if (btn.hasAttribute("data-add")) {
      if (window.CartAPI?.addById) {
        window.CartAPI.addById(id, 1);
      } else if (window.CartAPI?.addProduct) {
        // fallback mínimo
        const nombre = card?.querySelector(".reco-title")?.textContent?.trim() ?? "Producto";
        const precioText = card?.querySelector(".reco-price")?.textContent || "0";
        const precioNum = Number((precioText.replace(/[^\d]/g, "")) || 0);
        window.CartAPI.addProduct({ id, nombre, titulo: nombre, precio: precioNum }, 1);
      }
      btn.textContent = "Agregado ✓";
      setTimeout(() => (btn.textContent = "Agregar"), 1200);
      window.CartAPI?.refreshBadge?.();
    }

    if (btn.hasAttribute("data-view")) {
      closeReco();
      const anchor = document.querySelector("#contenedor-productos");
      if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function personalizeTitle() {
  // Cambia el H2 a “Recomendado para vos, {Nombre}”
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;
    const nombre = user.user_metadata?.nombre || user.email?.split("@")[0] || "";
    if (!nombre) return;
    const h2 = document.getElementById("recoModalTitle");
    if (h2) h2.textContent = `Recomendado para vos, ${nombre}`;
  }).catch(() => {});
}

function wireLogoClick() {
  const candidates = [
    ".logo-principal",
    ".logo img",
    "aside header img",
    "header .logo img"
  ];
  let logoEl = null;
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) { logoEl = el; break; }
  }
  logoEl?.addEventListener("click", (e) => {
    e.preventDefault();
    openReco();
  });
}

async function boot() {
  const overlay = document.getElementById(OVERLAY_ID);
  const list = document.getElementById(LIST_ID);
  if (!overlay || !list) return;

  list.innerHTML = `<div style="padding:16px">Cargando recomendaciones…</div>`;
  const items = await loadRecommendations();
  renderList(items);

  personalizeTitle();
  openReco();
  wireModalActions();
  wireLogoClick();
}

document.addEventListener("DOMContentLoaded", boot);
