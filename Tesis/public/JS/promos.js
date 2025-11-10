// ==================== PROMOS.JS MEJORADO ====================
// Gestión de promociones - Standalone con buscador

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIG ====================
const SUPABASE_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== ESTADO ====================
let promosData = [];
let productosData = [];
let productosOriginal = []; // Guardar lista original para filtrar
let currentPromoId = null;

// ==================== HELPERS ====================

function formatPrice(precio) {
  const precioNumerico = parseFloat(precio);
  if (isNaN(precioNumerico)) return '0';
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(precioNumerico);
}

function formatDate(fecha) {
  if (!fecha) return '-';
  return new Date(fecha).toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#f59e0b'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  `;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : '⚠️';
  toast.innerHTML = `<span style="font-size: 1.25rem;">${icon}</span> ${message}`;
  
  document.body.appendChild(toast);
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  if (!document.querySelector('style[data-toast]')) {
    style.setAttribute('data-toast', '');
    document.head.appendChild(style);
  }
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getTipoLabel(tipo) {
  const tipos = {
    'porcentaje': '% Descuento',
    'monto_fijo': 'Gs Fijos',
    'precio_especial': 'Precio Fijo'
  };
  return tipos[tipo] || tipo;
}

function formatValor(tipo, valor) {
  switch(tipo) {
    case 'porcentaje':
      return `${valor}%`;
    case 'monto_fijo':
      return `${formatPrice(valor)} OFF`;
    case 'precio_especial':
      return formatPrice(valor) + ' Gs';
    default:
      return valor;
  }
}

function getEstadoPromo(promo) {
  const now = new Date();
  const inicio = new Date(promo.fecha_inicio);
  const fin = new Date(promo.fecha_fin);
  
  if (!promo.activo) {
    return { label: 'Pausada', color: 'var(--text-muted)', icon: '⏸️' };
  }
  
  if (now < inicio) {
    return { label: 'Programada', color: 'var(--info)', icon: '📅' };
  }
  
  if (now > fin) {
    return { label: 'Expirada', color: 'var(--danger)', icon: '⏱️' };
  }
  
  return { label: 'Activa', color: 'var(--success)', icon: '✅' };
}

// ==================== BUSCAR PRODUCTOS ====================

function filterProductos(searchTerm) {
  const term = searchTerm.toLowerCase().trim();
  
  if (!term) {
    // Si está vacío, mostrar todos
    productosData = [...productosOriginal];
  } else {
    // Filtrar por nombre
    productosData = productosOriginal.filter(p => 
      p.nombre.toLowerCase().includes(term)
    );
  }
  
  renderProductosAsignar();
}

function renderProductosAsignar() {
  const list = document.getElementById('productosAsignarList');
  if (!list) return;

  if (productosData.length === 0) {
    list.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
        <i class="bi bi-search" style="font-size: 2rem; display: block; margin-bottom: 0.5rem; opacity: 0.5;"></i>
        <p style="font-weight: 600; margin-bottom: 0.5rem;">No hay productos que coincidan</p>
        <p style="font-size: 0.9rem;">Intenta con otro término de búsqueda</p>
      </div>
    `;
    return;
  }

  // Obtener los IDs de productos ya asignados del formulario
  const checkboxes = list.querySelectorAll('input[type="checkbox"]');
  const asignadosIds = new Set(
    Array.from(checkboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value)
  );

  list.innerHTML = productosData.map(p => `
    <label class="producto-item" style="
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
      margin-bottom: 0.75rem;
    " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
      <input 
        type="checkbox" 
        value="${p.id}"
        ${asignadosIds.has(p.id) ? 'checked' : ''}
        style="width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;"
      >
      <div style="flex: 1;">
        <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${p.nombre}</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatPrice(p.precio)} Gs</div>
      </div>
      <div style="
        background: var(--primary);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
      ">
        ${formatPrice(p.precio)} Gs
      </div>
    </label>
  `).join('');
}

// ==================== CARGAR DATOS ====================

async function loadPromos() {
  console.log('🔄 Cargando promos...');
  
  const tbody = document.getElementById('promosTableBody');
  if (!tbody) return;
  
  tbody.innerHTML = `
    <tr>
      <td colspan="6" class="loading-cell">
        <div class="spinner"></div>
        <p>Cargando promos...</p>
      </td>
    </tr>
  `;
  
  try {
    const { data, error } = await supabase
      .from('promos')
      .select(`
        *,
        productos_promos(count)
      `)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    
    console.log(`✅ ${data.length} promos cargadas`);
    
    promosData = data.map(promo => ({
      ...promo,
      productos_count: promo.productos_promos[0]?.count || 0
    }));
    
    renderPromosTable();
    
  } catch (error) {
    console.error('Error cargando promos:', error);
    showToast('Error al cargar promos: ' + error.message, 'error');
    
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          <strong>Error cargando promos</strong>
          <p style="margin-top: 0.5rem; color: var(--text-secondary);">${error.message}</p>
          <button onclick="loadPromos()" class="btn-primary" style="margin-top: 1rem;">
            <i class="bi bi-arrow-clockwise"></i>
            Reintentar
          </button>
        </td>
      </tr>
    `;
  }
}

async function loadProductos() {
  console.log('🔄 Cargando productos...');
  
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, precio, imagen')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    
    console.log(`✅ ${data.length} productos cargados`);
    productosData = data;
    productosOriginal = [...data]; // Guardar copia original
    
  } catch (error) {
    console.error('Error cargando productos:', error);
    showToast('Error al cargar productos', 'error');
  }
}

// ==================== RENDERIZADO ====================

function renderPromosTable() {
  const tbody = document.getElementById('promosTableBody');
  if (!tbody) return;

  if (!promosData || promosData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-tag" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No hay promos creadas</p>
          <button onclick="openNewPromoModal()" class="btn-primary" style="margin-top: 1rem;">
            <i class="bi bi-plus-lg"></i>
            Crear primera promo
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = promosData.map(promo => {
    const tipo = getTipoLabel(promo.tipo);
    const valor = formatValor(promo.tipo, promo.valor);
    const estado = getEstadoPromo(promo);
    
    return `
    <tr>
      <td>
        <div style="font-weight: 600; margin-bottom: 0.25rem;">${promo.nombre}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          ${promo.codigo ? `<i class="bi bi-tag-fill"></i> ${promo.codigo}` : 'Sin código'}
        </div>
      </td>
      <td>
        <span class="badge" style="background: var(--info-light); color: var(--info);">
          ${tipo}
        </span>
      </td>
      <td class="text-center" style="font-weight: 600;">
        ${valor}
      </td>
      <td style="font-size: 0.85rem;">
        <div style="margin-bottom: 0.25rem;">
          <i class="bi bi-calendar-check"></i> ${formatDate(promo.fecha_inicio)}
        </div>
        <div style="color: var(--text-muted);">
          <i class="bi bi-calendar-x"></i> ${formatDate(promo.fecha_fin)}
        </div>
      </td>
      <td class="text-center">
        <span class="badge" style="background: ${estado.color}20; color: ${estado.color};">
          ${estado.icon} ${estado.label}
        </span>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
          ${promo.productos_count} producto${promo.productos_count !== 1 ? 's' : ''}
        </div>
      </td>
      <td class="text-center">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button 
            class="icon-btn" 
            onclick="editPromo('${promo.id}')"
            title="Editar"
            style="background: var(--info-light); color: var(--info);"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="asignarProductos('${promo.id}')"
            title="Asignar productos"
            style="background: var(--warning-light); color: var(--warning);"
          >
            <i class="bi bi-box-seam"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="toggleActivoPromo('${promo.id}', ${!promo.activo})"
            title="${promo.activo ? 'Desactivar' : 'Activar'}"
            style="background: ${promo.activo ? 'var(--warning-light)' : 'var(--success-light)'}; color: ${promo.activo ? 'var(--warning)' : 'var(--success)'};"
          >
            <i class="bi bi-${promo.activo ? 'pause' : 'play'}-circle"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="deletePromo('${promo.id}', '${promo.nombre.replace(/'/g, "\\'")}')"
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

// ==================== MODAL ====================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
  }
}

function openNewPromoModal() {
  currentPromoId = null;
  
  const form = document.getElementById('formPromo');
  const title = document.getElementById('modalPromoTitle');
  
  if (!form) return;
  
  title.textContent = 'Nueva Promoción';
  form.reset();
  document.getElementById('promoId').value = '';
  document.getElementById('promoActivo').checked = true;
  
  // Fechas por defecto
  const hoy = new Date().toISOString().split('T')[0];
  const treintaDias = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
  document.getElementById('promoFechaInicio').value = hoy;
  document.getElementById('promoFechaFin').value = treintaDias;
  
  openModal('modalPromo');
}

async function editPromo(id) {
  try {
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentPromoId = id;
    
    const title = document.getElementById('modalPromoTitle');
    
    title.textContent = 'Editar Promoción';
    document.getElementById('promoId').value = data.id;
    document.getElementById('promoNombre').value = data.nombre;
    document.getElementById('promoDescripcion').value = data.descripcion || '';
    document.getElementById('promoTipo').value = data.tipo;
    document.getElementById('promoValor').value = data.valor;
    document.getElementById('promoFechaInicio').value = data.fecha_inicio.split('T')[0];
    document.getElementById('promoFechaFin').value = data.fecha_fin.split('T')[0];
    document.getElementById('promoCodigo').value = data.codigo || '';
    document.getElementById('promoActivo').checked = data.activo;

    openModal('modalPromo');
    
  } catch (error) {
    console.error('Error al cargar promo:', error);
    showToast('Error al cargar promo', 'error');
  }
}

async function deletePromo(id, nombre) {
  const confirmado = confirm(
    `¿Estás seguro de eliminar la promo "${nombre}"?\n\n⚠️ Esta acción no se puede deshacer.`
  );
  
  if (!confirmado) return;

  try {
    const { error } = await supabase
      .from('promos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    showToast('Promo eliminada exitosamente', 'success');
    await loadPromos();
    
  } catch (error) {
    console.error('Error al eliminar promo:', error);
    showToast('Error al eliminar promo', 'error');
  }
}

async function toggleActivoPromo(id, nuevoEstado) {
  try {
    const { error } = await supabase
      .from('promos')
      .update({ activo: nuevoEstado })
      .eq('id', id);

    if (error) throw error;

    showToast(
      nuevoEstado ? 'Promo activada' : 'Promo pausada',
      'success'
    );
    await loadPromos();
    
  } catch (error) {
    console.error('Error al cambiar estado:', error);
    showToast('Error al cambiar estado', 'error');
  }
}

// ==================== GUARDAR ====================

async function savePromo(e) {
  e.preventDefault();

  const formData = {
    nombre: document.getElementById('promoNombre').value.trim(),
    descripcion: document.getElementById('promoDescripcion').value.trim() || null,
    tipo: document.getElementById('promoTipo').value,
    valor: parseFloat(document.getElementById('promoValor').value),
    fecha_inicio: new Date(document.getElementById('promoFechaInicio').value + 'T00:00:00Z').toISOString(),
    fecha_fin: new Date(document.getElementById('promoFechaFin').value + 'T23:59:59Z').toISOString(),
    codigo: document.getElementById('promoCodigo').value.trim().toUpperCase() || null,
    activo: document.getElementById('promoActivo').checked
  };

  if (formData.fecha_inicio >= formData.fecha_fin) {
    showToast('La fecha de fin debe ser posterior a la de inicio', 'error');
    return;
  }

  try {
    if (currentPromoId) {
      const { error } = await supabase
        .from('promos')
        .update(formData)
        .eq('id', currentPromoId);

      if (error) throw error;
      
      showToast('Promo actualizada exitosamente', 'success');
      
    } else {
      const { error } = await supabase
        .from('promos')
        .insert([formData]);

      if (error) throw error;
      
      showToast('Promo creada exitosamente', 'success');
    }

    closeModal('modalPromo');
    await loadPromos();
    
  } catch (error) {
    console.error('Error al guardar promo:', error);
    showToast('Error al guardar promo: ' + error.message, 'error');
  }
}

// ==================== ASIGNAR PRODUCTOS ====================

async function asignarProductos(promoId) {
  try {
    const { data: promo, error: promoError } = await supabase
      .from('promos')
      .select('*')
      .eq('id', promoId)
      .single();

    if (promoError) throw promoError;

    const { data: asignados, error: asigError } = await supabase
      .from('productos_promos')
      .select('producto_id')
      .eq('promo_id', promoId);

    if (asigError) throw asigError;

    const asignadosIds = new Set(asignados.map(a => a.producto_id));

    const title = document.getElementById('modalAsignarTitle');
    const searchContainer = document.getElementById('searchContainerPromos');
    const list = document.getElementById('productosAsignarList');

    title.textContent = `Asignar productos a "${promo.nombre}"`;
    
    // Crear el buscador
    if (searchContainer) {
      searchContainer.innerHTML = `
        <div style="
          position: relative;
          margin-bottom: 1.5rem;
        ">
          <i class="bi bi-search" style="
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 1.1rem;
            z-index: 1;
          "></i>
          <input 
            type="text" 
            id="searchProductosPromo"
            placeholder="Buscar producto por nombre..." 
            style="
              width: 100%;
              padding: 0.875rem 1rem 0.875rem 2.75rem;
              border: 2px solid var(--border);
              border-radius: 8px;
              font-size: 0.95rem;
              transition: all 0.2s;
              font-family: inherit;
            "
            onkeyup="filterProductos(this.value)"
          >
          <div style="
            position: absolute;
            right: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            font-size: 0.85rem;
          ">
            <span id="resultadosBusqueda">${productosData.length} productos</span>
          </div>
        </div>
      `;
    }

    // Resetear datos a todos los productos
    productosData = [...productosOriginal];
    
    // Renderizar la lista
    list.innerHTML = productosData.map(p => `
      <label class="producto-item" style="
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        margin-bottom: 0.75rem;
      " onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='transparent'">
        <input 
          type="checkbox" 
          value="${p.id}"
          ${asignadosIds.has(p.id) ? 'checked' : ''}
          style="width: 20px; height: 20px; cursor: pointer; flex-shrink: 0;"
          onchange="document.getElementById('resultadosBusqueda').textContent = '${productosData.length} producto(s) seleccionado(s)'"
        >
        <div style="flex: 1;">
          <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem;">${p.nombre}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">${formatPrice(p.precio)} Gs</div>
        </div>
        <div style="
          background: var(--primary);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 6px;
          font-size: 0.8rem;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        ">
          ${formatPrice(p.precio)} Gs
        </div>
      </label>
    `).join('');

    document.getElementById('modalAsignarProductos').dataset.promoId = promoId;
    openModal('modalAsignarProductos');

  } catch (error) {
    console.error('Error al cargar productos:', error);
    showToast('Error al cargar productos', 'error');
  }
}

async function saveAsignacionProductos() {
  const modal = document.getElementById('modalAsignarProductos');
  const promoId = modal.dataset.promoId;
  
  const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
  const seleccionados = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  try {
    await supabase
      .from('productos_promos')
      .delete()
      .eq('promo_id', promoId);

    if (seleccionados.length > 0) {
      const inserts = seleccionados.map(prodId => ({
        promo_id: promoId,
        producto_id: prodId
      }));

      const { error } = await supabase
        .from('productos_promos')
        .insert(inserts);

      if (error) throw error;
    }

    showToast(`${seleccionados.length} productos asignados`, 'success');
    closeModal('modalAsignarProductos');
    await loadPromos();

  } catch (error) {
    console.error('Error al asignar productos:', error);
    showToast('Error al asignar productos', 'error');
  }
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando módulo de promos...');
  
  // Cargar datos
  await loadProductos();
  await loadPromos();
  
  // Botones
  document.getElementById('btnNuevaPromo')?.addEventListener('click', openNewPromoModal);
  document.getElementById('closeModalPromo')?.addEventListener('click', () => closeModal('modalPromo'));
  document.getElementById('btnCancelarPromo')?.addEventListener('click', () => closeModal('modalPromo'));
  document.getElementById('formPromo')?.addEventListener('submit', savePromo);
  
  document.getElementById('closeModalAsignar')?.addEventListener('click', () => closeModal('modalAsignarProductos'));
  document.getElementById('btnCancelarAsignar')?.addEventListener('click', () => closeModal('modalAsignarProductos'));
  document.getElementById('btnGuardarAsignar')?.addEventListener('click', saveAsignacionProductos);
  
  console.log('✅ Módulo de promos inicializado');
});

// Exportar funciones globales para onclick handlers
window.loadPromos = loadPromos;
window.openNewPromoModal = openNewPromoModal;
window.editPromo = editPromo;
window.deletePromo = deletePromo;
window.toggleActivoPromo = toggleActivoPromo;
window.asignarProductos = asignarProductos;
window.filterProductos = filterProductos;