// ==================== MÓDULO CLIENTES ====================
// Gestión completa de clientes para el dashboard admin

import { supa } from './supabase-client.js';

let clientesData = [];
let clientesFiltrados = [];

// ========== INICIALIZACIÓN ==========
export async function initClientes() {
  console.log('🔵 Inicializando módulo de Clientes...');
  
  await cargarClientes();
  setupEventListeners();
  actualizarEstadisticas();
}

// ========== CARGAR CLIENTES ==========
async function cargarClientes() {
  try {
    const { data, error } = await supa
      .from('clientes_perfil')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    clientesData = data || [];
    clientesFiltrados = [...clientesData];
    
    console.log(`✅ ${clientesData.length} clientes cargados`);
    
    renderizarTablaClientes();
    cargarCiudadesFiltro();
    
  } catch (error) {
    console.error('❌ Error al cargar clientes:', error);
    mostrarError('No se pudieron cargar los clientes');
  }
}

// ========== RENDERIZAR TABLA ==========
function renderizarTablaClientes() {
  const tbody = document.getElementById('clientesTableBody');
  
  if (!tbody) {
    console.warn('⚠️ No se encontró el tbody de clientes');
    return;
  }

  if (clientesFiltrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          <p style="margin: 0;">No se encontraron clientes</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clientesFiltrados.map(cliente => {
    const fechaCreacion = new Date(cliente.created_at).toLocaleDateString('es-PY');
    const esNuevo = (Date.now() - new Date(cliente.created_at)) < 7 * 24 * 60 * 60 * 1000; // Últimos 7 días
    
    return `
      <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;" 
          onmouseover="this.style.background='var(--bg-hover)'" 
          onmouseout="this.style.background='transparent'">
        
        <!-- Cliente -->
        <td style="padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1.1rem;">
              ${cliente.razon.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight: 600; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                ${cliente.razon || 'Sin nombre'}
                ${esNuevo ? '<span style="background: var(--success); color: white; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 600;">NUEVO</span>' : ''}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                <i class="bi bi-envelope" style="margin-right: 0.25rem;"></i>
                ${cliente.mail || 'Sin email'}
              </div>
            </div>
          </div>
        </td>

        <!-- Contacto -->
        <td style="padding: 1rem;">
          <div style="font-size: 0.9rem;">
            <div style="margin-bottom: 0.3rem;">
              <i class="bi bi-telephone" style="color: var(--success); margin-right: 0.3rem;"></i>
              ${cliente.tel || 'Sin teléfono'}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              <i class="bi bi-person" style="margin-right: 0.3rem;"></i>
              ${cliente.contacto || 'Sin contacto'}
            </div>
          </div>
        </td>

        <!-- Ubicación -->
        <td style="padding: 1rem;">
          <div style="font-size: 0.9rem;">
            <div style="font-weight: 600; margin-bottom: 0.2rem;">
              <i class="bi bi-geo-alt" style="color: var(--primary); margin-right: 0.3rem;"></i>
              ${cliente.ciudad || 'Sin ciudad'}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              ${cliente.barrio || 'Sin barrio'}${cliente.depto ? `, ${cliente.depto}` : ''}
            </div>
          </div>
        </td>

        <!-- RUC -->
        <td style="padding: 1rem; text-align: center;">
          <span style="font-family: 'Courier New', monospace; background: var(--bg-secondary); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.9rem;">
            ${cliente.ruc || 'Sin RUC'}
          </span>
        </td>

        <!-- Fecha Registro -->
        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
          ${fechaCreacion}
        </td>

        <!-- Acciones -->
        <td style="padding: 1rem; text-align: center;">
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button 
              class="icon-btn" 
              onclick="window.verDetalleCliente('${cliente.id}')"
              title="Ver detalles"
              style="background: var(--primary); color: white;">
              <i class="bi bi-eye"></i>
            </button>
            <button 
              class="icon-btn" 
              onclick="window.editarCliente('${cliente.id}')"
              title="Editar cliente"
              style="background: var(--info); color: white;">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ========== ESTADÍSTICAS ==========
async function actualizarEstadisticas() {
  try {
    // Total de clientes
    const totalClientes = clientesData.length;
    document.getElementById('totalClientes').textContent = totalClientes;

    // Clientes nuevos (últimos 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const clientesNuevos = clientesData.filter(c => 
      new Date(c.created_at) > hace30Dias
    ).length;
    document.getElementById('clientesNuevos').textContent = clientesNuevos;

    // Clientes por ciudad (usando la vista v_clientes_por_ciudad)
    const { data: ciudades, error } = await supa
      .from('v_clientes_por_ciudad')
      .select('*')
      .order('cantidad_clientes', { ascending: false })
      .limit(1);

    if (!error && ciudades && ciudades.length > 0) {
      document.getElementById('ciudadTop').textContent = 
        `${ciudades[0].ciudad} (${ciudades[0].cantidad_clientes})`;
    }

    // Clientes con email válido
    const conEmail = clientesData.filter(c => 
      c.mail && c.mail !== 'sin@email.com' && c.mail.includes('@')
    ).length;
    document.getElementById('clientesConEmail').textContent = conEmail;

  } catch (error) {
    console.error('❌ Error al actualizar estadísticas:', error);
  }
}

// ========== FILTROS ==========
function cargarCiudadesFiltro() {
  const selectCiudad = document.getElementById('filterCiudad');
  if (!selectCiudad) return;

  const ciudades = [...new Set(clientesData.map(c => c.ciudad).filter(Boolean))].sort();
  
  selectCiudad.innerHTML = '<option value="">Todas las ciudades</option>' +
    ciudades.map(ciudad => `<option value="${ciudad}">${ciudad}</option>`).join('');
}

function aplicarFiltros() {
  const searchText = document.getElementById('searchClientes')?.value.toLowerCase() || '';
  const ciudadFilter = document.getElementById('filterCiudad')?.value || '';

  clientesFiltrados = clientesData.filter(cliente => {
    const matchSearch = !searchText || 
      cliente.razon?.toLowerCase().includes(searchText) ||
      cliente.mail?.toLowerCase().includes(searchText) ||
      cliente.tel?.toLowerCase().includes(searchText) ||
      cliente.ruc?.toLowerCase().includes(searchText);

    const matchCiudad = !ciudadFilter || cliente.ciudad === ciudadFilter;

    return matchSearch && matchCiudad;
  });

  renderizarTablaClientes();
  
  // Actualizar contador
  const contador = document.getElementById('contadorClientes');
  if (contador) {
    contador.textContent = `Mostrando ${clientesFiltrados.length} de ${clientesData.length} clientes`;
  }
}

// ========== VER DETALLE CLIENTE ==========
window.verDetalleCliente = function(clienteId) {
  const cliente = clientesData.find(c => c.id === clienteId);
  if (!cliente) return;

  const modal = document.getElementById('modalDetalleCliente');
  if (!modal) return;

  // Llenar datos del modal
  document.getElementById('detalleRazon').textContent = cliente.razon || 'Sin nombre';
  document.getElementById('detalleRuc').textContent = cliente.ruc || 'Sin RUC';
  document.getElementById('detalleTel').textContent = cliente.tel || 'Sin teléfono';
  document.getElementById('detalleMail').textContent = cliente.mail || 'Sin email';
  document.getElementById('detalleContacto').textContent = cliente.contacto || 'Sin contacto';
  
  // Dirección completa
  const direccionCompleta = [
    cliente.calle1,
    cliente.nro ? `N° ${cliente.nro}` : '',
    cliente.calle2 ? `esq. ${cliente.calle2}` : '',
    cliente.barrio,
    cliente.ciudad,
    cliente.depto
  ].filter(Boolean).join(', ');
  
  document.getElementById('detalleDireccion').textContent = direccionCompleta || 'Sin dirección';
  document.getElementById('detallePostal').textContent = cliente.postal || 'Sin código postal';
  
  // Fechas
  document.getElementById('detalleFechaCreacion').textContent = 
    new Date(cliente.created_at).toLocaleString('es-PY');
  document.getElementById('detalleFechaActualizacion').textContent = 
    new Date(cliente.updated_at).toLocaleString('es-PY');

  modal.style.display = 'flex';
};

// ========== EDITAR CLIENTE ==========
window.editarCliente = function(clienteId) {
  const cliente = clientesData.find(c => c.id === clienteId);
  if (!cliente) return;

  const modal = document.getElementById('modalEditarCliente');
  if (!modal) return;

  // Llenar formulario
  document.getElementById('editClienteId').value = cliente.id;
  document.getElementById('editRazon').value = cliente.razon || '';
  document.getElementById('editRuc').value = cliente.ruc || '';
  document.getElementById('editTel').value = cliente.tel || '';
  document.getElementById('editMail').value = cliente.mail || '';
  document.getElementById('editContacto').value = cliente.contacto || '';
  document.getElementById('editCalle1').value = cliente.calle1 || '';
  document.getElementById('editCalle2').value = cliente.calle2 || '';
  document.getElementById('editNro').value = cliente.nro || '';
  document.getElementById('editBarrio').value = cliente.barrio || '';
  document.getElementById('editCiudad').value = cliente.ciudad || '';
  document.getElementById('editDepto').value = cliente.depto || '';
  document.getElementById('editPostal').value = cliente.postal || '';

  modal.style.display = 'flex';
};

// ========== GUARDAR CAMBIOS CLIENTE ==========
async function guardarCambiosCliente(e) {
  e.preventDefault();

  const clienteId = document.getElementById('editClienteId').value;
  const btnGuardar = e.target.querySelector('button[type="submit"]');
  
  btnGuardar.disabled = true;
  btnGuardar.innerHTML = '<i class="bi bi-hourglass-split"></i> Guardando...';

  try {
    const datosActualizados = {
      razon: document.getElementById('editRazon').value,
      ruc: document.getElementById('editRuc').value,
      tel: document.getElementById('editTel').value,
      mail: document.getElementById('editMail').value,
      contacto: document.getElementById('editContacto').value,
      calle1: document.getElementById('editCalle1').value,
      calle2: document.getElementById('editCalle2').value,
      nro: document.getElementById('editNro').value,
      barrio: document.getElementById('editBarrio').value,
      ciudad: document.getElementById('editCiudad').value,
      depto: document.getElementById('editDepto').value,
      postal: document.getElementById('editPostal').value,
      updated_at: new Date().toISOString()
    };

    const { error } = await supa
      .from('clientes_perfil')
      .update(datosActualizados)
      .eq('id', clienteId);

    if (error) throw error;

    mostrarExito('✅ Cliente actualizado correctamente');
    document.getElementById('modalEditarCliente').style.display = 'none';
    await cargarClientes();

  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
    mostrarError('No se pudo actualizar el cliente');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<i class="bi bi-check-lg"></i> Guardar Cambios';
  }
}

// ========== EXPORTAR CLIENTES ==========
function exportarClientes() {
  const csv = [
    ['Razón Social', 'RUC', 'Teléfono', 'Email', 'Ciudad', 'Barrio', 'Fecha Registro'],
    ...clientesFiltrados.map(c => [
      c.razon || '',
      c.ruc || '',
      c.tel || '',
      c.mail || '',
      c.ciudad || '',
      c.barrio || '',
      new Date(c.created_at).toLocaleDateString('es-PY')
    ])
  ].map(row => row.join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `clientes_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // Búsqueda
  const searchInput = document.getElementById('searchClientes');
  searchInput?.addEventListener('input', aplicarFiltros);

  // Filtro ciudad
  const filterCiudad = document.getElementById('filterCiudad');
  filterCiudad?.addEventListener('change', aplicarFiltros);

  // Cerrar modales
  document.getElementById('closeModalDetalle')?.addEventListener('click', () => {
    document.getElementById('modalDetalleCliente').style.display = 'none';
  });

  document.getElementById('closeModalEditar')?.addEventListener('click', () => {
    document.getElementById('modalEditarCliente').style.display = 'none';
  });

  document.getElementById('btnCancelarEditar')?.addEventListener('click', () => {
    document.getElementById('modalEditarCliente').style.display = 'none';
  });

  // Formulario editar
  document.getElementById('formEditarCliente')?.addEventListener('submit', guardarCambiosCliente);

  // Exportar
  document.getElementById('btnExportarClientes')?.addEventListener('click', exportarClientes);

  // Cerrar modal al hacer clic fuera
  window.addEventListener('click', (e) => {
    const modalDetalle = document.getElementById('modalDetalleCliente');
    const modalEditar = document.getElementById('modalEditarCliente');
    
    if (e.target === modalDetalle) modalDetalle.style.display = 'none';
    if (e.target === modalEditar) modalEditar.style.display = 'none';
  });
}

// ========== UTILIDADES ==========
function mostrarExito(mensaje) {
  alert(mensaje); // Puedes implementar un toast más elegante
}

function mostrarError(mensaje) {
  alert('❌ ' + mensaje);
}

console.log('📦 Módulo de Clientes cargado');
