// JS/reco-popup.js
import { supabase } from "./ScriptLogin.js";

const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

// Formatear precio en Guaraníes
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

// Convertir imagen a URL completa
const toImg = (v) => {
  if (!v) return IMG_FALLBACK;
  let s = String(v).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.toLowerCase().startsWith("productos/")) s = s.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(s);
};

// Set global de favoritos
let FAVORITOS_IDS = new Set();

// ========== Toast Notification ==========
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: ${type === 'error' ? '#e74c3c' : type === 'warning' ? '#f39c12' : '#27ae60'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10002;
    animation: slideInToast 0.3s ease;
    font-family: inherit;
    font-size: 0.95rem;
  `;
  
  // Agregar estilos de animación si no existen
  if (!document.querySelector('style[data-toast]')) {
    const style = document.createElement('style');
    style.setAttribute('data-toast', '');
    style.textContent = `
      @keyframes slideInToast {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOutToast {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutToast 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ========== Cargar IDs de Favoritos ==========
async function loadFavoritosIds() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc('get_favoritos');
    if (error) throw error;

    FAVORITOS_IDS = new Set((data || []).map(f => f.producto_id));
  } catch (error) {
    console.error('Error cargar favoritos:', error);
  }
}

// ========== Toggle Favorito ==========
async function toggleFavorito(productoId, btn) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      showToast('Debes iniciar sesión para guardar favoritos', 'warning');
      setTimeout(() => window.location.href = 'login.html', 1500);
      return;
    }
    
    btn.disabled = true;
    
    const { data, error } = await supabase.rpc('toggle_favorito', {
      p_producto_id: productoId
    });
    
    if (error) throw error;
    
    const result = data[0];
    const esFavorito = result.es_favorito;
    
    // Actualizar el Set local
    if (esFavorito) {
      FAVORITOS_IDS.add(productoId);
    } else {
      FAVORITOS_IDS.delete(productoId);
    }
    
    // Actualizar UI del botón
    updateFavoritoButton(btn, esFavorito);
    showToast(result.mensaje, 'success');
    
  } catch (error) {
    console.error('Error toggle favorito:', error);
    showToast('Error al actualizar favorito', 'error');
  } finally {
    btn.disabled = false;
  }
}

// ========== Actualizar UI del botón de favorito ==========
function updateFavoritoButton(btn, esFavorito) {
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
}

// ========== Obtener Recomendaciones ==========
async function fetchRecomendaciones() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('Usuario no autenticado, mostrando productos populares');
      const { data, error } = await supabase
        .from("populares_para_portada")
        .select("*")
        .limit(12);
      
      if (error) throw error;
      
      return (data || []).map(p => ({
        id: p.id,
        nombre: p.nombre,
        imagen: toImg(p.url_imagen || p.imagen),
        precio: p.precio,
        veces_comprado: 0,
        es_ultima: false
      }));
    }

    const { data, error } = await supabase.rpc('obtener_recomendaciones_usuario');
    
    if (error) throw error;
    
    return (data || []).map(p => ({
      id: p.producto_id,
      nombre: p.nombre,
      imagen: toImg(p.url_imagen),
      precio: p.precio,
      veces_comprado: p.veces_comprado || 0,
      es_ultima: p.es_ultima || false
    }));
    
  } catch (error) {
    console.error('Error obteniendo recomendaciones:', error);
    return [];
  }
}

// ========== Renderizar Productos en el Popup ==========
function renderRecomendaciones(productos) {
  const recoList = document.getElementById('recoList');
  
  if (!productos || productos.length === 0) {
    recoList.innerHTML = `
      <div class="reco-empty">
        <i class="bi bi-box-seam"></i>
        <p>No hay recomendaciones disponibles en este momento</p>
      </div>
    `;
    return;
  }
  
  recoList.innerHTML = '';
  
  productos.forEach(producto => {
    const esFavorito = FAVORITOS_IDS.has(producto.id);
    
    const card = document.createElement('div');
    card.className = 'reco-card';
    if (producto.es_ultima) {
      card.setAttribute('data-ultima', 'true');
    }
    
    card.innerHTML = `
      <button class="reco-btn-favorito ${esFavorito ? 'active' : ''}" 
              data-producto-id="${producto.id}" 
              aria-label="${esFavorito ? 'Quitar de favoritos' : 'Agregar a favoritos'}">
        <i class="bi ${esFavorito ? 'bi-heart-fill' : 'bi-heart'}"></i>
      </button>
      
      <div class="reco-imgwrap">
        <img src="${producto.imagen}" alt="${producto.nombre}" onerror="this.src='${IMG_FALLBACK}'">
      </div>
      
      <div class="reco-info">
        <h3 class="reco-title">${producto.nombre}</h3>
        <p class="reco-price">${fmtGs(producto.precio)}</p>
        ${producto.veces_comprado > 0 ? `<p class="reco-veces">Comprado ${producto.veces_comprado} ${producto.veces_comprado === 1 ? 'vez' : 'veces'}</p>` : ''}
      </div>
      
      <div class="reco-actions">
        <button class="reco-btn-add" data-id="${producto.id}">
          <i class="bi bi-cart-plus-fill"></i> Agregar
        </button>
      </div>
    `;
    
    recoList.appendChild(card);
  });
  
  // Event listeners para botones de favorito
  document.querySelectorAll('.reco-btn-favorito').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const productoId = btn.dataset.productoId;
      await toggleFavorito(productoId, btn);
    });
  });
  
  // Event listeners para botones de agregar al carrito
  document.querySelectorAll('.reco-btn-add').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const productoId = e.currentTarget.dataset.id;
      const producto = productos.find(p => String(p.id) === String(productoId));
      
      if (!producto) {
        showToast('Producto no encontrado', 'error');
        return;
      }
      
      try {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-check-circle-fill"></i> Agregado';
        btn.classList.add('added');
        
        // Agregar al carrito usando CartAPI
        if (window.CartAPI) {
          await window.CartAPI.addProduct({
            id: producto.id,
            nombre: producto.nombre,
            titulo: producto.nombre,
            precio: producto.precio,
            imagen: producto.imagen
          }, 1);
          
          await window.CartAPI.refreshBadge();
          showToast('Producto agregado al carrito', 'success');
        } else {
          console.error('CartAPI no disponible');
          showToast('Error al agregar al carrito', 'error');
        }
        
        // Restaurar botón después de 2 segundos
        setTimeout(() => {
          btn.innerHTML = '<i class="bi bi-cart-plus-fill"></i> Agregar';
          btn.classList.remove('added');
          btn.disabled = false;
        }, 2000);
        
      } catch (error) {
        console.error('Error agregando producto:', error);
        showToast('Error al agregar producto', 'error');
        btn.innerHTML = '<i class="bi bi-cart-plus-fill"></i> Agregar';
        btn.classList.remove('added');
        btn.disabled = false;
      }
    });
  });
}

// ========== Abrir Popup ==========
async function abrirPopupRecomendaciones() {
  const overlay = document.getElementById('recoModalOverlay');
  const modal = document.getElementById('recoModal');
  
  if (!overlay || !modal) {
    console.error('Elementos del popup no encontrados');
    return;
  }
  
  // Mostrar overlay con loading
  overlay.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  
  const recoList = document.getElementById('recoList');
  recoList.innerHTML = `
    <div class="reco-empty">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Cargando...</span>
      </div>
      <p style="margin-top: 16px;">Cargando recomendaciones...</p>
    </div>
  `;
  
  // Cargar favoritos y recomendaciones
  await loadFavoritosIds();
  const productos = await fetchRecomendaciones();
  
  // Renderizar productos
  renderRecomendaciones(productos);
}

// ========== Cerrar Popup ==========
function cerrarPopupRecomendaciones() {
  const overlay = document.getElementById('recoModalOverlay');
  if (overlay) {
    overlay.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }
}

// ========== Inicializar ==========
function initRecoPopup() {
  const closeBtn = document.getElementById('recoCloseBtn');
  const overlay = document.getElementById('recoModalOverlay');
  const modal = document.getElementById('recoModal');
  
  if (!closeBtn || !overlay || !modal) {
    console.error('Elementos del popup de recomendaciones no encontrados');
    return;
  }
  
  // Botón de cerrar
  closeBtn.addEventListener('click', cerrarPopupRecomendaciones);
  
  // Cerrar al hacer click fuera del modal
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      cerrarPopupRecomendaciones();
    }
  });
  
  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) {
      cerrarPopupRecomendaciones();
    }
  });
  
  // Agregar trigger para abrir el popup (puedes personalizarlo)
  // Ejemplo: abrir automáticamente después de 3 segundos
  setTimeout(() => {
    abrirPopupRecomendaciones();
  }, 3000);
  
  console.log('Popup de recomendaciones inicializado');
}

// ========== Auto-init al cargar ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRecoPopup);
} else {
  initRecoPopup();
}

// Exportar funciones para uso externo
export { abrirPopupRecomendaciones, cerrarPopupRecomendaciones, loadFavoritosIds };