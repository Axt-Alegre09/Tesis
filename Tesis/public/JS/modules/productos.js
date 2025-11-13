// ==================== MÓDULO DE PRODUCTOS - VERSIÓN FINAL CORREGIDA ====================

import { supa } from '../supabase-client.js';

// ==================== ESTADO ====================
let productosData = [];
let categoriasData = [];
let currentProductId = null;
let currentImageUrl = null;

// ==================== FUNCIONES AUXILIARES ====================
function getImageUrl(imagePath) {
  if (!imagePath) return 'https://via.placeholder.com/300x300?text=Sin+Imagen';
  if (imagePath.startsWith('http')) return imagePath;
  
  const { data } = supa.storage
    .from('productos')
    .getPublicUrl(imagePath);
  
  return data.publicUrl;
}

function formatPrice(precio) {
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(precio);
}

function showToast(message, type = 'success') {
  const bgColor = type === 'success' ? 'rgb(16, 185, 129)' : 'rgb(239, 68, 68)';
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-weight: 500;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== INICIALIZACIÓN ====================
export async function initProductos() {
  console.log('🔄 Inicializando módulo de productos...');
  
  // Crear modal si no existe
  createProductModal();
  
  // Cargar datos
  await loadCategorias();
  await loadProductos();
  
  // Configurar event listeners
  setupEventListeners();
  
  console.log('✅ Módulo de productos inicializado');
}

// ==================== CREAR MODAL ====================
function createProductModal() {
  if (document.getElementById('modalProducto')) return;

  const modalHTML = `
    <div id="modalProducto" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;">
      <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        
        <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
          <h2 id="modalProductoTitle" style="margin: 0; font-size: 1.5rem; font-weight: 700;">Nuevo Producto</h2>
          <button id="closeModalProducto" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">
            <i class="bi bi-x-lg"></i>
          </button>
        </div>

        <form id="formProducto" style="padding: 1.5rem;">
          <input type="hidden" id="productoId">
          
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">
              Nombre del Producto <span style="color: var(--danger);">*</span>
            </label>
            <input type="text" id="productoNombre" required 
              style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">
                Precio (Gs) <span style="color: var(--danger);">*</span>
              </label>
              <input type="number" id="productoPrecio" required min="0"
                style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem;">
            </div>
            
            <div>
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">
                Categoría <span style="color: var(--danger);">*</span>
              </label>
              <select id="productoCategoria" required
                style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; background: white;">
                <option value="">Selecciona una categoría</option>
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">
              Descripción
            </label>
            <textarea id="productoDescripcion" rows="3"
              style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; font-size: 1rem; resize: vertical;">
            </textarea>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--text-secondary);">
              Imagen del Producto
            </label>
            <div id="uploadArea" style="border: 2px dashed var(--border); border-radius: 12px; padding: 2rem; text-align: center; cursor: pointer; transition: all 0.3s;">
              <input type="file" id="productoImagen" accept="image/*" style="display: none;">
              <div id="previewArea">
                <i class="bi bi-cloud-upload" style="font-size: 3rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
                <p style="color: var(--text-secondary); margin: 0;">Haz clic o arrastra una imagen aquí</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">PNG, JPG o WEBP (máx. 5MB)</p>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
              <input type="checkbox" id="productoDisponible" checked style="width: 18px; height: 18px;">
              <span style="font-weight: 600;">Producto disponible</span>
            </label>
          </div>

          <div style="display: flex; gap: 1rem; justify-content: flex-end;">
            <button type="button" id="btnCancelarProducto" 
              style="padding: 0.75rem 1.5rem; border: 1px solid var(--border); background: white; border-radius: 8px; font-weight: 600; cursor: pointer;">
              Cancelar
            </button>
            <button type="submit" 
              style="padding: 0.75rem 1.5rem; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
              <i class="bi bi-check-lg"></i> Guardar Producto
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ==================== CARGAR DATOS ====================
export async function loadProductos() {
  console.log('🔄 Cargando productos...');
  
  const tbody = document.getElementById('productosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <div class="spinner"></div>
        <p>Cargando productos...</p>
      </td>
    </tr>
  `;
  
  try {
    const { data, error } = await supa
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
    
    productosData = data.map(producto => ({
      ...producto,
      categoria_nombre: producto.categorias?.nombre || 'Sin categoría'
    }));
    
    renderProductosTable();
    
  } catch (error) {
    console.error('Error cargando productos:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 2rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 2rem;"></i>
          <p>Error cargando productos</p>
        </td>
      </tr>
    `;
  }
}

export async function loadCategorias() {
  console.log('🔄 Cargando categorías...');
  
  try {
    const { data, error } = await supa
      .from('categorias')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    
    categoriasData = data;
    populateCategoriaSelects();
    
  } catch (error) {
    console.error('Error cargando categorías:', error);
  }
}

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
function renderProductosTable(filteredData = null) {
  const tbody = document.getElementById('productosTableBody');
  if (!tbody) return;
  
  const data = filteredData || productosData;
  
  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-inbox" style="font-size: 3rem;"></i>
          <p>No hay productos para mostrar</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(producto => `
    <tr style="border-bottom: 1px solid var(--border);">
      <td style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <img 
            src="${getImageUrl(producto.imagen)}" 
            alt="${producto.nombre}"
            style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;"
            onerror="this.src='https://via.placeholder.com/60x60?text=Sin+Imagen'"
          >
          <div>
            <div style="font-weight: 600;">${producto.nombre}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              Stock: ${producto.stock || 0}
            </div>
          </div>
        </div>
      </td>
      <td style="padding: 1rem;">
        <span style="background: var(--bg-main); padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem;">
          ${producto.categoria_nombre}
        </span>
      </td>
      <td style="padding: 1rem; text-align: right; font-weight: 600;">
        ${formatPrice(producto.precio)} Gs
      </td>
      <td style="padding: 1rem; text-align: center;">
        <span style="
          padding: 0.4rem 0.75rem; 
          border-radius: 6px; 
          font-size: 0.85rem;
          background: ${producto.activo ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};
          color: ${producto.activo ? 'rgb(16,185,129)' : 'rgb(239,68,68)'};
        ">
          ${producto.activo ? '✓ Disponible' : '✗ No disponible'}
        </span>
      </td>
      <td style="padding: 1rem; text-align: center;">
        <button class="icon-btn" onclick="window.productosModule.editProducto('${producto.id}')" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="icon-btn" onclick="window.productosModule.deleteProducto('${producto.id}', '${producto.nombre.replace(/'/g, "\\'")}')" title="Eliminar" style="background: rgba(239,68,68,0.1); color: rgb(239,68,68);">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

// ==================== MODAL FUNCTIONS ====================
export function openNewProductoModal() {
  console.log('📝 Abriendo modal para nuevo producto');
  currentProductId = null;
  currentImageUrl = null;
  
  const modal = document.getElementById('modalProducto');
  const form = document.getElementById('formProducto');
  const title = document.getElementById('modalProductoTitle');
  
  if (!modal || !form) {
    console.error('Modal no encontrado');
    return;
  }
  
  title.textContent = 'Nuevo Producto';
  form.reset();
  document.getElementById('productoDisponible').checked = true;
  
  document.getElementById('previewArea').innerHTML = `
    <i class="bi bi-cloud-upload" style="font-size: 3rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
    <p style="color: var(--text-secondary); margin: 0;">Haz clic o arrastra una imagen aquí</p>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">PNG, JPG o WEBP (máx. 5MB)</p>
  `;
  
  modal.style.display = 'flex';
}

export function closeProductoModal() {
  const modal = document.getElementById('modalProducto');
  if (modal) {
    modal.style.display = 'none';
    currentProductId = null;
    currentImageUrl = null;
  }
}

export async function editProducto(id) {
  console.log('✏️ Editando producto:', id);
  
  try {
    const { data, error } = await supa
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentProductId = id;
    currentImageUrl = data.imagen;
    
    const modal = document.getElementById('modalProducto');
    const title = document.getElementById('modalProductoTitle');
    
    if (!modal) {
      console.error('Modal no encontrado');
      return;
    }
    
    title.textContent = 'Editar Producto';
    document.getElementById('productoId').value = data.id;
    document.getElementById('productoNombre').value = data.nombre;
    document.getElementById('productoPrecio').value = parseFloat(data.precio);
    document.getElementById('productoCategoria').value = data.categoria_id || '';
    document.getElementById('productoDescripcion').value = data.descripcion || '';
    document.getElementById('productoDisponible').checked = data.activo;

    if (data.imagen) {
      document.getElementById('previewArea').innerHTML = `
        <img src="${getImageUrl(data.imagen)}" 
             style="max-width: 100%; max-height: 200px; border-radius: 8px;">
        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">Haz clic para cambiar la imagen</p>
      `;
    }

    modal.style.display = 'flex';
    
  } catch (error) {
    console.error('Error al cargar producto:', error);
    showToast('Error al cargar el producto', 'error');
  }
}

export async function deleteProducto(id, nombre) {
  console.log('🗑️ Intentando eliminar producto:', id, nombre);
  
  // ✅ CORRECCIÓN: Verificar si el producto está en uso
  try {
    const { data: detalles, error: errorDetalles } = await supa
      .from('detalles_pedido')
      .select('id')
      .eq('producto_id', id)
      .limit(1);

    if (errorDetalles) throw errorDetalles;

    if (detalles && detalles.length > 0) {
      alert(`❌ No se puede eliminar "${nombre}"\n\nMotivo: Este producto está siendo usado en pedidos existentes.\n\n💡 Sugerencia: En su lugar, puedes DESACTIVAR el producto editándolo y desmarcando "Producto disponible".`);
      return;
    }

    const confirmado = confirm(`¿Estás seguro de eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmado) return;

    const { error } = await supa
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    showToast('✅ Producto eliminado exitosamente', 'success');
    await loadProductos();
    
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    showToast('❌ Error al eliminar producto', 'error');
  }
}

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
    // Manejar la imagen si hay una nueva
    const fileInput = document.getElementById('productoImagen');
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const fileName = `${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supa.storage
        .from('productos')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      formData.imagen = fileName;
    } else if (currentImageUrl) {
      // Mantener la imagen existente
      formData.imagen = currentImageUrl;
    }

    if (currentProductId) {
      // ✅ ACTUALIZAR
      formData.actualizado_en = new Date().toISOString();
      
      const { error } = await supa
        .from('productos')
        .update(formData)
        .eq('id', currentProductId);

      if (error) throw error;
      
      showToast('✅ Producto actualizado exitosamente', 'success');
      
    } else {
      // ✅ CREAR NUEVO
      formData.creado_en = new Date().toISOString();
      formData.actualizado_en = new Date().toISOString();
      
      const { error } = await supa
        .from('productos')
        .insert([formData]);

      if (error) throw error;
      
      showToast('✅ Producto creado exitosamente', 'success');
    }

    closeProductoModal();
    await loadProductos();
    
  } catch (error) {
    console.error('Error al guardar producto:', error);
    showToast('❌ Error al guardar producto', 'error');
  }
}

// ==================== FILTROS ====================
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
    filtered = filtered.filter(p => p.categoria_id === parseInt(categoriaId));
  }
  
  renderProductosTable(filtered);
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  console.log('🎧 Configurando event listeners de productos...');
  
  // Búsqueda y filtros
  const searchInput = document.getElementById('searchProductos');
  const filterSelect = document.getElementById('filterCategoria');
  
  if (searchInput) {
    searchInput.addEventListener('input', filterProductos);
  }
  
  if (filterSelect) {
    filterSelect.addEventListener('change', filterProductos);
  }
  
  // ✅ CORRECCIÓN: Botón nuevo producto
  const btnNuevo = document.getElementById('btnNuevoProducto');
  if (btnNuevo) {
    // Remover listeners anteriores
    const newBtn = btnNuevo.cloneNode(true);
    btnNuevo.parentNode.replaceChild(newBtn, btnNuevo);
    
    // Agregar nuevo listener
    newBtn.addEventListener('click', () => {
      console.log('🆕 Click en botón Nuevo Producto');
      openNewProductoModal();
    });
  }
  
  // Modal
  document.getElementById('closeModalProducto')?.addEventListener('click', closeProductoModal);
  document.getElementById('btnCancelarProducto')?.addEventListener('click', closeProductoModal);
  
  const form = document.getElementById('formProducto');
  if (form) {
    form.addEventListener('submit', saveProducto);
  }
  
  // Upload de imagen
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('productoImagen');
  
  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      if (file.size > 5 * 1024 * 1024) {
        alert('La imagen es muy grande. Máximo 5MB');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('previewArea').innerHTML = `
          <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">Haz clic para cambiar la imagen</p>
        `;
      };
      reader.readAsDataURL(file);
    });
  }
  
  console.log('✅ Event listeners de productos configurados');
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
}

console.log('📦 Módulo de Productos cargado (versión corregida)');