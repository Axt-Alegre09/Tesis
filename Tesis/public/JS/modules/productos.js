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
let categoriasMap = {};
let viewMode = 'list';

// ========== INICIALIZACIÓN ==========
export async function initProductos() {
  console.log('📦 Inicializando módulo de Productos...');
  
  await cargarCategorias();
  await cargarProductos();
  setupEventListeners();
}

// ========== CARGAR PRODUCTOS ==========
async function cargarProductos() {
  try {
    const { data, error } = await supa
      .from('productos')
      .select('*')
      .order('creado_en', { ascending: false }); // CAMBIADO: created_at -> creado_en

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

    // Crear mapa de categorías para búsqueda rápida
    data?.forEach(cat => {
      categoriasMap[cat.id] = cat.nombre;
    });

    const selectCategoria = document.getElementById('filterCategoria');
    if (selectCategoria && data) {
      selectCategoria.innerHTML = '<option value="">Todas las categorías</option>' +
        data.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('');
    }
    
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

// ========== RENDERIZAR PRODUCTOS ==========
function renderizarProductos() {
  const container = document.getElementById('productosTableContainer');
  if (!container) return;

  if (viewMode === 'grid') {
    renderizarGrid();
  } else {
    renderizarTabla();
  }
}

function renderizarTabla() {
  const container = document.getElementById('productosTableContainer');
  if (!container) return;

  if (productosFiltrados.length === 0) {
    container.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
        <p style="margin: 0;">No se encontraron productos</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid var(--border);">
            <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Producto</th>
            <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Categoría</th>
            <th style="padding: 1rem; text-align: right; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Precio</th>
            <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Estado</th>
            <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${productosFiltrados.map(producto => `
            <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;"
                onmouseover="this.style.background='var(--bg-hover)'"
                onmouseout="this.style.background='transparent'">
              
              <td style="padding: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                  <img src="${getImageUrl(producto.imagen)}" 
                       alt="${producto.nombre}"
                       style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"
                       onerror="this.src='https://via.placeholder.com/60x60?text=Sin+Imagen'">
                  <div>
                    <div style="font-weight: 600; margin-bottom: 0.25rem;">${producto.nombre}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">SKU: ${producto.sku || 'N/A'}</div>
                  </div>
                </div>
              </td>
              
              <td style="padding: 1rem;">
                <span style="background: var(--bg-secondary); padding: 0.25rem 0.75rem; border-radius: 6px; font-size: 0.85rem;">
                  ${obtenerNombreCategoria(producto.categoria_id)}
                </span>
              </td>
              
              <td style="padding: 1rem; text-align: right; font-weight: 600;">
                Gs ${formatPrice(producto.precio)}
              </td>
              
              <td style="padding: 1rem; text-align: center;">
                <label class="switch" style="position: relative; display: inline-block; width: 50px; height: 24px;">
                  <input type="checkbox" 
                         ${producto.activo ? 'checked' : ''}
                         onchange="window.toggleProductoActivo('${producto.id}')"
                         style="opacity: 0; width: 0; height: 0;">
                  <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 24px; ${producto.activo ? 'background-color: var(--success);' : ''}">
                    <span style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%; ${producto.activo ? 'transform: translateX(26px);' : ''}"></span>
                  </span>
                </label>
              </td>
              
              <td style="padding: 1rem; text-align: center;">
                <div style="display: flex; gap: 0.5rem; justify-content: center;">
                  <button class="icon-btn" onclick="window.editarProducto('${producto.id}')"
                          style="background: var(--info); color: white; padding: 0.5rem; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="icon-btn" onclick="window.eliminarProducto('${producto.id}')"
                          style="background: var(--danger); color: white; padding: 0.5rem; border: none; border-radius: 6px; cursor: pointer;">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderizarGrid() {
  const container = document.getElementById('productosTableContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem; padding: 1rem;">
      ${productosFiltrados.map(producto => `
        <div class="product-card" style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.3s;"
             onmouseover="this.style.transform='translateY(-4px)'"
             onmouseout="this.style.transform='translateY(0)'">
          <div style="position: relative; height: 200px; overflow: hidden;">
            <img src="${getImageUrl(producto.imagen)}" 
                 alt="${producto.nombre}"
                 style="width: 100%; height: 100%; object-fit: cover;"
                 onerror="this.src='https://via.placeholder.com/250x200?text=Sin+Imagen'">
            <span style="position: absolute; top: 1rem; right: 1rem; background: ${producto.activo ? 'var(--success)' : 'var(--danger)'}; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
              ${producto.activo ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <div style="padding: 1rem;">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 600;">${producto.nombre}</h4>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0 0 1rem 0;">
              ${obtenerNombreCategoria(producto.categoria_id)}
            </p>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 1.25rem; font-weight: 700; color: var(--primary);">
                Gs ${formatPrice(producto.precio)}
              </span>
              <div style="display: flex; gap: 0.5rem;">
                <button class="icon-btn" onclick="window.editarProducto('${producto.id}')"
                        style="background: var(--info); color: white; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer;">
                  <i class="bi bi-pencil" style="font-size: 0.85rem;"></i>
                </button>
                <button class="icon-btn" onclick="window.eliminarProducto('${producto.id}')"
                        style="background: var(--danger); color: white; width: 32px; height: 32px; border: none; border-radius: 6px; cursor: pointer;">
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
function obtenerNombreCategoria(categoriaId) {
  return categoriasMap[categoriaId] || 'Sin categoría';
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
      producto.categoria_id === categoriaFilter;

    return matchSearch && matchCategoria;
  });

  renderizarProductos();
}

// ========== CAMBIAR VISTA ==========
function cambiarVista(modo) {
  viewMode = modo;
  
  const btnGrid = document.getElementById('btnViewGrid');
  const btnList = document.getElementById('btnViewList');
  
  if (modo === 'grid') {
    btnGrid?.classList.add('active');
    btnList?.classList.remove('active');
    btnGrid?.style.setProperty('background', 'var(--primary)', 'important');
    btnGrid?.style.setProperty('color', 'white', 'important');
    btnList?.style.setProperty('background', 'var(--bg-main)', 'important');
    btnList?.style.setProperty('color', 'var(--text)', 'important');
  } else {
    btnList?.classList.add('active');
    btnGrid?.classList.remove('active');
    btnList?.style.setProperty('background', 'var(--primary)', 'important');
    btnList?.style.setProperty('color', 'white', 'important');
    btnGrid?.style.setProperty('background', 'var(--bg-main)', 'important');
    btnGrid?.style.setProperty('color', 'var(--text)', 'important');
  }
  
  renderizarProductos();
}

// ========== TOGGLE ACTIVO ==========
window.toggleProductoActivo = async function(productoId) {
  const producto = productosData.find(p => p.id === productoId);
  if (!producto) return;

  try {
    const nuevoEstado = !producto.activo;
    
    const { error } = await supa
      .from('productos')
      .update({ 
        activo: nuevoEstado,
        actualizado_en: new Date().toISOString() 
      })
      .eq('id', productoId);

    if (error) throw error;

    producto.activo = nuevoEstado;
    showToast(`Producto ${nuevoEstado ? 'activado' : 'desactivado'}`, 'success');
    renderizarProductos();
    
  } catch (error) {
    handleError(error, 'Actualizar estado del producto');
    renderizarProductos();
  }
};

// ========== EDITAR PRODUCTO ==========
window.editarProducto = function(productoId) {
  const producto = productosData.find(p => p.id === productoId);
  if (!producto) return;

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

    // Eliminar imagen si existe y no es placeholder
    if (producto.imagen && !producto.imagen.startsWith('http')) {
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
  document.getElementById('btnViewGrid')?.addEventListener('click', () => cambiarVista('grid'));
  document.getElementById('btnViewList')?.addEventListener('click', () => cambiarVista('list'));
  
  // Nuevo producto
  document.getElementById('btnNuevoProducto')?.addEventListener('click', nuevoProducto);
}

console.log('📦 Módulo de Productos cargado');