// ==================== MÓDULO DE CONFIGURACIÓN COMPLETO ====================
// Para el panel de administración de Paniquiños

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuración de Supabase
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Vista HTML de Configuración
export const configuracionView = `
  <div style="max-width: 1400px; margin: 0 auto;">
    <!-- Header -->
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size: 2rem; font-weight: 800; margin-bottom: 0.5rem; background: linear-gradient(135deg, var(--primary), var(--primary-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        ⚙️ Configuración del Sistema
      </h2>
      <p style="color: var(--text-secondary); font-size: 1.1rem;">Administra usuarios, notificaciones y configuración general</p>
    </div>

    <!-- Tabs de navegación -->
    <div class="config-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 2rem; border-bottom: 2px solid var(--border); padding-bottom: 0; overflow-x: auto;">
      <button class="config-tab active" data-tab="usuarios" style="padding: 1rem 1.5rem; background: transparent; border: none; font-weight: 600; color: var(--text-secondary); cursor: pointer; position: relative; transition: all 0.3s; white-space: nowrap;">
        <i class="bi bi-people"></i> Usuarios
      </button>
      <button class="config-tab" data-tab="notificaciones" style="padding: 1rem 1.5rem; background: transparent; border: none; font-weight: 600; color: var(--text-secondary); cursor: pointer; position: relative; transition: all 0.3s; white-space: nowrap;">
        <i class="bi bi-bell"></i> Notificaciones
        <span class="notification-badge" id="notifBadge" style="display: none; position: absolute; top: 8px; right: 8px; background: var(--danger); color: white; font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; min-width: 18px;">0</span>
      </button>
      <button class="config-tab" data-tab="general" style="padding: 1rem 1.5rem; background: transparent; border: none; font-weight: 600; color: var(--text-secondary); cursor: pointer; position: relative; transition: all 0.3s; white-space: nowrap;">
        <i class="bi bi-shop"></i> General
      </button>
      <button class="config-tab" data-tab="mantenimiento" style="padding: 1rem 1.5rem; background: transparent; border: none; font-weight: 600; color: var(--text-secondary); cursor: pointer; position: relative; transition: all 0.3s; white-space: nowrap;">
        <i class="bi bi-tools"></i> Mantenimiento
      </button>
      <button class="config-tab" data-tab="chatbot" style="padding: 1rem 1.5rem; background: transparent; border: none; font-weight: 600; color: var(--text-secondary); cursor: pointer; position: relative; transition: all 0.3s; white-space: nowrap;">
        <i class="bi bi-robot"></i> ChatBot IA
      </button>
    </div>

    <!-- Contenido de las tabs -->
    <div id="configTabContent">
      
      <!-- ========== TAB USUARIOS ========== -->
      <div class="config-content active" data-content="usuarios">
        <!-- Estadísticas -->
        <div class="grid-3" style="margin-bottom: 2rem;">
          <div class="card" style="border-left: 4px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <i class="bi bi-shield-check" style="font-size: 2rem; color: var(--primary);"></i>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Administradores</div>
                <div style="font-size: 1.75rem; font-weight: 700;" id="countAdmins">0</div>
              </div>
            </div>
          </div>
          
          <div class="card" style="border-left: 4px solid var(--success);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <i class="bi bi-people" style="font-size: 2rem; color: var(--success);"></i>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Clientes Activos</div>
                <div style="font-size: 1.75rem; font-weight: 700;" id="countClientes">0</div>
              </div>
            </div>
          </div>
          
          <div class="card" style="border-left: 4px solid var(--warning);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <i class="bi bi-person-x" style="font-size: 2rem; color: var(--warning);"></i>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Bloqueados</div>
                <div style="font-size: 1.75rem; font-weight: 700;" id="countBloqueados">0</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Acciones -->
        <div style="display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap;">
          <button class="btn-primary" id="btnNuevoAdmin">
            <i class="bi bi-person-plus"></i>
            Nuevo Administrador
          </button>
          <button class="btn-primary" style="background: var(--success);" id="btnNuevoCliente">
            <i class="bi bi-person-plus"></i>
            Nuevo Cliente
          </button>
        </div>

        <!-- Tabla de usuarios -->
        <div class="card">
          <h3 style="margin-bottom: 1.5rem; font-size: 1.1rem; font-weight: 600;">Lista de Usuarios</h3>
          
          <!-- Filtros -->
          <div style="display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; margin-bottom: 1.5rem;">
            <input type="search" id="searchUsuarios" placeholder="Buscar por nombre o email..." 
                   style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
            <select id="filterTipo" style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              <option value="">Todos</option>
              <option value="admin">Administradores</option>
              <option value="cliente">Clientes</option>
            </select>
            <select id="filterEstado" style="padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="bloqueado">Bloqueados</option>
            </select>
          </div>
          
          <!-- Tabla -->
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--border);">
                  <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">USUARIO</th>
                  <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">TIPO</th>
                  <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">ESTADO</th>
                  <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">ÚLTIMA ACTIVIDAD</th>
                  <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem;">ACCIONES</th>
                </tr>
              </thead>
              <tbody id="usuariosTableBody">
                <tr>
                  <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">
                    Cargando usuarios...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- ========== TAB NOTIFICACIONES ========== -->
      <div class="config-content" data-content="notificaciones" style="display: none;">
        <!-- Header con acciones -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem;">Centro de Notificaciones</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">
              <span id="notifCount">0</span> notificaciones • 
              <span id="notifUnread">0</span> sin leer
            </p>
          </div>
          <div style="display: flex; gap: 1rem;">
            <button class="btn-primary" style="background: var(--info);" id="btnMarcarTodas">
              <i class="bi bi-check-all"></i>
              Marcar todas como leídas
            </button>
            <button class="btn-primary" style="background: var(--danger);" id="btnEliminarTodas">
              <i class="bi bi-trash3"></i>
              Eliminar todas
            </button>
          </div>
        </div>

        <!-- Lista de notificaciones -->
        <div id="notificacionesList" style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Las notificaciones se cargarán aquí dinámicamente -->
        </div>

        <!-- Estado vacío -->
        <div id="emptyNotifications" style="display: none; text-align: center; padding: 4rem 2rem;">
          <i class="bi bi-bell-slash" style="font-size: 4rem; color: var(--text-muted);"></i>
          <h3 style="margin-top: 1rem; color: var(--text-secondary);">No hay notificaciones</h3>
          <p style="color: var(--text-muted);">Las notificaciones aparecerán aquí cuando ocurran eventos en el sistema</p>
        </div>
      </div>

      <!-- ========== TAB GENERAL ========== -->
      <div class="config-content" data-content="general" style="display: none;">
        <div class="grid-2" style="gap: 2rem;">
          <!-- Información de la empresa -->
          <div class="card">
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1.5rem;">
              <i class="bi bi-building" style="color: var(--primary);"></i>
              Información de la Empresa
            </h3>
            
            <form id="formEmpresa" style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Nombre</label>
                <input type="text" id="empresaNombre" value="Paniquiños" 
                       style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Teléfono Principal</label>
                <input type="tel" id="empresaTel" value="+595 21 123456" 
                       style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">WhatsApp</label>
                <input type="tel" id="empresaWhatsapp" value="+595 971 123456" 
                       style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Email</label>
                <input type="email" id="empresaEmail" value="info@paniquinos.com" 
                       style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
              </div>
              
              <div>
                <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Dirección</label>
                <textarea id="empresaDireccion" rows="2" 
                          style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px; resize: vertical;">Asunción, Paraguay</textarea>
              </div>
              
              <button type="submit" class="btn-primary" style="justify-content: center;">
                <i class="bi bi-check-lg"></i>
                Guardar Cambios
              </button>
            </form>
          </div>

          <!-- Horarios -->
          <div class="card">
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1.5rem;">
              <i class="bi bi-clock" style="color: var(--info);"></i>
              Horarios de Atención
            </h3>
            
            <form id="formHorarios" style="display: flex; flex-direction: column; gap: 1rem;">
              <!-- Lunes a Viernes -->
              <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 0.75rem;">Lunes a Viernes</label>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">
                  <input type="time" id="horarioLunViernesDesde" value="08:00" 
                         style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                  <span style="color: var(--text-muted);">hasta</span>
                  <input type="time" id="horarioLunViernesHasta" value="18:00" 
                         style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                </div>
              </div>
              
              <!-- Sábado -->
              <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                <label style="font-weight: 600; display: block; margin-bottom: 0.75rem;">Sábado</label>
                <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: center;">
                  <input type="time" id="horarioSabadoDesde" value="08:00" 
                         style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                  <span style="color: var(--text-muted);">hasta</span>
                  <input type="time" id="horarioSabadoHasta" value="13:00" 
                         style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                </div>
              </div>
              
              <!-- Domingo -->
              <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">
                <label style="font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" id="domingoCerrado" checked style="width: 18px; height: 18px;">
                  Cerrado los domingos
                </label>
              </div>
              
              <button type="submit" class="btn-primary" style="justify-content: center; margin-top: 1rem;">
                <i class="bi bi-check-lg"></i>
                Guardar Horarios
              </button>
            </form>
          </div>
        </div>
      </div>

      <!-- ========== TAB MANTENIMIENTO ========== -->
      <div class="config-content" data-content="mantenimiento" style="display: none;">
        <div class="card" style="max-width: 800px; margin: 0 auto;">
          <h3 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 2rem; text-align: center;">
            <i class="bi bi-tools" style="color: var(--warning);"></i>
            Modo Mantenimiento
          </h3>
          
          <!-- Estado actual -->
          <div style="padding: 2rem; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 2rem; text-align: center;">
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem;">Estado Actual</div>
            <div id="estadoMantenimiento" style="font-size: 1.5rem; font-weight: 700;">
              <span class="badge" style="background: var(--success); color: white; padding: 0.5rem 1.5rem; border-radius: 20px;">
                SITIO ACTIVO
              </span>
            </div>
          </div>
          
          <!-- Activar/Desactivar -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; background: var(--bg-main); border-radius: 12px; margin-bottom: 2rem;">
            <div>
              <h4 style="font-weight: 600; margin-bottom: 0.25rem;">Activar Modo Mantenimiento</h4>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">
                Los clientes verán un mensaje de mantenimiento
              </p>
            </div>
            <label class="switch" style="position: relative; display: inline-block; width: 60px; height: 30px;">
              <input type="checkbox" id="toggleMantenimiento" style="opacity: 0; width: 0; height: 0;">
              <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #ccc; transition: .4s; border-radius: 30px;"></span>
            </label>
          </div>
          
          <!-- Mensaje personalizado -->
          <div>
            <label style="display: block; font-weight: 600; margin-bottom: 0.75rem;">
              Mensaje de Mantenimiento
            </label>
            <textarea id="mensajeMantenimiento" rows="5" 
                      placeholder="Estamos realizando mejoras en nuestro sitio. Volveremos pronto..."
                      style="width: 100%; padding: 1rem; border: 1px solid var(--border); border-radius: 8px; resize: vertical; font-size: 0.95rem;">🔧 Estamos realizando mantenimiento en nuestro sitio.

Por favor, vuelve en unos minutos. 

¡Gracias por tu paciencia! 🍰</textarea>
          </div>
          
          <!-- Vista previa -->
          <div style="margin-top: 2rem; padding: 2rem; border: 2px dashed var(--border); border-radius: 12px;">
            <h5 style="font-weight: 600; margin-bottom: 1rem; color: var(--text-secondary);">Vista Previa</h5>
            <div id="previewMantenimiento" style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: var(--shadow);">
              <i class="bi bi-tools" style="font-size: 3rem; color: var(--warning); display: block; margin-bottom: 1rem;"></i>
              <div id="previewMensaje" style="white-space: pre-line;">
                🔧 Estamos realizando mantenimiento en nuestro sitio.

                Por favor, vuelve en unos minutos. 

                ¡Gracias por tu paciencia! 🍰
              </div>
            </div>
          </div>
          
          <button class="btn-primary" style="width: 100%; margin-top: 2rem; justify-content: center;" id="btnGuardarMantenimiento">
            <i class="bi bi-check-lg"></i>
            Guardar Configuración
          </button>
        </div>
      </div>

      <!-- ========== TAB CHATBOT ========== -->
      <div class="config-content" data-content="chatbot" style="display: none;">
        <div class="card" style="max-width: 800px; margin: 0 auto;">
          <h3 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 2rem;">
            <i class="bi bi-robot" style="color: var(--info);"></i>
            Configuración del ChatBot IA
          </h3>
          
          <!-- Estado -->
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 1.5rem; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 2rem;">
            <div>
              <h4 style="font-weight: 600; margin-bottom: 0.25rem;">ChatBot Activo</h4>
              <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0;">
                El bot responderá automáticamente a los clientes
              </p>
            </div>
            <label class="switch" style="position: relative; display: inline-block; width: 60px; height: 30px;">
              <input type="checkbox" id="toggleChatbot" checked style="opacity: 0; width: 0; height: 0;">
              <span class="slider" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--success); transition: .4s; border-radius: 30px;"></span>
            </label>
          </div>
          
          <!-- Mensaje de bienvenida -->
          <div style="margin-bottom: 2rem;">
            <label style="display: block; font-weight: 600; margin-bottom: 0.75rem;">
              Mensaje de Bienvenida
            </label>
            <textarea id="mensajeBienvenida" rows="3" 
                      style="width: 100%; padding: 1rem; border: 1px solid var(--border); border-radius: 8px; resize: vertical;">¡Hola! 👋 Soy el asistente virtual de Paniquiños. ¿En qué puedo ayudarte hoy?</textarea>
          </div>
          
          <!-- Estadísticas -->
          <div style="padding: 1.5rem; background: var(--bg-main); border-radius: 12px;">
            <h4 style="font-weight: 600; margin-bottom: 1rem;">Estadísticas del ChatBot</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1.5rem;">
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Conversaciones Hoy</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">24</div>
              </div>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Tasa de Éxito</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--success);">87%</div>
              </div>
              <div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">Pedidos Generados</div>
                <div style="font-size: 1.5rem; font-weight: 700; color: var(--info);">12</div>
              </div>
            </div>
          </div>
          
          <button class="btn-primary" style="width: 100%; margin-top: 2rem; justify-content: center;" id="btnGuardarChatbot">
            <i class="bi bi-check-lg"></i>
            Guardar Configuración
          </button>
        </div>
      </div>
      
    </div>
  </div>

  <!-- ========== MODALES ========== -->
  
  <!-- Modal Nuevo Usuario -->
  <div class="modal-overlay" id="modalUsuario" style="display: none;">
    <div class="card" style="max-width: 500px; width: 90%; position: relative;">
      <button id="closeModalUsuario" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer;">
        <i class="bi bi-x-lg"></i>
      </button>
      
      <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem;" id="modalUsuarioTitle">
        Nuevo Usuario
      </h2>
      
      <form id="formUsuario" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <input type="hidden" id="usuarioId">
        <input type="hidden" id="usuarioTipo">
        
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Nombre Completo *</label>
          <input type="text" id="usuarioNombre" required 
                 style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
        </div>
        
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Email *</label>
          <input type="email" id="usuarioEmail" required 
                 style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
        </div>
        
        <div>
          <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Contraseña *</label>
          <input type="password" id="usuarioPassword" required minlength="6"
                 style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
          <small style="color: var(--text-muted); font-size: 0.85rem;">Mínimo 6 caracteres</small>
        </div>
        
        <div id="campoTelefono" style="display: none;">
          <label style="display: block; font-weight: 600; margin-bottom: 0.5rem;">Teléfono</label>
          <input type="tel" id="usuarioTelefono" 
                 style="width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 8px;">
        </div>
        
        <div style="display: flex; gap: 1rem; margin-top: 1rem;">
          <button type="button" id="btnCancelarUsuario" 
                  style="flex: 1; padding: 0.875rem; border: 1px solid var(--border); background: white; border-radius: 8px; font-weight: 600;">
            Cancelar
          </button>
          <button type="submit" class="btn-primary" style="flex: 1; justify-content: center;">
            <i class="bi bi-check-lg"></i>
            Crear Usuario
          </button>
        </div>
      </form>
    </div>
  </div>
`;

// ========== FUNCIONES DE CONFIGURACIÓN ==========

// Inicializar módulo de configuración
export async function initConfiguracion() {
  console.log('🚀 Inicializando módulo de configuración...');
  
  // Configurar tabs
  setupConfigTabs();
  
  // Cargar datos iniciales
  await cargarUsuarios();
  await cargarNotificaciones();
  await cargarConfiguracion();
  
  // Configurar event listeners
  setupEventListeners();
  
  // Iniciar actualización en tiempo real de notificaciones
  iniciarActualizacionNotificaciones();
}

// Configurar navegación de tabs
function setupConfigTabs() {
  const tabs = document.querySelectorAll('.config-tab');
  const contents = document.querySelectorAll('.config-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remover active de todos
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.color = 'var(--text-secondary)';
        t.style.borderBottom = 'none';
      });
      contents.forEach(c => c.style.display = 'none');
      
      // Activar el seleccionado
      tab.classList.add('active');
      tab.style.color = 'var(--primary)';
      tab.style.borderBottom = '3px solid var(--primary)';
      
      const targetContent = document.querySelector(`[data-content="${tab.dataset.tab}"]`);
      if (targetContent) {
        targetContent.style.display = 'block';
      }
    });
  });
}

// Configurar event listeners
function setupEventListeners() {
  // Usuarios
  document.getElementById('btnNuevoAdmin')?.addEventListener('click', () => abrirModalUsuario('admin'));
  document.getElementById('btnNuevoCliente')?.addEventListener('click', () => abrirModalUsuario('cliente'));
  document.getElementById('closeModalUsuario')?.addEventListener('click', cerrarModalUsuario);
  document.getElementById('btnCancelarUsuario')?.addEventListener('click', cerrarModalUsuario);
  document.getElementById('formUsuario')?.addEventListener('submit', guardarUsuario);
  
  // Búsqueda y filtros
  document.getElementById('searchUsuarios')?.addEventListener('input', filtrarUsuarios);
  document.getElementById('filterTipo')?.addEventListener('change', filtrarUsuarios);
  document.getElementById('filterEstado')?.addEventListener('change', filtrarUsuarios);
  
  // Notificaciones
  document.getElementById('btnMarcarTodas')?.addEventListener('click', marcarTodasLeidas);
  document.getElementById('btnEliminarTodas')?.addEventListener('click', eliminarTodasNotificaciones);
  
  // Configuración general
  document.getElementById('formEmpresa')?.addEventListener('submit', guardarEmpresa);
  document.getElementById('formHorarios')?.addEventListener('submit', guardarHorarios);
  
  // Mantenimiento
  document.getElementById('toggleMantenimiento')?.addEventListener('change', toggleMantenimiento);
  document.getElementById('mensajeMantenimiento')?.addEventListener('input', actualizarPreview);
  document.getElementById('btnGuardarMantenimiento')?.addEventListener('click', guardarMantenimiento);
  
  // ChatBot
  document.getElementById('toggleChatbot')?.addEventListener('change', toggleChatbot);
  document.getElementById('btnGuardarChatbot')?.addEventListener('click', guardarChatbot);
}

// ========== GESTIÓN DE USUARIOS ==========

async function cargarUsuarios() {
  try {
    // Cargar administradores
    const { data: admins, error: errorAdmins } = await supa
      .from('usuarios')
      .select('*')
      .eq('rol', 'admin');
    
    // Cargar clientes
    const { data: clientes, error: errorClientes } = await supa
      .from('usuarios')
      .select('*')
      .eq('rol', 'cliente');
    
    // Actualizar contadores
    document.getElementById('countAdmins').textContent = admins?.length || 0;
    document.getElementById('countClientes').textContent = clientes?.filter(c => c.estado === 'activo').length || 0;
    document.getElementById('countBloqueados').textContent = clientes?.filter(c => c.estado === 'bloqueado').length || 0;
    
    // Combinar y mostrar en tabla
    const todosUsuarios = [...(admins || []), ...(clientes || [])];
    mostrarUsuarios(todosUsuarios);
    
  } catch (error) {
    console.error('Error cargando usuarios:', error);
  }
}

function mostrarUsuarios(usuarios) {
  const tbody = document.getElementById('usuariosTableBody');
  if (!tbody) return;
  
  if (usuarios.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted);">
          No hay usuarios registrados
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = usuarios.map(usuario => `
    <tr>
      <td style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--primary-light)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
            ${usuario.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div style="font-weight: 600;">${usuario.nombre || 'Sin nombre'}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">${usuario.email}</div>
          </div>
        </div>
      </td>
      <td style="padding: 1rem;">
        <span class="badge" style="background: ${usuario.rol === 'admin' ? 'var(--primary)' : 'var(--info)'}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
          ${usuario.rol === 'admin' ? 'Administrador' : 'Cliente'}
        </span>
      </td>
      <td style="padding: 1rem; text-align: center;">
        <span class="badge" style="background: ${usuario.estado === 'activo' ? 'var(--success-light)' : 'var(--danger-light)'}; color: ${usuario.estado === 'activo' ? 'var(--success)' : 'var(--danger)'}; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
          ${usuario.estado === 'activo' ? 'Activo' : 'Bloqueado'}
        </span>
      </td>
      <td style="padding: 1rem; color: var(--text-muted); font-size: 0.9rem;">
        ${usuario.ultimo_acceso ? new Date(usuario.ultimo_acceso).toLocaleDateString('es-PY') : 'Nunca'}
      </td>
      <td style="padding: 1rem;">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          ${usuario.estado === 'activo' ? `
            <button onclick="bloquearUsuario('${usuario.id}')" class="icon-btn" style="background: var(--warning-light); color: var(--warning);" title="Bloquear">
              <i class="bi bi-lock"></i>
            </button>
          ` : `
            <button onclick="desbloquearUsuario('${usuario.id}')" class="icon-btn" style="background: var(--success-light); color: var(--success);" title="Desbloquear">
              <i class="bi bi-unlock"></i>
            </button>
          `}
          <button onclick="resetearPassword('${usuario.id}')" class="icon-btn" style="background: var(--info-light); color: var(--info);" title="Resetear contraseña">
            <i class="bi bi-key"></i>
          </button>
          <button onclick="eliminarUsuario('${usuario.id}')" class="icon-btn" style="background: var(--danger-light); color: var(--danger);" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function abrirModalUsuario(tipo) {
  const modal = document.getElementById('modalUsuario');
  const titulo = document.getElementById('modalUsuarioTitle');
  const campoTelefono = document.getElementById('campoTelefono');
  
  document.getElementById('usuarioTipo').value = tipo;
  
  if (tipo === 'admin') {
    titulo.textContent = 'Nuevo Administrador';
    campoTelefono.style.display = 'none';
  } else {
    titulo.textContent = 'Nuevo Cliente';
    campoTelefono.style.display = 'block';
  }
  
  modal.style.display = 'flex';
  document.getElementById('formUsuario').reset();
}

function cerrarModalUsuario() {
  document.getElementById('modalUsuario').style.display = 'none';
}

async function guardarUsuario(e) {
  e.preventDefault();
  
  const tipo = document.getElementById('usuarioTipo').value;
  const nombre = document.getElementById('usuarioNombre').value;
  const email = document.getElementById('usuarioEmail').value;
  const password = document.getElementById('usuarioPassword').value;
  const telefono = document.getElementById('usuarioTelefono').value;
  
  try {
    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supa.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          rol: tipo
        }
      }
    });
    
    if (authError) throw authError;
    
    // Guardar en tabla usuarios
    const { error: dbError } = await supa
      .from('usuarios')
      .insert({
        id: authData.user.id,
        email,
        nombre,
        rol: tipo,
        telefono: tipo === 'cliente' ? telefono : null,
        estado: 'activo',
        created_at: new Date().toISOString()
      });
    
    if (dbError) throw dbError;
    
    // Crear notificación
    await crearNotificacion(
      'usuario_nuevo',
      'Nuevo usuario creado',
      `Se ha creado un nuevo ${tipo === 'admin' ? 'administrador' : 'cliente'}: ${nombre}`
    );
    
    cerrarModalUsuario();
    await cargarUsuarios();
    
    alert(`✅ Usuario creado exitosamente`);
    
  } catch (error) {
    console.error('Error creando usuario:', error);
    alert('❌ Error al crear usuario: ' + error.message);
  }
}

// Funciones para acciones de usuarios (se llamarán desde onclick)
window.bloquearUsuario = async (id) => {
  if (!confirm('¿Seguro que querés bloquear este usuario?')) return;
  
  try {
    const { error } = await supa
      .from('usuarios')
      .update({ estado: 'bloqueado' })
      .eq('id', id);
    
    if (error) throw error;
    
    await cargarUsuarios();
    alert('✅ Usuario bloqueado');
  } catch (error) {
    console.error('Error bloqueando usuario:', error);
    alert('❌ Error al bloquear usuario');
  }
};

window.desbloquearUsuario = async (id) => {
  try {
    const { error } = await supa
      .from('usuarios')
      .update({ estado: 'activo' })
      .eq('id', id);
    
    if (error) throw error;
    
    await cargarUsuarios();
    alert('✅ Usuario desbloqueado');
  } catch (error) {
    console.error('Error desbloqueando usuario:', error);
    alert('❌ Error al desbloquear usuario');
  }
};

window.resetearPassword = async (id) => {
  const nuevaPassword = prompt('Ingresa la nueva contraseña (mínimo 6 caracteres):');
  if (!nuevaPassword || nuevaPassword.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  try {
    // Aquí deberías usar una función admin de Supabase
    alert('✅ Contraseña actualizada (función pendiente de implementar con admin SDK)');
  } catch (error) {
    console.error('Error reseteando contraseña:', error);
    alert('❌ Error al resetear contraseña');
  }
};

window.eliminarUsuario = async (id) => {
  if (!confirm('¿Seguro que querés eliminar este usuario? Esta acción no se puede deshacer.')) return;
  
  try {
    const { error } = await supa
      .from('usuarios')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    await cargarUsuarios();
    alert('✅ Usuario eliminado');
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    alert('❌ Error al eliminar usuario');
  }
};

function filtrarUsuarios() {
  const search = document.getElementById('searchUsuarios').value.toLowerCase();
  const tipo = document.getElementById('filterTipo').value;
  const estado = document.getElementById('filterEstado').value;
  
  // Implementar filtrado
  // Por ahora solo recargamos
  cargarUsuarios();
}

// ========== GESTIÓN DE NOTIFICACIONES ==========

async function cargarNotificaciones() {
  try {
    const { data, error } = await supa
      .from('notificaciones')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    mostrarNotificaciones(data || []);
    actualizarContadorNotificaciones(data || []);
    
  } catch (error) {
    console.error('Error cargando notificaciones:', error);
  }
}

function mostrarNotificaciones(notificaciones) {
  const lista = document.getElementById('notificacionesList');
  const empty = document.getElementById('emptyNotifications');
  
  if (!lista) return;
  
  if (notificaciones.length === 0) {
    lista.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  
  lista.style.display = 'flex';
  empty.style.display = 'none';
  
  lista.innerHTML = notificaciones.map(notif => {
    const icono = obtenerIconoNotificacion(notif.tipo);
    const color = obtenerColorNotificacion(notif.tipo);
    const tiempo = calcularTiempoRelativo(notif.created_at);
    
    return `
      <div class="notification-item" style="display: flex; gap: 1rem; padding: 1.5rem; background: ${notif.leida ? 'var(--bg-card)' : 'var(--bg-secondary)'}; border-radius: 12px; border: 1px solid var(--border); position: relative; transition: all 0.3s;">
        <div style="width: 48px; height: 48px; border-radius: 12px; background: ${color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; flex-shrink: 0;">
          <i class="bi bi-${icono}"></i>
        </div>
        <div style="flex: 1;">
          <div style="font-weight: 600; margin-bottom: 0.25rem;">${notif.titulo}</div>
          <div style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 0.5rem;">${notif.mensaje}</div>
          <div style="color: var(--text-muted); font-size: 0.85rem;">${tiempo}</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${!notif.leida ? `
            <button onclick="marcarLeida('${notif.id}')" class="icon-btn" style="background: var(--info-light); color: var(--info);" title="Marcar como leída">
              <i class="bi bi-check"></i>
            </button>
          ` : ''}
          <button onclick="eliminarNotificacion('${notif.id}')" class="icon-btn" style="background: var(--danger-light); color: var(--danger);" title="Eliminar">
            <i class="bi bi-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function obtenerIconoNotificacion(tipo) {
  const iconos = {
    'pedido': 'cart-check',
    'catering': 'calendar-event',
    'producto_nuevo': 'box-seam',
    'producto_modificado': 'pencil-square',
    'usuario_nuevo': 'person-plus',
    'sistema': 'gear'
  };
  return iconos[tipo] || 'bell';
}

function obtenerColorNotificacion(tipo) {
  const colores = {
    'pedido': 'linear-gradient(135deg, var(--success), var(--success-light))',
    'catering': 'linear-gradient(135deg, var(--warning), var(--warning-light))',
    'producto_nuevo': 'linear-gradient(135deg, var(--info), var(--info-light))',
    'producto_modificado': 'linear-gradient(135deg, var(--primary), var(--primary-light))',
    'usuario_nuevo': 'linear-gradient(135deg, var(--accent), var(--warning))',
    'sistema': 'linear-gradient(135deg, var(--text-secondary), var(--text-muted))'
  };
  return colores[tipo] || 'var(--primary)';
}

function calcularTiempoRelativo(fecha) {
  const ahora = new Date();
  const fechaNotif = new Date(fecha);
  const diferencia = Math.floor((ahora - fechaNotif) / 1000);
  
  if (diferencia < 60) return 'Hace unos segundos';
  if (diferencia < 3600) return `Hace ${Math.floor(diferencia / 60)} minutos`;
  if (diferencia < 86400) return `Hace ${Math.floor(diferencia / 3600)} horas`;
  if (diferencia < 604800) return `Hace ${Math.floor(diferencia / 86400)} días`;
  
  return fechaNotif.toLocaleDateString('es-PY');
}

function actualizarContadorNotificaciones(notificaciones) {
  const sinLeer = notificaciones.filter(n => !n.leida).length;
  const badge = document.getElementById('notifBadge');
  const count = document.getElementById('notifCount');
  const unread = document.getElementById('notifUnread');
  
  if (badge) {
    badge.textContent = sinLeer;
    badge.style.display = sinLeer > 0 ? 'block' : 'none';
  }
  
  if (count) count.textContent = notificaciones.length;
  if (unread) unread.textContent = sinLeer;
  
  // Actualizar badge en el botón principal de notificaciones del topbar
  const topbarBadge = document.querySelector('#notificationsBtn .badge');
  if (topbarBadge) {
    topbarBadge.textContent = sinLeer;
    topbarBadge.style.display = sinLeer > 0 ? 'block' : 'none';
  }
}

async function crearNotificacion(tipo, titulo, mensaje) {
  try {
    const { error } = await supa
      .from('notificaciones')
      .insert({
        tipo,
        titulo,
        mensaje,
        leida: false,
        created_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    // Recargar notificaciones
    await cargarNotificaciones();
    
  } catch (error) {
    console.error('Error creando notificación:', error);
  }
}

window.marcarLeida = async (id) => {
  try {
    const { error } = await supa
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);
    
    if (error) throw error;
    
    await cargarNotificaciones();
  } catch (error) {
    console.error('Error marcando notificación:', error);
  }
};

window.eliminarNotificacion = async (id) => {
  try {
    const { error } = await supa
      .from('notificaciones')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    
    await cargarNotificaciones();
  } catch (error) {
    console.error('Error eliminando notificación:', error);
  }
};

async function marcarTodasLeidas() {
  try {
    const { error } = await supa
      .from('notificaciones')
      .update({ leida: true })
      .eq('leida', false);
    
    if (error) throw error;
    
    await cargarNotificaciones();
    alert('✅ Todas las notificaciones marcadas como leídas');
  } catch (error) {
    console.error('Error marcando todas:', error);
    alert('❌ Error al marcar notificaciones');
  }
}

async function eliminarTodasNotificaciones() {
  if (!confirm('¿Seguro que querés eliminar TODAS las notificaciones? Esta acción no se puede deshacer.')) return;
  
  try {
    const { error } = await supa
      .from('notificaciones')
      .delete()
      .neq('id', 0); // Elimina todas
    
    if (error) throw error;
    
    await cargarNotificaciones();
    alert('✅ Todas las notificaciones eliminadas');
  } catch (error) {
    console.error('Error eliminando todas:', error);
    alert('❌ Error al eliminar notificaciones');
  }
}

// Actualización en tiempo real
function iniciarActualizacionNotificaciones() {
  // Suscribirse a cambios en la tabla de notificaciones
  const subscription = supa
    .channel('notificaciones-changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'notificaciones' },
      () => {
        cargarNotificaciones();
      }
    )
    .subscribe();
  
  // Actualizar cada 30 segundos también
  setInterval(() => {
    cargarNotificaciones();
  }, 30000);
}

// ========== CONFIGURACIÓN GENERAL ==========

async function cargarConfiguracion() {
  try {
    const { data, error } = await supa
      .from('configuracion')
      .select('*');
    
    if (error) throw error;
    
    // Aplicar configuración a los campos
    data?.forEach(config => {
      switch(config.clave) {
        case 'empresa_nombre':
          document.getElementById('empresaNombre').value = config.valor;
          break;
        case 'empresa_telefono':
          document.getElementById('empresaTel').value = config.valor;
          break;
        case 'empresa_whatsapp':
          document.getElementById('empresaWhatsapp').value = config.valor;
          break;
        case 'empresa_email':
          document.getElementById('empresaEmail').value = config.valor;
          break;
        case 'empresa_direccion':
          document.getElementById('empresaDireccion').value = config.valor;
          break;
        case 'modo_mantenimiento':
          const toggle = document.getElementById('toggleMantenimiento');
          if (toggle) {
            toggle.checked = config.valor === 'true';
            actualizarEstadoMantenimiento(config.valor === 'true');
          }
          break;
        case 'mensaje_mantenimiento':
          document.getElementById('mensajeMantenimiento').value = config.valor;
          document.getElementById('previewMensaje').textContent = config.valor;
          break;
        case 'chatbot_activo':
          const toggleBot = document.getElementById('toggleChatbot');
          if (toggleBot) toggleBot.checked = config.valor === 'true';
          break;
        case 'chatbot_mensaje_bienvenida':
          document.getElementById('mensajeBienvenida').value = config.valor;
          break;
      }
    });
    
  } catch (error) {
    console.error('Error cargando configuración:', error);
  }
}

async function guardarConfiguracionItem(clave, valor, tipo = 'text') {
  try {
    const { error } = await supa
      .from('configuracion')
      .upsert({
        clave,
        valor,
        tipo,
        updated_at: new Date().toISOString()
      });
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error('Error guardando configuración:', error);
    return false;
  }
}

async function guardarEmpresa(e) {
  e.preventDefault();
  
  const configs = [
    { clave: 'empresa_nombre', valor: document.getElementById('empresaNombre').value },
    { clave: 'empresa_telefono', valor: document.getElementById('empresaTel').value },
    { clave: 'empresa_whatsapp', valor: document.getElementById('empresaWhatsapp').value },
    { clave: 'empresa_email', valor: document.getElementById('empresaEmail').value },
    { clave: 'empresa_direccion', valor: document.getElementById('empresaDireccion').value }
  ];
  
  let success = true;
  for (const config of configs) {
    const result = await guardarConfiguracionItem(config.clave, config.valor);
    if (!result) success = false;
  }
  
  if (success) {
    alert('✅ Información guardada correctamente');
  } else {
    alert('❌ Error al guardar la información');
  }
}

async function guardarHorarios(e) {
  e.preventDefault();
  
  const horarios = {
    lun_vie: {
      desde: document.getElementById('horarioLunViernesDesde').value,
      hasta: document.getElementById('horarioLunViernesHasta').value
    },
    sabado: {
      desde: document.getElementById('horarioSabadoDesde').value,
      hasta: document.getElementById('horarioSabadoHasta').value
    },
    domingo_cerrado: document.getElementById('domingoCerrado').checked
  };
  
  const result = await guardarConfiguracionItem('horarios_atencion', JSON.stringify(horarios), 'json');
  
  if (result) {
    alert('✅ Horarios guardados correctamente');
  } else {
    alert('❌ Error al guardar horarios');
  }
}

// ========== MODO MANTENIMIENTO ==========

function toggleMantenimiento(e) {
  const activo = e.target.checked;
  actualizarEstadoMantenimiento(activo);
}

function actualizarEstadoMantenimiento(activo) {
  const estado = document.getElementById('estadoMantenimiento');
  if (estado) {
    estado.innerHTML = activo ? `
      <span class="badge" style="background: var(--warning); color: white; padding: 0.5rem 1.5rem; border-radius: 20px;">
        EN MANTENIMIENTO
      </span>
    ` : `
      <span class="badge" style="background: var(--success); color: white; padding: 0.5rem 1.5rem; border-radius: 20px;">
        SITIO ACTIVO
      </span>
    `;
  }
}

function actualizarPreview() {
  const mensaje = document.getElementById('mensajeMantenimiento').value;
  document.getElementById('previewMensaje').textContent = mensaje || 'Sin mensaje';
}

async function guardarMantenimiento() {
  const activo = document.getElementById('toggleMantenimiento').checked;
  const mensaje = document.getElementById('mensajeMantenimiento').value;
  
  const result1 = await guardarConfiguracionItem('modo_mantenimiento', activo.toString(), 'boolean');
  const result2 = await guardarConfiguracionItem('mensaje_mantenimiento', mensaje);
  
  if (result1 && result2) {
    alert('✅ Configuración de mantenimiento guardada');
    
    // Crear notificación
    await crearNotificacion(
      'sistema',
      activo ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado',
      activo ? 'El sitio está ahora en modo mantenimiento' : 'El sitio está operativo'
    );
  } else {
    alert('❌ Error al guardar configuración de mantenimiento');
  }
}

// ========== CHATBOT ==========

function toggleChatbot(e) {
  // Solo visual por ahora
  console.log('ChatBot:', e.target.checked ? 'Activo' : 'Inactivo');
}

async function guardarChatbot() {
  const activo = document.getElementById('toggleChatbot').checked;
  const mensaje = document.getElementById('mensajeBienvenida').value;
  
  const result1 = await guardarConfiguracionItem('chatbot_activo', activo.toString(), 'boolean');
  const result2 = await guardarConfiguracionItem('chatbot_mensaje_bienvenida', mensaje);
  
  if (result1 && result2) {
    alert('✅ Configuración del ChatBot guardada');
  } else {
    alert('❌ Error al guardar configuración del ChatBot');
  }
}

// CSS adicional para el switch
const switchStyles = `
<style>
.switch input:checked + .slider {
  background-color: var(--success);
}

.switch input:checked + .slider:before {
  content: '';
  position: absolute;
  height: 22px;
  width: 22px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
  transform: translateX(26px);
}

.switch .slider:before {
  content: '';
  position: absolute;
  height: 22px;
  width: 22px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.config-tab.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--primary);
}

.notification-item:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-md);
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 1.1rem;
}

.icon-btn:hover {
  transform: scale(1.1);
}
</style>
`;

// Agregar estilos al documento
document.head.insertAdjacentHTML('beforeend', switchStyles);