// ==================== ADMIN DASHBOARD JS ====================
// Sistema de navegación SPA (Single Page Application)

// ========== VISTAS (Templates HTML de cada sección) ==========
const views = {
  dashboard: `
    <div class="welcome-section">
      <h2 style="font-size: 2rem; margin-bottom: 0.5rem; font-weight: 700;">¡Bienvenido de vuelta! 👋</h2>
      <p style="color: var(--text-secondary); font-size: 1.05rem;">Aquí está el resumen de tu negocio hoy</p>
    </div>

    <!-- Stats Grid -->
    <div class="grid-4" style="margin-top: 2rem;">
      <div class="card" style="border-top: 3px solid var(--primary);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(111,92,56,0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-currency-dollar"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Ventas Hoy</div>
            <div style="font-size: 1.75rem; font-weight: 700;" id="ventasHoy">0 Gs</div>
            <div style="font-size: 0.8rem; color: var(--success); font-weight: 600; margin-top: 0.25rem;">
              <i class="bi bi-arrow-up"></i> +12.5%
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="border-top: 3px solid var(--success);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(16,185,129,0.1); color: var(--success); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-cart-check"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Pedidos Hoy</div>
            <div style="font-size: 1.75rem; font-weight: 700;" id="pedidosHoy">0</div>
            <div style="font-size: 0.8rem; color: var(--success); font-weight: 600; margin-top: 0.25rem;">
              <i class="bi bi-arrow-up"></i> +8.2%
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="border-top: 3px solid var(--warning);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(245,158,11,0.1); color: var(--warning); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-box-seam"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Productos</div>
            <div style="font-size: 1.75rem; font-weight: 700;" id="productosTotal">0</div>
          </div>
        </div>
      </div>

      <div class="card" style="border-top: 3px solid var(--info);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 50px; height: 50px; border-radius: 12px; background: rgba(59,130,246,0.1); color: var(--info); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-people"></i>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Usuarios Activos</div>
            <div style="font-size: 1.75rem; font-weight: 700;">23</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="grid-3" style="margin-top: 2rem;">
      <a href="#productos" class="card" style="text-decoration: none; color: inherit; cursor: pointer; transition: all 0.3s;" data-navigate="productos">
        <div style="width: 50px; height: 50px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="bi bi-box-seam"></i>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Gestionar Productos</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Agregar, editar o eliminar productos</p>
      </a>

      <a href="#catering" class="card" style="text-decoration: none; color: inherit; cursor: pointer;" data-navigate="catering">
        <div style="width: 50px; height: 50px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="bi bi-calendar-event"></i>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Pedidos Catering</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Ver y gestionar reservas</p>
      </a>

      <a href="#pedidos" class="card" style="text-decoration: none; color: inherit; cursor: pointer;" data-navigate="pedidos">
        <div style="width: 50px; height: 50px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="bi bi-clock-history"></i>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Pedidos Pendientes</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Revisar pedidos pendientes</p>
      </a>

      <a href="#analytics" class="card" style="text-decoration: none; color: inherit; cursor: pointer;" data-navigate="analytics">
        <div style="width: 50px; height: 50px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="bi bi-graph-up"></i>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Analytics</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Métricas y crecimiento</p>
      </a>

      <a href="#reportes" class="card" style="text-decoration: none; color: inherit; cursor: pointer;" data-navigate="reportes">
        <div style="width: 50px; height: 50px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="bi bi-file-earmark-bar-graph"></i>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Reportes</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Informes detallados</p>
      </a>

      <a href="#configuracion" class="card" style="text-decoration: none; color: inherit; cursor: pointer;" data-navigate="configuracion">
        <div style="width: 50px; height: 50px; border-radius: 12px; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="bi bi-gear"></i>
        </div>
        <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem;">Configuración</h3>
        <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">Ajustes del sistema</p>
      </a>
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
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; border-width: 0.3rem;"></div>
                <p style="margin-top: 1rem;">Cargando productos...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Grid de Productos (oculto por defecto) -->
    <div id="productosGridContainer" style="display: none;">
      <div class="grid-4" id="productosGrid">
        <!-- Se llena dinámicamente -->
      </div>
    </div>

    <!-- Modal Agregar/Editar Producto -->
    <div class="modal-overlay" id="modalProducto" style="display: none;">
      <div class="card" style="max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
        <button id="closeModalProducto" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.2s;">
          <i class="bi bi-x-lg"></i>
        </button>
        
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem;" id="modalProductoTitle">Nuevo Producto</h2>
        
        <form id="formProducto" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <input type="hidden" id="productoId">
          
          <!-- Imagen -->
          <div>
            <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Imagen del Producto</label>
            <div style="border: 2px dashed var(--border); border-radius: 12px; padding: 2rem; text-align: center; cursor: pointer; transition: all 0.2s;" id="uploadArea">
              <input type="file" id="productoImagen" accept="image/*" style="display: none;">
              <div id="previewArea">
                <i class="bi bi-cloud-upload" style="font-size: 3rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
                <p style="color: var(--text-secondary); margin: 0;">Haz clic o arrastra una imagen aquí</p>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">PNG, JPG o WEBP (máx. 5MB)</p>
              </div>
            </div>
          </div>

          <!-- Nombre -->
          <div>
            <label for="productoNombre" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Nombre *</label>
            <input 
              type="text" 
              id="productoNombre" 
              required 
              placeholder="Ej: Empanada de Carne"
              style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;"
            >
          </div>

          <!-- Precio -->
          <div>
            <label for="productoPrecio" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Precio (Gs) *</label>
            <input 
              type="number" 
              id="productoPrecio" 
              required 
              min="0"
              step="1000"
              placeholder="15000"
              style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;"
            >
          </div>

          <!-- Categoría -->
          <div>
            <label for="productoCategoria" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Categoría *</label>
            <select 
              id="productoCategoria" 
              required
              style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;"
            >
              <option value="">Selecciona una categoría</option>
            </select>
          </div>

          <!-- Descripción -->
          <div>
            <label for="productoDescripcion" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Descripción</label>
            <textarea 
              id="productoDescripcion" 
              rows="3"
              placeholder="Descripción opcional del producto..."
              style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem; resize: vertical;"
            ></textarea>
          </div>

          <!-- Disponible -->
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <input type="checkbox" id="productoDisponible" checked style="width: 20px; height: 20px; cursor: pointer;">
            <label for="productoDisponible" style="font-weight: 600; font-size: 0.9rem; cursor: pointer;">Producto disponible</label>
          </div>

          <!-- Botones -->
          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button type="button" id="btnCancelarProducto" style="flex: 1; padding: 0.875rem; border: 1px solid var(--border); background: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" style="flex: 1; padding: 0.875rem; justify-content: center;">
              <i class="bi bi-check-lg"></i>
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  `,

  categorias: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Categorías</h2>
    <div class="card">
      <p style="color: var(--text-secondary); text-align: center; padding: 3rem;">Vista de categorías en desarrollo...</p>
    </div>
  `,

  pedidos: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Pedidos</h2>
    <div class="card">
      <iframe src="pendientes.html" style="width: 100%; height: 80vh; border: none; border-radius: 12px;"></iframe>
    </div>
  `,

  catering: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Catering</h2>
    <div class="card">
      <iframe src="catering.html" style="width: 100%; height: 80vh; border: none; border-radius: 12px;"></iframe>
    </div>
  `,

  clientes: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Clientes</h2>
    <div class="card">
      <p style="color: var(--text-secondary); text-align: center; padding: 3rem;">Vista de clientes en desarrollo...</p>
    </div>
  `,

  analytics: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Analytics</h2>
    <div class="card">
      <iframe src="reporteDia.html" style="width: 100%; height: 80vh; border: none; border-radius: 12px;"></iframe>
    </div>
  `,

  reportes: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Reportes</h2>
    <div class="grid-2">
      <a href="informeVentas.html" target="_blank" class="card" style="text-decoration: none; color: inherit; cursor: pointer;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">📊 Informe de Ventas</h3>
        <p style="color: var(--text-secondary); margin: 0;">Análisis detallado de ventas por período</p>
      </a>
      <a href="topProductos.html" target="_blank" class="card" style="text-decoration: none; color: inherit; cursor: pointer;">
        <h3 style="font-size: 1.2rem; font-weight: 700; margin-bottom: 1rem;">🏆 Top Productos</h3>
        <p style="color: var(--text-secondary); margin: 0;">Productos más vendidos</p>
      </a>
    </div>
  `,

  configuracion: `
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;">Configuración</h2>
    <div class="card">
      <p style="color: var(--text-secondary); text-align: center; padding: 3rem;">Vista de configuración en desarrollo...</p>
    </div>
  `
};

// ========== NAVEGACIÓN ==========
function navigateTo(viewName) {
  const contentArea = document.getElementById('contentArea');
  const pageTitle = document.getElementById('pageTitle');
  
  // Actualizar contenido
  if (views[viewName]) {
    contentArea.innerHTML = views[viewName];
    pageTitle.textContent = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    
    // Actualizar nav activo
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    // Agregar event listeners a los enlaces de navegación dentro de las vistas
    contentArea.querySelectorAll('[data-navigate]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.navigate);
      });
    });

    // Si es la vista de productos, cargar datos
    if (viewName === 'productos') {
      setTimeout(() => {
        loadCategorias();
        loadProductos();
      }, 100);
    }
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  
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

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    if (confirm('¿Seguro que querés cerrar sesión?')) {
      window.location.href = 'loginAdmin.html';
    }
  });

  // Cargar vista inicial
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // Handle browser back/forward
  window.addEventListener('hashchange', () => {
    const view = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(view);
  });

});

// ========== PRODUCTOS MODULE ==========
let currentProductId = null;
let productosData = [];
let categoriasData = [];

// Inicializar Supabase
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUzNjM4OTksImV4cCI6MjA0MDkzOTg5OX0.4y9aWfHMLHUGZ_2y9Yy5Lmc0sqVMIHaHRc5eGMwYCg8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Helper para construir URL de imagen
function getImageUrl(imagenNombre) {
  if (!imagenNombre) return 'https://via.placeholder.com/300x300?text=Sin+Imagen';
  if (imagenNombre.startsWith('http')) return imagenNombre;
  return `${SUPABASE_URL}/storage/v1/object/public/productos/${imagenNombre}`;
}

// Helper para formatear precio
function formatPrice(precio) {
  const precioNumerico = parseFloat(precio);
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(precioNumerico);
}

// Cargar productos desde Supabase
async function loadProductos() {
  console.log('🔄 Cargando productos de Paniquiños...');
  
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .order('nombre');

    if (error) throw error;
    
    console.log(`✅ ${data.length} productos cargados correctamente`);
    productosData = data;
    
    // Cargar nombres de categorías
    await enrichProductosWithCategorias();
    
    renderProductosTable();
    updateDashboardStats();
    
  } catch (error) {
    console.error('❌ Error cargando productos:', error);
    document.getElementById('productosTableBody').innerHTML = `
      <tr>
        <td colspan="5" style="padding: 2rem; text-align: center; color: var(--danger);">
          <i class="bi bi-exclamation-triangle" style="font-size: 2rem; display: block; margin-bottom: 0.5rem;"></i>
          <strong>Error cargando productos</strong>
          <p style="margin-top: 0.5rem; color: var(--text-secondary);">${error.message}</p>
          <button onclick="loadProductos()" class="btn-primary" style="margin-top: 1rem; display: inline-flex;">
            <i class="bi bi-arrow-clockwise"></i>
            Reintentar
          </button>
        </td>
      </tr>
    `;
  }
}

// Enriquecer productos con nombres de categorías
async function enrichProductosWithCategorias() {
  if (categoriasData.length === 0) {
    await loadCategorias();
  }
  
  // Crear un mapa de categorías para acceso rápido
  const categoriasMap = {};
  categoriasData.forEach(cat => {
    categoriasMap[cat.id] = cat.nombre;
  });
  
  // Agregar nombre de categoría a cada producto
  productosData = productosData.map(producto => ({
    ...producto,
    categoria_nombre: categoriasMap[producto.categoria_id] || 'Sin categoría'
  }));
}

// Cargar categorías
async function loadCategorias() {
  console.log('🔄 Cargando categorías...');
  
  try {
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nombre')
      .order('nombre');

    if (error) throw error;
    
    console.log(`✅ ${data.length} categorías cargadas`);
    categoriasData = data;
    
    // Llenar selects
    const selectsCategoria = document.querySelectorAll('#productoCategoria, #filterCategoria');
    selectsCategoria.forEach(select => {
      if (!select) return;
      
      if (select.id === 'filterCategoria') {
        select.innerHTML = '<option value="">Todas las categorías</option>';
      } else {
        select.innerHTML = '<option value="">Selecciona una categoría</option>';
      }
      
      data.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.id;
        option.textContent = cat.nombre;
        select.appendChild(option);
      });
    });
  } catch (error) {
    console.error('❌ Error cargando categorías:', error);
  }
}

// Renderizar tabla de productos
function renderProductosTable(filteredData = null) {
  const tbody = document.getElementById('productosTableBody');
  if (!tbody) return;
  
  const data = filteredData || productosData;

  if (!data || data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-muted);">
          <i class="bi bi-inbox" style="font-size: 3rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          No hay productos para mostrar
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = data.map(producto => {
    const precioFormateado = formatPrice(producto.precio);
    const imagenUrl = getImageUrl(producto.imagen);
    
    return `
    <tr style="border-bottom: 1px solid var(--border); transition: background 0.2s;">
      <td style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <img 
            src="${imagenUrl}" 
            alt="${producto.nombre}"
            style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);"
            onerror="this.src='https://via.placeholder.com/60x60?text=❌'"
          >
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${producto.nombre}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted);">Stock: ${producto.stock}</div>
          </div>
        </div>
      </td>
      <td style="padding: 1rem;">
        <span style="background: var(--bg-main); padding: 0.4rem 0.75rem; border-radius: 6px; font-size: 0.85rem; font-weight: 500;">
          ${producto.categoria_nombre}
        </span>
      </td>
      <td style="padding: 1rem; text-align: right; font-weight: 600; font-size: 1.05rem;">
        ${precioFormateado} Gs
      </td>
      <td style="padding: 1rem; text-align: center;">
        <span style="
          padding: 0.4rem 0.75rem; 
          border-radius: 6px; 
          font-size: 0.85rem; 
          font-weight: 600;
          background: ${producto.activo ? 'var(--success-light)' : 'var(--danger-light)'};
          color: ${producto.activo ? 'var(--success)' : 'var(--danger)'};
        ">
          ${producto.activo ? 'Disponible' : 'No disponible'}
        </span>
      </td>
      <td style="padding: 1rem; text-align: center;">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button 
            class="icon-btn" 
            onclick="editProducto('${producto.id}')"
            title="Editar"
            style="background: var(--info-light); color: var(--info);"
          >
            <i class="bi bi-pencil"></i>
          </button>
          <button 
            class="icon-btn" 
            onclick="deleteProducto('${producto.id}', '${producto.nombre.replace(/'/g, "\\'")}')"
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

// Actualizar estadísticas del dashboard
function updateDashboardStats() {
  const totalProductos = document.getElementById('productosTotal');
  if (totalProductos) {
    totalProductos.textContent = productosData.length;
  }
  
  // Actualizar badge en sidebar
  const productosBadge = document.querySelector('[data-view="productos"] .nav-badge');
  if (productosBadge) {
    productosBadge.textContent = productosData.length;
  }
}

// Filtrar productos
function filterProductos() {
  const searchTerm = document.getElementById('searchProductos')?.value.toLowerCase() || '';
  const categoriaId = document.getElementById('filterCategoria')?.value || '';

  let filtered = productosData;

  if (searchTerm) {
    filtered = filtered.filter(p => 
      p.nombre.toLowerCase().includes(searchTerm)
    );
  }

  if (categoriaId) {
    filtered = filtered.filter(p => p.categoria_id === categoriaId);
  }

  renderProductosTable(filtered);
}

// Abrir modal para nuevo producto
function openNewProductoModal() {
  currentProductId = null;
  document.getElementById('modalProductoTitle').textContent = 'Nuevo Producto';
  document.getElementById('formProducto').reset();
  document.getElementById('productoId').value = '';
  document.getElementById('productoDisponible').checked = true;
  document.getElementById('previewArea').innerHTML = `
    <i class="bi bi-cloud-upload" style="font-size: 3rem; color: var(--text-muted); display: block; margin-bottom: 0.5rem;"></i>
    <p style="color: var(--text-secondary); margin: 0;">Haz clic o arrastra una imagen aquí</p>
    <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">PNG, JPG o WEBP (máx. 5MB)</p>
  `;
  document.getElementById('modalProducto').style.display = 'flex';
}

// Editar producto
window.editProducto = async function(id) {
  try {
    const { data, error } = await supabase
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    currentProductId = id;
    document.getElementById('modalProductoTitle').textContent = 'Editar Producto';
    document.getElementById('productoId').value = data.id;
    document.getElementById('productoNombre').value = data.nombre;
    document.getElementById('productoPrecio').value = parseFloat(data.precio);
    document.getElementById('productoCategoria').value = data.categoria_id || '';
    document.getElementById('productoDescripcion').value = data.descripcion || '';
    document.getElementById('productoDisponible').checked = data.activo;

    if (data.imagen) {
      const imagenUrl = getImageUrl(data.imagen);
      document.getElementById('previewArea').innerHTML = `
        <img src="${imagenUrl}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;" onerror="this.src='https://via.placeholder.com/300x200?text=Error'">
        <p style="color: var(--text-secondary); font-size: 0.85rem;">Haz clic para cambiar la imagen</p>
      `;
    }

    document.getElementById('modalProducto').style.display = 'flex';
  } catch (error) {
    console.error('Error cargando producto:', error);
    alert('Error al cargar el producto: ' + error.message);
  }
};

// Eliminar producto
window.deleteProducto = async function(id, nombre) {
  if (!confirm(`¿Estás seguro de eliminar "${nombre}"?\n\nEsta acción no se puede deshacer.`)) return;

  try {
    const { error } = await supabase
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await loadProductos();
    alert('✅ Producto eliminado exitosamente');
  } catch (error) {
    console.error('Error eliminando producto:', error);
    alert('❌ Error al eliminar producto: ' + error.message);
  }
};

// Guardar producto (crear o actualizar)
async function saveProducto(e) {
  e.preventDefault();

  const formData = {
    nombre: document.getElementById('productoNombre').value.trim(),
    precio: parseFloat(document.getElementById('productoPrecio').value).toFixed(2),
    categoria_id: document.getElementById('productoCategoria').value || null,
    descripcion: document.getElementById('productoDescripcion').value.trim() || null,
    activo: document.getElementById('productoDisponible').checked,
    stock: 0
  };

  try {
    // Subir imagen si hay una nueva
    const fileInput = document.getElementById('productoImagen');
    if (fileInput.files.length > 0) {
      const file = fileInput.files[0];
      
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen es muy grande. Máximo 5MB');
        return;
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('productos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      formData.imagen = fileName;
    }

    // Crear o actualizar
    if (currentProductId) {
      // Si no hay nueva imagen, mantener la anterior
      if (!formData.imagen) {
        const { data: currentData } = await supabase
          .from('productos')
          .select('imagen')
          .eq('id', currentProductId)
          .single();
        
        formData.imagen = currentData?.imagen;
      }

      formData.actualizado_en = new Date().toISOString();

      const { error } = await supabase
        .from('productos')
        .update(formData)
        .eq('id', currentProductId);

      if (error) throw error;
      alert('✅ Producto actualizado exitosamente');
    } else {
      formData.creado_en = new Date().toISOString();
      formData.actualizado_en = new Date().toISOString();

      const { error } = await supabase
        .from('productos')
        .insert([formData]);

      if (error) throw error;
      alert('✅ Producto creado exitosamente');
    }

    document.getElementById('modalProducto').style.display = 'none';
    await loadProductos();
  } catch (error) {
    console.error('Error guardando producto:', error);
    alert('❌ Error al guardar producto: ' + error.message);
  }
}

// Event listeners para productos
document.addEventListener('click', (e) => {
  if (e.target.id === 'btnNuevoProducto') {
    openNewProductoModal();
  }
  
  if (e.target.id === 'closeModalProducto' || e.target.id === 'btnCancelarProducto') {
    document.getElementById('modalProducto').style.display = 'none';
  }
  
  if (e.target.closest('#uploadArea')) {
    document.getElementById('productoImagen').click();
  }
});

document.addEventListener('submit', (e) => {
  if (e.target.id === 'formProducto') {
    saveProducto(e);
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'searchProductos' || e.target.id === 'filterCategoria') {
    filterProductos();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'productoImagen') {
    const file = e.target.files[0];
    if (file) {
      // Validar tamaño (5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen es muy grande. Máximo 5MB');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        document.getElementById('previewArea').innerHTML = `
          <img src="${e.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;">
          <p style="color: var(--text-secondary); font-size: 0.85rem;">Haz clic para cambiar la imagen</p>
        `;
      };
      reader.readAsDataURL(file);
    }
  }
});