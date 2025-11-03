// JS/favoritos.js
import { supabase } from "./ScriptLogin.js";

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE =
  "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

// ========== Agregar corazón a cada card existente ==========
export function initFavoritos() {
  const productos = document.querySelectorAll(".producto");

  productos.forEach((card) => {
    const id =
      card.dataset.id || card.querySelector("[data-id]")?.dataset.id;
    if (!id) return;

    if (card.querySelector(".btn-favorito")) return;

    card.style.position = "relative";

    const btnFav = document.createElement("button");
    btnFav.className = "btn-favorito";
    btnFav.innerHTML = '<i class="bi bi-heart"></i>';
    btnFav.setAttribute("aria-label", "Agregar a favoritos");
    btnFav.dataset.productoId = id;

    card.appendChild(btnFav);

    btnFav.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await toggleFavorito(id, btnFav);
    });
  });

  loadFavoritosState();
}

// ========== Toggle favorito ==========
async function toggleFavorito(productoId, btn) {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      showToast("Debes iniciar sesión para guardar favoritos", "warning");
      return;
    }

    btn.disabled = true;

    const { data, error } = await supabase.rpc("toggle_favorito", {
      p_producto_id: productoId,
    });

    if (error) throw error;

    const result = data[0];
    const esFavorito = result.es_favorito;

    actualizarBtnFavorito(btn, esFavorito);
    showToast(result.mensaje, "success");
  } catch (error) {
    console.error("Error toggle favorito:", error);
    showToast("Error al actualizar favorito", "error");
  } finally {
    btn.disabled = false;
  }
}

function actualizarBtnFavorito(btn, esFavorito) {
  const icon = btn.querySelector("i");
  if (!icon) return;

  if (esFavorito) {
    icon.classList.remove("bi-heart");
    icon.classList.add("bi-heart-fill");
    btn.classList.add("active");
  } else {
    icon.classList.remove("bi-heart-fill");
    icon.classList.add("bi-heart");
    btn.classList.remove("active");
  }

  btn.classList.add("animate");
  setTimeout(() => btn.classList.remove("animate"), 400);
}

// ========== Cargar estado de favoritos ==========
async function loadFavoritosState() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc("get_favoritos");
    if (error) throw error;

    const favoritosIds = (data || []).map((f) => f.producto_id);

    document.querySelectorAll(".btn-favorito").forEach((btn) => {
      const id = btn.dataset.productoId;
      if (favoritosIds.includes(id)) {
        actualizarBtnFavorito(btn, true);
      }
    });
  } catch (error) {
    console.error("Error cargar favoritos:", error);
  }
}

// ========== Cargar productos favoritos en una página dedicada ==========
export async function loadFavoritosPage() {
  const contenedor = document.getElementById("contenedor-productos");
  const titulo = document.getElementById("titulo-principal");

  if (!contenedor) return;

  try {
    titulo.textContent = "Mis Favoritos";
    contenedor.innerHTML =
      '<div class="loading">Cargando favoritos...</div>';

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-heart" style="font-size: 4rem; opacity: 0.3;"></i>
          <p>Debes iniciar sesión para ver tus favoritos</p>
          <a href="login.html" class="btn-primary">Iniciar sesión</a>
        </div>
      `;
      return;
    }

    const { data, error } = await supabase.rpc("get_favoritos");

    if (error) throw error;

    if (!data || data.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-heart" style="font-size: 4rem; opacity: 0.3;"></i>
          <p>Aún no tienes productos favoritos</p>
          <a href="index.html" class="btn-primary">Explorar productos</a>
        </div>
      `;
      return;
    }

    contenedor.innerHTML = data
      .map((producto) => createProductCard(producto))
      .join("");

    initFavoritos();
  } catch (error) {
    console.error("Error cargar página favoritos:", error);
    contenedor.innerHTML =
      '<div class="error">Error al cargar favoritos</div>';
  }
}

// ========== Helper: crear card de producto ==========
function createProductCard(producto) {
  const imgSrc = producto.imagen?.startsWith("http")
    ? producto.imagen
    : STORAGE_BASE + producto.imagen;

  return `
    <div class="producto" data-id="${producto.producto_id}">
      <img class="producto-imagen" src="${imgSrc || IMG_FALLBACK}" alt="${producto.nombre}">
      <button class="btn-favorito" data-producto-id="${producto.producto_id}" aria-label="Favorito">
        <i class="bi bi-heart"></i>
      </button>
      <div class="producto-detalles">
        <h3 class="producto-titulo">${producto.nombre}</h3>
        <p class="producto-precio">${new Intl.NumberFormat("es-PY").format(
          producto.precio
        )} Gs</p>
        <button class="producto-agregar" data-id="${producto.producto_id}">Agregar</button>
      </div>
    </div>
  `;
}

// ========== Toast notification ==========
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${
      type === "error" ? "#e74c3c" : type === "warning" ? "#f39c12" : "#27ae60"
    };
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10001;
    animation: slideIn 0.3s ease;
    font-family: inherit;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
