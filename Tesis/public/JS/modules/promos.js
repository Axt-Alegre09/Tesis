// ==================== MÓDULO DE PROMOS ====================
// Gestión completa de promociones: CRUD + asignación a productos

import { 
  supabase, 
  formatPrice, 
  formatDate,
  showToast, 
  handleError
} from './supabase-config.js';

// ==================== ESTADO ====================
let promosData = [];
let productosData = [];
let currentPromoId = null;

// ==================== INICIALIZACIÓN ====================

/**
 * Inicializar el módulo de promos
 */
export async function initPromos() {
  console.log('🔄 Inicializando módulo de promos...');
  
  // Cargar datos
  await loadProductos();
  await loadPromos();
  
  // Configurar event listeners
  setupEventListeners();
  
  console.log('✅ Módulo de promos inicializado');
}

// ==================== CARGAR DATOS ====================

/**
 * Cargar promos desde Supabase
 */
export async function loadPromos() {
  console.log('🔄 Cargando promos...');
  
  const tbody = document.getElementById('promosTableBody');
  if (!tbody) return;
  
  // Mostrar loading
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <div style="width: 3rem; height: 3rem; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite;"></div>
        <p>Cargando promos...</p>
      </td>
    </tr>
  `;
  
  try {
    // Cargar promos con conteo de productos asignados
    const { data, error } = await supabase
      .from('promos')
      .select(`
        *,
        productos_promos(count)
      `)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    
    console.log(`✅ ${data.length} promos cargadas`);
    
    // Procesar datos
    promosData = data.map(promo => ({
      ...promo,
      productos_count: promo.productos_promos[0]?.count || 0
    }));
    
    renderPromosTable();
    
  } catch (error) {
    handleError(error, 'Error cargando promos');
    
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          <strong>Error cargando promos</strong>
          <p style="margin-top: 0.5rem; color: var(--text-secondary);">${error.message}</p>
          <button onclick="window.promosModule.loadPromos()" class="btn-primary" style="margin-top: 1rem; display: inline-flex; gap: 0.5rem;">
            <i class="bi bi-arrow-clockwise"></i>
            Reintentar
          </button>
        </td>
      </tr>
    `;
  }
}

/**
 * Cargar productos desde Supabase (para asignar a promos)
 */
async function loadProductos() {
  console.log('🔄 Cargando productos para asignación...');
  
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('id, nombre, precio, imagen')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    
    console.log(`✅ ${data.length} productos cargados`);
    productosData = data;
    
  } catch (error) {
    handleError(error, 'Error cargando productos');
  }
}

// ==================== RENDERIZADO ====================

/**
 * Renderizar tabla de promos
 */
function renderPromosTable() {
  const tbody = document.getElementById('promosTableBody');
  if (!tbody) return;

  if (!promosData || promosData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-tag" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No hay promos creadas</p>
          <button onclick="window.promosModule.openNewPromoModal()" class="btn-primary" style="margin-top: 1rem;">
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
    <tr style="border-bottom: 1px solid var(--border); transition: all 0.2s;" onmouseenter="this.style.background='var(--bg-main)'" onmouseleave="this.style.background='transparent'">
      <td style="padding: 1rem;">
        <div style="font-weight: 600; margin-bottom: 0.25rem;">${promo.nombre}</div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          ${promo.codigo ? `<i class="bi bi-tag-fill"></i> ${promo.codigo}` : 'Sin código'}
        </div>
      </td>
      <td style="padding: 1rem;">
        <span style="background: var(--info-light); color: var(--info); padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">
          ${tipo}
        </span>
      </td>
      <td style="padding: 1rem; text-align: center; font-weight: 600;">
        ${valor}
      </td>
      <td style="padding: 1rem; font-size: 0.85rem;">
        <div style="margin-bottom: 0.25rem;">
          <i class="bi bi-calendar-check"></i> ${formatDate(promo.fecha_inicio)}
        </div>
        <div style="color: var(--text-muted);">
          <i class="bi bi-calendar-x"></i> ${formatDate(promo.fecha_fin)}
        </div>
      </td>
      <td style="padding: 1rem; text-align: center;">
        <span style="
          padding: 0.4rem 0.75rem; 
          border-radius: 6px; 
          font-size: 0.85rem; 
          font-weight: 600;
          background: ${estado.color}20;
          color: ${estado.color};
        ">
          ${estado.icon} ${estado.label}
        </span>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">
          ${promo.productos_count} producto${promo.productos_count !== 1 ? 's' : ''}
        </div>
      </td>
      <td style="padding: 1rem; text-align: center;">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button 
            class="icon-btn" 
            onclick="window.promosModule.editPromo('${promo.id}')"
            title="Editar"
            style="background: var(--info-light); color: var(--info);"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="window.promosModule.asignarProductos('${promo.id}')"
            title="Asignar productos"
            style="background: var(--warning-light); color: var(--warning);"
          >
            <i class="bi bi-box-seam"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="window.promosModule.toggleActivoPromo('${promo.id}', ${!promo.activo})"
            title="${promo.activo ? 'Desactivar' : 'Activar'}"
            style="background: ${promo.activo ? 'var(--warning-light)' : 'var(--success-light)'}; color: ${promo.activo ? 'var(--warning)' : 'var(--success)'};"
          >
            <i class="bi bi-${promo.activo ? 'pause' : 'play'}-circle"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="window.promosModule.deletePromo('${promo.id}', '${promo.nombre.replace(/'/g, "\\'")}')"
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

// ==================== HELPERS ====================

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
      return formatPrice(valor);
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

// ==================== MODAL ====================

/**
 * Abrir modal para nueva promo
 */
export function openNewPromoModal() {
  currentPromoId = null;
  
  const modal = document.getElementById('modalPromo');
  const form = document.getElementById('formPromo');
  const title = document.getElementById('modalPromoTitle');
  
  if (!modal || !form) return;
  
  title.textContent = 'Nueva Promoción';
  form.reset();
  document.getElementById('promoId').value = '';
  document.getElementById('promoActivo').checked = true;
  
  // Fechas por defecto (hoy + 30 días)
  const hoy = new Date().toISOString().split('T')[0];
  const treintaDias = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
  document.getElementById('promoFechaInicio').value = hoy;
  document.getElementById('promoFechaFin').value = treintaDias;
  
  modal.style.display = 'flex';
}

/**
 * Cerrar modal de promo
 */
export function closePromoModal() {
  const modal = document.getElementById('modalPromo');
  if (modal) {
    modal.style.display = 'none';
    currentPromoId = null;
  }
}

/**
 * Editar promo existente
 */
export async function editPromo(id) {
  try {
    const { data, error } = await supabase
      .from('promos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentPromoId = id;
    
    const modal = document.getElementById('modalPromo');
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

    modal.style.display = 'flex';
    
  } catch (error) {
    handleError(error, 'Error al cargar promo');
  }
}

/**
 * Eliminar promo
 */
export async function deletePromo(id, nombre) {
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
    handleError(error, 'Error al eliminar promo');
  }
}

/**
 * Toggle activo/inactivo
 */
export async function toggleActivoPromo(id, nuevoEstado) {
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
    handleError(error, 'Error al cambiar estado');
  }
}

// ==================== GUARDAR ====================

/**
 * Guardar promo (crear o actualizar)
 */
export async function savePromo(e) {
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

  // Validaciones
  if (formData.fecha_inicio >= formData.fecha_fin) {
    showToast('La fecha de fin debe ser posterior a la de inicio', 'error');
    return;
  }

  try {
    if (currentPromoId) {
      // ACTUALIZAR
      const { error } = await supabase
        .from('promos')
        .update(formData)
        .eq('id', currentPromoId);

      if (error) throw error;
      
      showToast('Promo actualizada exitosamente', 'success');
      
    } else {
      // CREAR
      const { error } = await supabase
        .from('promos')
        .insert([formData]);

      if (error) throw error;
      
      showToast('Promo creada exitosamente', 'success');
    }

    closePromoModal();
    await loadPromos();
    
  } catch (error) {
    handleError(error, 'Error al guardar promo');
  }
}

// ==================== ASIGNAR PRODUCTOS ====================

/**
 * Abrir modal para asignar productos a una promo
 */
export async function asignarProductos(promoId) {
  try {
    // Cargar promo
    const { data: promo, error: promoError } = await supabase
      .from('promos')
      .select('*')
      .eq('id', promoId)
      .single();

    if (promoError) throw promoError;

    // Cargar productos ya asignados
    const { data: asignados, error: asigError } = await supabase
      .from('productos_promos')
      .select('producto_id')
      .eq('promo_id', promoId);

    if (asigError) throw asigError;

    const asignadosIds = new Set(asignados.map(a => a.producto_id));

    // Mostrar modal
    const modal = document.getElementById('modalAsignarProductos');
    const title = document.getElementById('modalAsignarTitle');
    const list = document.getElementById('productosAsignarList');

    title.textContent = `Asignar productos a "${promo.nombre}"`;

    list.innerHTML = productosData.map(p => `
      <label style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; cursor: pointer; transition: all 0.2s;">
        <input 
          type="checkbox" 
          value="${p.id}"
          ${asignadosIds.has(p.id) ? 'checked' : ''}
          style="width: 20px; height: 20px; cursor: pointer;"
        >
        <div style="flex: 1;">
          <div style="font-weight: 600;">${p.nombre}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted);">${formatPrice(p.precio)} Gs</div>
        </div>
      </label>
    `).join('');

    modal.dataset.promoId = promoId;
    modal.style.display = 'flex';

  } catch (error) {
    handleError(error, 'Error al cargar productos');
  }
}

/**
 * Guardar asignación de productos
 */
export async function saveAsignacionProductos() {
  const modal = document.getElementById('modalAsignarProductos');
  const promoId = modal.dataset.promoId;
  
  const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
  const seleccionados = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.value);

  try {
    // Eliminar asignaciones viejas
    await supabase
      .from('productos_promos')
      .delete()
      .eq('promo_id', promoId);

    // Insertar nuevas asignaciones
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
    modal.style.display = 'none';
    await loadPromos();

  } catch (error) {
    handleError(error, 'Error al asignar productos');
  }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
  // Botones del modal principal
  const btnNuevaPromo = document.getElementById('btnNuevaPromo');
  const closeModalBtn = document.getElementById('closeModalPromo');
  const btnCancelar = document.getElementById('btnCancelarPromo');
  const formPromo = document.getElementById('formPromo');
  
  if (btnNuevaPromo) {
    btnNuevaPromo.addEventListener('click', openNewPromoModal);
  }
  
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closePromoModal);
  }
  
  if (btnCancelar) {
    btnCancelar.addEventListener('click', closePromoModal);
  }
  
  if (formPromo) {
    formPromo.addEventListener('submit', savePromo);
  }

  // Modal asignar productos
  const closeAsignarBtn = document.getElementById('closeModalAsignar');
  const btnCancelarAsignar = document.getElementById('btnCancelarAsignar');
  const btnGuardarAsignar = document.getElementById('btnGuardarAsignar');

  if (closeAsignarBtn) {
    closeAsignarBtn.addEventListener('click', () => {
      document.getElementById('modalAsignarProductos').style.display = 'none';
    });
  }

  if (btnCancelarAsignar) {
    btnCancelarAsignar.addEventListener('click', () => {
      document.getElementById('modalAsignarProductos').style.display = 'none';
    });
  }

  if (btnGuardarAsignar) {
    btnGuardarAsignar.addEventListener('click', saveAsignacionProductos);
  }
}

// ==================== EXPORTAR PARA USO GLOBAL ====================
if (typeof window !== 'undefined') {
  window.promosModule = {
    initPromos,
    loadPromos,
    openNewPromoModal,
    closePromoModal,
    editPromo,
    deletePromo,
    toggleActivoPromo,
    savePromo,
    asignarProductos,
    saveAsignacionProductos
  };
}