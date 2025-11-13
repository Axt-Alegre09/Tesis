// ==================== MÓDULO PRODUCTOS ====================
// Gestión completa de productos para el dashboard admin

import { supa } from '../supabase-client.js';
import { 
  getImageUrl, 
  formatPrice, 
  showToast, 
  handleError,
  uploadImage,
  deleteImage 
} from './supabase-config.js';

let productosData = [];
let productosFiltrados = [];
let viewMode = 'list';

// ========== INICIALIZACIÓN ==========
export async function initProductos() {
  console.log('📦 Inicializando módulo de Productos...');
  
  await cargarProductos();
  await cargarCategorias();
  setupEventListeners();
}

// ========== CARGAR PRODUCTOS ==========
async function cargarProductos() {
  try {
    const { data, error } = await supa
      .from('productos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    productosData = data || [];
    productosFiltrados = [...productosData];
    
    console.log(`✅ ${productosData.length} productos cargados`);
    
    renderizarProductos();
    
  } catch (error) {
    handleError(error, 'Cargar productos');
  }
}

// ========== CARGAR CATEGORÍAS ==========
async function cargarCategorias() {
  try {
    const { data, error } = await supa
      .from('categorias')
      .select('*')
      .order('nombre');

    if (error) throw error;

    const selectCategoria = document.getElementById('filterCategoria');
    if (selectCategoria) {
      selectCategoria.innerHTML = '<option value="">Todas las categorías</option>' +
        data.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('');
    }
    
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

// ========== RENDERIZAR PRODUCTOS ==========
function renderizarProductos() {
  if (viewMode === 'grid') {
    renderizarGrid();
  } else {
    renderizarTabla();
  }
}

function renderizarTabla() {
  const tbody = document.getElementById('productosTableBody');
  if (!tbody) return;

  if (productosFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          <p style="margin: 0;">No se encontraron productos</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = productosFiltrados.map(producto => `
    <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;"
        onmouseover="this.style.background='var(--bg-hover)'"
        onmouseout="this.style.background='transparent'">
      
      <td style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <img src="${getImageUrl(producto.imagen)}" 
               alt="${producto.nombre}"
               style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;">
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${producto.nombre}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">SKU: ${producto.sku || 'N/A'}</div>
          </div>
        </div>
      </td>
      
      <td style="padding: 1rem;">
        <span style="background: var(--bg-secondary); padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem;">
          ${obtenerNombreCategoria(producto.id_categoria)}
        </span>
      </td>
      
      <td style="padding: 1rem; text-align: right; font-weight: 600;">
        Gs ${formatPrice(producto.precio)}
      </td>
      
      <td style="padding: 1rem; text-align: center;">
        <div class="form-check form-switch" style="display: inline-block;">
          <input class="form-check-input" type="checkbox" 
                 ${producto.activo ? 'checked' : ''}
                 onchange="window.toggleProductoActivo('${producto.id}')"
                 style="cursor: pointer;">
        </div>
      </td>
      
      <td style="padding: 1rem; text-align: center;">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button class="icon-btn" onclick="window.editarProducto('${producto.id}')"
                  style="background: var(--info); color: white;">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="icon-btn" onclick="window.eliminarProducto('${producto.id}')"
                  style="background: var(--danger); color: white;">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderizarGrid() {
  const container = document.getElementById('productosTableContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; padding: 1rem;">
      ${productosFiltrados.map(producto => `
        <div class="product-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.3s;">
          <div style="position: relative;">
            <img src="${getImageUrl(producto.imagen)}" 
                 alt="${producto.nombre}"
                 style="width: 100%; height: 200px; object-fit: cover;">
            <span style="position: absolute; top: 1rem; right: 1rem; background: ${producto.activo ? 'var(--success)' : 'var(--danger)'}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
              ${producto.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${producto.nombre}</h4>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0 0 1rem 0;">
              ${obtenerNombreCategoria(producto.id_categoria)}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">
                Gs ${formatPrice(producto.precio)}
              </span>
              <div style="display: flex; gap: 0.5rem;">
                <button class="icon-btn" onclick="window.editarProducto('${producto.id}')"
                        style="background: var(--info); color: white; width: 32px; height: 32px;">
                  <i class="bi bi-pencil" style="font-size: 0.85rem;"></i>
                </button>
                <button class="icon-btn" onclick="window.eliminarProducto('${producto.id}')"
                        style="background: var(--danger); color: white; width: 32px; height: 32px;">
                  <i class="bi bi-trash" style="font-size: 0.85rem;"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ========== HELPERS ==========
function obtenerNombreCategoria(idCategoria) {
  // Aquí deberías tener un mapeo de categorías
  const categorias = {
    1: 'Panadería',
    2: 'Pastelería',
    3: 'Bebidas',
    // etc...
  };
  return categorias[idCategoria] || 'Sin categoría';
}

// ========== FILTROS ==========
function aplicarFiltros() {
  const searchText = document.getElementById('searchProductos')?.value.toLowerCase() || '';
  const categoriaFilter = document.getElementById('filterCategoria')?.value || '';

  productosFiltrados = productosData.filter(producto => {
    const matchSearch = !searchText || 
      producto.nombre.toLowerCase().includes(searchText) ||
      producto.descripcion?.toLowerCase().includes(searchText);

    const matchCategoria = !categoriaFilter || 
      producto.id_categoria === parseInt(categoriaFilter);

    return matchSearch && matchCategoria;
  });

  renderizarProductos();
}

// ========== TOGGLE ACTIVO ==========
window.toggleProductoActivo = async function(productoId) {
  const producto = productosData.find(p => p.id === productoId);
  if (!producto) return;

  try {
    const { error } = await supa
      .from('productos')
      .update({ activo: !producto.activo })
      .eq('id', productoId);

    if (error) throw error;

    producto.activo = !producto.activo;
    showToast(`Producto ${producto.activo ? 'activado' : 'desactivado'}`, 'success');
    
  } catch (error) {
    handleError(error, 'Actualizar estado del producto');
    renderizarProductos();
  }
};

// ========== EDITAR PRODUCTO ==========
window.editarProducto = function(productoId) {
  const producto = productosData.find(p => p.id === productoId);
  if (!producto) return;

  // Aquí implementarías el modal de edición
  console.log('Editar producto:', producto);
  showToast('Función de edición en desarrollo', 'info');
};

// ========== ELIMINAR PRODUCTO ==========
window.eliminarProducto = async function(productoId) {
  const producto = productosData.find(p => p.id === productoId);
  if (!producto) return;

  if (!confirm(`¿Seguro que querés eliminar "${producto.nombre}"?`)) return;

  try {
    const { error } = await supa
      .from('productos')
      .delete()
      .eq('id', productoId);

    if (error) throw error;

    // Eliminar imagen si existe
    if (producto.imagen) {
      await deleteImage(producto.imagen);
    }

    productosData = productosData.filter(p => p.id !== productoId);
    productosFiltrados = productosFiltrados.filter(p => p.id !== productoId);
    renderizarProductos();
    
    showToast('Producto eliminado correctamente', 'success');
    
  } catch (error) {
    handleError(error, 'Eliminar producto');
  }
};

// ========== NUEVO PRODUCTO ==========
window.nuevoProducto = function() {
  console.log('Crear nuevo producto');
  showToast('Función de crear producto en desarrollo', 'info');
};

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Búsqueda
  document.getElementById('searchProductos')?.addEventListener('input', aplicarFiltros);
  
  // Filtro categoría
  document.getElementById('filterCategoria')?.addEventListener('change', aplicarFiltros);
  
  // Vista Grid/Lista
  document.getElementById('btnViewGrid')?.addEventListener('click', () => {
    viewMode = 'grid';
    document.getElementById('btnViewGrid').classList.add('active');
    document.getElementById('btnViewList').classList.remove('active');
    renderizarProductos();
  });
  
  document.getElementById('btnViewList')?.addEventListener('click', () => {
    viewMode = 'list';
    document.getElementById('btnViewList').classList.add('active');
    document.getElementById('btnViewGrid').classList.remove('active');
    renderizarProductos();
  });
  
  // Nuevo producto
  document.getElementById('btnNuevoProducto')?.addEventListener('click', nuevoProducto);
}

console.log('📦 Módulo de Productos cargado');