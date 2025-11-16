// ==================== ADMIN DASHBOARD JS - VERSIÓN CORREGIDA ====================
// Sistema de navegación SPA + Integración con módulos + Dashboard FUNCIONAL

// ========== IMPORTS ==========
import { supabase } from './modules/supabase-config.js';
import { initProductos } from './modules/productos.js';

const supa = supabase;

// ========== OTROS MÓDULOS (Imports dinámicos seguros) ==========
let initClientes = null;
let initConfiguracion = null;
let configuracionView = '<div class="card"><h3>Módulo de configuración no disponible</h3></div>';

// Cargar otros módulos de forma segura (sin romper si no existen)
(async () => {
  try {
    const clientesModule = await import('./clientes.js');
    initClientes = clientesModule.initClientes;
    console.log('✅ Módulo clientes cargado');
  } catch (e) {
    console.warn('⚠️ Módulo clientes no disponible:', e.message);
  }

  try {
    const configModule = await import('./modules/configuracion-complete.js');
    configuracionView = configModule.configuracionView;
    initConfiguracion = configModule.initConfiguracion;
    console.log('✅ Módulo configuración cargado');
  } catch (e) {
    console.warn('⚠️ Módulo configuración no disponible:', e.message);
  }
})();

// ========== SISTEMA DE NOTIFICACIONES ==========
class NotificationSystem {
  constructor() {
    this.badge = null;
    this.container = null;
    this.subscription = null;
  }

  init() {
    this.badge = document.getElementById('notificationsBadge');
    
    if (!document.getElementById('notificationsContainer')) {
      this.createNotificationsContainer();
    }
    
    this.container = document.getElementById('notificationsContainer');
    this.loadNotifications();
    this.subscribeToNotifications();
    
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
    
    document.addEventListener('click', (e) => {
      if (!container.contains(e.target) && 
          !document.getElementById('notificationsBtn')?.contains(e.target)) {
        container.style.display = 'none';
      }
    });
    
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
      
      if (this.badge) {
        if (unreadCount > 0) {
          this.badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
          this.badge.style.display = 'flex';
        } else {
          this.badge.style.display = 'none';
        }
      }

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

let notificationSystem = null;

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

    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: grid; grid-template-columns: 1fr auto; gap: 1rem; align-items: center;">
        <div style="position: relative;">
          <i class="bi bi-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
          <input 
            type="search" 
            id="searchProductos" 
            placeholder="Buscar productos..." 
            style="width: 100%; padding: 0.75rem 1rem 0.75rem 2.5rem; border: 1px solid var(--border); border-radius: 8px;"
          >
        </div>
        <select id="filterCategoria" style="padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px;">
          <option value="">Todas las categorías</option>
        </select>
      </div>
    </div>

    <div class="card">
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
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <div>
        <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;">Gestión de Clientes</h2>
        <p style="color: var(--text-secondary);" id="contadorClientes">Cargando clientes...</p>
      </div>
      <button class="btn-primary" id="btnExportarClientes">
        <i class="bi bi-download"></i>
        Exportar CSV
      </button>
    </div>

    <div class="grid-4" style="margin-bottom: 2rem;">
      <div class="card">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Total Clientes</div>
        <div style="font-size: 1.75rem; font-weight: 700;" id="totalClientes">0</div>
      </div>
      <div class="card">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Nuevos (30 días)</div>
        <div style="font-size: 1.75rem; font-weight: 700;" id="clientesNuevos">0</div>
      </div>
      <div class="card">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Ciudad Principal</div>
        <div style="font-size: 1.2rem; font-weight: 700;" id="ciudadTop">-</div>
      </div>
      <div class="card">
        <div style="font-size: 0.85rem; color: var(--text-secondary);">Con Email</div>
        <div style="font-size: 1.75rem; font-weight: 700;" id="clientesConEmail">0</div>
      </div>
    </div>
  `,

  configuracion: configuracionView
};

// ========== VARIABLE GLOBAL PARA EL GRÁFICO ==========
let chartInstance = null;

// ========== INICIALIZACIÓN DEL DASHBOARD - ✅ VERSIÓN CORREGIDA ✅ ==========
async function initDashboard() {
  console.log('🚀 Inicializando Dashboard...');

  try {
    // ========== 1. CARGAR DATOS DE HOY ==========
    const { data: resumenHoy, error: errorResumen } = await supa
      .from('v_resumen_hoy')
      .select('*')
      .maybeSingle();

    if (errorResumen) {
      console.error('Error cargando resumen:', errorResumen);
    }

    if (resumenHoy) {
      // Ventas de hoy
      const ventasHoy = resumenHoy.total_hoy || 0;
      const ventasAyer = resumenHoy.total_ayer || 0;
      
      document.getElementById('ventasHoy').textContent = formatGs(ventasHoy);
      document.getElementById('pedidosHoy').textContent = resumenHoy.pedidos_hoy || 0;
      document.getElementById('ticketPromedio').textContent = formatGs(resumenHoy.ticket_promedio_hoy || 0);

      // Calcular cambio porcentual vs ayer
      const changeElement = document.getElementById('ventasChange');
      if (ventasAyer > 0) {
        const cambio = ((ventasHoy - ventasAyer) / ventasAyer) * 100;
        const isPositive = cambio >= 0;
        
        changeElement.className = `kpi-change ${isPositive ? 'positive' : 'negative'}`;
        changeElement.innerHTML = `
          <i class="bi bi-arrow-${isPositive ? 'up' : 'down'}"></i>
          <span>${isPositive ? '+' : ''}${cambio.toFixed(1)}%</span>
        `;
      } else if (ventasHoy > 0) {
        changeElement.className = 'kpi-change positive';
        changeElement.innerHTML = `
          <i class="bi bi-arrow-up"></i>
          <span>+100%</span>
        `;
      } else {
        changeElement.className = 'kpi-change';
        changeElement.innerHTML = `<span>Sin cambio</span>`;
      }
    }

    // ========== 2. CARGAR PRODUCTOS ==========
    const { count: totalProductos } = await supa
      .from('productos')
      .select('*', { count: 'exact', head: true });

    const { count: productosActivos } = await supa
      .from('productos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true);

    document.getElementById('productosTotal').textContent = totalProductos || 0;
    document.getElementById('productosActivos').textContent = productosActivos || 0;

    // ========== 3. MÉTRICAS DE CHATBOT (Por ahora en 0) ==========
    document.getElementById('chatbotInteracciones').textContent = '0';
    document.getElementById('chatbotTasa').textContent = '0%';

    // ========== 4. CARGAR GRÁFICO DE TENDENCIA ==========
    await cargarGraficoTendencia();

    console.log('✅ Dashboard cargado correctamente');

  } catch (error) {
    console.error('❌ Error cargando dashboard:', error);
    
    // Mostrar valores por defecto en caso de error
    document.getElementById('ventasHoy').textContent = 'Gs 0';
    document.getElementById('pedidosHoy').textContent = '0';
    document.getElementById('ticketPromedio').textContent = 'Gs 0';
    document.getElementById('productosTotal').textContent = '0';
    document.getElementById('productosActivos').textContent = '0';
  }
}

// ========== FUNCIÓN PARA CARGAR GRÁFICO DE TENDENCIA - ✅ NUEVA ✅ ==========
async function cargarGraficoTendencia() {
  try {
    // Obtener datos de los últimos 7 días
    const { data: ventasPorDia, error } = await supa
      .from('v_ventas_por_dia')
      .select('*')
      .order('dia', { ascending: true })
      .limit(7);

    if (error) {
      console.error('Error cargando datos del gráfico:', error);
      return;
    }

    if (!ventasPorDia || ventasPorDia.length === 0) {
      console.warn('No hay datos para el gráfico');
      mostrarMensajeGraficoVacio();
      return;
    }

    // Preparar datos para el gráfico
    const labels = ventasPorDia.map(v => {
      const fecha = new Date(v.dia);
      return fecha.toLocaleDateString('es-PY', { day: '2-digit', month: 'short' });
    });

    const datos = ventasPorDia.map(v => parseFloat(v.total_gs) || 0);
    const pedidos = ventasPorDia.map(v => v.pedidos || 0);

    // Destruir gráfico anterior si existe
    if (chartInstance) {
      chartInstance.destroy();
    }

    // Crear nuevo gráfico
    const ctx = document.getElementById('chartVentasTendencia');
    if (!ctx) {
      console.error('Canvas no encontrado');
      return;
    }

    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ventas (Gs)',
            data: datos,
            borderColor: 'rgb(111, 92, 56)',
            backgroundColor: 'rgba(111, 92, 56, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBackgroundColor: 'rgb(111, 92, 56)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            },
            callbacks: {
              label: function(context) {
                const index = context.dataIndex;
                const ventas = formatGs(context.parsed.y);
                const numPedidos = pedidos[index];
                return [
                  `Ventas: ${ventas}`,
                  `Pedidos: ${numPedidos}`
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return 'Gs ' + (value / 1000).toFixed(0) + 'k';
              },
              font: {
                size: 12
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });

    console.log('✅ Gráfico de tendencia cargado');

  } catch (error) {
    console.error('❌ Error creando gráfico:', error);
    mostrarMensajeGraficoVacio();
  }
}

// ========== MOSTRAR MENSAJE CUANDO NO HAY DATOS - ✅ NUEVA ✅ ==========
function mostrarMensajeGraficoVacio() {
  const canvas = document.getElementById('chartVentasTendencia');
  if (!canvas) return;

  const parent = canvas.parentElement;
  if (!parent) return;

  parent.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 300px; color: var(--text-muted);">
      <i class="bi bi-graph-up" style="font-size: 4rem; opacity: 0.3; margin-bottom: 1rem;"></i>
      <p style="font-size: 1.1rem; margin: 0;">No hay datos de ventas para mostrar</p>
      <p style="font-size: 0.9rem; margin-top: 0.5rem;">Los datos aparecerán cuando haya pedidos finalizados</p>
    </div>
  `;
}

// ========== FORMATO DE MONEDA ==========
function formatGs(valor) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
  }).format(valor).replace('PYG', 'Gs').trim();
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
          initProductos();
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

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Admin Dashboard...');
  
  // Inicializar sistemas
  notificationSystem = new NotificationSystem();
  notificationSystem.init();
  
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

  // Logout
  const logoutBtn = document.getElementById('logoutBtn');
  logoutBtn?.addEventListener('click', async () => {
    const ok = confirm('¿Seguro que querés cerrar sesión?');
    if (!ok) return;

    try {
      await supa.auth.signOut();
      console.log('✅ Sesión cerrada');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
    }

    window.location.href = 'loginAdmin.html';
  });
  
  // Cargar vista inicial
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  console.log('✅ Dashboard inicializado');
});
