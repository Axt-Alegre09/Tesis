// ==================== ADMIN DASHBOARD JS (OPTIMIZADO) ====================
// Sistema de navegación SPA con cliente Supabase centralizado

import { supa } from './supabase-client.js';
import { configuracionView, initConfiguracion } from './modules/configuracion-complete.js';
import { initProductos } from './modules/productos.js';
import { initClientes } from './clientes.js';

// ========== VISTAS (Templates HTML de cada sección) ==========
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
    // 1. Cargar datos básicos de ventas del día actual con query directa
    const hoy = new Date().toISOString().split('T')[0];
    
    const { data: ventasHoy, error: errorVentas } = await supa
      .from('pedido')
      .select('total')
      .eq('fecha', hoy)
      .eq('estado', 'entregado');
    
    if (!errorVentas && ventasHoy) {
      const totalHoy = ventasHoy.reduce((sum, p) => sum + (parseFloat(p.total) || 0), 0);
      const pedidosHoy = ventasHoy.length;
      const ticketPromedio = pedidosHoy > 0 ? totalHoy / pedidosHoy : 0;
      
      document.getElementById('ventasHoy').textContent = formatGs(totalHoy);
      document.getElementById('pedidosHoy').textContent = pedidosHoy;
      document.getElementById('ticketPromedio').textContent = formatGs(ticketPromedio);
    }

    // 2. Cargar ventas últimos 7 días
    const hace7Dias = new Date();
    hace7Dias.setDate(hace7Dias.getDate() - 6);
    
    const { data: ventasSemana, error: errorSemana } = await supa
      .from('pedido')
      .select('fecha, total')
      .gte('fecha', hace7Dias.toISOString().split('T')[0])
      .lte('fecha', hoy)
      .eq('estado', 'entregado')
      .order('fecha', { ascending: true });

    if (!errorSemana && ventasSemana) {
      // Agrupar por día
      const ventasPorDia = {};
      ventasSemana.forEach(venta => {
        if (!ventasPorDia[venta.fecha]) {
          ventasPorDia[venta.fecha] = { total_gs: 0, pedidos: 0, dia: venta.fecha };
        }
        ventasPorDia[venta.fecha].total_gs += parseFloat(venta.total) || 0;
        ventasPorDia[venta.fecha].pedidos++;
      });
      
      const datosGrafico = Object.values(ventasPorDia);
      if (datosGrafico.length > 0) {
        initChartVentas(datosGrafico);
        initWeekGrid(datosGrafico);
      }
    }

    // 3. Métricas simuladas del ChatBot (por ahora hardcoded)
    document.getElementById('chatbotInteracciones').textContent = '42';
    document.getElementById('chatbotTasa').textContent = '87%';
    document.getElementById('chatbotCarrito').textContent = '15';

    // 4. Top producto del día (consulta simplificada)
    const { data: ventasProductos } = await supa
      .from('detalle_pedido')
      .select('producto_id, cantidad')
      .in('pedido_id', ventasHoy?.map(v => v.id) || []);

    if (ventasProductos && ventasProductos.length > 0) {
      // Agrupar y encontrar el más vendido
      const productoConteo = {};
      ventasProductos.forEach(vp => {
        if (!productoConteo[vp.producto_id]) {
          productoConteo[vp.producto_id] = 0;
        }
        productoConteo[vp.producto_id] += vp.cantidad;
      });
      
      const topId = Object.keys(productoConteo).reduce((a, b) => 
        productoConteo[a] > productoConteo[b] ? a : b
      );
      
      // Obtener nombre del producto
      const { data: producto } = await supa
        .from('productos')
        .select('nombre')
        .eq('id', topId)
        .single();
      
      if (producto) {
        document.getElementById('topProducto').textContent = producto.nombre;
        document.getElementById('topProductoVentas').textContent = 
          `${productoConteo[topId]} unidades vendidas`;
      }
    } else {
      document.getElementById('topProducto').textContent = 'Sin ventas hoy';
      document.getElementById('topProductoVentas').textContent = '0 unidades vendidas';
    }

    // 5. Estadísticas de catering (simulado)
    document.getElementById('cateringBot').textContent = '42.9%';
    document.getElementById('cateringBotText').textContent = '6 de 14 via ChatBot';

    // 6. Impacto de promociones (simulado)
    document.getElementById('ventasSinPromo').textContent = formatGs(2247500);
    document.getElementById('ventasConPromo').textContent = formatGs(0);
    document.getElementById('promoUplift').textContent = '+0%';

    // 7. Total productos
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
  }
}

// Función para formatear guaraníes
function formatGs(valor) {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0
  }).format(valor).replace('PYG', 'Gs').trim();
}

// Inicializar Chart.js para tendencia de ventas
function initChartVentas(data) {
  const ctx = document.getElementById('chartVentasTendencia');
  if (!ctx) return;

  // Destruir gráfico anterior si existe
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
        legend: {
          display: false
        },
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
          grid: {
            color: 'rgba(0, 0, 0, 0.05)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// Inicializar grid semanal
function initWeekGrid(data) {
  const grid = document.getElementById('weekGrid');
  if (!grid) return;

  const hoy = new Date().toISOString().split('T')[0];
  
  // Crear array de 7 días
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() - i);
    dias.push(fecha.toISOString().split('T')[0]);
  }

  grid.innerHTML = dias.map(dia => {
    const dataDelDia = data.find(d => d.dia === dia);
    const fecha = new Date(dia + 'T00:00:00');
    const esHoy = dia === hoy;
    const nombreDia = fecha.toLocaleDateString('es-PY', { weekday: 'short' });
    const ventas = formatGs(dataDelDia?.total_gs || 0);
    const pedidos = dataDelDia?.pedidos || 0;

    return `
      <div class="day-cell ${esHoy ? 'today' : ''}">
        <div class="day-name">${nombreDia}</div>
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
    // Limpiar contenido anterior
    contentArea.innerHTML = views[viewName];
    
    // Actualizar título
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

    // Actualizar hash para permitir back/forward
    try { 
      window.location.hash = viewName; 
    } catch(e) {
      console.log('No se pudo actualizar el hash');
    }
    
    // Actualizar nav activo
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    // Inicializar vista específica
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

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Admin Dashboard Optimizado...');
  
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
      
      // Cerrar sidebar en mobile
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('mobile-open');
      }
    });
  });

  // Botón de notificaciones
  document.getElementById('notificationsBtn')?.addEventListener('click', () => {
    // Navegar a configuración y abrir tab de notificaciones
    navigateTo('configuracion');
    setTimeout(() => {
      const notifTab = document.querySelector('[data-tab="notificaciones"]');
      notifTab?.click();
    }, 200);
  });

  // Botón de acciones rápidas
  document.getElementById('quickAddBtn')?.addEventListener('click', () => {
    // Mostrar menú de opciones rápidas (por implementar)
    alert('Menú de acciones rápidas (próximamente)');
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

// Exportar función para notificaciones globales
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
  } catch (error) {
    console.error('Error creando notificación:', error);
  }
}