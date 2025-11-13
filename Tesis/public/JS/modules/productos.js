// ==================== MÓDULO DE PRODUCTOS CORREGIDO ====================
// Importar desde supabase-config.js que ya tiene todos los helpers necesarios
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
  // Si el modal ya existe, no lo creamos de nuevo
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
    const { data, error } = await supabase
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
            onerror="this.src='https://via.placeholder.com/60x60?text=Error'"
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
  currentProductId = null;
  
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
  }
}

export async function editProducto(id) {
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
    alert('Error al cargar el producto');
  }
}

export async function deleteProducto(id, nombre) {
  // Primero verificar si el producto está en uso
  try {
    const { data: detalles, error: errorDetalles } = await supabase
      .from('detalles_pedido')
      .select('id')
      .eq('producto_id', id)
      .limit(1);

    if (detalles && detalles.length > 0) {
      alert(`No se puede eliminar "${nombre}" porque está siendo usado en pedidos existentes.\n\nPuedes desactivar el producto en su lugar.`);
      return;
    }

    const confirmado = confirm(`¿Estás seguro de eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`);
    
    if (!confirmado) return;

    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    showToast('Producto eliminado exitosamente', 'success');
    await loadProductos();
    
  } catch (error) {
    handleError(error, 'Error al eliminar producto');
  }
}

export async function saveProducto(e) {
  e.preventDefault();
  
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
      const fileName = await uploadImage(fileInput.files[0]);
      formData.imagen = fileName;
    }

    if (currentProductId) {
      // ACTUALIZAR
      if (!formData.imagen) {
        const { data: current } = await supabase
          .from('productos')
          .select('imagen')
          .eq('id', currentProductId)
          .single();
        
        formData.imagen = current?.imagen;
      }

      formData.actualizado_en = new Date().toISOString();
      
      const { error } = await supabase
        .from('productos')
        .update(formData)
        .eq('id', currentProductId);

      if (error) throw error;
      
      showToast('Producto actualizado exitosamente', 'success');
      
    } else {
      // CREAR NUEVO
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
    filtered = filtered.filter(p => p.categoria_id === categoriaId);
  }
  
  renderProductosTable(filtered);
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  // Búsqueda y filtros
  document.getElementById('searchProductos')?.addEventListener('input', filterProductos);
  document.getElementById('filterCategoria')?.addEventListener('change', filterProductos);
  
  // Modal
  document.getElementById('btnNuevoProducto')?.addEventListener('click', openNewProductoModal);
  document.getElementById('closeModalProducto')?.addEventListener('click', closeProductoModal);
  document.getElementById('btnCancelarProducto')?.addEventListener('click', closeProductoModal);
  document.getElementById('formProducto')?.addEventListener('submit', saveProducto);
  
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

console.log('📦 Módulo de Productos cargado');