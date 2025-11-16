// ==================== ADMIN DASHBOARD JS - VERSIÓN FINAL ====================
// Cambios finales:
// 1. ✅ Email dinámico del usuario autenticado
// 2. ✅ Chatbot removido completamente

import { supa } from './supabase-client.js';
import { configuracionView, initConfiguracion } from './modules/configuracion-complete.js';
import { initProductos } from './modules/productos.js';
import { initClientes } from './clientes.js';

// ========== SISTEMA DE NOTIFICACIONES ==========
class NotificationSystem {
  constructor() {
    this.badge = null;
    this.container = null;
    this.subscription = null;
  }

  init() {
    // Crear badge de notificaciones
    this.badge = document.getElementById('notificationsBadge');
    
    // Crear contenedor de notificaciones si no existe
    if (!document.getElementById('notificationsContainer')) {
      this.createNotificationsContainer();
    }
    
    this.container = document.getElementById('notificationsContainer');
    
    // Cargar notificaciones iniciales
    this.loadNotifications();
    
    // Suscribirse a cambios en tiempo real
    this.subscribeToNotifications();
    
    // Event listener para el botón
    document.getElementById('notificationsBtn')?.addEventListener('click', () => {
      this.togglePanel();
    });
  }

  createNotificationsContainer() {
    const container = document.createElement('div');
    container.id = 'notificationsContainer';
    container.className = 'notifications-panel';
    container.style.cssText = `
      position: fixed;
      top: 70px;
      right: 20px;
      width: 380px;
      max-height: 600px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      display: none;
      z-index: 1000;
      overflow: hidden;
      border: 1px solid var(--border);
    `;
    
    container.innerHTML = `
      <div style="padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">
          <i class="bi bi-bell"></i> Notificaciones
        </h3>
        <button id="markAllReadBtn" style="background: none; border: none; color: var(--primary); cursor: pointer; font-size: 0.9rem;">
          Marcar todas leídas
        </button>
      </div>
      <div id="notificationsList" style="max-height: 500px; overflow-y: auto;">
        <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
          <div class="spinner"></div>
          <p style="margin-top: 1rem;">Cargando...</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    
    // Cerrar al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target) && 
          !document.getElementById('notificationsBtn')?.contains(e.target)) {
        container.style.display = 'none';
      }
    });
    
    // Marcar todas como leídas
    document.getElementById('markAllReadBtn')?.addEventListener('click', () => {
      this.markAllAsRead();
    });
  }

  togglePanel() {
    if (this.container.style.display === 'none') {
      this.container.style.display = 'block';
      this.loadNotifications();
    } else {
      this.container.style.display = 'none';
    }
  }

  async loadNotifications() {
    try {
      const { data, error } = await supa
        .from('notificaciones')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      const unreadCount = data.filter(n => !n.leida).length;
      
      // Actualizar badge
      if (this.badge) {
        if (unreadCount > 0) {
          this.badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
          this.badge.style.display = 'flex';
        } else {
          this.badge.style.display = 'none';
        }
      }

      // Renderizar lista
      this.renderNotifications(data);

    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    }
  }

  renderNotifications(notifications) {
    const list = document.getElementById('notificationsList');
    if (!list) return;

    if (notifications.length === 0) {
      list.innerHTML = `
        <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-bell-slash" style="font-size: 3rem; opacity: 0.3;"></i>
          <p style="margin-top: 1rem;">No hay notificaciones</p>
        </div>
      `;
      return;
    }

    list.innerHTML = notifications.map(notif => {
      const iconMap = {
        pedido: 'cart-check',
        sistema: 'gear',
        chatbot: 'robot',
        catering: 'calendar-event',
        promocion: 'tag',
        stock: 'box-seam',
        default: 'bell'
      };

      const colorMap = {
        pedido: 'var(--success)',
        sistema: 'var(--info)',
        chatbot: 'var(--primary)',
        catering: 'var(--warning)',
        promocion: 'var(--primary)',
        stock: 'var(--danger)',
        default: 'var(--text-secondary)'
      };

      const icon = iconMap[notif.tipo] || iconMap.default;
      const color = colorMap[notif.tipo] || colorMap.default;
      const fecha = new Date(notif.created_at).toLocaleString('es-PY');

      return `
        <div class="notification-item ${!notif.leida ? 'unread' : ''}" 
             data-id="${notif.id}"
             style="padding: 1rem 1.5rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; ${!notif.leida ? 'background: rgba(111,92,56,0.05);' : ''}">
          <div style="display: flex; gap: 1rem; align-items: start;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: ${color}15; color: ${color}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              <i class="bi bi-${icon}"></i>
            </div>
            <div style="flex: 1; min-width: 0;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.25rem;">
                <strong style="font-size: 0.95rem;">${notif.titulo}</strong>
                ${!notif.leida ? '<span style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%; flex-shrink: 0;"></span>' : ''}
              </div>
              <p style="margin: 0.25rem 0; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.4;">
                ${notif.mensaje}
              </p>
              <small style="font-size: 0.8rem; color: var(--text-muted);">${fecha}</small>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Event listeners para marcar como leída
    list.querySelectorAll('.notification-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.markAsRead(id);
      });
    });
  }

  async markAsRead(id) {
    try {
      await supa
        .from('notificaciones')
        .update({ leida: true })
        .eq('id', id);
      
      this.loadNotifications();
    } catch (error) {
      console.error('Error marcando notificación:', error);
    }
  }

  async markAllAsRead() {
    try {
      await supa
        .from('notificaciones')
        .update({ leida: true })
        .eq('leida', false);
      
      this.loadNotifications();
    } catch (error) {
      console.error('Error marcando todas:', error);
    }
  }

  subscribeToNotifications() {
    // Suscribirse a cambios en tiempo real
    this.subscription = supa
      .channel('notificaciones-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'notificaciones' },
        () => {
          this.loadNotifications();
        }
      )
      .subscribe();
  }

  destroy() {
    if (this.subscription) {
      supa.removeChannel(this.subscription);
    }
  }
}

// Instancia global del sistema de notificaciones
let notificationSystem = null;

// ========== MODO MANTENIMIENTO ==========
class MaintenanceMode {
  constructor() {
    this.isActive = false;
  }

  async init() {
    await this.checkStatus();
  }

  async checkStatus() {
    try {
      const { data, error } = await supa
        .from('configuracion_general')
        .select('modo_mantenimiento')
        .single();

      if (!error && data) {
        this.isActive = data.modo_mantenimiento;
        this.updateUI();
      }
    } catch (error) {
      console.error('Error verificando modo mantenimiento:', error);
    }
  }

  async toggle() {
    try {
      const newStatus = !this.isActive;
      
      const { error } = await supa
        .from('configuracion_general')
        .update({ modo_mantenimiento: newStatus })
        .eq('id', 1);

      if (error) throw error;

      this.isActive = newStatus;
      this.updateUI();

      // Crear notificación
      await crearNotificacionGlobal(
        'sistema',
        'Modo Mantenimiento',
        `Modo mantenimiento ${newStatus ? 'activado' : 'desactivado'}`
      );

      return true;
    } catch (error) {
      console.error('Error cambiando modo mantenimiento:', error);
      return false;
    }
  }

  updateUI() {
    const badge = document.getElementById('maintenanceBadge');
    if (badge) {
      badge.style.display = this.isActive ? 'inline-block' : 'none';
    }

    // Actualizar botón en configuración si existe
    const btn = document.getElementById('btnModoMantenimiento');
    if (btn) {
      btn.textContent = this.isActive ? 'Desactivar Mantenimiento' : 'Activar Mantenimiento';
      btn.className = this.isActive ? 'btn-danger' : 'btn-warning';
    }
  }
}

// Instancia global del modo mantenimiento
let maintenanceMode = null;

// ========== VISTAS (Templates HTML) ==========
const views = {
  dashboard: `
    <div class="welcome-section" style="margin-bottom: 2rem;">
      <h2 style="font-size: 2.25rem; margin-bottom: 0.5rem; font-weight: 800; background: linear-gradient(135deg, var(--primary), var(--primary-light)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
        ¡Bienvenido de vuelta! 👋
      </h2>
      <p style="color: var(--text-secondary); font-size: 1.1rem;">Intelligence Center - Análisis en Tiempo Real</p>
    </div>

    <!-- KPIs Principales -->
    <div class="grid-4" style="margin-bottom: 2rem;">
      <!-- Ventas Hoy -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, rgba(111,92,56,0.1), rgba(111,92,56,0.05)); color: var(--primary);">
          <i class="bi bi-currency-dollar"></i>
        </div>
        <div>
          <div class="kpi-label">Ventas Hoy</div>
          <div class="kpi-value" id="ventasHoy">Gs 0</div>
          <div class="kpi-change positive" id="ventasChange">
            <i class="bi bi-arrow-up"></i>
            <span>+0%</span>
          </div>
        </div>
      </div>

      <!-- Pedidos Hoy -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.05)); color: var(--success);">
          <i class="bi bi-cart-check"></i>
        </div>
        <div>
          <div class="kpi-label">Pedidos Hoy</div>
          <div class="kpi-value" id="pedidosHoy">0</div>
          <div class="kpi-subtitle">Ticket promedio: <span id="ticketPromedio">Gs 0</span></div>
        </div>
      </div>

      <!-- ChatBot IA -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(59,130,246,0.05)); color: var(--info);">
          <i class="bi bi-robot"></i>
        </div>
        <div>
          <div class="kpi-label">Automatización IA</div>
          <div class="kpi-value" id="chatbotInteracciones">0</div>
          <div class="kpi-subtitle"><span id="chatbotTasa">0%</span> tasa de éxito</div>
        </div>
      </div>

      <!-- Productos Total -->
      <div class="kpi-card">
        <div class="kpi-icon" style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05)); color: var(--warning);">
          <i class="bi bi-box-seam"></i>
        </div>
        <div>
          <div class="kpi-label">Productos</div>
          <div class="kpi-value" id="productosTotal">0</div>
          <div class="kpi-subtitle"><span id="productosActivos">0</span> activos</div>
        </div>
      </div>
    </div>

    <!-- Gráfico de Tendencia -->
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="chart-title">
          <i class="bi bi-graph-up-arrow"></i>
          Tendencia de Ventas (Últimos 7 Días)
        </h3>
      </div>
      <div style="position: relative; height: 300px; width: 100%;">
        <canvas id="chartVentasTendencia"></canvas>
      </div>
    </div>

    <!-- Performance Semanal -->
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="chart-title">
          <i class="bi bi-calendar-week"></i>
          Performance Semanal
        </h3>
      </div>
      <div class="week-grid" id="weekGrid">
        <div class="loading" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
          <div class="spinner"></div>
          <p style="margin-top: 1rem; color: var(--text-muted);">Cargando datos...</p>
        </div>
      </div>
    </div>

    <!-- Insights en Tiempo Real -->
    <div class="chart-container">
      <div class="chart-header">
        <h3 class="chart-title">
          <i class="bi bi-lightbulb"></i>
          Insights en Tiempo Real
        </h3>
      </div>
      <div class="insights-grid">
        <!-- Top Producto -->
        <div class="insight-card">
          <div class="insight-icon">🏆</div>
          <div class="insight-content">
            <strong>Producto Estrella Hoy</strong>
            <span id="topProducto">-</span>
            <small id="topProductoVentas">0 unidades vendidas</small>
          </div>
        </div>

        <!-- ChatBot IA Stats -->
        <div class="insight-card">
          <div class="insight-icon">🤖</div>
          <div class="insight-content">
            <strong>ChatBot IA</strong>
            <span id="chatbotCarrito">0</span>
            <small>productos agregados al carrito</small>
          </div>
        </div>

        <!-- Catering Automatizado -->
        <div class="insight-card">
          <div class="insight-icon">🎉</div>
          <div class="insight-content">
            <strong>Catering Automatizado</strong>
            <span id="cateringBot">0%</span>
            <small id="cateringBotText">del total via ChatBot</small>
          </div>
        </div>
      </div>
    </div>

    <!-- Impacto de Promociones -->
    <div class="promo-analysis">
      <div class="chart-header">
        <h3 class="chart-title">
          <i class="bi bi-tag-fill"></i>
          Impacto de Promociones (Últimos 7 Días)
        </h3>
      </div>
      <div class="promo-grid">
        <div class="promo-stat">
          <span class="label">Sin Promoción</span>
          <span class="value" id="ventasSinPromo">Gs 0</span>
        </div>
        <div class="promo-arrow">
          <i class="bi bi-arrow-right"></i>
          <span class="uplift" id="promoUplift">+0%</span>
        </div>
        <div class="promo-stat highlight">
          <span class="label">Con Promoción</span>
          <span class="value" id="ventasConPromo">Gs 0</span>
        </div>
      </div>
    </div>
  `,

  productos: `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;">Gestión de Productos</h2>
        <p style="color: var(--text-secondary);">Administra tu catálogo completo</p>
      </div>
      <button class="btn-primary" id="btnNuevoProducto">
        <i class="bi bi-plus-lg"></i>
        Nuevo Producto
      </button>
    </div>

    <!-- Filtros y Búsqueda -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; align-items: center;">
        <div style="position: relative;">
          <i class="bi bi-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
          <input 
            type="search" 
            id="searchProductos" 
            placeholder="Buscar productos por nombre..." 
            style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;"
          >
        </div>
        <select id="filterCategoria" style="padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
          <option value="">Todas las categorías</option>
        </select>
        <div style="display: flex; gap: 0.5rem;">
          <button id="btnViewGrid" class="icon-btn" style="background: var(--bg-main);">
            <i class="bi bi-grid-3x3-gap"></i>
          </button>
          <button id="btnViewList" class="icon-btn active" style="background: var(--primary); color: white;">
            <i class="bi bi-list-ul"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Tabla de Productos -->
    <div class="card" id="productosTableContainer">
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border);">
              <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Producto</th>
              <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Categoría</th>
              <th style="padding: 1rem; text-align: right; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Precio</th>
              <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Estado</th>
              <th style="padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase;">Acciones</th>
            </tr>
          </thead>
          <tbody id="productosTableBody">
            <tr>
              <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <div class="spinner"></div>
                <p style="margin-top: 1rem;">Cargando productos...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,

  promos: `
   <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Promociones</h2>
   <div class="card">
      <iframe src="promos.html" style="width: 100%; height: 85vh; border: none; border-radius: 12px;"></iframe>
  </div>
`,

  pedidos: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Pedidos Pendientes</h2>
    <div class="card">
      <iframe src="pendientes.html" style="width: 100%; height: 80vh; border: none; border-radius: 12px;"></iframe>
    </div>
  `,

  catering: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Gestión de Catering</h2>
    <div class="card">
      <iframe src="catering.html" style="width: 100%; height: 80vh; border: none; border-radius: 12px;"></iframe>
    </div>
  `,

  clientes: `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;">Gestión de Clientes</h2>
        <p style="color: var(--text-secondary);" id="contadorClientes">Cargando clientes...</p>
      </div>
      <button class="btn-primary" id="btnExportarClientes">
        <i class="bi bi-download"></i>
        Exportar CSV
      </button>
    </div>

    <!-- Estadísticas -->
    <div class="grid-4" style="margin-bottom: 2rem;">
      <div class="card" style="border-top: 3px solid var(--primary);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(111,92,56,0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-people"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Total Clientes</div>
            <div style="font-size: 1.75rem; font-weight: 700;" id="totalClientes">0</div>
          </div>
        </div>
      </div>

      <div class="card" style="border-top: 3px solid var(--success);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(16,185,129,0.1); color: var(--success); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-person-plus"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Nuevos (30 días)</div>
            <div style="font-size: 1.75rem; font-weight: 700;" id="clientesNuevos">0</div>
          </div>
        </div>
      </div>

      <div class="card" style="border-top: 3px solid var(--info);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(59,130,246,0.1); color: var(--info); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-geo-alt"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Ciudad Principal</div>
            <div style="font-size: 1.2rem; font-weight: 700;" id="ciudadTop">-</div>
          </div>
        </div>
      </div>

      <div class="card" style="border-top: 3px solid var(--warning);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(245,158,11,0.1); color: var(--warning); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-envelope-check"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Con Email</div>
            <div style="font-size: 1.75rem; font-weight: 700;" id="clientesConEmail">0</div>
          </div>
        </div>
      </div>
    </div>

    <!-- El resto del contenido se carga dinámicamente -->
  `,

  configuracion: configuracionView
};

// ========== INICIALIZACIÓN DEL DASHBOARD ==========
async function initDashboard() {
  console.log('🚀 Inicializando Dashboard Intelligence...');

  try {
    // 1. Usar la vista v_resumen_hoy
    const { data: resumenHoy, error: errorResumen } = await supa
      .from('v_resumen_hoy')
      .select('*')
      .maybeSingle();

    if (resumenHoy) {
      document.getElementById('ventasHoy').textContent = formatGs(resumenHoy.total_hoy || 0);
      document.getElementById('pedidosHoy').textContent = resumenHoy.pedidos_hoy || 0;
      document.getElementById('ticketPromedio').textContent = formatGs(resumenHoy.ticket_promedio_hoy || 0);
      
      if (resumenHoy.total_ayer && resumenHoy.total_ayer > 0) {
        const cambio = ((resumenHoy.total_hoy - resumenHoy.total_ayer) / resumenHoy.total_ayer * 100).toFixed(1);
        const changeElem = document.getElementById('ventasChange');
        if (changeElem) {
          changeElem.querySelector('span').textContent = `${cambio > 0 ? '+' : ''}${cambio}%`;
          changeElem.className = cambio > 0 ? 'kpi-change positive' : 'kpi-change negative';
        }
      }
    } else {
      setDefaultValues();
    }

    // 2. Cargar datos de ventas por día para los últimos 7 días
    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hoy.getDate() - 6); // Últimos 7 días incluyendo hoy

    const { data: ventasSemana } = await supa
      .from('v_ventas_por_dia')
      .select('*')
      .gte('dia', hace7Dias.toISOString().split('T')[0])
      .order('dia', { ascending: true });

    // Crear array de 7 días aunque no tengan ventas
    const diasCompletos = [];
    for (let i = 0; i < 7; i++) {
      const fecha = new Date(hace7Dias);
      fecha.setDate(hace7Dias.getDate() + i);
      const diaStr = fecha.toISOString().split('T')[0];
      
      const ventaDelDia = ventasSemana?.find(v => v.dia === diaStr);
      
      diasCompletos.push({
        dia: diaStr,
        total_gs: ventaDelDia?.total_gs || 0,
        pedidos: ventaDelDia?.pedidos || 0
      });
    }

    initChartVentas(diasCompletos);
    initWeekGrid(diasCompletos);

    // 3. Cargar métricas del chatbot
    const { data: chatbotMetrics } = await supa
      .from('v_chatbot_metricas_hoy')
      .select('*')
      .maybeSingle();

    if (chatbotMetrics) {
      document.getElementById('chatbotInteracciones').textContent = chatbotMetrics.total_interacciones || 0;
      document.getElementById('chatbotTasa').textContent = `${chatbotMetrics.tasa_exito || 0}%`;
      document.getElementById('chatbotCarrito').textContent = chatbotMetrics.productos_agregados_bot || 0;
    }

    // 4. Cargar top productos
    const { data: topProductos } = await supa
      .from('v_top_productos_hoy')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (topProductos) {
      document.getElementById('topProducto').textContent = topProductos.nombre || '-';
      document.getElementById('topProductoVentas').textContent = `${topProductos.cantidad_vendida || 0} unidades vendidas`;
    }

    // 5. Cargar stats de catering
    const { data: cateringStats } = await supa
      .from('v_catering_bot_vs_manual')
      .select('*')
      .maybeSingle();

    if (cateringStats) {
      document.getElementById('cateringBot').textContent = `${cateringStats.porcentaje_automatizado || 0}%`;
      document.getElementById('cateringBotText').textContent = 
        `${cateringStats.catering_bot || 0} de ${cateringStats.total_catering || 0} via ChatBot`;
    }

    // 6. Cargar impacto de promociones
    const { data: promos } = await supa
      .from('v_impacto_promos_semana')
      .select('*')
      .maybeSingle();

    if (promos) {
      document.getElementById('ventasSinPromo').textContent = formatGs(promos.ventas_sin_promo || 0);
      document.getElementById('ventasConPromo').textContent = formatGs(promos.ventas_con_promo || 0);
      document.getElementById('promoUplift').textContent = `+${promos.incremento_porcentaje || 0}%`;
    }

    // 7. Cargar total productos
    const { count: totalProductos } = await supa
      .from('productos')
      .select('*', { count: 'exact', head: true });

    const { count: productosActivos } = await supa
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    document.getElementById('productosTotal').textContent = totalProductos || 0;
    document.getElementById('productosActivos').textContent = productosActivos || 0;

    console.log('✅ Dashboard cargado correctamente');

  } catch (error) {
    console.error('❌ Error cargando dashboard:', error);
    setDefaultValues();
  }
}

function setDefaultValues() {
  document.getElementById('ventasHoy').textContent = formatGs(0);
  document.getElementById('pedidosHoy').textContent = '0';
  document.getElementById('ticketPromedio').textContent = formatGs(0);
  document.getElementById('productosTotal').textContent = '0';
  document.getElementById('productosActivos').textContent = '0';
  document.getElementById('chatbotInteracciones').textContent = '0';
  document.getElementById('chatbotTasa').textContent = '0%';
  document.getElementById('chatbotCarrito').textContent = '0';
  document.getElementById('topProducto').textContent = 'Sin datos';
  document.getElementById('topProductoVentas').textContent = '0 unidades vendidas';
  document.getElementById('cateringBot').textContent = '0%';
  document.getElementById('cateringBotText').textContent = '0 de 0 via ChatBot';
  document.getElementById('ventasSinPromo').textContent = formatGs(0);
  document.getElementById('ventasConPromo').textContent = formatGs(0);
  document.getElementById('promoUplift').textContent = '+0%';
}

function formatGs(valor) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
  }).format(valor).replace('PYG', 'Gs').trim();
}

function initChartVentas(data) {
  const ctx = document.getElementById('chartVentasTendencia');
  if (!ctx) return;

  if (window.dashboardChart) {
    window.dashboardChart.destroy();
  }

  const labels = data.map(d => {
    const fecha = new Date(d.dia + 'T00:00:00');
    return fecha.toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric' });
  });

  const valores = data.map(d => parseFloat(d.total_gs) || 0);

  window.dashboardChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ventas (Gs)',
        data: valores,
        borderColor: 'rgb(111, 92, 56)',
        backgroundColor: 'rgba(111, 92, 56, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(111, 92, 56)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: (context) => ` ${formatGs(context.parsed.y)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatGs(value)
          },
          grid: { color: 'rgba(0, 0, 0, 0.05)' }
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

function initWeekGrid(data) {
  const grid = document.getElementById('weekGrid');
  if (!grid) return;

  const hoy = new Date().toISOString().split('T')[0];

  grid.innerHTML = data.map(d => {
    const fecha = new Date(d.dia + 'T00:00:00');
    const esHoy = d.dia === hoy;
    const nombreDia = fecha.toLocaleDateString('es-PY', { weekday: 'short' });
    const ventas = formatGs(d.total_gs || 0);
    const pedidos = d.pedidos || 0;

    return `
      <div class="day-cell ${esHoy ? 'today' : ''}">
        <div class="day-name">${nombreDia.toUpperCase()}</div>
        <div class="day-sales">${ventas}</div>
        <div class="day-orders">${pedidos} pedidos</div>
      </div>
    `;
  }).join('');
}

// ========== NAVEGACIÓN ==========
function navigateTo(viewName) {
  const contentArea = document.getElementById('contentArea');
  const pageTitle = document.getElementById('pageTitle');
  
  if (views[viewName]) {
    contentArea.innerHTML = views[viewName];
    
    const titles = {
      dashboard: 'Dashboard',
      productos: 'Productos',
      promos: 'Promociones',
      pedidos: 'Pedidos',
      catering: 'Catering',
      clientes: 'Clientes',
      configuracion: 'Configuración'
    };
    
    pageTitle.textContent = titles[viewName] || viewName;

    try { 
      window.location.hash = viewName; 
    } catch(e) {
      console.log('No se pudo actualizar el hash');
    }
    
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    setTimeout(() => {
      switch(viewName) {
        case 'dashboard':
          initDashboard();
          break;
        case 'productos':
          if (typeof initProductos === 'function') initProductos();
          break;
        case 'clientes':
          if (typeof initClientes === 'function') initClientes();
          break;
        case 'configuracion':
          if (typeof initConfiguracion === 'function') initConfiguracion();
          break;
      }
    }, 100);
  }
}

// ========== FUNCIÓN PARA CREAR NOTIFICACIONES ==========
export async function crearNotificacionGlobal(tipo, titulo, mensaje) {
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
    console.log('✅ Notificación creada:', titulo);
    
    // Recargar notificaciones si el sistema está inicializado
    if (notificationSystem) {
      notificationSystem.loadNotifications();
    }
  } catch (error) {
    console.error('Error creando notificación:', error);
  }
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Inicializando Admin Dashboard Final...');
  
  // Limpiar modales al inicio
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.style.display = 'none';
  });
  
  // Cargar email del usuario autenticado
  try {
    const { data: { user } } = await supa.auth.getUser();
    if (user && user.email) {
      const userEmailElement = document.querySelector('.user-email');
      if (userEmailElement) {
        userEmailElement.textContent = user.email;
      }
      const userNameElement = document.querySelector('.user-name');
      if (userNameElement) {
        userNameElement.textContent = user.email.split('@')[0];
      }
      console.log('✅ Usuario autenticado:', user.email);
    }
  } catch (error) {
    console.error('Error cargando usuario:', error);
  }
  
  // Inicializar sistemas
  notificationSystem = new NotificationSystem();
  notificationSystem.init();
  
  // CHATBOT REMOVIDO - No se inicializa
  
  maintenanceMode = new MaintenanceMode();
  maintenanceMode.init();
  
  // Sidebar toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');

  sidebarToggle?.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });

  mobileMenuBtn?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
  });

  // Navigation links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      navigateTo(view);
      
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('mobile-open');
      }
    });
  });

  // Botón de acciones rápidas
  document.getElementById('quickAddBtn')?.addEventListener('click', () => {
    const menu = document.createElement('div');
    menu.style.cssText = `
      position: fixed;
      top: 70px;
      right: 80px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.15);
      padding: 0.5rem;
      z-index: 1000;
      min-width: 200px;
    `;
    
    menu.innerHTML = `
      <button class="quick-action-btn" onclick="navigateTo('productos'); setTimeout(() => document.getElementById('btnNuevoProducto')?.click(), 200)">
        <i class="bi bi-box-seam"></i> Nuevo Producto
      </button>
      <button class="quick-action-btn" onclick="navigateTo('promos')">
        <i class="bi bi-tag"></i> Nueva Promoción
      </button>
      <button class="quick-action-btn" onclick="navigateTo('catering')">
        <i class="bi bi-calendar-event"></i> Nueva Reserva
      </button>
    `;
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
      document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target) && e.target.id !== 'quickAddBtn') {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      });
    }, 100);
  });

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', async () => {
    const ok = confirm('¿Seguro que querés cerrar sesión?');
    if (!ok) return;

    try {
      await supa.auth.signOut();
      console.log('✅ Sesión cerrada correctamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }

    window.location.href = 'loginAdmin.html';
  });

  // Cargar vista inicial
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // Handle browser back/forward
  window.addEventListener('hashchange', () => {
    const view = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(view);
  });

  console.log('✅ Admin Dashboard inicializado correctamente');
});

// Agregar estilos CSS para botones de acción rápida
const style = document.createElement('style');
style.textContent = `
  .quick-action-btn {
    width: 100%;
    padding: 0.75rem 1rem;
    background: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    font-size: 0.95rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: background 0.2s;
  }
  
  .quick-action-btn:hover {
    background: var(--bg-main);
  }
  
  .quick-action-btn i {
    color: var(--primary);
    font-size: 1.1rem;
  }
`;
document.head.appendChild(style);