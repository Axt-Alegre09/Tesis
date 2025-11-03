// JS/favoritos.js
import { supabase } from "./ScriptLogin.js";

// ========== Agregar corazón a cada card ==========
export function initFavoritos() {
  // Agregar botón de favorito a cada card de producto
  const productos = document.querySelectorAll('.producto');
  
  productos.forEach(card => {
    const id = card.dataset.id || card.querySelector('[data-id]')?.dataset.id;
    if (!id) return;
    
    // Crear botón de favorito
    const btnFav = document.createElement('button');
    btnFav.className = 'btn-favorito';
    btnFav.innerHTML = '<i class="bi bi-heart"></i>';
    btnFav.setAttribute('aria-label', 'Agregar a favoritos');
    btnFav.dataset.productoId = id;
    
    // Insertar en la esquina superior derecha del card
    card.style.position = 'relative';
    card.appendChild(btnFav);
    
    // Event listener
    btnFav.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await toggleFavorito(id, btnFav);
    });
  });
  
  // Cargar estado inicial de favoritos
  loadFavoritosState();
}

// ========== Toggle favorito ==========
async function toggleFavorito(productoId, btn) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      alert('Debes iniciar sesión para guardar favoritos');
      return;
    }
    
    btn.disabled = true;
    
    const { data, error } = await supabase.rpc('toggle_favorito', {
      p_producto_id: productoId
    });
    
    if (error) throw error;
    
    const result = data[0];
    const esFavorito = result.es_favorito;
    
    // Actualizar UI
    const icon = btn.querySelector('i');
    if (esFavorito) {
      icon.classList.remove('bi-heart');
      icon.classList.add('bi-heart-fill');
      btn.classList.add('active');
    } else {
      icon.classList.remove('bi-heart-fill');
      icon.classList.add('bi-heart');
      btn.classList.remove('active');
    }
    
    // Mostrar toast
    showToast(result.mensaje);
    
  } catch (error) {
    console.error('Error toggle favorito:', error);
    showToast('Error al actualizar favorito', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ========== Cargar estado de favoritos ==========
async function loadFavoritosState() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data, error } = await supabase.rpc('get_favoritos');
    if (error) throw error;
    
    const favoritosIds = (data || []).map(f => f.producto_id);
    
    // Marcar favoritos en la UI
    document.querySelectorAll('.btn-favorito').forEach(btn => {
      const id = btn.dataset.productoId;
      if (favoritosIds.includes(id)) {
        const icon = btn.querySelector('i');
        icon.classList.remove('bi-heart');
        icon.classList.add('bi-heart-fill');
        btn.classList.add('active');
      }
    });
    
  } catch (error) {
    console.error('Error cargar favoritos:', error);
  }
}

// ========== Cargar productos favoritos ==========
export async function loadFavoritosPage() {
  const contenedor = document.getElementById('contenedor-productos');
  const titulo = document.getElementById('titulo-principal');
  
  if (!contenedor) return;
  
  try {
    titulo.textContent = 'Mis Favoritos';
    contenedor.innerHTML = '<div class="loading">Cargando favoritos...</div>';
    
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-heart" style="font-size: 4rem; opacity: 0.3;"></i>
          <p>Debes iniciar sesión para ver tus favoritos</p>
        </div>
      `;
      return;
    }
    
    const { data, error } = await supabase.rpc('get_favoritos');
    
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
    
    // Renderizar productos (reutilizar tu función existente o crear cards)
    contenedor.innerHTML = data.map(producto => createProductCard(producto)).join('');
    
    // Reinicializar favoritos
    initFavoritos();
    
  } catch (error) {
    console.error('Error cargar página favoritos:', error);
    contenedor.innerHTML = '<div class="error">Error al cargar favoritos</div>';
  }
}

// ========== Helper: crear card de producto ==========
function createProductCard(producto) {
  const STORAGE_BASE = 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/';
  const imgSrc = producto.imagen?.startsWith('http') 
    ? producto.imagen 
    : STORAGE_BASE + producto.imagen;
  
  return `
    <div class="producto" data-id="${producto.producto_id}">
      <img class="producto-imagen" src="${imgSrc}" alt="${producto.nombre}">
      <div class="producto-detalles">
        <h3 class="producto-titulo">${producto.nombre}</h3>
        <p class="producto-precio">${new Intl.NumberFormat('es-PY').format(producto.precio)} Gs</p>
        <button class="producto-agregar" data-id="${producto.producto_id}">Agregar</button>
      </div>
    </div>
  `;
}

// ========== Toast notification ==========
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === 'error' ? '#e74c3c' : '#27ae60'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10001;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}