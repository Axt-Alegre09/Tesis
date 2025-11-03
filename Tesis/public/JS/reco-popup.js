// JS/reco-popup-v2.js
import { supabase } from "./ScriptLogin.js";

const OVERLAY_ID = "recoModalOverlay";
const LIST_ID = "recoList";
const IMG_FALLBACK = "https://placehold.co/512x512?text=Sin+Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

// Formateo Gs PY
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

/* ===================== Estado del popup ===================== */
function recoKey(uid) { return `recoShown:${uid}`; }
function markShown(uid) { 
  try { 
    sessionStorage.setItem(recoKey(uid), Date.now().toString()); 
  } catch {} 
}
function wasShownRecently(uid, minutes = 30) {
  try {
    const shown = sessionStorage.getItem(recoKey(uid));
    if (!shown) return false;
    const elapsed = (Date.now() - parseInt(shown)) / 1000 / 60;
    return elapsed < minutes;
  } catch {
    return false;
  }
}

/* ===================== Modal ===================== */
function openReco() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden'; // Prevenir scroll
  }
}

function closeReco() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.hidden = true;
    document.body.style.overflow = ''; // Restaurar scroll
  }
}

/* ===================== Render ===================== */
function cardHTML(p) {
  const id = p.id ?? "";
  const nombre = p.nombre ?? "Producto";
  const precio = p.precio ?? 0;
  const esUltima = p.es_ultima_compra ?? false;
  const veces = p.veces_comprado ?? 0;

  const imgPath = p.imagen || p.imagen_url || p.url_imagen || "";
  const img = imgPath?.startsWith?.("http")
    ? imgPath
    : (imgPath ? (STORAGE_BASE + imgPath) : IMG_FALLBACK);

  return `
    <article class="reco-card" data-id="${id}" data-ultima="${esUltima}">
      <div class="reco-imgwrap">
        <img src="${img}" alt="${nombre}" loading="lazy">
      </div>
      <div class="reco-info">
        <h3 class="reco-title">${nombre}</h3>
        <div class="reco-price">${fmtGs(precio)}</div>
        ${veces > 0 ? `<div class="reco-veces">Pedido ${veces}× antes</div>` : ''}
      </div>
      <div class="reco-actions">
        <button class="reco-btn-add" data-add="${id}">
          <i class="bi bi-cart-plus"></i> Agregar al carrito
        </button>
      </div>
    </article>
  `;
}

function renderList(items = []) {
  const list = document.getElementById(LIST_ID);
  if (!list) return;
  
  if (!items.length) {
    list.innerHTML = `
      <div class="reco-empty">
        <i class="bi bi-emoji-smile"></i>
        <p>Aún no tenemos recomendaciones personalizadas para vos.</p>
        <p>Empezá a explorar nuestros productos para recibir sugerencias.</p>
      </div>
    `;
    return;
  }
  
  list.innerHTML = items.map(cardHTML).join("");
}

/* ===================== Data ===================== */
async function loadRecommendations() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.id) {
      // Usuario no autenticado: mostrar productos populares
      const { data, error } = await supabase
        .from("v_productos_publicos")
        .select("id, nombre, precio, imagen")
        .limit(8);
      
      if (error) throw error;
      return data || [];
    }

    // Usuario autenticado: usar la RPC mejorada
    const { data, error } = await supabase.rpc("reco_para_usuario_v2", {
      p_usuario: user.id,
      p_limite: 8,
    });

    if (error) {
      console.warn("[reco-popup] RPC error:", error);
      // Fallback a productos públicos
      const { data: fallback } = await supabase
        .from("v_productos_publicos")
        .select("id, nombre, precio, imagen")
        .limit(8);
      return fallback || [];
    }

    return data || [];
  } catch (e) {
    console.error("[reco-popup] loadRecommendations error:", e);
    return [];
  }
}

/* ===================== Interacción ===================== */
function wireModalActions() {
  const overlay = document.getElementById(OVERLAY_ID);
  const closeBtn = document.getElementById("recoCloseBtn");

  // Cerrar con botón y clic fuera
  closeBtn?.addEventListener("click", closeReco);
  overlay?.addEventListener("click", (ev) => {
    if (ev.target === overlay) closeReco();
  });

  // Cerrar con ESC
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && !overlay?.hidden) {
      closeReco();
    }
  });

  // Delegación: Agregar al carrito
  const list = document.getElementById(LIST_ID);
  list?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".reco-btn-add");
    if (!btn) return;

    const card = btn.closest(".reco-card");
    const id = card?.dataset?.id;
    if (!id) return;

    // Agregar al carrito
    if (window.CartAPI?.addById) {
      await window.CartAPI.addById(id, 1);
    } else if (window.CartAPI?.addProduct) {
      const nombre = card?.querySelector(".reco-title")?.textContent?.trim() ?? "Producto";
      const precioText = card?.querySelector(".reco-price")?.textContent || "0";
      const precioNum = Number((precioText.replace(/[^\d]/g, "")) || 0);
      await window.CartAPI.addProduct({ id, nombre, precio: precioNum }, 1);
    }

    // Feedback visual
    btn.classList.add("added");
    btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> ¡Agregado!';
    
    setTimeout(() => {
      btn.classList.remove("added");
      btn.innerHTML = '<i class="bi bi-cart-plus"></i> Agregar al carrito';
    }, 2000);

    // Actualizar badge del carrito
    window.CartAPI?.refreshBadge?.();
  });
}

async function personalizeTitle() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let display = "";

    // Prioridad: razon > nombre > email
    const { data: cp } = await supabase
      .from("clientes_perfil")
      .select("razon")
      .eq("user_id", user.id)
      .maybeSingle();
    
    if (cp?.razon) display = String(cp.razon).trim();

    if (!display) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", user.id)
        .maybeSingle();
      if (prof?.nombre) display = String(prof.nombre).trim();
    }

    if (!display) {
      const metaName = user.user_metadata?.nombre;
      if (metaName) display = String(metaName).trim();
    }

    if (!display) display = user.email?.split("@")[0] || "";

    const h2 = document.getElementById("recoModalTitle");
    if (display && h2) {
      // Primer nombre solo
      const firstName = display.split(" ")[0];
      h2.textContent = `Recomendado para vos, ${firstName}`;
    }
  } catch (e) {
    console.warn("[reco-popup] personalizeTitle error:", e);
  }
}

/* ===================== Boot ===================== */
async function boot() {
  const overlay = document.getElementById(OVERLAY_ID);
  const list = document.getElementById(LIST_ID);
  if (!overlay || !list) return;

  // Cargar recomendaciones
  list.innerHTML = `
    <div class="reco-empty">
      <div class="spinner-border text-primary" role="status"></div>
      <p>Cargando recomendaciones...</p>
    </div>
  `;

  const items = await loadRecommendations();
  renderList(items);
  wireModalActions();

  // Mostrar automáticamente solo si:
  // 1. Usuario autenticado
  // 2. No se mostró recientemente (últimos 30 min)
  // 3. Hay recomendaciones
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id && !wasShownRecently(user.id, 30) && items.length > 0) {
      await personalizeTitle();
      setTimeout(() => {
        openReco();
        markShown(user.id);
      }, 800); // Delay de 800ms para mejor UX
    }
  } catch (e) {
    console.warn("[reco-popup] boot auto-show error:", e);
  }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// Exportar para testing
window.__testReco = {
  loadRecommendations,
  openReco,
  closeReco,
};