// ==================== MÓDULO DE CONFIGURACIÓN - VERSIÓN FINAL ====================
// ✅ Usa las tablas reales: perfiles, configuracion, business_info
// ✅ Vista: v_usuarios_admin, v_estadisticas_usuarios
// ✅ Sistema de notificaciones integrado
// ✅ Gestión de roles y permisos

import { supa } from '../supabase-client.js';

// Variable para importar la función de notificaciones
let crearNotificacionGlobal;

// Intentar importar la función de notificaciones
try {
  const module = await import('../admin-dashboard.js');
  crearNotificacionGlobal = module.crearNotificacionGlobal;
} catch (error) {
  console.warn('No se pudo importar crearNotificacionGlobal, usando versión local');
  crearNotificacionGlobal = async (tipo, titulo, mensaje) => {
    console.log(`📢 Notificación: [${tipo}] ${titulo} - ${mensaje}`);
  };
}

// ========== TEMPLATE HTML ==========
export const configuracionView = `
  <div class="config-container">
    
    <!-- Header -->
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;">
        <i class="bi bi-gear"></i> Configuración del Sistema
      </h2>
      <p style="color: var(--text-secondary);">Administra los ajustes generales de Paniquiños</p>
    </div>

    <!-- Tabs de Navegación -->
    <div class="config-tabs" style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 2px solid var(--border); overflow-x: auto;">
      <button class="config-tab active" data-tab="general">
        <i class="bi bi-sliders"></i>
        <span>General</span>
      </button>
      <button class="config-tab" data-tab="usuarios">
        <i class="bi bi-people"></i>
        <span>Usuarios</span>
      </button>
      <button class="config-tab" data-tab="notificaciones">
        <i class="bi bi-bell"></i>
        <span>Notificaciones</span>
      </button>
      <button class="config-tab" data-tab="mantenimiento">
        <i class="bi bi-tools"></i>
        <span>Mantenimiento</span>
      </button>
    </div>

    <!-- Contenido de Tabs -->
    <div class="config-content">
      
      <!-- TAB: General -->
      <div class="config-panel active" id="panel-general">
        <div class="card">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;">
            <i class="bi bi-shop"></i> Información del Negocio
          </h3>
          
          <div class="form-grid">
            <div class="form-group">
              <label>Nombre del Negocio</label>
              <input type="text" id="nombreNegocio" class="form-control" placeholder="Paniquiños">
            </div>
            
            <div class="form-group">
              <label>Dirección</label>
              <input type="text" id="direccionNegocio" class="form-control" placeholder="Av. Principal 123">
            </div>
            
            <div class="form-group">
              <label>Ciudad</label>
              <input type="text" id="ciudadNegocio" class="form-control" placeholder="Villa Elisa">
            </div>
            
            <div class="form-group">
              <label>Teléfono</label>
              <input type="tel" id="telefonoNegocio" class="form-control" placeholder="021 123 456">
            </div>
            
            <div class="form-group">
              <label>WhatsApp</label>
              <input type="tel" id="whatsappNegocio" class="form-control" placeholder="0991 000 000">
            </div>
            
            <div class="form-group">
              <label>Instagram</label>
              <input type="text" id="instagramNegocio" class="form-control" placeholder="@paniquinos_py">
            </div>
          </div>

          <button class="btn-primary" id="btnGuardarGeneral" style="margin-top: 1.5rem;">
            <i class="bi bi-check-lg"></i>
            Guardar Cambios
          </button>
        </div>
      </div>

      <!-- TAB: Usuarios -->
      <div class="config-panel" id="panel-usuarios">
        
        <!-- Estadísticas de Usuarios -->
        <div class="grid-3" style="margin-bottom: 2rem;">
          <div class="card" style="border-left: 4px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(111,92,56,0.1); display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-people" style="font-size: 1.5rem; color: var(--primary);"></i>
              </div>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Usuarios</div>
                <div style="font-size: 1.75rem; font-weight: 700;" id="statTotalUsuarios">0</div>
              </div>
            </div>
          </div>

          <div class="card" style="border-left: 4px solid var(--danger);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(239,68,68,0.1); display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-shield-check" style="font-size: 1.5rem; color: var(--danger);"></i>
              </div>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Administradores</div>
                <div style="font-size: 1.75rem; font-weight: 700;" id="statAdmins">0</div>
              </div>
            </div>
          </div>

          <div class="card" style="border-left: 4px solid var(--success);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-person-plus" style="font-size: 1.5rem; color: var(--success);"></i>
              </div>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">Clientes</div>
                <div style="font-size: 1.75rem; font-weight: 700;" id="statClientes">0</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filtros -->
        <div class="card" style="margin-bottom: 1.5rem;">
          <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem;">
            <div style="position: relative;">
              <i class="bi bi-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
              <input 
                type="search" 
                id="searchUsuarios" 
                placeholder="Buscar usuarios por nombre o email..." 
                style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid var(--border); border-radius: 8px;"
              >
            </div>
            <select id="filterRol" style="padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px;">
              <option value="">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="cliente">Clientes</option>
            </select>
          </div>
        </div>

        <!-- Tabla de Usuarios -->
        <div class="card">
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border);">
                  <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Usuario</th>
                  <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Email</th>
                  <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Rol</th>
                  <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Registro</th>
                  <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Acciones</th>
                </tr>
              </thead>
              <tbody id="usuariosTableBody">
                <tr>
                  <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                    <div class="spinner"></div>
                    <p style="margin-top: 1rem;">Cargando usuarios...</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TAB: Notificaciones -->
      <div class="config-panel" id="panel-notificaciones">
        <div class="card">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;">
            <i class="bi bi-bell"></i> Gestión de Notificaciones
          </h3>
          
          <!-- Estadísticas -->
          <div class="grid-3" style="margin-bottom: 2rem;">
            <div class="stat-box">
              <div class="stat-icon" style="background: rgba(111,92,56,0.1); color: var(--primary);">
                <i class="bi bi-envelope"></i>
              </div>
              <div>
                <div class="stat-label">Total Enviadas</div>
                <div class="stat-value" id="statNotifTotal">0</div>
              </div>
            </div>
            
            <div class="stat-box">
              <div class="stat-icon" style="background: rgba(16,185,129,0.1); color: var(--success);">
                <i class="bi bi-envelope-open"></i>
              </div>
              <div>
                <div class="stat-label">Leídas</div>
                <div class="stat-value" id="statNotifLeidas">0</div>
              </div>
            </div>
            
            <div class="stat-box">
              <div class="stat-icon" style="background: rgba(245,158,11,0.1); color: var(--warning);">
                <i class="bi bi-envelope-exclamation"></i>
              </div>
              <div>
                <div class="stat-label">Pendientes</div>
                <div class="stat-value" id="statNotifPendientes">0</div>
              </div>
            </div>
          </div>

          <!-- Crear Nueva Notificación -->
          <div style="background: var(--bg-main); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem;">
            <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem;">
              <i class="bi bi-plus-circle"></i> Crear Notificación
            </h4>
            
            <div class="form-grid">
              <div class="form-group">
                <label>Tipo</label>
                <select id="notifTipo" class="form-control">
                  <option value="sistema">Sistema</option>
                  <option value="pedido">Pedido</option>
                  <option value="chatbot">ChatBot</option>
                  <option value="catering">Catering</option>
                  <option value="promocion">Promoción</option>
                  <option value="stock">Stock</option>
                </select>
              </div>
              
              <div class="form-group">
                <label>Título</label>
                <input type="text" id="notifTitulo" class="form-control" placeholder="Título de la notificación">
              </div>
              
              <div class="form-group" style="grid-column: 1 / -1;">
                <label>Mensaje</label>
                <textarea id="notifMensaje" class="form-control" rows="3" placeholder="Contenido de la notificación"></textarea>
              </div>
            </div>
            
            <button class="btn-primary" id="btnCrearNotif">
              <i class="bi bi-send"></i>
              Enviar Notificación
            </button>
          </div>

          <!-- Lista de Notificaciones Recientes -->
          <h4 style="font-size: 1rem; font-weight: 600; margin-bottom: 1rem;">
            <i class="bi bi-clock-history"></i> Notificaciones Recientes
          </h4>
          <div id="listaNotificaciones">
            <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
              <div class="spinner"></div>
              <p style="margin-top: 1rem;">Cargando notificaciones...</p>
            </div>
          </div>
        </div>
      </div>

      <!-- TAB: Mantenimiento -->
      <div class="config-panel" id="panel-mantenimiento">
        <div class="card">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;">
            <i class="bi bi-tools"></i> Modo Mantenimiento
          </h3>
          
          <div style="background: var(--bg-main); padding: 2rem; border-radius: 12px; margin-bottom: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
              <div style="width: 60px; height: 60px; border-radius: 12px; background: rgba(239,68,68,0.1); display: flex; align-items: center; justify-content: center;">
                <i class="bi bi-tools" style="font-size: 2rem; color: var(--danger);"></i>
              </div>
              <div style="flex: 1;">
                <strong style="font-size: 1.1rem; display: block; margin-bottom: 0.25rem;">Estado del Sitio</strong>
                <span id="estadoMantenimiento" style="color: var(--text-secondary);">Cargando...</span>
              </div>
              <button class="btn-warning" id="btnToggleMantenimiento" style="min-width: 200px;">
                <i class="bi bi-gear"></i>
                <span>Cargando...</span>
              </button>
            </div>
            
            <div style="background: white; padding: 1rem; border-radius: 8px; border-left: 4px solid var(--warning);">
              <strong style="display: block; margin-bottom: 0.5rem;">
                <i class="bi bi-info-circle"></i> Importante:
              </strong>
              <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">
                Al activar el modo mantenimiento, los clientes verán un mensaje de mantenimiento y no podrán acceder al sitio. Solo los administradores podrán acceder normalmente.
              </p>
            </div>
          </div>

          <!-- Mensaje de Mantenimiento -->
          <div class="form-group">
            <label>Mensaje de Mantenimiento</label>
            <textarea 
              id="mensajeMantenimiento" 
              class="form-control" 
              rows="4" 
              placeholder="Mensaje que verán los usuarios durante el mantenimiento"
            ></textarea>
            <small style="color: var(--text-muted); margin-top: 0.5rem; display: block;">
              Este mensaje se mostrará a los usuarios cuando el sitio esté en mantenimiento
            </small>
          </div>

          <button class="btn-primary" id="btnGuardarMensajeMantenimiento">
            <i class="bi bi-check-lg"></i>
            Guardar Mensaje
          </button>
        </div>

        <!-- Herramientas de Mantenimiento -->
        <div class="card" style="margin-top: 1.5rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem;">
            <i class="bi bi-wrench"></i> Herramientas del Sistema
          </h3>
          
          <div style="display: grid; gap: 1rem;">
            <button class="btn-outline" onclick="window.location.reload()">
              <i class="bi bi-arrow-clockwise"></i>
              Recargar Dashboard
            </button>
            
            <button class="btn-outline" id="btnLimpiarCache">
              <i class="bi bi-trash"></i>
              Limpiar Caché Local
            </button>
            
            <button class="btn-outline" id="btnVerLogs">
              <i class="bi bi-file-text"></i>
              Ver Logs del Sistema
            </button>
          </div>
        </div>
      </div>

    </div>
  </div>
`;

// ========== ESTADO GLOBAL ==========
let usuariosList = [];
let notificacionesList = [];
let configuracionGeneral = {};

// ========== FUNCIONES PRINCIPALES ==========

export async function initConfiguracion() {
  console.log('🚀 Inicializando módulo de configuración...');
  
  // Configurar tabs
  setupTabs();
  
  // Cargar datos iniciales
  await Promise.all([
    cargarEstadisticasUsuarios(),
    cargarUsuarios(),
    cargarNotificaciones(),
    cargarConfiguracionGeneral(),
    cargarEstadoMantenimiento()
  ]);
  
  // Event listeners
  setupEventListeners();
  
  console.log('✅ Módulo de configuración inicializado');
}

// ========== TABS ==========
function setupTabs() {
  const tabs = document.querySelectorAll('.config-tab');
  const panels = document.querySelectorAll('.config-panel');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Actualizar tabs activos
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Mostrar panel correspondiente
      panels.forEach(panel => {
        panel.classList.remove('active');
        if (panel.id === `panel-${targetTab}`) {
          panel.classList.add('active');
        }
      });
      
      // Cargar datos según el tab
      if (targetTab === 'usuarios') {
        cargarUsuarios();
      } else if (targetTab === 'notificaciones') {
        cargarNotificaciones();
      } else if (targetTab === 'mantenimiento') {
        cargarEstadoMantenimiento();
      }
    });
  });
}

// ========== USUARIOS ==========
async function cargarEstadisticasUsuarios() {
  try {
    const { data, error } = await supa
      .from('v_estadisticas_usuarios')
      .select('*')
      .single();
    
    if (error) throw error;
    
    document.getElementById('statTotalUsuarios').textContent = data.total_usuarios || 0;
    document.getElementById('statAdmins').textContent = data.total_admins || 0;
    document.getElementById('statClientes').textContent = data.total_clientes || 0;
    
  } catch (error) {
    console.error('Error cargando estadísticas de usuarios:', error);
  }
}

async function cargarUsuarios() {
  try {
    const { data, error } = await supa
      .from('v_usuarios_admin')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    usuariosList = data || [];
    renderizarUsuarios(usuariosList);
    
  } catch (error) {
    console.error('Error cargando usuarios:', error);
    mostrarErrorUsuarios();
  }
}

function renderizarUsuarios(usuarios) {
  const tbody = document.getElementById('usuariosTableBody');
  if (!tbody) return;
  
  if (usuarios.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.3;"></i>
          <p style="margin-top: 1rem;">No hay usuarios registrados</p>
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = usuarios.map(user => {
    const fecha = new Date(user.created_at).toLocaleDateString('es-PY');
    const rolColor = user.rol === 'admin' ? 'var(--danger)' : 'var(--success)';
    const rolIcon = user.rol === 'admin' ? 'shield-check' : 'person';
    const nombre = user.nombre_completo || 'Sin nombre';
    
    return `
      <tr style="border-bottom: 1px solid var(--border);">
        <td style="padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
              ${nombre.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style="font-weight: 500;">${nombre}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${user.telefono || 'Sin teléfono'}</div>
            </div>
          </div>
        </td>
        <td style="padding: 1rem;">
          <span style="font-size: 0.9rem;">${user.email}</span>
        </td>
        <td style="padding: 1rem; text-align: center;">
          <span style="padding: 0.35rem 0.75rem; background: ${rolColor}15; color: ${rolColor}; border-radius: 20px; font-size: 0.85rem; font-weight: 500; display: inline-flex; align-items: center; gap: 0.35rem;">
            <i class="bi bi-${rolIcon}"></i>
            ${user.rol}
          </span>
        </td>
        <td style="padding: 1rem; text-align: center;">
          <span style="font-size: 0.9rem; color: var(--text-secondary);">${fecha}</span>
        </td>
        <td style="padding: 1rem; text-align: center;">
          <button class="btn-icon" onclick="window.configuracion.cambiarRolUsuario('${user.id}', '${user.rol}')" title="Cambiar rol">
            <i class="bi bi-arrow-left-right"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function mostrarErrorUsuarios() {
  const tbody = document.getElementById('usuariosTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 3rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 3rem;"></i>
          <p style="margin-top: 1rem;">Error cargando usuarios</p>
        </td>
      </tr>
    `;
  }
}

async function cambiarRolUsuario(userId, rolActual) {
  const nuevoRol = rolActual === 'admin' ? 'cliente' : 'admin';
  
  const confirmar = confirm(`¿Estás seguro de cambiar el rol a "${nuevoRol}"?`);
  if (!confirmar) return;
  
  try {
    const { error } = await supa.rpc('cambiar_rol_usuario', {
      usuario_id: userId,
      nuevo_rol: nuevoRol
    });
    
    if (error) throw error;
    
    await crearNotificacionGlobal(
      'sistema',
      'Rol Actualizado',
      `Se cambió el rol de un usuario a ${nuevoRol}`
    );
    
    alert(`✅ Rol actualizado exitosamente a "${nuevoRol}"`);
    await cargarUsuarios();
    await cargarEstadisticasUsuarios();
    
  } catch (error) {
    console.error('Error cambiando rol:', error);
    alert('❌ Error al cambiar el rol. Intenta nuevamente.');
  }
}

// ========== NOTIFICACIONES ==========
async function cargarNotificaciones() {
  try {
    const { data, error } = await supa
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) throw error;
    
    notificacionesList = data || [];
    
    // Actualizar estadísticas
    const total = notificacionesList.length;
    const leidas = notificacionesList.filter(n => n.leida).length;
    const pendientes = total - leidas;
    
    document.getElementById('statNotifTotal').textContent = total;
    document.getElementById('statNotifLeidas').textContent = leidas;
    document.getElementById('statNotifPendientes').textContent = pendientes;
    
    // Renderizar lista
    renderizarNotificaciones(notificacionesList);
    
  } catch (error) {
    console.error('Error cargando notificaciones:', error);
  }
}

function renderizarNotificaciones(notificaciones) {
  const container = document.getElementById('listaNotificaciones');
  if (!container) return;
  
  if (notificaciones.length === 0) {
    container.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
        <i class="bi bi-inbox" style="font-size: 3rem; opacity: 0.3;"></i>
        <p style="margin-top: 1rem;">No hay notificaciones</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = notificaciones.map(notif => {
    const fecha = new Date(notif.created_at).toLocaleString('es-PY');
    const iconMap = {
      pedido: 'cart-check',
      sistema: 'gear',
      chatbot: 'robot',
      catering: 'calendar-event',
      promocion: 'tag',
      stock: 'box-seam'
    };
    
    const icon = iconMap[notif.tipo] || 'bell';
    
    return `
      <div style="padding: 1rem; border-bottom: 1px solid var(--border); ${!notif.leida ? 'background: rgba(111,92,56,0.05);' : ''}">
        <div style="display: flex; gap: 1rem; align-items: start;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: var(--primary)15; color: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="bi bi-${icon}"></i>
          </div>
          <div style="flex: 1;">
            <strong style="display: block; margin-bottom: 0.25rem;">${notif.titulo}</strong>
            <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">${notif.mensaje}</p>
            <small style="color: var(--text-muted); margin-top: 0.5rem; display: block;">${fecha}</small>
          </div>
          ${!notif.leida ? '<span style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%;"></span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function crearNotificacion() {
  const tipo = document.getElementById('notifTipo').value;
  const titulo = document.getElementById('notifTitulo').value.trim();
  const mensaje = document.getElementById('notifMensaje').value.trim();
  
  if (!titulo || !mensaje) {
    alert('⚠️ Por favor completa todos los campos');
    return;
  }
  
  try {
    await crearNotificacionGlobal(tipo, titulo, mensaje);
    
    // Limpiar campos
    document.getElementById('notifTitulo').value = '';
    document.getElementById('notifMensaje').value = '';
    
    alert('✅ Notificación enviada correctamente');
    await cargarNotificaciones();
    
  } catch (error) {
    console.error('Error creando notificación:', error);
    alert('❌ Error al enviar la notificación');
  }
}

// ========== CONFIGURACIÓN GENERAL ==========
async function cargarConfiguracionGeneral() {
  try {
    const { data, error } = await supa
      .from('business_info')
      .select('*')
      .single();
    
    if (error) throw error;
    
    configuracionGeneral = data;
    
    // Llenar formulario
    document.getElementById('nombreNegocio').value = data.nombre || '';
    document.getElementById('direccionNegocio').value = data.direccion || '';
    document.getElementById('ciudadNegocio').value = data.ciudad || '';
    document.getElementById('telefonoNegocio').value = data.telefono || '';
    document.getElementById('whatsappNegocio').value = data.whatsapp || '';
    document.getElementById('instagramNegocio').value = data.instagram || '';
    
  } catch (error) {
    console.error('Error cargando configuración general:', error);
  }
}

async function guardarConfiguracionGeneral() {
  const datos = {
    nombre: document.getElementById('nombreNegocio').value.trim(),
    direccion: document.getElementById('direccionNegocio').value.trim(),
    ciudad: document.getElementById('ciudadNegocio').value.trim(),
    telefono: document.getElementById('telefonoNegocio').value.trim(),
    whatsapp: document.getElementById('whatsappNegocio').value.trim(),
    instagram: document.getElementById('instagramNegocio').value.trim(),
    updated_at: new Date().toISOString()
  };
  
  try {
    const { error } = await supa
      .from('business_info')
      .update(datos)
      .eq('id', 1);
    
    if (error) throw error;
    
    await crearNotificacionGlobal(
      'sistema',
      'Configuración Actualizada',
      'Se actualizó la información del negocio'
    );
    
    alert('✅ Configuración guardada correctamente');
    
  } catch (error) {
    console.error('Error guardando configuración:', error);
    alert('❌ Error al guardar la configuración');
  }
}

// ========== MODO MANTENIMIENTO ==========
async function cargarEstadoMantenimiento() {
  try {
    const { data, error } = await supa
      .from('configuracion')
      .select('valor')
      .eq('clave', 'modo_mantenimiento')
      .single();
    
    if (error) throw error;
    
    const activo = data.valor === 'true';
    actualizarUIMantenimiento(activo);
    
    // Cargar mensaje
    const { data: mensajeData } = await supa
      .from('configuracion')
      .select('valor')
      .eq('clave', 'mensaje_mantenimiento')
      .single();
    
    if (mensajeData) {
      document.getElementById('mensajeMantenimiento').value = mensajeData.valor;
    }
    
  } catch (error) {
    console.error('Error cargando estado de mantenimiento:', error);
  }
}

function actualizarUIMantenimiento(activo) {
  const estado = document.getElementById('estadoMantenimiento');
  const btn = document.getElementById('btnToggleMantenimiento');
  
  if (estado) {
    estado.textContent = activo ? '🔴 Sitio en Mantenimiento' : '🟢 Sitio Operativo';
    estado.style.color = activo ? 'var(--danger)' : 'var(--success)';
    estado.style.fontWeight = '600';
  }
  
  if (btn) {
    btn.innerHTML = `
      <i class="bi bi-${activo ? 'check-circle' : 'tools'}"></i>
      <span>${activo ? 'Desactivar Mantenimiento' : 'Activar Mantenimiento'}</span>
    `;
    btn.className = activo ? 'btn-success' : 'btn-warning';
  }
}

async function toggleMantenimiento() {
  try {
    // Obtener estado actual
    const { data: configData } = await supa
      .from('configuracion')
      .select('valor')
      .eq('clave', 'modo_mantenimiento')
      .single();
    
    const estadoActual = configData.valor === 'true';
    const nuevoEstado = !estadoActual;
    
    // Confirmar
    const confirmar = confirm(
      nuevoEstado 
        ? '⚠️ ¿Activar modo mantenimiento? Los clientes no podrán acceder al sitio.' 
        : '¿Desactivar modo mantenimiento? El sitio volverá a estar disponible.'
    );
    
    if (!confirmar) return;
    
    // Actualizar en BD
    const { error } = await supa
      .from('configuracion')
      .update({ valor: nuevoEstado.toString(), updated_at: new Date() })
      .eq('clave', 'modo_mantenimiento');
    
    if (error) throw error;
    
    // Notificar
    await crearNotificacionGlobal(
      'sistema',
      'Modo Mantenimiento',
      `Modo mantenimiento ${nuevoEstado ? 'activado' : 'desactivado'}`
    );
    
    // Actualizar UI
    actualizarUIMantenimiento(nuevoEstado);
    
    alert(`✅ Modo mantenimiento ${nuevoEstado ? 'activado' : 'desactivado'} correctamente`);
    
  } catch (error) {
    console.error('Error toggling mantenimiento:', error);
    alert('❌ Error al cambiar el modo de mantenimiento');
  }
}

async function guardarMensajeMantenimiento() {
  const mensaje = document.getElementById('mensajeMantenimiento').value.trim();
  
  if (!mensaje) {
    alert('⚠️ El mensaje no puede estar vacío');
    return;
  }
  
  try {
    const { error } = await supa
      .from('configuracion')
      .update({ valor: mensaje, updated_at: new Date() })
      .eq('clave', 'mensaje_mantenimiento');
    
    if (error) throw error;
    
    alert('✅ Mensaje de mantenimiento guardado correctamente');
    
  } catch (error) {
    console.error('Error guardando mensaje:', error);
    alert('❌ Error al guardar el mensaje');
  }
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  // General
  document.getElementById('btnGuardarGeneral')?.addEventListener('click', guardarConfiguracionGeneral);
  
  // Notificaciones
  document.getElementById('btnCrearNotif')?.addEventListener('click', crearNotificacion);
  
  // Mantenimiento
  document.getElementById('btnToggleMantenimiento')?.addEventListener('click', toggleMantenimiento);
  document.getElementById('btnGuardarMensajeMantenimiento')?.addEventListener('click', guardarMensajeMantenimiento);
  
  // Búsqueda de usuarios
  document.getElementById('searchUsuarios')?.addEventListener('input', (e) => {
    const busqueda = e.target.value.toLowerCase();
    const filtrados = usuariosList.filter(user => 
      user.email.toLowerCase().includes(busqueda) ||
      (user.nombre_completo && user.nombre_completo.toLowerCase().includes(busqueda))
    );
    renderizarUsuarios(filtrados);
  });
  
  // Filtro de rol
  document.getElementById('filterRol')?.addEventListener('change', (e) => {
    const rol = e.target.value;
    const filtrados = rol ? usuariosList.filter(u => u.rol === rol) : usuariosList;
    renderizarUsuarios(filtrados);
  });
  
  // Herramientas
  document.getElementById('btnLimpiarCache')?.addEventListener('click', () => {
    localStorage.clear();
    sessionStorage.clear();
    alert('✅ Caché local limpiado');
  });
  
  document.getElementById('btnVerLogs')?.addEventListener('click', () => {
    alert('📋 Función de logs en desarrollo');
  });
}

// Exportar funciones para uso global
window.configuracion = {
  cambiarRolUsuario
};

console.log('📦 Módulo de configuración cargado');