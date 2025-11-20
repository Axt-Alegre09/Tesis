// JS/pendientes.js - VERSIÓN FINAL COMPLETA CON DATOS DE CLIENTE
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Supabase ========= */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log(" Supabase inicializado");

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
    console.log("Cargando pedidos...");
    
    // Cargar pedidos
    const { data: pedidos, error: errorPedidos } = await supabase
      .from("pedidos")
      .select("id, estado, estado_pago, metodo_pago, monto_total, creado_en, usuario_id")
      .order("creado_en", { ascending: false });
    
    if (errorPedidos) {
      console.error("Error cargando pedidos:", errorPedidos.message);
      throw errorPedidos;
    }

    if (!pedidos || pedidos.length === 0) {
      console.log("Sin pedidos");
      return [];
    }

    console.log(`📦 ${pedidos.length} pedidos obtenidos`);

    // Extraer IDs de usuarios únicos
    const userIds = [...new Set(pedidos.map(p => p.usuario_id).filter(Boolean))];
    console.log(`👥 Cargando datos de ${userIds.length} clientes. IDs:`);
    userIds.forEach((id, i) => console.log(`   ${i+1}. ${id}`));
    
    // Cargar datos del cliente - sin usar IN, fetch todo
    let clientes = [];
    let errorClientes = null;
    
    const result = await supabase
      .from("clientes_perfil")
      .select("*");
    
    clientes = result.data || [];
    errorClientes = result.error;
    
    console.log(`Clientes obtenidos: ${clientes.length}`);
    if (errorClientes) {
      console.warn("Error en query clientes:", errorClientes.message);
    }
    
    if (errorClientes) {
      console.warn("Error cargando clientes:", errorClientes.message);
    }

    // Mapear clientes por user_id
    const clientesMap = {};
    (clientes || []).forEach(c => {
      clientesMap[c.user_id] = c;
      console.log(`   Cliente mapeado: ${c.user_id} -> ${c.razon}`);
    });

    console.log(` Total ${Object.keys(clientesMap).length} clientes mapeados`);
    console.log(`   Clientes esperados: ${userIds.length}`);
    console.log(`   Clientes encontrados: ${clientes.length}`);

    // Combinar datos
    const resultado = pedidos.map(p => {
      const cliente = clientesMap[p.usuario_id] || {};
      return {
        pedido_id: p.id,
        pedido_nro: p.id.substring(0, 8).toUpperCase(),
        estado: p.estado,
        estado_pago: p.estado_pago,
        metodo_pago: p.metodo_pago,
        monto_total: p.monto_total,
        creado_en: p.creado_en,
        razon: cliente.razon || "",
        mail: cliente.mail || "",
        ruc: cliente.ruc || "",
        tel: cliente.tel || "",
        contacto: cliente.contacto || "",
        ciudad: cliente.ciudad || "",
        barrio: cliente.barrio || "",
        depto: cliente.depto || "",
        postal: cliente.postal || "",
        calle1: cliente.calle1 || "",
        calle2: cliente.calle2 || "",
        nro: cliente.nro || ""
      };
    });
    
    console.log(`${resultado.length} pedidos procesados correctamente`);
    return resultado;
  } catch (err) {
    console.error("Error cargando pedidos:", err);
    showToast("Error al cargar pedidos: " + err.message, "error");
    return [];
  }
}

async function updatePedido(pedidoId, updates) {
  if (!pedidoId) throw new Error("ID de pedido requerido");
  
  try {
    console.log("Actualizando pedido:", pedidoId, updates);
    
    const { error } = await supabase
      .from("pedidos")
      .update(updates)
      .eq("id", pedidoId);
    
    if (error) throw error;
    console.log("Pedido actualizado");
    return true;
  } catch (err) {
    console.error("Error actualizando pedido:", err);
    throw err;
  }
}

async function fetchItemsByPedido(pedidoId) {
  if (!pedidoId) return [];
  
  try {
    console.log("Cargando items para pedido:", pedidoId);
    
    // Primero cargar los detalles del pedido
    const { data: detalles, error: errorDetalles } = await supabase
      .from("detalles_pedido")
      .select("id, cantidad, precio_unitario, producto_id, subtotal")
      .eq("pedido_id", pedidoId)
      .order("id", { ascending: true });
    
    if (errorDetalles) {
      console.warn("Error cargando detalles:", errorDetalles.message);
      return [];
    }
    
    if (!detalles || detalles.length === 0) {
      console.log("Sin ítems para este pedido");
      return [];
    }
    
    console.log(`${detalles.length} detalles encontrados`);
    
    // Luego cargar los productos por separado
    const productIds = detalles.map(d => d.producto_id).filter(Boolean);
    
    if (productIds.length === 0) {
      return detalles.map(d => ({
        nombre: "(producto sin ID)",
        imagen: null,
        cantidad: Number(d.cantidad || 1),
        precio: Number(d.precio_unitario || 0)
      }));
    }
    
    const { data: productos, error: errorProductos } = await supabase
      .from("productos")
      .select("id, nombre, imagen")
      .in("id", productIds);
    
    if (errorProductos) {
      console.warn("Error cargando productos:", errorProductos.message);
      return detalles.map(d => ({
        nombre: "(error cargando producto)",
        imagen: null,
        cantidad: Number(d.cantidad || 1),
        precio: Number(d.precio_unitario || 0)
      }));
    }
    
    // Mapear productos con sus detalles
    const productMap = {};
    (productos || []).forEach(p => {
      productMap[p.id] = p;
    });
    
    const items = detalles.map(d => {
      const prod = productMap[d.producto_id];
      return {
        nombre: prod?.nombre || "(producto desconocido)",
        imagen: prod?.imagen || null,
        cantidad: Number(d.cantidad || 1),
        precio: Number(d.precio_unitario || 0)
      };
    });
    
    console.log(`${items.length} items procesados correctamente`);
    return items;
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
  
  const elPendientes = document.getElementById("countPendientes");
  const elFinalizados = document.getElementById("countFinalizados");
  const elCancelados = document.getElementById("countCancelados");
  
  if (elPendientes) elPendientes.textContent = pendientes;
  if (elFinalizados) elFinalizados.textContent = finalizados;
  if (elCancelados) elCancelados.textContent = cancelados;
  
  console.log(`Stats: Pendientes=${pendientes}, Finalizados=${finalizados}, Cancelados=${cancelados}`);
}

/* ========= Renderizado ========= */

function renderPedidos() {
  const grid = $("#grid");
  
  if (!grid) {
    console.error("No se encontró #grid");
    return;
  }
  
  if (filteredPedidos.length === 0) {
    grid.style.display = "none";
    const emptyView = $("#emptyView");
    if (emptyView) emptyView.style.display = "flex";
    return;
  }
  
  grid.style.display = "grid";
  const emptyView = $("#emptyView");
  if (emptyView) emptyView.style.display = "none";
  
  grid.innerHTML = filteredPedidos.map(p => createCardPedido(p)).join("");
  
  // Agregar event listeners
  $$(".card-header").forEach(card => {
    card.addEventListener("click", (e) => {
      const cardEl = e.currentTarget.closest(".card");
      cardEl?.classList.toggle("expanded");
    });
  });
  
  $$(".btn-editar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pedidoId = btn.dataset.pedidoId;
      const pedido = allPedidos.find(p => p.pedido_id === pedidoId);
      if (pedido) openModal(pedido);
    });
  });
  
  $$(".btn-finalizar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pedidoId = btn.dataset.pedidoId;
      const confirmed = confirm("¿Marcar este pedido como finalizado?");
      if (confirmed) {
        try {
          await updatePedido(pedidoId, { estado: "finalizado" });
          showToast("Pedido finalizado", "success");
          await loadPedidos();
        } catch (err) {
          showToast("Error: " + err.message, "error");
        }
      }
    });
  });
  
  $$(".btn-cancelar").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const pedidoId = btn.dataset.pedidoId;
      const confirmed = confirm("¿Cancelar este pedido?");
      if (confirmed) {
        try {
          await updatePedido(pedidoId, { estado: "cancelado" });
          showToast("Pedido cancelado", "success");
          await loadPedidos();
        } catch (err) {
          showToast("Error: " + err.message, "error");
        }
      }
    });
  });
}

function createCardPedido(p) {
  const estado = ESTADOS_PEDIDO[p.estado] || ESTADOS_PEDIDO.pendiente;
  const pago = ESTADOS_PAGO[p.estado_pago] || ESTADOS_PAGO.pendiente;
  const total = fmtGs(Number(p.monto_total || 0));
  const fecha = fmtFecha(p.creado_en);
  
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title-section">
          <div class="card-nro">
            <span class="nro-label">Pedido</span>
            <span class="nro-value">#${p.pedido_nro || p.pedido_id?.slice(0, 8) || "---"}</span>
          </div>
          <div class="card-client-info">
            <div class="client-name">${fmt(p.razon || "Cliente")}</div>
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
            <div class="info-item">
              <label>Total:</label>
              <span style="font-weight: 600; font-size: 1.1em; color: #059669;">${total}</span>
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
  
  if (!modal || !content) return;
  
  const estado = ESTADOS_PEDIDO[pedido.estado] || ESTADOS_PEDIDO.pendiente;
  const pago = ESTADOS_PAGO[pedido.estado_pago] || ESTADOS_PAGO.pendiente;
  
  content.innerHTML = `
    <div class="modal-header">
      <h2>Editar Pedido #${pedido.pedido_nro || pedido.pedido_id?.slice(0, 8) || "---"}</h2>
      <p class="modal-client">${fmt(pedido.razon || "Cliente")}</p>
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
            `<option value="${m}" ${(pedido.metodo_pago || "").toLowerCase() === m.toLowerCase() ? "selected" : ""}>${m}</option>`
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
  const btnCancel = document.getElementById("btnCancelarModal");
  const btnSave = document.getElementById("btnGuardarModal");
  
  if (btnCancel) {
    btnCancel.addEventListener("click", () => closeModal());
  }
  
  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      const estado = (document.getElementById("modalEstado") || {}).value;
      const estadoPago = (document.getElementById("modalPago") || {}).value;
      const metodo = (document.getElementById("modalMetodo") || {}).value;
      const pedidoId = btnSave.dataset.pedidoId;
      
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
  }
  
  modal.classList.add("active");
}

function closeModal() {
  const modal = $("#modalDetalles");
  if (modal) modal.classList.remove("active");
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
  
  try {
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
              <td style="text-align: center;">${item.cantidad}</td>
              <td style="text-align: right;">${fmtGs(item.precio)}</td>
              <td style="text-align: right;"><strong>${fmtGs(item.cantidad * item.precio)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
    
    console.log(`Items renderizados para pedido ${pedidoId}`);
  } catch (err) {
    console.error(`Error renderizando items para ${pedidoId}:`, err);
    container.innerHTML = `<p class="items-error">Error cargando ítems</p>`;
  }
}

/* ========= Eventos ========= */

function setupEventListeners() {
  // Filtros
  const filterEstadoEl = $("#filterEstado");
  const filterPagoEl = $("#filterPago");
  const searchClienteEl = $("#searchCliente");
  const btnRefreshEl = $("#btnRefresh");
  const closeModalEl = $("#closeModal");
  const modalDetallesEl = $("#modalDetalles");
  
  if (filterEstadoEl) {
    filterEstadoEl.addEventListener("change", (e) => {
      filterEstado = e.target.value;
      applyFilters();
    });
  }
  
  if (filterPagoEl) {
    filterPagoEl.addEventListener("change", (e) => {
      filterPago = e.target.value;
      applyFilters();
    });
  }
  
  if (searchClienteEl) {
    searchClienteEl.addEventListener("keyup", (e) => {
      searchTerm = e.target.value;
      applyFilters();
    });
  }
  
  if (btnRefreshEl) {
    btnRefreshEl.addEventListener("click", loadPedidos);
  }
  
  if (closeModalEl) {
    closeModalEl.addEventListener("click", closeModal);
  }
  
  if (modalDetallesEl) {
    modalDetallesEl.addEventListener("click", (e) => {
      if (e.target.id === "modalDetalles") closeModal();
    });
  }
  
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
  const loadingView = $("#loadingView");
  const grid = $("#grid");
  
  if (loadingView) loadingView.style.display = "flex";
  if (grid) grid.style.display = "none";
  
  allPedidos = await fetchAllPedidos();
  
  console.log("Pedidos obtenidos:", allPedidos.length);
  
  // Renderizar primero
  applyFilters();
  updateStats();
  
  // Luego cargar items para cada tarjeta visible
  for (const pedido of filteredPedidos) {
    if (pedido.pedido_id) {
      await loadItemsForCard(pedido.pedido_id);
    }
  }
  
  if (loadingView) loadingView.style.display = "none";
  
  console.log("Todos los items cargados");
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Inicializando módulo de pedidos pendientes...");
  
  setupEventListeners();
  loadPedidos();
  
  // Recargar cada 30 segundos
  setInterval(loadPedidos, 30000);
  
  console.log("Módulo de pedidos inicializado");
});