// ==================== MÓDULO CLIENTES - VERSIÓN CORREGIDA BASADA EN PROYECTO VIEJO ====================
// ✅ Enfoque probado: onclick inline + window.module
// ✅ Misma estructura que productos.js que SÍ funciona

import { supabase } from './modules/supabase-config.js';

// ==================== ESTADO ====================
let clientesData = [];
let clientesFiltrados = [];

// ==================== INICIALIZACIÓN ====================

/**
 * Inicializar el módulo de clientes
 */
export async function initClientes() {
  console.log('🔄 Inicializando módulo de clientes...');
  
  // Actualizar el HTML con la tabla completa
  updateClientesView();
  
  // Cargar datos
  await cargarClientes();
  
  // Setup event listeners
  setupEventListeners();
  
  // Actualizar estadísticas
  actualizarEstadisticas();
  
  console.log('✅ Módulo de clientes inicializado');
}

// ==================== ACTUALIZAR VISTA HTML ====================
function updateClientesView() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;
  
  // Verificar si estamos en la vista de clientes
  const pageTitle = document.getElementById('pageTitle');
  if (pageTitle?.textContent !== 'Clientes') return;
  
  // Agregar la tabla completa después de las estadísticas
  const estadisticasContainer = contentArea.querySelector('.grid-4');
  if (!estadisticasContainer) return;
  
  // Crear contenedor de tabla si no existe
  let tableContainer = document.getElementById('clientesTableContainer');
  if (!tableContainer) {
    tableContainer = document.createElement('div');
    tableContainer.id = 'clientesTableContainer';
    tableContainer.innerHTML = `
      <!-- Filtros -->
      <div class="card" style="margin-bottom: 1.5rem;">
        <div style="display: grid; grid-template-columns: 1fr 200px auto; gap: 1rem; align-items: center;">
          <div style="position: relative;">
            <i class="bi bi-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
            <input 
              type="search" 
              id="searchClientes" 
              placeholder="Buscar por nombre, email, teléfono o RUC..." 
              style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;"
            >
          </div>
          <select id="filterCiudad" style="padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
            <option value="">Todas las ciudades</option>
          </select>
          <button id="btnRefreshClientes" class="icon-btn" style="background: var(--primary); color: white;" title="Actualizar">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      <!-- Tabla de Clientes -->
      <div class="card">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid var(--border);">
                <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Cliente</th>
                <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Contacto</th>
                <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Ubicación</th>
                <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">RUC</th>
                <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Registro</th>
                <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Acciones</th>
              </tr>
            </thead>
            <tbody id="clientesTableBody">
              <tr>
                <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                  <div class="spinner"></div>
                  <p style="margin-top: 1rem;">Cargando clientes...</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    estadisticasContainer.insertAdjacentElement('afterend', tableContainer);
  }
  
  // Crear modales si no existen
  createModals();
}

// ==================== CREAR MODALES ====================
function createModals() {
  // Modal de detalle
  if (!document.getElementById('modalDetalleCliente')) {
    const modalDetalle = document.createElement('div');
    modalDetalle.innerHTML = `
      <div id="modalDetalleCliente" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Detalle del Cliente</h2>
            <button id="closeModalDetalle" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          <div style="padding: 1.5rem;">
            <div style="display: grid; gap: 1.5rem;">
              <div>
                <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--primary);">
                  <i class="bi bi-person-circle"></i> Información General
                </h3>
                <div style="display: grid; gap: 0.75rem; padding-left: 1.5rem;">
                  <div><strong>Razón Social:</strong> <span id="detalleRazon"></span></div>
                  <div><strong>RUC:</strong> <span id="detalleRuc"></span></div>
                  <div><strong>Teléfono:</strong> <span id="detalleTel"></span></div>
                  <div><strong>Email:</strong> <span id="detalleMail"></span></div>
                  <div><strong>Contacto:</strong> <span id="detalleContacto"></span></div>
                </div>
              </div>
              
              <div>
                <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--primary);">
                  <i class="bi bi-geo-alt"></i> Dirección
                </h3>
                <div style="display: grid; gap: 0.75rem; padding-left: 1.5rem;">
                  <div><strong>Dirección:</strong> <span id="detalleDireccion"></span></div>
                  <div><strong>Código Postal:</strong> <span id="detallePostal"></span></div>
                </div>
              </div>
              
              <div>
                <h3 style="font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--primary);">
                  <i class="bi bi-clock"></i> Fechas
                </h3>
                <div style="display: grid; gap: 0.75rem; padding-left: 1.5rem;">
                  <div><strong>Registrado:</strong> <span id="detalleFechaCreacion"></span></div>
                  <div><strong>Última actualización:</strong> <span id="detalleFechaActualizacion"></span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalDetalle);
  }
  
  // Modal de edición
  if (!document.getElementById('modalEditarCliente')) {
    const modalEditar = document.createElement('div');
    modalEditar.innerHTML = `
      <div id="modalEditarCliente" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 9999; align-items: center; justify-content: center;">
        <div class="modal-content" style="background: white; border-radius: 16px; width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
          <div class="modal-header" style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0; font-size: 1.5rem; font-weight: 700;">Editar Cliente</h2>
            <button id="closeModalEditar" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-secondary);">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
          
          <form id="formEditarCliente" style="padding: 1.5rem;">
            <input type="hidden" id="editClienteId">
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Razón Social</label>
                <input type="text" id="editRazon" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">RUC</label>
                <input type="text" id="editRuc" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Teléfono</label>
                <input type="text" id="editTel" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Email</label>
                <input type="email" id="editMail" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
              <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Contacto</label>
              <input type="text" id="editContacto" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
            </div>
            
            <h3 style="font-size: 1.1rem; margin-bottom: 1rem; color: var(--primary);">Dirección</h3>
            
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Calle Principal</label>
                <input type="text" id="editCalle1" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Número</label>
                <input type="text" id="editNro" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Barrio</label>
                <input type="text" id="editBarrio" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Ciudad</label>
                <input type="text" id="editCiudad" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              <div>
                <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Código Postal</label>
                <input type="text" id="editPostal" style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
            </div>
            
            <div style="display: flex; gap: 1rem; justify-content: flex-end;">
              <button type="button" id="btnCancelarEditar" style="padding: 0.75rem 1.5rem; border: 1px solid var(--border); background: white; border-radius: 8px; font-weight: 600; cursor: pointer;">
                Cancelar
              </button>
              <button type="submit" style="padding: 0.75rem 1.5rem; background: var(--primary); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                <i class="bi bi-check-lg"></i> Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.appendChild(modalEditar);
  }
}

// ==================== CARGAR CLIENTES ====================
async function cargarClientes() {
  console.log('🔄 Cargando clientes...');
  
  const tbody = document.getElementById('clientesTableBody');
  if (!tbody) return;
  
  // Mostrar loading
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <div style="width: 3rem; height: 3rem; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite;"></div>
        <p>Cargando clientes...</p>
      </td>
    </tr>
  `;
  
  try {
    const { data, error } = await supabase
      .from('clientes_perfil')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    clientesData = data || [];
    clientesFiltrados = [...clientesData];
    
    console.log(`✅ ${clientesData.length} clientes cargados`);
    
    renderizarTablaClientes();
    cargarCiudadesFiltro();
    actualizarContador();
    
  } catch (error) {
    console.error('❌ Error al cargar clientes:', error);
    
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="padding: 2rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          <strong>Error cargando clientes</strong>
          <p style="margin-top: 0.5rem; color: var(--text-secondary);">${error.message}</p>
          <button onclick="window.clientesModule.cargarClientes()" class="btn-primary" style="margin-top: 1rem;">
            <i class="bi bi-arrow-clockwise"></i>
            Reintentar
          </button>
        </td>
      </tr>
    `;
  }
}

// ==================== RENDERIZAR TABLA ====================
// ✅ ENFOQUE PROYECTO VIEJO: onclick inline
function renderizarTablaClientes(filteredData = null) {
  const tbody = document.getElementById('clientesTableBody');
  if (!tbody) return;
  
  const data = filteredData || clientesFiltrados;
  
  if (!data || data.length === 0) {
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

  tbody.innerHTML = data.map(cliente => {
    const fechaCreacion = new Date(cliente.created_at).toLocaleDateString('es-PY');
    const esNuevo = (Date.now() - new Date(cliente.created_at)) < 7 * 24 * 60 * 60 * 1000;
    
    // ✅ Escapar comillas para onclick
    const nombreEscapado = (cliente.razon || 'Sin nombre').replace(/'/g, "\\'");
    
    return `
      <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;" 
          onmouseover="this.style.background='rgba(111,92,56,0.02)'" 
          onmouseout="this.style.background='transparent'">
        
        <td style="padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #8b7355); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700;">
              ${(cliente.razon || 'S').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight: 600; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                ${cliente.razon || 'Sin nombre'}
                ${esNuevo ? '<span style="background: var(--success); color: white; font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px;">NUEVO</span>' : ''}
              </div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                ${cliente.mail || 'Sin email'}
              </div>
            </div>
          </div>
        </td>

        <td style="padding: 1rem;">
          <div style="font-size: 0.9rem;">
            <div style="margin-bottom: 0.3rem;">
              <i class="bi bi-telephone" style="color: var(--success); margin-right: 0.3rem;"></i>
              ${cliente.tel || 'Sin teléfono'}
            </div>
            ${cliente.contacto ? `
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                <i class="bi bi-person" style="margin-right: 0.3rem;"></i>
                ${cliente.contacto}
              </div>
            ` : ''}
          </div>
        </td>

        <td style="padding: 1rem;">
          <div style="font-size: 0.9rem;">
            <div style="font-weight: 500; margin-bottom: 0.2rem;">
              <i class="bi bi-geo-alt" style="color: var(--primary); margin-right: 0.3rem;"></i>
              ${cliente.ciudad || 'Sin ciudad'}
            </div>
            ${cliente.barrio ? `
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                ${cliente.barrio}${cliente.depto ? `, ${cliente.depto}` : ''}
              </div>
            ` : ''}
          </div>
        </td>

        <td style="padding: 1rem; text-align: center;">
          <span style="font-family: 'Courier New', monospace; background: var(--bg-main); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.9rem;">
            ${cliente.ruc || 'Sin RUC'}
          </span>
        </td>

        <td style="padding: 1rem; text-align: center; color: var(--text-secondary); font-size: 0.9rem;">
          ${fechaCreacion}
        </td>

        <td style="padding: 1rem; text-align: center;">
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button 
              onclick="window.clientesModule.verDetalleCliente('${cliente.id}')"
              class="icon-btn" 
              title="Ver detalles"
              style="background: var(--primary); color: white;">
              <i class="bi bi-eye"></i>
            </button>
            <button 
              onclick="window.clientesModule.editarCliente('${cliente.id}')"
              class="icon-btn" 
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

// ==================== ESTADÍSTICAS ====================
async function actualizarEstadisticas() {
  try {
    const totalClientes = clientesData.length;
    const totalElem = document.getElementById('totalClientes');
    if (totalElem) totalElem.textContent = totalClientes;

    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);
    const clientesNuevos = clientesData.filter(c => 
      new Date(c.created_at) > hace30Dias
    ).length;
    const nuevosElem = document.getElementById('clientesNuevos');
    if (nuevosElem) nuevosElem.textContent = clientesNuevos;

    // Ciudad principal
    const ciudades = {};
    clientesData.forEach(c => {
      if (c.ciudad) {
        ciudades[c.ciudad] = (ciudades[c.ciudad] || 0) + 1;
      }
    });
    
    const ciudadTop = Object.entries(ciudades).sort((a, b) => b[1] - a[1])[0];
    const ciudadElem = document.getElementById('ciudadTop');
    if (ciudadElem && ciudadTop) {
      ciudadElem.textContent = `${ciudadTop[0]} (${ciudadTop[1]})`;
    }

    const conEmail = clientesData.filter(c => 
      c.mail && c.mail !== 'sin@email.com' && c.mail.includes('@')
    ).length;
    const emailElem = document.getElementById('clientesConEmail');
    if (emailElem) emailElem.textContent = conEmail;
    
  } catch (error) {
    console.error('❌ Error al actualizar estadísticas:', error);
  }
}

// ==================== FILTROS ====================
function cargarCiudadesFiltro() {
  const selectCiudad = document.getElementById('filterCiudad');
  if (!selectCiudad) return;
  
  const ciudades = [...new Set(clientesData.map(c => c.ciudad).filter(Boolean))].sort();
  
  selectCiudad.innerHTML = '<option value="">Todas las ciudades</option>' +
    ciudades.map(ciudad => `<option value="${ciudad}">${ciudad}</option>`).join('');
}

export function aplicarFiltros() {
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
  actualizarContador();
}

function actualizarContador() {
  const contador = document.getElementById('contadorClientes');
  if (contador) {
    contador.textContent = `Mostrando ${clientesFiltrados.length} de ${clientesData.length} clientes`;
  }
}

// ==================== MODALES ====================

/**
 * Ver detalle de cliente
 * @param {string} clienteId - ID del cliente
 */
export function verDetalleCliente(clienteId) {
  console.log('👁️ Viendo detalle del cliente:', clienteId);
  
  const cliente = clientesData.find(c => c.id === clienteId);
  if (!cliente) return;
  
  const modal = document.getElementById('modalDetalleCliente');
  if (!modal) return;
  
  document.getElementById('detalleRazon').textContent = cliente.razon || 'Sin nombre';
  document.getElementById('detalleRuc').textContent = cliente.ruc || 'Sin RUC';
  document.getElementById('detalleTel').textContent = cliente.tel || 'Sin teléfono';
  document.getElementById('detalleMail').textContent = cliente.mail || 'Sin email';
  document.getElementById('detalleContacto').textContent = cliente.contacto || 'Sin contacto';
  
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
  
  document.getElementById('detalleFechaCreacion').textContent = 
    new Date(cliente.created_at).toLocaleString('es-PY');
  document.getElementById('detalleFechaActualizacion').textContent = 
    new Date(cliente.updated_at).toLocaleString('es-PY');
  
  modal.style.display = 'flex';
  console.log('✅ Modal de detalle abierto');
}

/**
 * Editar cliente
 * @param {string} clienteId - ID del cliente
 */
export function editarCliente(clienteId) {
  console.log('✏️ Editando cliente:', clienteId);
  
  const cliente = clientesData.find(c => c.id === clienteId);
  if (!cliente) return;
  
  const modal = document.getElementById('modalEditarCliente');
  if (!modal) return;
  
  document.getElementById('editClienteId').value = cliente.id;
  document.getElementById('editRazon').value = cliente.razon || '';
  document.getElementById('editRuc').value = cliente.ruc || '';
  document.getElementById('editTel').value = cliente.tel || '';
  document.getElementById('editMail').value = cliente.mail || '';
  document.getElementById('editContacto').value = cliente.contacto || '';
  document.getElementById('editCalle1').value = cliente.calle1 || '';
  document.getElementById('editNro').value = cliente.nro || '';
  document.getElementById('editBarrio').value = cliente.barrio || '';
  document.getElementById('editCiudad').value = cliente.ciudad || '';
  document.getElementById('editPostal').value = cliente.postal || '';
  
  modal.style.display = 'flex';
  console.log('✅ Modal de edición abierto');
}

/**
 * Guardar cambios de cliente
 * @param {Event} e - Evento del formulario
 */
async function guardarCambiosCliente(e) {
  e.preventDefault();
  
  const clienteId = document.getElementById('editClienteId').value;
  const btnGuardar = e.target.querySelector('button[type="submit"]');
  
  console.log('💾 Guardando cambios del cliente:', clienteId);
  
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
      nro: document.getElementById('editNro').value,
      barrio: document.getElementById('editBarrio').value,
      ciudad: document.getElementById('editCiudad').value,
      postal: document.getElementById('editPostal').value,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('clientes_perfil')
      .update(datosActualizados)
      .eq('id', clienteId);

    if (error) throw error;

    showToast('✅ Cliente actualizado correctamente');
    document.getElementById('modalEditarCliente').style.display = 'none';
    await cargarClientes();
    
    console.log('✅ Cliente actualizado exitosamente');
    
  } catch (error) {
    console.error('❌ Error al actualizar cliente:', error);
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    btnGuardar.disabled = false;
    btnGuardar.innerHTML = '<i class="bi bi-check-lg"></i> Guardar Cambios';
  }
}

// ==================== EXPORTAR CSV ====================
export function exportarClientes() {
  console.log('📥 Exportando clientes a CSV');
  
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
  
  console.log('✅ CSV descargado');
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
  console.log('🎧 Configurando event listeners de clientes...');
  
  // Búsqueda
  const searchInput = document.getElementById('searchClientes');
  if (searchInput) {
    searchInput.addEventListener('input', aplicarFiltros);
    console.log('✅ Listener de búsqueda configurado');
  }
  
  // Filtro ciudad
  const filterSelect = document.getElementById('filterCiudad');
  if (filterSelect) {
    filterSelect.addEventListener('change', aplicarFiltros);
    console.log('✅ Listener de filtro configurado');
  }
  
  // Botón refresh
  const btnRefresh = document.getElementById('btnRefreshClientes');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', cargarClientes);
    console.log('✅ Listener de refresh configurado');
  }
  
  // Cerrar modales
  const closeModalDetalle = document.getElementById('closeModalDetalle');
  if (closeModalDetalle) {
    closeModalDetalle.addEventListener('click', () => {
      document.getElementById('modalDetalleCliente').style.display = 'none';
    });
  }
  
  const closeModalEditar = document.getElementById('closeModalEditar');
  if (closeModalEditar) {
    closeModalEditar.addEventListener('click', () => {
      document.getElementById('modalEditarCliente').style.display = 'none';
    });
  }
  
  const btnCancelarEditar = document.getElementById('btnCancelarEditar');
  if (btnCancelarEditar) {
    btnCancelarEditar.addEventListener('click', () => {
      document.getElementById('modalEditarCliente').style.display = 'none';
    });
  }
  
  // Formulario editar
  const formEditar = document.getElementById('formEditarCliente');
  if (formEditar) {
    formEditar.addEventListener('submit', guardarCambiosCliente);
    console.log('✅ Listener de formulario configurado');
  }
  
  // Exportar
  const btnExportar = document.getElementById('btnExportarClientes');
  if (btnExportar) {
    btnExportar.addEventListener('click', exportarClientes);
    console.log('✅ Listener de exportar configurado');
  }
  
  // Cerrar modal al hacer clic fuera
  window.addEventListener('click', (e) => {
    const modalDetalle = document.getElementById('modalDetalleCliente');
    const modalEditar = document.getElementById('modalEditarCliente');
    
    if (e.target === modalDetalle) modalDetalle.style.display = 'none';
    if (e.target === modalEditar) modalEditar.style.display = 'none';
  });
}

function showToast(mensaje, tipo = 'success') {
  alert(mensaje); // Puedes implementar un toast más elegante
}

// ==================== EXPORTAR PARA USO GLOBAL ====================
// ✅ CRÍTICO: Hacer las funciones disponibles globalmente para onclick handlers
if (typeof window !== 'undefined') {
  window.clientesModule = {
    initClientes,
    cargarClientes,
    aplicarFiltros,
    verDetalleCliente,
    editarCliente,
    exportarClientes
  };
  console.log('✅ Módulo clientes exportado a window.clientesModule');
}


console.log('📦 Módulo de Clientes cargado (versión corregida basada en proyecto viejo)');
