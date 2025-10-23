// JS/reco-popup.js
import { supabase } from "./ScriptLogin.js";

const OVERLAY_ID = "recoModalOverlay";
const LIST_ID = "recoList";

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

// Formateo Gs PY
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

/* ===================== Helpers de estado ===================== */
// Guardo una marca por sesión/usuario para no mostrar el popup repetidamente
function recoKey(uid) { return `recoShown:${uid}`; }
function markShown(uid) { try { sessionStorage.setItem(recoKey(uid), "1"); } catch {} }
function wasShown(uid)  { try { return sessionStorage.getItem(recoKey(uid)) === "1"; } catch { return false; } }

/* ===================== Helpers modal ===================== */
function openReco() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.hidden = false;
}
function closeReco() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) overlay.hidden = true;
}

/* ===================== Render ===================== */
function cardHTML(p) {
  const id = p.id ?? p.producto_id ?? p.slug ?? "";
  const nombre = p.nombre ?? p.titulo ?? "Producto";
  const precio = p.precio ?? p.price ?? 0;

  const imgPath = p.imagen_url || p.url_imagen || p.img || p.imagen || p.image_path || p.imagen_url_portada || "";
  const img = imgPath?.startsWith?.("http")
    ? imgPath
    : (imgPath ? (STORAGE_BASE + imgPath) : IMG_FALLBACK);

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
        <button class="reco-btn ghost"  data-view="${id}">Ver</button>
      </div>
    </article>
  `;
}

function renderList(items = []) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;
  if (!items.length) {
    list.innerHTML = `<div style="padding:16px">No tengo recomendaciones por ahora. Explorá nuestros <a href="#contenedor-productos">productos</a> 👇</div>`;
    return;
  }
  list.innerHTML = items.map(cardHTML).join("");
}

/* ===================== Data: RPC + fallback ===================== */
// Llamo a la RPC sin prefijo de esquema (mantengo el nombre que definí en la DB)
async function tryRpcRecomendaciones(userId, limit = 8) {
  const { data, error } = await supabase.rpc("reco_para_usuario_v1", {
    p_usuario: userId,
    p_limite: limit,
  });
  if (error) {
    console.warn("[reco-popup] RPC error:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    return { data: [], error };
  }
  return { data: data || [], error: null };
}

// Si no hay recomendaciones o la RPC falla, cargo productos públicos
async function fetchFallback(limit = 8) {
  const { data, error } = await supabase
    .from("v_productos_publicos")
    .select("id, nombre, precio, imagen")
    .limit(limit);

  if (error) {
    console.warn("[reco-popup] Fallback error:", error.message || error);
    return [];
  }
  return data ?? [];
}

async function loadRecommendations() {
  try {
    const { data: { user} } = await supabase.auth.getUser();
    if (user?.id) {
      const { data } = await tryRpcRecomendaciones(user.id, 8);
      if (Array.isArray(data) && data.length) return data;
    }
    return await fetchFallback(8);
  } catch (e) {
    console.warn("[reco-popup] loadRecommendations error:", e);
    return [];
  }
}

/* ===================== Interacción ===================== */
function wireModalActions() {
  const overlay = document.getElementById(OVERLAY_ID);
  const closeBtn = document.getElementById("recoCloseBtn");
  const closeSecondary = document.getElementById("recoCloseSecondary");

  // Cierro el modal desde los botones y también clic afuera
  closeBtn?.addEventListener("click", closeReco);
  closeSecondary?.addEventListener("click", closeReco);
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
      // Agrego al carrito con la API que ya tengo en window
      if (window.CartAPI?.addById) {
        window.CartAPI.addById(id, 1);
      } else if (window.CartAPI?.addProduct) {
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
      document.querySelector("#contenedor-productos")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  });
}

async function personalizeTitle() {
  // Personalizo el título con el nombre visible que ya uso en el chip (misma prioridad)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let display = "";

    // 1) clientes_perfil.razon
    const { data: cp } = await supabase
      .from("clientes_perfil")
      .select("razon")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cp?.razon) display = String(cp.razon).trim();

    // 2) profiles.nombre
    if (!display) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.nombre) display = String(prof.nombre).trim();
    }

    // 3) user_metadata.nombre
    if (!display) {
      const metaName = user.user_metadata?.nombre;
      if (metaName) display = String(metaName).trim();
    }

    // 4) email como último recurso
    if (!display) display = user.email?.split("@")[0] || "";

    const h2 = document.getElementById("recoModalTitle");
    if (display && h2) h2.textContent = `Recomendado para vos, ${display}`;
  } catch (e) {
    console.warn("[reco-popup] personalizeTitle error:", e);
  }
}

// Siempre dejo el click en el logo como atajo manual para abrir el popup
function wireLogoClick() {
  const candidates = [
    ".logo-principal",
    ".logo img",
    "aside header img",
    "header .logo img",
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openReco();
      });
      break;
    }
  }
}

/* ===================== Boot ===================== */
async function boot() {
  const overlay = document.getElementById(OVERLAY_ID);
  const list = document.getElementById(LIST_ID);
  if (!overlay || !list) return;

  // Cargo al menos una vez la lista de items (así el modal abre rápido)
  list.innerHTML = `<div style="padding:16px">Cargando recomendaciones…</div>`;
  const items = await loadRecommendations();
  renderList(items);
  wireModalActions();
  wireLogoClick();

  // Solo muestro automáticamente al iniciar sesión (una vez por sesión/usuario)
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && !wasShown(user.id)) {
      await personalizeTitle();
      openReco();
      markShown(user.id); // dejo registrado que ya se mostró en esta sesión
    }
  } catch (e) {
    console.warn("[reco-popup] boot auto-show error:", e);
  }
}

document.addEventListener("DOMContentLoaded", boot);

/* ===================== Debug de consola ===================== */
window.supabase = supabase;
window.__testReco = {
  loadRecommendations,
  tryRpcRecomendaciones,
  openReco,
  closeReco,
};
