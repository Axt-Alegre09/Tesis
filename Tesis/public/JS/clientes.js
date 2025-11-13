// JS/catering.js - VERSIÓN CORREGIDA MANTENIENDO RPC
// Panel de Administración de Catering con funciones RPC
import { supabase, requireAuth } from "./ScriptLogin.js";

/* ========= Estado Global ========= */
let allReservas = [];
let filteredReservas = [];
let currentFilter = 'all';
let selectedId = null;
let isEditMode = false;

/* ========= Elementos del DOM ========= */
const elements = {
  tableBody: document.getElementById('tableBody'),
  emptyMsg: document.getElementById('emptyMsg'),
  searchInput: document.getElementById('searchInput'),
  
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalDrawer: document.getElementById('modalDrawer'),
  drawerTitle: document.getElementById('drawerTitle'),
  mainForm: document.getElementById('mainForm'),
  
  f_nombre: document.getElementById('f_nombre'),
  f_telefono: document.getElementById('f_telefono'),
  f_email: document.getElementById('f_email'),
  f_direccion: document.getElementById('f_direccion'),
  f_tipo: document.getElementById('f_tipo'),
  f_menu: document.getElementById('f_menu'),
  f_invitados: document.getElementById('f_invitados'),
  f_fecha: document.getElementById('f_fecha'),
  f_hora: document.getElementById('f_hora'),
  f_estado: document.getElementById('f_estado'),
  statusCol: document.getElementById('statusCol'),
  
  btnNew: document.getElementById('btnNew'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnModalCancel: document.getElementById('btnModalCancel'),
  btnModalSave: document.getElementById('btnModalSave'),
  btnModalDelete: document.getElementById('btnModalDelete'),
  
  filterPills: document.querySelectorAll('.filter-pills .pill')
};

/* ========= Utilidades ========= */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('es-PY', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  } catch (e) {
    return dateStr;
  }
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
};

const formatTimeForDB = (timeStr) => {
  if (!timeStr) return null;
  if (timeStr.length === 5) return timeStr + ':00';
  return timeStr;
};

// ✅ CORRECCIÓN: Mapeo correcto de estados
const estadoDisplayMap = {
  'agendado': 'Agendado',
  'en_curso': 'En Curso', 
  'finalizado': 'Finalizado',
  'cancelado': 'Cancelado',
  // Mapeo inverso para compatibilidad
  'pendiente': 'Agendado',
  'en curso': 'En Curso'
};

const estadoClassMap = {
  'agendado': 'pending',
  'en_curso': 'in-progress',
  'finalizado': 'completed',
  'cancelado': 'cancelled',
  // Compatibilidad
  'pendiente': 'pending',
  'en curso': 'in-progress'
};

const formToDbEstado = {
  'pending': 'agendado',
  'in-progress': 'en_curso',
  'completed': 'finalizado',
  'cancelled': 'cancelado'
};

const dbToFormEstado = {
  'agendado': 'pending',
  'en_curso': 'in-progress',
  'finalizado': 'completed',
  'cancelado': 'cancelled',
  // Compatibilidad
  'pendiente': 'pending',
  'en curso': 'in-progress'
};

const getStatusText = (status) => {
  return estadoDisplayMap[status] || status || 'Agendado';
};

const getStatusClass = (status) => {
  return estadoClassMap[status] || 'pending';
};

/* ========= Toast Notifications ========= */
function showToast(message, type = 'success') {
  const toastArea = document.getElementById('toastArea');
  if (!toastArea) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s;
  `;
  
  toastArea.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ========= Verificar Cupo ========= */
async function verificarCupo(fecha) {
  try {
    const { data, error } = await supabase.rpc('verificar_cupo_catering', {
      p_fecha: fecha
    });
    
    if (error) {
      console.error('Error verificando cupo:', error);
      return { tiene_cupo: true, disponible: 999, limite: 999, usados: 0 };
    }
    
    return data || { tiene_cupo: true, disponible: 999, limite: 999, usados: 0 };
  } catch (err) {
    console.error('Error verificando cupo:', err);
    return { tiene_cupo: true, disponible: 999, limite: 999, usados: 0 };
  }
}

/* ========= Modal Functions ========= */
function openModal(mode = 'new', data = null) {
  isEditMode = mode === 'edit';
  selectedId = data?.id || null;
  
  if (elements.drawerTitle) {
    elements.drawerTitle.textContent = mode === 'new' ? 'Nueva Reserva' : 'Editar Reserva';
  }
  if (elements.btnModalSave) {
    elements.btnModalSave.textContent = mode === 'new' ? 'Agendar' : 'Guardar Cambios';
  }
  
  if (elements.statusCol) {
    elements.statusCol.style.display = mode === 'edit' ? 'block' : 'none';
  }
  if (elements.btnModalDelete) {
    elements.btnModalDelete.style.display = mode === 'edit' ? 'inline-block' : 'none';
  }
  
  if (mode === 'new') {
    if (elements.mainForm) elements.mainForm.reset();
    const today = new Date().toISOString().split('T')[0];
    if (elements.f_fecha) elements.f_fecha.value = today;
  } else if (data) {
    if (elements.f_nombre) elements.f_nombre.value = data.razonsocial || '';
    if (elements.f_telefono) elements.f_telefono.value = data.telefono || '';
    if (elements.f_email) elements.f_email.value = data.email || '';
    if (elements.f_direccion) elements.f_direccion.value = data.lugar || '';
    if (elements.f_tipo) elements.f_tipo.value = data.tipoevento || 'catering';
    if (elements.f_menu) elements.f_menu.value = data.tipocomida || '';
    if (elements.f_invitados) elements.f_invitados.value = data.invitados || '';
    if (elements.f_fecha) elements.f_fecha.value = data.fecha || '';
    if (elements.f_hora) elements.f_hora.value = formatTime(data.hora);
    if (elements.f_estado) {
      // ✅ CORRECCIÓN: Mapeo correcto de estado
      elements.f_estado.value = dbToFormEstado[data.estado] || 'pending';
    }
  }
  
  if (elements.modalBackdrop) elements.modalBackdrop.classList.add('active');
  if (elements.modalDrawer) elements.modalDrawer.classList.add('active');
}

function closeModal() {
  if (elements.modalBackdrop) elements.modalBackdrop.classList.remove('active');
  if (elements.modalDrawer) elements.modalDrawer.classList.remove('active');
  selectedId = null;
  isEditMode = false;
}

/* ========= Data Loading ========= */
async function loadReservas() {
  try {
    console.log('📥 Cargando reservas...');
    
    const { data, error } = await supabase
      .from('reservas_catering')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false });
    
    if (error) {
      console.error('Error al cargar reservas:', error);
      throw error;
    }
    
    allReservas = data || [];
    console.log(`✅ ${allReservas.length} reservas cargadas`);
    
    applyFilters();
    
  } catch (error) {
    console.error('❌ Error cargando reservas:', error);
    showToast('Error al cargar las reservas', 'error');
    allReservas = [];
    applyFilters();
  }
}

/* ========= Filters ========= */
function applyFilters() {
  const searchTerm = elements.searchInput?.value?.toLowerCase() || '';
  
  filteredReservas = allReservas.filter(reserva => {
    let matchesStatus = true;
    if (currentFilter !== 'all') {
      const status = reserva.estado;
      if (currentFilter === 'pending') {
        matchesStatus = status === 'agendado' || status === 'pendiente';
      } else if (currentFilter === 'in-progress') {
        matchesStatus = status === 'en_curso' || status === 'en curso';
      } else if (currentFilter === 'completed') {
        matchesStatus = status === 'finalizado';
      }
    }
    
    let matchesSearch = true;
    if (searchTerm) {
      matchesSearch = 
        (reserva.razonsocial?.toLowerCase().includes(searchTerm)) ||
        (reserva.telefono?.toLowerCase().includes(searchTerm)) ||
        (reserva.email?.toLowerCase().includes(searchTerm)) ||
        (reserva.lugar?.toLowerCase().includes(searchTerm));
    }
    
    return matchesStatus && matchesSearch;
  });
  
  renderTable();
  updateCounts();
}

function updateCounts() {
  const counts = {
    all: allReservas.length,
    pending: allReservas.filter(r => r.estado === 'agendado' || r.estado === 'pendiente').length,
    'in-progress': allReservas.filter(r => r.estado === 'en_curso' || r.estado === 'en curso').length,
    completed: allReservas.filter(r => r.estado === 'finalizado').length
  };
  
  elements.filterPills.forEach(pill => {
    const filter = pill.dataset.filter;
    const countEl = pill.querySelector('.count');
    if (countEl) {
      countEl.textContent = counts[filter] || 0;
    }
  });
}

/* ========= Render Table ========= */
function renderTable() {
  if (!elements.tableBody) return;
  
  if (filteredReservas.length === 0) {
    elements.tableBody.innerHTML = '';
    if (elements.emptyMsg) elements.emptyMsg.style.display = 'flex';
    return;
  }
  
  if (elements.emptyMsg) elements.emptyMsg.style.display = 'none';
  
  const rows = filteredReservas.map(reserva => {
    const row = document.createElement('tr');
    const esChatBot = reserva.ruc === 'CHAT-BOT';
    
    row.innerHTML = `
      <td>
        <div class="cell-content">
          <span class="text-main">
            ${reserva.razonsocial || 'Sin nombre'}
            ${esChatBot ? '🤖' : ''}
          </span>
          <span class="text-sub">${reserva.email || ''}</span>
        </div>
      </td>
      <td>${reserva.telefono || '-'}</td>
      <td>
        <div class="date-time">
          <span>${formatDate(reserva.fecha)}</span>
          <span class="text-sub">${formatTime(reserva.hora)}</span>
        </div>
      </td>
      <td>${reserva.invitados || '-'}</td>
      <td>
        <span class="status-badge ${getStatusClass(reserva.estado)}">
          ${getStatusText(reserva.estado)}
        </span>
      </td>
      <td class="col-actions">
        <button class="btn-action edit" data-id="${reserva.id}" title="Editar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="btn-action delete" data-id="${reserva.id}" title="Cancelar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </td>
    `;
    
    return row;
  });
  
  elements.tableBody.innerHTML = '';
  rows.forEach(row => elements.tableBody.appendChild(row));
}

/* ========= CRUD Operations ========= */
async function saveReserva() {
  try {
    // Validar campos requeridos
    const requiredFields = [
      { element: elements.f_nombre, name: 'Nombre' },
      { element: elements.f_fecha, name: 'Fecha' },
      { element: elements.f_hora, name: 'Hora' }
    ];
    
    for (const field of requiredFields) {
      if (!field.element?.value?.trim()) {
        showToast(`El campo "${field.name}" es requerido`, 'error');
        field.element?.focus();
        return;
      }
    }
    
    if (isEditMode && selectedId) {
      // ===== MODO EDICIÓN =====
      console.log('📝 Actualizando reserva ID:', selectedId);
      
      const currentReserva = allReservas.find(r => r.id === selectedId);
      
      // ✅ Preparar datos para catering_editar
      const updateData = {
        p_id: selectedId,
        p_razonsocial: elements.f_nombre.value.trim(),
        p_ruc: currentReserva?.ruc || '',
        p_tipoevento: elements.f_tipo?.value?.trim() || 'catering',
        p_fecha: elements.f_fecha.value,
        p_hora: formatTimeForDB(elements.f_hora.value),
        p_tipocomida: elements.f_menu?.value?.trim() || '',
        p_lugar: elements.f_direccion?.value?.trim() || '-',
        p_observaciones: '',
        p_invitados: elements.f_invitados?.value ? parseInt(elements.f_invitados.value) : null,
        p_telefono: elements.f_telefono?.value?.trim() || null,
        p_email: elements.f_email?.value?.trim() || null
      };
      
      console.log('📤 Datos para catering_editar:', updateData);
      
      const { data: editData, error: editError } = await supabase.rpc('catering_editar', updateData);
      
      if (editError) {
        console.error('❌ Error en catering_editar:', editError);
        showToast(editError.message || 'Error al actualizar', 'error');
        return;
      }
      
      console.log('✅ Respuesta de catering_editar:', editData);
      
      // Actualizar estado si cambió
      const newStatus = formToDbEstado[elements.f_estado.value];
      if (currentReserva && currentReserva.estado !== newStatus) {
        console.log('📊 Actualizando estado a:', newStatus);
        
        const { error: statusError } = await supabase.rpc('catering_set_estado', {
          p_id: selectedId,
          p_estado: newStatus
        });
        
        if (statusError) {
          console.error('Error en catering_set_estado:', statusError);
          showToast('Datos actualizados pero hubo problema con el estado', 'warning');
        }
      }
      
      showToast('✅ Reserva actualizada exitosamente', 'success');
      
    } else {
      // ===== MODO CREACIÓN =====
      console.log('➕ Creando nueva reserva');
      
      // Verificar cupo
      const cupoInfo = await verificarCupo(elements.f_fecha.value);
      if (!cupoInfo.tiene_cupo) {
        showToast(`No hay cupo disponible para el ${formatDate(elements.f_fecha.value)}. Límite: ${cupoInfo.limite}, Usados: ${cupoInfo.usados}`, 'error');
        return;
      }
      
      // ✅ Preparar datos para catering_agendar
      const createData = {
        p_razonsocial: elements.f_nombre.value.trim(),
        p_ruc: '',
        p_tipoevento: elements.f_tipo?.value?.trim() || 'catering',
        p_fecha: elements.f_fecha.value,
        p_hora: formatTimeForDB(elements.f_hora.value),
        p_tipocomida: elements.f_menu?.value?.trim() || '',
        p_lugar: elements.f_direccion?.value?.trim() || '-',
        p_observaciones: '',
        p_invitados: elements.f_invitados?.value ? parseInt(elements.f_invitados.value) : null,
        p_telefono: elements.f_telefono?.value?.trim() || null,
        p_email: elements.f_email?.value?.trim() || null
      };
      
      console.log('📤 Datos para catering_agendar:', createData);
      
      const { data, error } = await supabase.rpc('catering_agendar', createData);
      
      if (error) {
        console.error('❌ Error en catering_agendar:', error);
        
        if (error.message?.includes('Cupo lleno')) {
          showToast('Cupo lleno para esa fecha. Prueba otra fecha.', 'error');
        } else {
          showToast(error.message || 'Error al crear la reserva', 'error');
        }
        return;
      }
      
      console.log('✅ Respuesta de catering_agendar:', data);
      showToast('✅ Reserva creada exitosamente', 'success');
    }
    
    closeModal();
    await loadReservas();
    
  } catch (error) {
    console.error('❌ Error guardando reserva:', error);
    showToast('Error inesperado. Revisa la consola.', 'error');
  }
}

async function deleteReserva(id) {
  if (!confirm('¿Está seguro de CANCELAR esta reserva?\n\nEsto cambiará el estado a "Cancelado" y liberará el cupo.')) return;
  
  try {
    const { error } = await supabase.rpc('catering_set_estado', {
      p_id: id,
      p_estado: 'cancelado'
    });
    
    if (error) throw error;
    
    showToast('✅ Reserva cancelada exitosamente', 'success');
    closeModal();
    await loadReservas();
    
  } catch (error) {
    console.error('Error cancelando reserva:', error);
    showToast('Error al cancelar la reserva', 'error');
  }
}

/* ========= Event Listeners ========= */
elements.btnNew?.addEventListener('click', () => openModal('new'));
elements.btnCloseModal?.addEventListener('click', closeModal);
elements.btnModalCancel?.addEventListener('click', closeModal);
elements.modalBackdrop?.addEventListener('click', closeModal);

elements.mainForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveReserva();
});

elements.btnModalDelete?.addEventListener('click', async () => {
  if (selectedId) {
    await deleteReserva(selectedId);
  }
});

elements.filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    elements.filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.filter;
    applyFilters();
  });
});

elements.searchInput?.addEventListener('input', () => {
  applyFilters();
});

elements.tableBody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  
  const id = parseInt(btn.dataset.id);
  const reserva = allReservas.find(r => r.id === id);
  
  if (btn.classList.contains('edit')) {
    openModal('edit', reserva);
  } else if (btn.classList.contains('delete')) {
    await deleteReserva(id);
  }
});

elements.f_fecha?.addEventListener('change', async () => {
  const fecha = elements.f_fecha.value;
  if (!fecha) return;
  
  const cupoInfo = await verificarCupo(fecha);
  const dayOfWeek = new Date(fecha + 'T00:00:00').getDay();
  const esFinDeSemana = dayOfWeek === 0 || dayOfWeek === 6;
  
  const mensaje = `📅 ${formatDate(fecha)} ${esFinDeSemana ? '(Fin de semana)' : '(Día de semana)'}: ${cupoInfo.disponible} cupos disponibles de ${cupoInfo.limite}`;
  
  const info = document.createElement('small');
  info.style.color = cupoInfo.disponible > 0 ? 'green' : 'red';
  info.textContent = mensaje;
  
  const parent = elements.f_fecha.parentElement;
  const oldInfo = parent.querySelector('small');
  if (oldInfo) oldInfo.remove();
  parent.appendChild(info);
});

// Agregar animación CSS
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

/* ========= Inicialización ========= */
(async function init() {
  try {
    console.log('🚀 Inicializando Panel de Catering...');
    
    await requireAuth();
    await loadReservas();
    
    console.log('✅ Panel de Catering inicializado correctamente');
    
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    if (error.message?.includes('auth') || error.message?.includes('session')) {
      window.location.href = 'login.html';
    }
  }
})();