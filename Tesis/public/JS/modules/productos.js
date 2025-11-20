// ==================== MÓDULO DE PRODUCTOS - VERSIÓN PROYECTO VIEJO ====================
// Enfoque probado y confiable con onclick inline

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
  console.log(' Inicializando módulo de productos...');
  
  // Cargar datos
  await loadCategorias();
  await loadProductos();
  
  // Configurar SOLO los event listeners que NO están en la tabla
  setupEventListeners();
  
  console.log(' Módulo de productos inicializado');
}

// ==================== CARGAR DATOS ====================

/**
 * Cargar productos desde Supabase
 */
export async function loadProductos() {
  console.log(' Cargando productos...');
  
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
    
    console.log(` ${data.length} productos cargados`);
    
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
  console.log(' Cargando categorías...');
  
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    
    console.log(` ${data.length} categorías cargadas`);
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
 * ENFOQUE PROYECTO VIEJO: onclick inline
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
    
    //  Escapar comillas simples en el nombre para evitar romper onclick
    const nombreEscapado = producto.nombre.replace(/'/g, "\\'");
    
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
            onclick="window.productosModule.editProducto('${producto.id}')"
            class="icon-btn" 
            title="Editar"
            style="background: var(--info-light); color: var(--info);"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button 
            onclick="window.productosModule.deleteProducto('${producto.id}', '${nombreEscapado}')"
            class="icon-btn" 
            title="Eliminar"
            style="background: var(--danger-light); color: var(--danger);"
          >
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
  
  //  YA NO NECESITAMOS attachTableEventListeners() porque usamos onclick inline
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
    console.log(` Mostrando ${count} de ${total} productos`);
  }
}

// ==================== MODAL ====================

/**
 * Abrir modal para nuevo producto
 */
export function openNewProductoModal() {
  console.log(' Abriendo modal para nuevo producto');
  currentProductId = null;
  
  const modal = document.getElementById('modalProducto');
  const form = document.getElementById('formProducto');
  const title = document.getElementById('modalProductoTitle');
  const previewArea = document.getElementById('previewArea');
  
  if (!modal) {
    console.error(' Modal no encontrado');
    showToast('Error: Modal no encontrado', 'error');
    return;
  }
  
  if (!form) {
    console.error(' Formulario no encontrado');
    showToast('Error: Formulario no encontrado', 'error');
    return;
  }
  
  title.textContent = 'Nuevo Producto';
  form.reset();
  document.getElementById('productoId').value = '';
  document.getElementById('productoDisponible').checked = true;
  
  if (previewArea) {
    previewArea.innerHTML = `
      <i class="bi bi-cloud-upload" style="font-size: 3rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
      <p style="color: var(--text-secondary); margin: 0;">Haz clic o arrastra una imagen aquí</p>
      <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">PNG, JPG o WEBP (máx. 5MB)</p>
    `;
  }
  
  //  CORRECCIÓN: Usar clase active en lugar de style.display
  modal.classList.add('active');
  console.log(' Modal abierto');
}

/**
 * Cerrar modal de producto
 */
export function closeProductoModal() {
  const modal = document.getElementById('modalProducto');
  if (modal) {
    // CORRECCIÓN: Remover clase active en lugar de cambiar display
    modal.classList.remove('active');
    currentProductId = null;
    console.log(' Modal cerrado');
  }
}

/**
 * Editar producto existente
 * @param {string} id - ID del producto
 */
export async function editProducto(id) {
  console.log('Editando producto:', id);
  
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentProductId = id;
    
    const modal = document.getElementById('modalProducto');
    const title = document.getElementById('modalProductoTitle');
    const previewArea = document.getElementById('previewArea');
    
    if (!modal) {
      console.error(' Modal no encontrado');
      showToast('Error: Modal no encontrado', 'error');
      return;
    }
    
    title.textContent = 'Editar Producto';
    document.getElementById('productoId').value = data.id;
    document.getElementById('productoNombre').value = data.nombre;
    document.getElementById('productoPrecio').value = parseFloat(data.precio);
    document.getElementById('productoCategoria').value = data.categoria_id || '';
    document.getElementById('productoDescripcion').value = data.descripcion || '';
    document.getElementById('productoDisponible').checked = data.activo;

    if (data.imagen && previewArea) {
      const imagenUrl = getImageUrl(data.imagen);
      previewArea.innerHTML = `
        <img src="${imagenUrl}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;" onerror="this.src='https://via.placeholder.com/300x200?text=Error'">
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Haz clic para cambiar la imagen</p>
      `;
    }

    //  CORRECCIÓN: Usar clase active
    modal.classList.add('active');
    console.log(' Modal de edición abierto');
    
  } catch (error) {
    handleError(error, 'Error al cargar producto');
  }
}

/**
 * Eliminar producto (con manejo inteligente de foreign keys)
 * @param {string} id - ID del producto
 * @param {string} nombre - Nombre del producto
 */
export async function deleteProducto(id, nombre) {
  console.log(' Intentando eliminar:', nombre);
  
  const confirmado = confirm(
    `¿Estás seguro de eliminar "${nombre}"?\n\n⚠️ Esta acción no se puede deshacer.`
  );
  
  if (!confirmado) {
    console.log(' Eliminación cancelada');
    return;
  }

  try {
    // Obtener datos del producto para eliminar imagen
    const { data: producto } = await supabase
      .from('productos')
      .select('imagen')
      .eq('id', id)
      .single();
    
    // Intentar eliminar producto de la BD
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    //  Manejo inteligente de foreign key constraint
    if (error) {
      if (error.code === '23503') {
        // Error de foreign key - producto está en uso
        const desactivar = confirm(
          `⚠️ Este producto no se puede eliminar porque está siendo usado en pedidos.\n\n¿Querés desactivarlo en su lugar?`
        );
        
        if (desactivar) {
          const { error: updateError } = await supabase
            .from('productos')
            .update({ activo: false })
            .eq('id', id);
          
          if (updateError) throw updateError;
          
          showToast(' Producto desactivado exitosamente', 'success');
          console.log(' Producto desactivado:', nombre);
          await loadProductos();
          return;
        } else {
          console.log(' Desactivación cancelada');
          return;
        }
      }
      throw error;
    }
    
    // Eliminar imagen del storage solo si se eliminó el producto
    if (producto?.imagen) {
      await deleteImage(producto.imagen);
    }

    showToast(' Producto eliminado exitosamente', 'success');
    console.log(' Producto eliminado:', nombre);
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
  console.log('💾 Guardando producto...');

  const formData = {
    nombre: document.getElementById('productoNombre').value.trim(),
    precio: parseFloat(document.getElementById('productoPrecio').value),
    categoria_id: document.getElementById('productoCategoria').value || null,
    descripcion: document.getElementById('productoDescripcion').value.trim() || null,
    activo: document.getElementById('productoDisponible').checked,
    stock: 0
  };

  try {
    // Subir imagen si hay una nueva
    const fileInput = document.getElementById('productoImagen');
    if (fileInput.files.length > 0) {
      console.log(' Subiendo imagen...');
      const fileName = await uploadImage(fileInput.files[0]);
      formData.imagen = fileName;
      console.log(' Imagen subida:', fileName);
    }

    if (currentProductId) {
      // ACTUALIZAR producto existente
      console.log(' Actualizando producto existente');
      
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
      
      showToast(' Producto actualizado exitosamente', 'success');
      
    } else {
      // CREAR nuevo producto
      console.log(' Creando nuevo producto');
      formData.creado_en = new Date().toISOString();
      formData.actualizado_en = new Date().toISOString();

      const { error } = await supabase
        .from('productos')
        .insert([formData]);

      if (error) throw error;
      
      showToast(' Producto creado exitosamente', 'success');
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
 * SOLO para elementos que NO están en la tabla
 */
function setupEventListeners() {
  console.log('🎧 Configurando event listeners...');
  
  // Búsqueda y filtros
  const searchInput = document.getElementById('searchProductos');
  const filterSelect = document.getElementById('filterCategoria');
  
  if (searchInput) {
    searchInput.addEventListener('input', filterProductos);
    console.log(' Listener de búsqueda configurado');
  }
  
  if (filterSelect) {
    filterSelect.addEventListener('change', filterProductos);
    console.log(' Listener de filtro configurado');
  }
  
  // Botón Nuevo Producto
  const btnNuevoProducto = document.getElementById('btnNuevoProducto');
  if (btnNuevoProducto) {
    btnNuevoProducto.addEventListener('click', (e) => {
      e.preventDefault();
      console.log(' Click en botón Nuevo Producto');
      openNewProductoModal();
    });
    console.log(' Listener de Nuevo Producto configurado');
  } else {
    console.warn(' Botón Nuevo Producto no encontrado');
  }
  
  // Preview de imagen
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('productoImagen');
  
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => {
      console.log(' Click en área de upload');
      fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      console.log(' Imagen seleccionada:', file.name);
      
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen es muy grande. Máximo 5MB', 'error');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const previewArea = document.getElementById('previewArea');
        if (previewArea) {
          previewArea.innerHTML = `
            <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;">
            <p style="color: var(--text-secondary); font-size: 0.85rem;">Haz clic para cambiar la imagen</p>
          `;
        }
      };
      reader.readAsDataURL(file);
    });
    console.log(' Listener de upload de imagen configurado');
  }
  
  // Botones del modal
  const closeModalBtn = document.getElementById('closeModalProducto');
  const btnCancelar = document.getElementById('btnCancelarProducto');
  const formProducto = document.getElementById('formProducto');
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeProductoModal);
    console.log('Listener de cerrar modal configurado');
  }
  
  if (btnCancelar) {
    btnCancelar.addEventListener('click', closeProductoModal);
    console.log(' Listener de cancelar configurado');
  }
  
  if (formProducto) {
    formProducto.addEventListener('submit', saveProducto);
    console.log(' Listener de formulario configurado');
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
}

// ==================== EXPORTAR PARA USO GLOBAL ====================
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
  console.log(' Módulo productos exportado a window.productosModule');
}

console.log('Módulo de Productos cargado (versión proyecto viejo con onclick inline)');