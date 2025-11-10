// JS/pendientes.js - VERSIÓN MEJORADA
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Supabase ========= */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========= Estados y Colores ========= */
const ESTADOS_PEDIDO = {
  pendiente: { label: "Pendiente", icon: "clock", color: "#f59e0b", bg: "#fef3c7" },
  finalizado: { label: "Finalizado", icon: "check-circle", color: "#10b981", bg: "#d1fae5" },
  cancelado: { label: "Cancelado", icon: "x-circle", color: "#ef4444", bg: "#fee2e2" }
};

const ESTADOS_PAGO = {
  pendiente: { label: "Pendiente", icon: "clock", color: "#f59e0b", bg: "#fef3c7" },
  pagado: { label: "Pagado", icon: "check-circle", color: "#10b981", bg: "#d1fae5" }
};

const METODOS_PAGO = ["Transferencia", "Tarjeta", "Efectivo"];

/* ========= Helpers ========= */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const fmt = (v) => (v ?? "").toString().trim();
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
const fmtFecha = (f) => f ? new Date(f).toLocaleDateString("es-PY", { day: "2-digit", month: "short", year: "numeric" }) : "-";

/* ========= Estado Global ========= */
let allPedidos = [];
let filteredPedidos = [];
let filterEstado = "pendiente";
let filterPago = "";
let searchTerm = "";

/* ========= Funciones de Datos ========= */

async function fetchAllPedidos() {
  try {
    const { data, error } = await supabase
      .from("v_pedidos_pendientes")
      .select("*")
      .order("creado_en", { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  } catch (err) {
    console.error("Error cargando pedidos:", err);
    showToast("Error al cargar pedidos", "error");
    return [];
  }
}

async function updatePedido(pedidoId, updates) {
  if (!pedidoId) throw new Error("ID de pedido requerido");
  
  try {
    const { error } = await supabase
      .from("pedidos")
      .update(updates)
      .eq("id", pedidoId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("Error actualizando pedido:", err);
    throw err;
  }
}

async function fetchItemsByPedido(pedidoId) {
  if (!pedidoId) return [];
  
  try {
    const { data, error } = await supabase
      .from("detalles_pedido")
      .select(`
        cantidad,
        precio_unitario,
        productos:productos!detalles_pedido_producto_id_fkey ( id, nombre, imagen )
      `)
      .eq("pedido_id", pedidoId)
      .order("id", { ascending: true });
    
    if (error) {
      console.warn("Error cargando items:", error.message);
      return [];
    }
    
    return (data || []).map(d => ({
      nombre: d?.productos?.nombre || "(sin nombre)",
      imagen: d?.productos?.imagen || null,
      cantidad: Number(d?.cantidad || 1),
      precio: Number(d?.precio_unitario || 0)
    }));
  } catch (err) {
    console.error("Error en fetchItemsByPedido:", err);
    return [];
  }
}

/* ========= Filtrado ========= */

function applyFilters() {
  filteredPedidos = allPedidos.filter(p => {
    // Filtro por estado
    if (filterEstado && p.estado !== filterEstado) return false;
    
    // Filtro por pago
    if (filterPago && p.estado_pago !== filterPago) return false;
    
    // Búsqueda por cliente, email, RUC
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesRazon = (p.razon || "").toLowerCase().includes(term);
      const matchesEmail = (p.mail || "").toLowerCase().includes(term);
      const matchesRuc = (p.ruc || "").toLowerCase().includes(term);
      const matchesTel = (p.tel || "").toLowerCase().includes(term);
      
      if (!matchesRazon && !matchesEmail && !matchesRuc && !matchesTel) return false;
    }
    
    return true;
  });
  
  renderPedidos();
  updateStats();
}

function updateStats() {
  const pendientes = allPedidos.filter(p => p.estado === "pendiente").length;
  const finalizados = allPedidos.filter(p => p.estado === "finalizado").length;
  const cancelados = allPedidos.filter(p => p.estado === "cancelado").length;
  
  document.getElementById("countPendientes").textContent = pendientes;
  document.getElementById("countFinalizados").textContent = finalizados;
  document.getElementById("countCancelados").textContent = cancelados;
}

/* ========= Renderizado ========= */

function renderPedidos() {
  const grid = $("#grid");
  
  if (filteredPedidos.length === 0) {
    grid.style.display = "none";
    $("#emptyView").style.display = "flex";
    return;
  }
  
  grid.style.display = "grid";
  $("#emptyView").style.display = "none";
  
  grid.innerHTML = filteredPedidos.map(p => createCardPedido(p)).join("");
  
  // Agregar event listeners
  $$(".card-header").forEach(card => {
    card.addEventListener("click", (e) => {
      const cardEl = e.currentTarget.closest(".card");
      const body = cardEl.querySelector(".card-body");
      cardEl.classList.toggle("expanded");
    });
  });
  
  $$(".btn-editar").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const pedidoId = btn.dataset.pedidoId;
      const pedido = allPedidos.find(p => p.pedido_id === pedidoId);
      openModal(pedido);
    });
  });
}

function createCardPedido(p) {
  const estado = ESTADOS_PEDIDO[p.estado] || ESTADOS_PEDIDO.pendiente;
  const pago = ESTADOS_PAGO[p.estado_pago] || ESTADOS_PAGO.pendiente;
  const total = fmtGs(Number(p.total_real || 0));
  const fecha = fmtFecha(p.creado_en);
  
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title-section">
          <div class="card-nro">
            <span class="nro-label">Pedido</span>
            <span class="nro-value">#${p.pedido_nro || "---"}</span>
          </div>
          <div class="card-client-info">
            <div class="client-name">${fmt(p.razon)}</div>
            <div class="client-email">${fmt(p.mail)}</div>
          </div>
        </div>
        
        <div class="card-badges">
          <span class="badge" style="background: ${estado.bg}; color: ${estado.color};">
            <i class="bi bi-${estado.icon}"></i> ${estado.label}
          </span>
          <span class="badge" style="background: ${pago.bg}; color: ${pago.color};">
            <i class="bi bi-${pago.icon}"></i> ${pago.label}
          </span>
        </div>
        
        <i class="bi bi-chevron-down"></i>
      </div>
      
      <div class="card-body">
        <div class="card-section">
          <div class="section-title">Información de Contacto</div>
          <div class="info-grid">
            <div class="info-item">
              <label>RUC/CI:</label>
              <span>${fmt(p.ruc)}</span>
            </div>
            <div class="info-item">
              <label>Teléfono:</label>
              <span>${fmt(p.tel)}</span>
            </div>
            <div class="info-item">
              <label>Correo:</label>
              <span>${fmt(p.mail)}</span>
            </div>
            <div class="info-item">
              <label>Contacto:</label>
              <span>${fmt(p.contacto)}</span>
            </div>
          </div>
        </div>
        
        <div class="card-section">
          <div class="section-title">Dirección de Entrega</div>
          <div class="info-grid">
            <div class="info-item full">
              <label>Dirección Postal:</label>
              <span>${fmt(p.postal)}</span>
            </div>
            <div class="info-item">
              <label>Ciudad:</label>
              <span>${fmt(p.ciudad)}</span>
            </div>
            <div class="info-item">
              <label>Barrio:</label>
              <span>${fmt(p.barrio)}</span>
            </div>
            <div class="info-item">
              <label>Departamento:</label>
              <span>${fmt(p.depto)}</span>
            </div>
            <div class="info-item">
              <label>Calle 1:</label>
              <span>${fmt(p.calle1)}</span>
            </div>
            <div class="info-item">
              <label>Calle 2:</label>
              <span>${fmt(p.calle2)}</span>
            </div>
            <div class="info-item">
              <label>N° Casa:</label>
              <span>${fmt(p.nro)}</span>
            </div>
          </div>
        </div>
        
        <div class="card-section">
          <div class="section-title">Detalles del Pedido</div>
          <div id="items-${p.pedido_id}" class="items-loading">
            <p>Cargando ítems...</p>
          </div>
          <div class="card-total">
            <span class="total-label">Total:</span>
            <span class="total-value">${total}</span>
          </div>
        </div>
        
        <div class="card-section">
          <div class="section-title">Gestión</div>
          <div class="info-grid">
            <div class="info-item">
              <label>Método de Pago:</label>
              <span>${fmt(p.metodo_pago)}</span>
            </div>
            <div class="info-item">
              <label>Fecha:</label>
              <span>${fecha}</span>
            </div>
          </div>
        </div>
        
        <div class="card-actions">
          <button class="btn-editar" data-pedido-id="${p.pedido_id}">
            <i class="bi bi-pencil"></i> Editar Estado
          </button>
          <button class="btn-finalizar" data-pedido-id="${p.pedido_id}">
            <i class="bi bi-check-lg"></i> Finalizar
          </button>
          <button class="btn-cancelar" data-pedido-id="${p.pedido_id}">
            <i class="bi bi-x-lg"></i> Cancelar
          </button>
        </div>
      </div>
    </div>
  `;
}

function openModal(pedido) {
  if (!pedido) return;
  
  const modal = $("#modalDetalles");
  const content = $("#modalContent");
  
  const estado = ESTADOS_PEDIDO[pedido.estado] || ESTADOS_PEDIDO.pendiente;
  const pago = ESTADOS_PAGO[pedido.estado_pago] || ESTADOS_PAGO.pendiente;
  
  content.innerHTML = `
    <div class="modal-header">
      <h2>Editar Pedido #${pedido.pedido_nro || "---"}</h2>
      <p class="modal-client">${fmt(pedido.razon)}</p>
    </div>
    
    <div class="modal-body">
      <div class="form-group">
        <label for="modalEstado">Estado del Pedido:</label>
        <select id="modalEstado" data-pedido-id="${pedido.pedido_id}">
          ${Object.entries(ESTADOS_PEDIDO).map(([key, val]) => 
            `<option value="${key}" ${pedido.estado === key ? "selected" : ""}>${val.label}</option>`
          ).join("")}
        </select>
      </div>
      
      <div class="form-group">
        <label for="modalPago">Estado de Pago:</label>
        <select id="modalPago" data-pedido-id="${pedido.pedido_id}">
          ${Object.entries(ESTADOS_PAGO).map(([key, val]) => 
            `<option value="${key}" ${pedido.estado_pago === key ? "selected" : ""}>${val.label}</option>`
          ).join("")}
        </select>
      </div>
      
      <div class="form-group">
        <label for="modalMetodo">Método de Pago:</label>
        <select id="modalMetodo" data-pedido-id="${pedido.pedido_id}">
          ${METODOS_PAGO.map(m => 
            `<option value="${m}" ${pedido.metodo_pago === m ? "selected" : ""}>${m}</option>`
          ).join("")}
        </select>
      </div>
    </div>
    
    <div class="modal-footer">
      <button class="btn-secondary" id="btnCancelarModal">
        Cancelar
      </button>
      <button class="btn-primary" id="btnGuardarModal" data-pedido-id="${pedido.pedido_id}">
        <i class="bi bi-check-lg"></i> Guardar Cambios
      </button>
    </div>
  `;
  
  // Event listeners del modal
  $("#btnCancelarModal").addEventListener("click", () => closeModal());
  
  $("#btnGuardarModal").addEventListener("click", async () => {
    const estado = $("#modalEstado").value;
    const estadoPago = $("#modalPago").value;
    const metodo = $("#modalMetodo").value;
    const pedidoId = $("#btnGuardarModal").dataset.pedidoId;
    
    try {
      await updatePedido(pedidoId, {
        estado,
        estado_pago: estadoPago,
        metodo_pago: metodo
      });
      
      showToast("Pedido actualizado correctamente", "success");
      closeModal();
      await loadPedidos();
    } catch (err) {
      showToast("Error al actualizar: " + err.message, "error");
    }
  });
  
  modal.classList.add("active");
}

function closeModal() {
  const modal = $("#modalDetalles");
  modal.classList.remove("active");
}

function showToast(msg, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi bi-${type === "success" ? "check-circle" : "exclamation-circle"}"></i>
    ${msg}
  `;
  toast.style.cssText = `
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    background: ${type === "success" ? "#10b981" : type === "error" ? "#ef4444" : "#3b82f6"};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    animation: slideIn 0.3s ease-out;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* ========= Carga de ítems ========= */

async function loadItemsForCard(pedidoId) {
  const container = $(`#items-${pedidoId}`);
  if (!container) return;
  
  const items = await fetchItemsByPedido(pedidoId);
  
  if (items.length === 0) {
    container.innerHTML = `<p class="items-empty">Sin ítems en este pedido</p>`;
    return;
  }
  
  const total = items.reduce((sum, item) => sum + (item.cantidad * item.precio), 0);
  
  container.innerHTML = `
    <table class="items-table">
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>Precio Unit.</th>
          <th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(item => `
          <tr>
            <td>${item.nombre}</td>
            <td>${item.cantidad}</td>
            <td>${fmtGs(item.precio)}</td>
            <td><strong>${fmtGs(item.cantidad * item.precio)}</strong></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

/* ========= Eventos ========= */

function setupEventListeners() {
  // Filtros
  $("#filterEstado").addEventListener("change", (e) => {
    filterEstado = e.target.value;
    applyFilters();
  });
  
  $("#filterPago").addEventListener("change", (e) => {
    filterPago = e.target.value;
    applyFilters();
  });
  
  $("#searchCliente").addEventListener("keyup", (e) => {
    searchTerm = e.target.value;
    applyFilters();
  });
  
  // Refresh
  $("#btnRefresh").addEventListener("click", loadPedidos);
  
  // Modal
  $("#closeModal").addEventListener("click", closeModal);
  $("#modalDetalles").addEventListener("click", (e) => {
    if (e.target.id === "modalDetalles") closeModal();
  });
  
  // Agregar estilos dinámicos
  if (!document.querySelector("style[data-pendientes]")) {
    const style = document.createElement("style");
    style.setAttribute("data-pendientes", "");
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

/* ========= Inicialización ========= */

async function loadPedidos() {
  $("#loadingView").style.display = "flex";
  $("#grid").style.display = "none";
  
  allPedidos = await fetchAllPedidos();
  
  // Cargar ítems para cada pedido
  for (const pedido of allPedidos) {
    if (pedido.pedido_id) {
      setTimeout(() => loadItemsForCard(pedido.pedido_id), 100);
    }
  }
  
  $("#loadingView").style.display = "none";
  
  applyFilters();
  updateStats();
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Inicializando módulo de pedidos pendientes...");
  
  setupEventListeners();
  loadPedidos();
  
  // Recargar cada 30 segundos
  setInterval(loadPedidos, 30000);
  
  console.log("✅ Módulo de pedidos inicializado");
});