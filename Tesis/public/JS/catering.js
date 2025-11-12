// JS/catering.js
// Panel de Reservas de Catering con tabla
import { supabase, requireAuth } from "./ScriptLogin.js";

/* ========= Estado Global ========= */
let allReservas = [];
let filteredReservas = [];
let currentFilter = 'all';
let selectedId = null;
let isEditMode = false;

/* ========= Elementos del DOM ========= */
const elements = {
  // Tabla y contenedores
  tableBody: document.getElementById('tableBody'),
  emptyMsg: document.getElementById('emptyMsg'),
  searchInput: document.getElementById('searchInput'),
  
  // Modal
  modalBackdrop: document.getElementById('modalBackdrop'),
  modalDrawer: document.getElementById('modalDrawer'),
  drawerTitle: document.getElementById('drawerTitle'),
  mainForm: document.getElementById('mainForm'),
  
  // Campos del formulario
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
  
  // Botones
  btnNew: document.getElementById('btnNew'),
  btnCloseModal: document.getElementById('btnCloseModal'),
  btnModalCancel: document.getElementById('btnModalCancel'),
  btnModalSave: document.getElementById('btnModalSave'),
  btnModalDelete: document.getElementById('btnModalDelete'),
  
  // Pills de filtro
  filterPills: document.querySelectorAll('.filter-pills .pill')
};

/* ========= Utilidades ========= */
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('es-PY', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.slice(0, 5);
};

const getStatusText = (status) => {
  const statusMap = {
    'pending': 'Pendiente',
    'pendiente': 'Pendiente',
    'in-progress': 'En Curso',
    'en_curso': 'En Curso',
    'completed': 'Finalizado',
    'finalizado': 'Finalizado',
    'cancelado': 'Cancelado'
  };
  return statusMap[status] || status;
};

const getStatusClass = (status) => {
  const classMap = {
    'pending': 'pending',
    'pendiente': 'pending',
    'in-progress': 'in-progress',
    'en_curso': 'in-progress',
    'completed': 'completed',
    'finalizado': 'completed',
    'cancelado': 'cancelled'
  };
  return classMap[status] || 'pending';
};

const normalizeStatus = (status) => {
  const statusMap = {
    'pendiente': 'pending',
    'en_curso': 'in-progress',
    'finalizado': 'completed',
    'cancelado': 'cancelled'
  };
  return statusMap[status] || status;
};

/* ========= Toast Notifications ========= */
function showToast(message, type = 'success') {
  const toastArea = document.getElementById('toastArea');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  toastArea.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ========= Modal Functions ========= */
function openModal(mode = 'new', data = null) {
  isEditMode = mode === 'edit';
  selectedId = data?.id || null;
  
  // Configurar título y botones
  elements.drawerTitle.textContent = mode === 'new' ? 'Nueva Reserva' : 'Editar Reserva';
  elements.btnModalSave.textContent = mode === 'new' ? 'Agendar' : 'Guardar';
  
  // Mostrar/ocultar columna de estado y botón eliminar
  if (mode === 'edit') {
    elements.statusCol.style.display = 'block';
    elements.btnModalDelete.style.display = 'inline-block';
  } else {
    elements.statusCol.style.display = 'none';
    elements.btnModalDelete.style.display = 'none';
  }
  
  // Limpiar o llenar formulario
  if (mode === 'new') {
    elements.mainForm.reset();
  } else if (data) {
    elements.f_nombre.value = data.razonsocial || '';
    elements.f_telefono.value = data.telefono || '';
    elements.f_email.value = data.email || '';
    elements.f_direccion.value = data.lugar || '';
    elements.f_tipo.value = data.tipoevento || 'Catering';
    elements.f_menu.value = data.tipocomida || '';
    elements.f_invitados.value = data.invitados || '';
    elements.f_fecha.value = data.fecha || '';
    elements.f_hora.value = formatTime(data.hora);
    elements.f_estado.value = normalizeStatus(data.estado);
  }
  
  // Mostrar modal
  elements.modalBackdrop.classList.add('active');
  elements.modalDrawer.classList.add('active');
}

function closeModal() {
  elements.modalBackdrop.classList.remove('active');
  elements.modalDrawer.classList.remove('active');
  selectedId = null;
  isEditMode = false;
}

/* ========= Data Loading ========= */
async function loadReservas() {
  try {
    const { data, error } = await supabase
      .from('reservas_catering')
      .select('*')
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false });
    
    if (error) throw error;
    
    allReservas = data || [];
    applyFilters();
    
  } catch (error) {
    console.error('Error cargando reservas:', error);
    showToast('Error al cargar las reservas', 'error');
  }
}

/* ========= Filters ========= */
function applyFilters() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  
  filteredReservas = allReservas.filter(reserva => {
    // Filtro por estado
    let matchesStatus = true;
    if (currentFilter !== 'all') {
      const status = normalizeStatus(reserva.estado);
      if (currentFilter === 'pending') matchesStatus = status === 'pending';
      else if (currentFilter === 'in-progress') matchesStatus = status === 'in-progress';
      else if (currentFilter === 'completed') matchesStatus = status === 'completed';
    }
    
    // Filtro por búsqueda
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
    pending: allReservas.filter(r => normalizeStatus(r.estado) === 'pending').length,
    'in-progress': allReservas.filter(r => normalizeStatus(r.estado) === 'in-progress').length,
    completed: allReservas.filter(r => normalizeStatus(r.estado) === 'completed').length
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
  if (filteredReservas.length === 0) {
    elements.tableBody.innerHTML = '';
    elements.emptyMsg.style.display = 'flex';
    return;
  }
  
  elements.emptyMsg.style.display = 'none';
  
  const rows = filteredReservas.map(reserva => {
    const row = document.createElement('tr');
    
    row.innerHTML = `
      <td>
        <div class="cell-content">
          <span class="text-main">${reserva.razonsocial || 'Sin nombre'}</span>
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
        <button class="btn-action delete" data-id="${reserva.id}" title="Eliminar">
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
    const formData = {
      p_razonsocial: elements.f_nombre.value.trim(),
      p_telefono: elements.f_telefono.value.trim(),
      p_email: elements.f_email.value.trim(),
      p_lugar: elements.f_direccion.value.trim(),
      p_tipoevento: elements.f_tipo.value.trim() || 'Catering',
      p_tipocomida: elements.f_menu.value.trim(),
      p_invitados: parseInt(elements.f_invitados.value) || null,
      p_fecha: elements.f_fecha.value,
      p_hora: elements.f_hora.value,
      p_ruc: '',
      p_observaciones: ''
    };
    
    let result;
    
    if (isEditMode && selectedId) {
      // Actualizar reserva existente
      formData.p_id = selectedId;
      
      // Actualizar estado si es modo edición
      const estadoMap = {
        'pending': 'pendiente',
        'in-progress': 'en_curso',
        'completed': 'finalizado'
      };
      
      // Primero actualizar los datos
      const { data: editData, error: editError } = await supabase.rpc('catering_editar', formData);
      if (editError) throw editError;
      
      // Luego actualizar el estado si cambió
      const newEstado = estadoMap[elements.f_estado.value];
      if (newEstado) {
        const { data: statusData, error: statusError } = await supabase.rpc('catering_set_estado', {
          p_id: selectedId,
          p_estado: newEstado
        });
        if (statusError) throw statusError;
        result = statusData;
      } else {
        result = editData;
      }
      
      showToast('Reserva actualizada exitosamente');
    } else {
      // Crear nueva reserva
      const { data, error } = await supabase.rpc('catering_agendar', formData);
      if (error) throw error;
      result = data;
      showToast('Reserva creada exitosamente');
    }
    
    closeModal();
    await loadReservas();
    
  } catch (error) {
    console.error('Error guardando reserva:', error);
    showToast(error.message || 'Error al guardar la reserva', 'error');
  }
}

async function deleteReserva(id) {
  if (!confirm('¿Está seguro de eliminar esta reserva?')) return;
  
  try {
    // Intentar cancelar en lugar de eliminar físicamente
    const { error } = await supabase.rpc('catering_set_estado', {
      p_id: id,
      p_estado: 'cancelado'
    });
    
    if (error) throw error;
    
    showToast('Reserva eliminada exitosamente');
    closeModal();
    await loadReservas();
    
  } catch (error) {
    console.error('Error eliminando reserva:', error);
    showToast('Error al eliminar la reserva', 'error');
  }
}

/* ========= Event Listeners ========= */
// Botón nueva reserva
elements.btnNew?.addEventListener('click', () => openModal('new'));

// Cerrar modal
elements.btnCloseModal?.addEventListener('click', closeModal);
elements.btnModalCancel?.addEventListener('click', closeModal);
elements.modalBackdrop?.addEventListener('click', closeModal);

// Guardar reserva
elements.mainForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await saveReserva();
});

// Eliminar desde modal
elements.btnModalDelete?.addEventListener('click', async () => {
  if (selectedId) {
    await deleteReserva(selectedId);
  }
});

// Filtros
elements.filterPills.forEach(pill => {
  pill.addEventListener('click', () => {
    elements.filterPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    currentFilter = pill.dataset.filter;
    applyFilters();
  });
});

// Búsqueda
elements.searchInput?.addEventListener('input', () => {
  applyFilters();
});

// Delegación de eventos para botones de la tabla
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

// Prevenir envío del formulario con Enter en campos que no sean el submit
elements.mainForm?.addEventListener('keypress', (e) => {
  if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') {
    e.preventDefault();
  }
});

/* ========= Inicialización ========= */
(async function init() {
  try {
    console.log('🚀 Inicializando Panel de Catering...');
    
    // Verificar autenticación
    await requireAuth();
    
    // Cargar datos iniciales
    await loadReservas();
    
    console.log('✅ Panel de Catering inicializado correctamente');
    
  } catch (error) {
    console.error('❌ Error al inicializar:', error);
    // Redirigir al login si no está autenticado
    if (error.message?.includes('auth')) {
      window.location.href = 'login.html';
    }
  }
})();