// ==================== ADMIN DASHBOARD JS (MODULAR) ====================
// Sistema de navegación SPA (Single Page Application)

import { configuracionView, initConfiguracion } from './modules/configuracion-complete.js';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initProductos } from './modules/productos.js';
import { initClientes } from './clientes.js';

// ========== Supabase ==========
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
            <span>Cargando...</span>
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
        <div class="loading" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">Cargando datos...</div>
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
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; border-width: 0.3rem;"></div>
                <p style="margin-top: 1rem;">Cargando productos...</p>
              </td>
            </tr>
          </tbody>
        </table>
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

  promos: `
   <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 2rem;"></h2>
   <div class="card">
      <iframe src="promos.html" style="width: 100%; height: 85vh; border: none; border-radius: 12px;"></iframe>
  </div>
`,

  pedidos: `
    <div class="card">
      <iframe src="pendientes.html" style="width: 100%; height: 80vh; border: none; border-radius: 12px;"></iframe>
    </div>
  `,

  catering: `
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

    <!-- Filtros y Búsqueda -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem; align-items: center;">
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
                <div class="spinner-border" role="status" style="width: 3rem; height: 3rem; border-width: 0.3rem;"></div>
                <p style="margin-top: 1rem;">Cargando clientes...</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Ver Detalle -->
    <div class="modal-overlay" id="modalDetalleCliente" style="display: none;">
      <div class="card" style="max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
        <button id="closeModalDetalle" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.2s;">
          <i class="bi bi-x-lg"></i>
        </button>
        
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem;">
          <i class="bi bi-person-circle" style="color: var(--primary);"></i>
          Detalles del Cliente
        </h2>
        
        <div style="display: grid; gap: 1.5rem;">
          <div style="padding: 1.5rem; background: var(--bg-secondary); border-radius: 12px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--primary);">
              <i class="bi bi-person-badge"></i> Información Personal
            </h3>
            <div style="display: grid; gap: 0.75rem;">
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Razón Social</label>
                <div style="font-weight: 600; font-size: 1.05rem;" id="detalleRazon">-</div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">RUC</label>
                  <div style="font-weight: 600;" id="detalleRuc">-</div>
                </div>
                <div>
                  <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Contacto</label>
                  <div style="font-weight: 600;" id="detalleContacto">-</div>
                </div>
              </div>
            </div>
          </div>

          <div style="padding: 1.5rem; background: var(--bg-secondary); border-radius: 12px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--success);">
              <i class="bi bi-telephone"></i> Contacto
            </h3>
            <div style="display: grid; gap: 0.75rem;">
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Teléfono</label>
                <div style="font-weight: 600;" id="detalleTel">-</div>
              </div>
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Email</label>
                <div style="font-weight: 600;" id="detalleMail">-</div>
              </div>
            </div>
          </div>

          <div style="padding: 1.5rem; background: var(--bg-secondary); border-radius: 12px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--info);">
              <i class="bi bi-geo-alt"></i> Dirección
            </h3>
            <div style="display: grid; gap: 0.75rem;">
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Dirección Completa</label>
                <div style="font-weight: 600;" id="detalleDireccion">-</div>
              </div>
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Código Postal</label>
                <div style="font-weight: 600;" id="detallePostal">-</div>
              </div>
            </div>
          </div>

          <div style="padding: 1.5rem; background: var(--bg-secondary); border-radius: 12px;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-muted);">
              <i class="bi bi-clock-history"></i> Información del Sistema
            </h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Fecha de Registro</label>
                <div style="font-weight: 600; font-size: 0.9rem;" id="detalleFechaCreacion">-</div>
              </div>
              <div>
                <label style="font-size: 0.85rem; color: var(--text-muted); display: block; margin-bottom: 0.25rem;">Última Actualización</label>
                <div style="font-weight: 600; font-size: 0.9rem;" id="detalleFechaActualizacion">-</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Editar Cliente -->
    <div class="modal-overlay" id="modalEditarCliente" style="display: none;">
      <div class="card" style="max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; position: relative;">
        <button id="closeModalEditar" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; font-size: 1.5rem; color: var(--text-muted); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: all 0.2s;">
          <i class="bi bi-x-lg"></i>
        </button>
        
        <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 1.5rem;">
          <i class="bi bi-pencil-square" style="color: var(--info);"></i>
          Editar Cliente
        </h2>
        
        <form id="formEditarCliente" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <input type="hidden" id="editClienteId">
          
          <fieldset style="border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px;">
            <legend style="font-weight: 700; padding: 0 0.5rem;">Información Personal</legend>
            
            <div style="display: grid; gap: 1rem;">
              <div>
                <label for="editRazon" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Razón Social *</label>
                <input type="text" id="editRazon" required style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div>
                  <label for="editRuc" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">RUC</label>
                  <input type="text" id="editRuc" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
                <div>
                  <label for="editContacto" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Persona de Contacto</label>
                  <input type="text" id="editContacto" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
              </div>
            </div>
          </fieldset>

          <fieldset style="border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px;">
            <legend style="font-weight: 700; padding: 0 0.5rem;">Contacto</legend>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label for="editTel" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Teléfono</label>
                <input type="tel" id="editTel" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
              </div>
              <div>
                <label for="editMail" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Email</label>
                <input type="email" id="editMail" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
              </div>
            </div>
          </fieldset>

          <fieldset style="border: 1px solid var(--border); padding: 1.5rem; border-radius: 12px;">
            <legend style="font-weight: 700; padding: 0 0.5rem;">Dirección</legend>
            
            <div style="display: grid; gap: 1rem;">
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                <div>
                  <label for="editCalle1" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Calle Principal</label>
                  <input type="text" id="editCalle1" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
                <div>
                  <label for="editNro" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Número</label>
                  <input type="text" id="editNro" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
              </div>

              <div>
                <label for="editCalle2" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Esquina / Calle 2</label>
                <input type="text" id="editCalle2" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                <div>
                  <label for="editBarrio" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Barrio</label>
                  <input type="text" id="editBarrio" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
                <div>
                  <label for="editCiudad" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Ciudad</label>
                  <input type="text" id="editCiudad" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
                <div>
                  <label for="editDepto" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Departamento</label>
                  <input type="text" id="editDepto" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
                </div>
              </div>

              <div>
                <label for="editPostal" style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 0.9rem;">Código Postal</label>
                <input type="text" id="editPostal" style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.95rem;">
              </div>
            </div>
          </fieldset>

          <div style="display: flex; gap: 1rem; margin-top: 1rem;">
            <button type="button" id="btnCancelarEditar" style="flex: 1; padding: 0.875rem; border: 1px solid var(--border); background: white; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              Cancelar
            </button>
            <button type="submit" class="btn-primary" style="flex: 1; padding: 0.875rem; justify-content: center;">
              <i class="bi bi-check-lg"></i>
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
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

  // ✅ Integrado desde el módulo externo
  configuracion: configuracionView
};

// ========== INICIALIZACIÓN DEL DASHBOARD ==========
async function initDashboard() {
  console.log('🚀 Inicializando Dashboard Intelligence...');

  try {
    // 1. Cargar resumen del día
    const { data: resumenHoy } = await supa
      .from('v_resumen_hoy')
      .select('*')
      .single();

    if (resumenHoy) {
      document.getElementById('ventasHoy').textContent = formatGs(resumenHoy.total_hoy || 0);
      document.getElementById('pedidosHoy').textContent = resumenHoy.pedidos_hoy || 0;
      document.getElementById('ticketPromedio').textContent = formatGs(resumenHoy.ticket_promedio_hoy || 0);
      
      // Cambio porcentual (simulado por ahora - puedes comparar con ayer)
      const changeElem = document.getElementById('ventasChange');
      if (changeElem) {
        changeElem.querySelector('span').textContent = '+12.5%';
      }
    }

    // 2. Cargar ventas últimos 7 días
    const { data: ventasSemana } = await supa
      .from('v_ventas_por_dia')
      .select('*')
      .order('dia', { ascending: true })
      .limit(7);

    if (ventasSemana && ventasSemana.length > 0) {
      initChartVentas(ventasSemana);
      initWeekGrid(ventasSemana);
    }

    // 3. Cargar métricas del ChatBot
    const { data: chatbotMetrics } = await supa
      .from('v_chatbot_metricas_hoy')
      .select('*')
      .single();

    if (chatbotMetrics) {
      document.getElementById('chatbotInteracciones').textContent = chatbotMetrics.total_interacciones || 0;
      document.getElementById('chatbotTasa').textContent = `${chatbotMetrics.tasa_exito || 0}%`;
      document.getElementById('chatbotCarrito').textContent = chatbotMetrics.productos_agregados_bot || 0;
    }

    // 4. Cargar top producto
    const { data: topProductos } = await supa
      .from('v_top_productos_hoy')
      .select('*')
      .limit(1)
      .single();

    if (topProductos) {
      document.getElementById('topProducto').textContent = topProductos.nombre || '-';
      document.getElementById('topProductoVentas').textContent = `${topProductos.cantidad_vendida || 0} unidades vendidas`;
    } else {
      document.getElementById('topProducto').textContent = 'Sin ventas hoy';
      document.getElementById('topProductoVentas').textContent = '0 unidades vendidas';
    }

    // 5. Cargar comparación catering
    const { data: cateringStats } = await supa
      .from('v_catering_bot_vs_manual')
      .select('*')
      .single();

    if (cateringStats) {
      document.getElementById('cateringBot').textContent = `${cateringStats.porcentaje_automatizado || 0}%`;
      document.getElementById('cateringBotText').textContent = 
        `${cateringStats.catering_bot || 0} de ${cateringStats.total_catering || 0} via ChatBot`;
    }

    // 6. Cargar impacto promos
    const { data: promos } = await supa
      .from('v_impacto_promos_semana')
      .select('*')
      .single();

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

  const labels = data.map(d => {
    const fecha = new Date(d.dia + 'T00:00:00');
    return fecha.toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric' });
  });

  const valores = data.map(d => parseFloat(d.total_gs) || 0);

  new Chart(ctx, {
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

  grid.innerHTML = data.map(d => {
    const fecha = new Date(d.dia + 'T00:00:00');
    const esHoy = d.dia === hoy;
    const nombreDia = fecha.toLocaleDateString('es-PY', { weekday: 'short' });
    const ventas = formatGs(d.total_gs || 0);

    return `
      <div class="day-cell ${esHoy ? 'today' : ''}">
        <div class="day-name">${nombreDia}</div>
        <div class="day-sales">${ventas}</div>
        <div class="day-orders">${d.pedidos || 0} pedidos</div>
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
    pageTitle.textContent = viewName === 'dashboard' 
      ? 'Dashboard' 
      : viewName.charAt(0).toUpperCase() + viewName.slice(1);

    // Actualizar hash para permitir back/forward
    try { window.location.hash = viewName; } catch {}
    
    // Actualizar nav activo
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
      if (link.dataset.view === viewName) {
        link.classList.add('active');
      }
    });

    // Agregar event listeners
    contentArea.querySelectorAll('[data-navigate]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.navigate);
      });
    });

    // Inicializar vista específica
    if (viewName === 'dashboard') {
      setTimeout(() => {
        initDashboard();
      }, 100);
    } else if (viewName === 'productos') {
      setTimeout(() => {
        initProductos();
      }, 100);
    } else if (viewName === 'clientes') {
      setTimeout(() => {
        initClientes();
      }, 100);
    } else if (viewName === 'configuracion') {
      // ✅ Inicializa el módulo de configuración al entrar a la vista
      setTimeout(() => {
        initConfiguracion();
      }, 100);
    }
  }
}

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Admin Dashboard...');
  
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
  const logoutBtn = document.getElementById('logoutBtn');

  logoutBtn?.addEventListener('click', async () => {
    const ok = confirm('¿Seguro que querés cerrar sesión?');
    if (!ok) return;

    try {
      await supa.auth.signOut();
      console.log('✅ Sesión Supabase cerrada correctamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión en Supabase:', error);
    }

    window.location.href = 'loginAdmin.html';
  });

  // Cargar vista inicial
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // Handle browser back/forward´å
  window.addEventListener('hashchange', () => {
    const view = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(view);
  });

  console.log('✅ Admin Dashboard inicializado correctamente');
});

// ========== HELPER GLOBAL DE NOTIFICACIONES (opcional) ==========
// Permite crear notificaciones desde otros módulos importando esta función
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
