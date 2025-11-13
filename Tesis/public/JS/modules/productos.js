// ==================== MÓDULO DE PRODUCTOS ====================
// Gestión completa de productos: CRUD + UI

import { 
  supabase, 
  getImageUrl, 
  formatPrice, 
  showToast, 
  handleError,
  uploadImage,
  deleteImage
} from './supabase-config.js';

// ==================== ESTADO ====================
let productosData = [];
let categoriasData = [];
let currentProductId = null;

// ==================== INICIALIZACIÓN ====================

/**
 * Inicializar el módulo de productos
 */
export async function initProductos() {
  console.log('🔄 Inicializando módulo de productos...');
  
  // Cargar datos
  await loadCategorias();
  await loadProductos();
  
  // Configurar event listeners
  setupEventListeners();
  
  console.log('✅ Módulo de productos inicializado');
}

// ==================== CARGAR DATOS ====================

/**
 * Cargar productos desde Supabase
 */
export async function loadProductos() {
  console.log('🔄 Cargando productos...');
  
  const tbody = document.getElementById('productosTableBody');
  if (!tbody) return;
  
  // Mostrar loading
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <div style="width: 3rem; height: 3rem; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite;"></div>
        <p>Cargando productos...</p>
      </td>
    </tr>
  `;
  
  try {
    const { data, error } = await supabase
      .from('productos')
      .select(`
        *,
        categorias:categoria_id (
          id,
          nombre
        )
      `)
      .order('nombre');

    if (error) throw error;
    
    console.log(`✅ ${data.length} productos cargados`);
    
    // Procesar datos
    productosData = data.map(producto => ({
      ...producto,
      categoria_nombre: producto.categorias?.nombre || 'Sin categoría'
    }));
    
    renderProductosTable();
    updateDashboardStats();
    
  } catch (error) {
    handleError(error, 'Error cargando productos');
    
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 2rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          <strong>Error cargando productos</strong>
          <p style="margin-top: 0.5rem; color: var(--text-secondary);">${error.message}</p>
          <button onclick="window.productosModule.loadProductos()" class="btn-primary" style="margin-top: 1rem; display: inline-flex; gap: 0.5rem;">
            <i class="bi bi-arrow-clockwise"></i>
            Reintentar
          </button>
        </td>
      </tr>
    `;
  }
}

/**
 * Cargar categorías desde Supabase
 */
export async function loadCategorias() {
  console.log('🔄 Cargando categorías...');
  
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    
    console.log(`✅ ${data.length} categorías cargadas`);
    categoriasData = data;
    
    // Llenar selects
    populateCategoriaSelects();
    
  } catch (error) {
    handleError(error, 'Error cargando categorías');
  }
}

/**
 * Llenar los selects de categoría
 */
function populateCategoriaSelects() {
  const selects = document.querySelectorAll('#productoCategoria, #filterCategoria');
  
  selects.forEach(select => {
    if (!select) return;
    
    const isFilter = select.id === 'filterCategoria';
    
    select.innerHTML = isFilter 
      ? '<option value="">Todas las categorías</option>'
      : '<option value="">Selecciona una categoría</option>';
    
    categoriasData.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      select.appendChild(option);
    });
  });
}

// ==================== RENDERIZADO ====================

/**
 * Renderizar tabla de productos
 * @param {Array} filteredData - Datos filtrados (opcional)
 */
function renderProductosTable(filteredData = null) {
  const tbody = document.getElementById('productosTableBody');
  if (!tbody) return;
  
  const data = filteredData || productosData;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No hay productos para mostrar</p>
          <button onclick="window.productosModule.openNewProductoModal()" class="btn-primary" style="margin-top: 1rem;">
            <i class="bi bi-plus-lg"></i>
            Agregar primer producto
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(producto => {
    const precioFormateado = formatPrice(producto.precio);
    const imagenUrl = getImageUrl(producto.imagen);
    
    return `
    <tr style="border-bottom: 1px solid var(--border); transition: all 0.2s;" onmouseenter="this.style.background='var(--bg-main)'" onmouseleave="this.style.background='transparent'">
      <td style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <img 
            src="${imagenUrl}" 
            alt="${producto.nombre}"
            style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);"
            onerror="this.src='https://via.placeholder.com/60x60?text=❌'"
          >
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${producto.nombre}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              <i class="bi bi-box"></i> Stock: ${producto.stock}
            </div>
          </div>
        </div>
      </td>
      <td style="padding: 1rem;">
        <span style="background: var(--bg-main); padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">
          ${producto.categoria_nombre}
        </span>
      </td>
      <td style="padding: 1rem; text-align: right; font-weight: 600; font-size: 1.05rem;">
        ${precioFormateado} Gs
      </td>
      <td style="padding: 1rem; text-align: center;">
        <span style="
          padding: 0.4rem 0.75rem; 
          border-radius: 6px; 
          font-size: 0.85rem; 
          font-weight: 600;
          background: ${producto.activo ? 'var(--success-light)' : 'var(--danger-light)'};
          color: ${producto.activo ? 'var(--success)' : 'var(--danger)'};
        ">
          ${producto.activo ? '✓ Disponible' : '✗ No disponible'}
        </span>
      </td>
      <td style="padding: 1rem; text-align: center;">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button 
            class="icon-btn" 
            onclick="window.productosModule.editProducto('${producto.id}')"
            title="Editar"
            style="background: var(--info-light); color: var(--info);"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="window.productosModule.deleteProducto('${producto.id}', '${producto.nombre.replace(/'/g, "\\'")}')"
            title="Eliminar"
            style="background: var(--danger-light); color: var(--danger);"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

// ==================== FILTROS ====================

/**
 * Filtrar productos por búsqueda y categoría
 */
export function filterProductos() {
  const searchTerm = document.getElementById('searchProductos')?.value.toLowerCase() || '';
  const categoriaId = document.getElementById('filterCategoria')?.value || '';

  let filtered = [...productosData];

  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.nombre.toLowerCase().includes(searchTerm) ||
      p.descripcion?.toLowerCase().includes(searchTerm)
    );
  }

  if (categoriaId) {
    filtered = filtered.filter(p => p.categoria_id === categoriaId);
  }

  renderProductosTable(filtered);
  
  // Mostrar contador de resultados
  const count = filtered.length;
  const total = productosData.length;
  
  if (searchTerm || categoriaId) {
    console.log(`🔍 Mostrando ${count} de ${total} productos`);
  }
}

// ==================== MODAL ====================

/**
 * Abrir modal para nuevo producto
 */
export function openNewProductoModal() {
  currentProductId = null;
  
  const modal = document.getElementById('modalProducto');
  const form = document.getElementById('formProducto');
  const title = document.getElementById('modalProductoTitle');
  const previewArea = document.getElementById('previewArea');
  
  if (!modal || !form) return;
  
  title.textContent = 'Nuevo Producto';
  form.reset();
  document.getElementById('productoId').value = '';
  document.getElementById('productoDisponible').checked = true;
  
  previewArea.innerHTML = `
    <i class="bi bi-cloud-upload" style="font-size: 3rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
    <p style="color: var(--text-secondary); margin: 0;">Haz clic o arrastra una imagen aquí</p>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">PNG, JPG o WEBP (máx. 5MB)</p>
  `;
  
  modal.style.display = 'flex';
}

/**
 * Cerrar modal de producto
 */
export function closeProductoModal() {
  const modal = document.getElementById('modalProducto');
  if (modal) {
    modal.style.display = 'none';
    currentProductId = null;
  }
}

/**
 * Editar producto existente
 * @param {string} id - ID del producto
 */
export async function editProducto(id) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentProductId = id;
    
    // Verificar que los elementos existan
    const modal = document.getElementById('modalProducto');
    const title = document.getElementById('modalProductoTitle');
    const previewArea = document.getElementById('previewArea');
    
    if (!modal || !title) {
      console.error('Modal de productos no encontrado en el DOM');
      showToast('Error: Modal no encontrado', 'error');
      return;
    }
    
    title.textContent = 'Editar Producto';
    
    // Verificar cada campo antes de asignar valor
    const campos = {
      'productoId': data.id,
      'productoNombre': data.nombre,
      'productoPrecio': parseFloat(data.precio),
      'productoCategoria': data.categoria_id || '',
      'productoDescripcion': data.descripcion || ''
    };
    
    for (const [id, valor] of Object.entries(campos)) {
      const elemento = document.getElementById(id);
      if (elemento) {
        elemento.value = valor;
      } else {
        console.warn(`Elemento ${id} no encontrado`);
      }
    }
    
    // Checkbox
    const checkbox = document.getElementById('productoDisponible');
    if (checkbox) {
      checkbox.checked = data.activo;
    }

    // Preview de imagen
    if (data.imagen && previewArea) {
      const imagenUrl = getImageUrl(data.imagen);
      previewArea.innerHTML = `
        <img src="${imagenUrl}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">
          Haz clic para cambiar la imagen
        </p>
      `;
    }

    modal.style.display = 'flex';
    
  } catch (error) {
    handleError(error, 'Error al cargar producto');
  }
}

/**
 * Eliminar producto
 * @param {string} id - ID del producto
 * @param {string} nombre - Nombre del producto
 */
export async function deleteProducto(id, nombre) {
  const confirmado = confirm(
    `¿Estás seguro de eliminar "${nombre}"?\n\n` +
    `⚠️ Esta acción eliminará:\n` +
    `• El producto\n` +
    `• Sus referencias en carritos activos\n` +
    `• Esta acción no se puede deshacer`
  );
  
  if (!confirmado) return;

  try {
    // Primero eliminar referencias en carrito_items
    const { error: errorCarrito } = await supabase
      .from('carrito_items')
      .delete()
      .eq('producto_id', id);
    
    if (errorCarrito) {
      console.warn('Advertencia limpiando carrito:', errorCarrito);
    }

    // Obtener datos del producto para eliminar imagen
    const { data: producto } = await supabase
      .from('productos')
      .select('imagen')
      .eq('id', id)
      .single();
    
    // Ahora sí eliminar el producto
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    // Eliminar imagen del storage si existe
    if (producto?.imagen) {
      await deleteImage(producto.imagen);
    }

    showToast('Producto eliminado exitosamente', 'success');
    await loadProductos();
    
  } catch (error) {
    handleError(error, 'Error al eliminar producto');
  }
}

// ==================== GUARDAR ====================

/**
 * Guardar producto (crear o actualizar)
 * @param {Event} e - Evento del formulario
 */
export async function saveProducto(e) {
  e.preventDefault();

  const formData = {
    nombre: document.getElementById('productoNombre').value.trim(),
    precio: parseFloat(document.getElementById('productoPrecio').value),
    categoria_id: document.getElementById('productoCategoria').value || null,
    descripcion: document.getElementById('productoDescripcion').value.trim() || null,
    activo: document.getElementById('productoDisponible').checked,
    stock: 0 // Por ahora siempre 0
  };

  try {
    // Subir imagen si hay una nueva
    const fileInput = document.getElementById('productoImagen');
    if (fileInput.files.length > 0) {
      const fileName = await uploadImage(fileInput.files[0]);
      formData.imagen = fileName;
    }

    if (currentProductId) {
      // ACTUALIZAR producto existente
      
      // Si no hay nueva imagen, mantener la anterior
      if (!formData.imagen) {
        const { data: currentData } = await supabase
          .from('productos')
          .select('imagen')
          .eq('id', currentProductId)
          .single();
        
        formData.imagen = currentData?.imagen;
      }

      formData.actualizado_en = new Date().toISOString();

      const { error } = await supabase
        .from('productos')
        .update(formData)
        .eq('id', currentProductId);

      if (error) throw error;
      
      showToast('Producto actualizado exitosamente', 'success');
      
    } else {
      // CREAR nuevo producto
      formData.creado_en = new Date().toISOString();
      formData.actualizado_en = new Date().toISOString();

      const { error } = await supabase
        .from('productos')
        .insert([formData]);

      if (error) throw error;
      
      showToast('Producto creado exitosamente', 'success');
    }

    closeProductoModal();
    await loadProductos();
    
  } catch (error) {
    handleError(error, 'Error al guardar producto');
  }
}

// ==================== EVENT LISTENERS ====================

/**
 * Configurar event listeners
 */
function setupEventListeners() {
  // Búsqueda y filtros
  const searchInput = document.getElementById('searchProductos');
  const filterSelect = document.getElementById('filterCategoria');
  
  if (searchInput) {
    searchInput.addEventListener('input', filterProductos);
  }
  
  if (filterSelect) {
    filterSelect.addEventListener('change', filterProductos);
  }
  
  // Preview de imagen
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('productoImagen');
  
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen es muy grande. Máximo 5MB', 'error');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('previewArea').innerHTML = `
          <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;">
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Haz clic para cambiar la imagen</p>
        `;
      };
      reader.readAsDataURL(file);
    });
  }
  
  // Botones del modal
  const btnNuevoProducto = document.getElementById('btnNuevoProducto');
  const closeModalBtn = document.getElementById('closeModalProducto');
  const btnCancelar = document.getElementById('btnCancelarProducto');
  const formProducto = document.getElementById('formProducto');
  
  if (btnNuevoProducto) {
    btnNuevoProducto.addEventListener('click', openNewProductoModal);
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeProductoModal);
  }
  
  if (btnCancelar) {
    btnCancelar.addEventListener('click', closeProductoModal);
  }
  
  if (formProducto) {
    formProducto.addEventListener('submit', saveProducto);
  }
}

// ==================== UTILS ====================

/**
 * Actualizar estadísticas del dashboard
 */
function updateDashboardStats() {
  const totalProductos = document.getElementById('productosTotal');
  if (totalProductos) {
    totalProductos.textContent = productosData.length;
  }
  
  // Actualizar badge en sidebar
  const productosBadge = document.querySelector('[data-view="productos"] .nav-badge');
  if (productosBadge) {
    productosBadge.textContent = productosData.length;
  }
}

// ==================== EXPORTAR PARA USO GLOBAL ====================
// Hacer las funciones disponibles globalmente para onclick handlers
if (typeof window !== 'undefined') {
  window.productosModule = {
    initProductos,
    loadProductos,
    loadCategorias,
    filterProductos,
    openNewProductoModal,
    closeProductoModal,
    editProducto,
    deleteProducto,
    saveProducto
  };
}