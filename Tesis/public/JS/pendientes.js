// pendientes.js - VERSIÓN CON DISEÑO MEJORADO Y MODAL - CORREGIDO

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase inicializado");

let allPedidos = [];
let clientesMap = {};

// ============================================================================
// CARGAR PEDIDOS
// ============================================================================

async function cargarPedidos() {
  try {
    console.log("🔄 Cargando pedidos...");

    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("*")
      .order("creado_en", { ascending: false });

    if (error) throw error;

    console.log("📦 " + pedidos.length + " pedidos obtenidos");

    // Extraer IDs de usuarios únicos
    const userIds = [...new Set(pedidos.map(p => p.usuario_id).filter(Boolean))];
    console.log(`👥 Cargando datos de ${userIds.length} clientes`);

    // Cargar datos del cliente
    const result = await supabase
      .from("clientes_perfil")
      .select("*");
    
    const clientes = result.data || [];
    
    console.log(`✅ Clientes obtenidos: ${clientes.length}`);

    // Mapear clientes por user_id
    clientesMap = {};
    (clientes || []).forEach(c => {
      clientesMap[c.user_id] = c;
    });

    console.log(`✅ Total ${Object.keys(clientesMap).length} clientes mapeados`);

    // Procesar pedidos
    allPedidos = pedidos.map(p => {
      const cliente = clientesMap[p.usuario_id] || {};
      return {
        ...p,
        cliente_nombre: cliente.razon || "Cliente desconocido",
        cliente_ruc: cliente.ruc || "",
        cliente_tel: cliente.tel || "",
        cliente_mail: cliente.mail || "",
        cliente_ciudad: cliente.ciudad || "",
        cliente_barrio: cliente.barrio || "",
        cliente_depto: cliente.depto || "",
        cliente_calle1: cliente.calle1 || "",
        cliente_calle2: cliente.calle2 || "",
        cliente_nro: cliente.nro || ""
      };
    });

    console.log(`✅ ${allPedidos.length} pedidos procesados correctamente`);

    // Cargar items para cada pedido
    await cargarItemsParaTodosPedidos();

    // Mostrar en UI
    mostrarPedidos();
    actualizarStats();

  } catch (err) {
    console.error("❌ Error cargando pedidos:", err);
  }
}

// ============================================================================
// CARGAR ITEMS PARA TODOS LOS PEDIDOS
// ============================================================================

async function cargarItemsParaTodosPedidos() {
  try {
    for (const pedido of allPedidos) {
      await cargarItemsPorPedido(pedido.id);
    }
    console.log("✅ Todos los items cargados");
  } catch (err) {
    console.error("❌ Error cargando items:", err);
  }
}

async function cargarItemsPorPedido(pedidoId) {
  try {
    const { data: items, error } = await supabase
      .from("pedidos_items")
      .select("*")
      .eq("pedido_id", pedidoId);

    if (error) throw error;

    const pedido = allPedidos.find(p => p.id === pedidoId);
    if (pedido) {
      if (!items || items.length === 0) {
        pedido.items = [];
      } else {
        pedido.items = items;
      }
    }
  } catch (err) {
    console.error("❌ Error cargando items:", err);
  }
}

// ============================================================================
// MOSTRAR PEDIDOS EN UI - TARJETAS SIMPLES
// ============================================================================

function mostrarPedidos() {
  const mainContent = document.querySelector("main") || document.body;
  
  // Encontrar la sección de pedidos
  let container = mainContent.querySelector(".pedidos-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "pedidos-container";
    
    // Encontrar dónde insertar (después de los filtros)
    const filterSection = mainContent.querySelector("section");
    if (filterSection) {
      filterSection.parentNode.insertBefore(container, filterSection.nextSibling);
    } else {
      mainContent.appendChild(container);
    }
  }

  const pedidosHtml = allPedidos
    .map(p => generarTarjetaPedidoSimple(p))
    .join("");
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; padding: 20px 0;">
      ${pedidosHtml}
    </div>
  `;

  // Agregar event listeners
  document.querySelectorAll(".pedido-card-simple").forEach(card => {
    card.addEventListener("click", (e) => {
      const pedidoId = e.currentTarget.dataset.pedidoId;
      const pedido = allPedidos.find(p => p.id === pedidoId);
      if (pedido) mostrarModalPedido(pedido);
    });
  });
}

function generarTarjetaPedidoSimple(pedido) {
  const estado = pedido.estado || "pendiente";
  const colorEstado = estado === "finalizado" ? "#10b981" : estado === "cancelado" ? "#ef4444" : "#f59e0b";
  const nroPedido = pedido.id.substring(0, 8).toUpperCase();
  const total = new Intl.NumberFormat("es-PY").format(pedido.monto_total || 0);

  return `
    <div class="pedido-card-simple" data-pedido-id="${pedido.id}" 
         style="
           border: 1px solid #e5e7eb; 
           border-radius: 12px; 
           padding: 16px; 
           cursor: pointer; 
           transition: all 0.3s ease;
           background: white;
         "
         onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'"
         onmouseout="this.style.boxShadow='none'; this.style.transform='translateY(0)'">
      
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
        <div>
          <div style="font-size: 12px; color: #999; margin-bottom: 4px;">PEDIDO</div>
          <div style="font-size: 16px; font-weight: bold; color: #1f2937;">#${nroPedido}</div>
        </div>
        <span style="background: ${colorEstado}; color: white; padding: 4px 8px; border-radius: 16px; font-size: 11px; font-weight: bold;">
          ${estado.toUpperCase()}
        </span>
      </div>

      <div style="border-top: 1px solid #f3f4f6; padding-top: 12px; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 4px;">
          ${pedido.cliente_nombre}
        </div>
        <div style="font-size: 12px; color: #666;">
          📱 ${pedido.cliente_tel}
        </div>
        <div style="font-size: 12px; color: #666;">
          📧 ${pedido.cliente_mail}
        </div>
      </div>

      <div style="border-top: 1px solid #f3f4f6; padding-top: 12px;">
        <div style="font-size: 11px; color: #999; margin-bottom: 4px;">TOTAL</div>
        <div style="font-size: 18px; font-weight: bold; color: #10b981;">
          ${total} Gs
        </div>
      </div>

      <div style="font-size: 11px; color: #bbb; margin-top: 12px; text-align: center;">
        Click para detalles →
      </div>
    </div>
  `;
}

// ============================================================================
// MODAL CON DETALLES COMPLETOS
// ============================================================================

function mostrarModalPedido(pedido) {
  const items = pedido.items || [];
  const itemsHtml = items.map(item => `
    <tr style="border-bottom: 1px solid #f3f4f6;">
      <td style="padding: 12px; text-align: center; font-weight: 600;">${item.cantidad || 1}</td>
      <td style="padding: 12px;">${item.titulo || item.nombre || "Producto"}</td>
      <td style="padding: 12px; text-align: right;">${new Intl.NumberFormat("es-PY").format(item.precio || 0)} Gs</td>
      <td style="padding: 12px; text-align: right; font-weight: 600;">${new Intl.NumberFormat("es-PY").format((item.precio || 0) * (item.cantidad || 1))} Gs</td>
    </tr>
  `).join("");

  const estado = pedido.estado || "pendiente";
  const colorEstado = estado === "finalizado" ? "#10b981" : estado === "cancelado" ? "#ef4444" : "#f59e0b";
  const nroPedido = pedido.id.substring(0, 8).toUpperCase();
  const fecha = new Date(pedido.creado_en).toLocaleDateString("es-PY");
  const total = new Intl.NumberFormat("es-PY").format(pedido.monto_total || 0);

  const modal = document.createElement("div");
  modal.className = "modal-pedido";
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    padding: 20px;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    ">
      <!-- HEADER -->
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 16px 16px 0 0;
      ">
        <div>
          <div style="font-size: 14px; opacity: 0.9;">PEDIDO</div>
          <div style="font-size: 28px; font-weight: bold;">#${nroPedido}</div>
        </div>
        <div style="text-align: right;">
          <span style="background: rgba(255,255,255,0.2); color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold;">
            ${estado.toUpperCase()}
          </span>
        </div>
        <button onclick="this.closest('.modal-pedido').remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        ">×</button>
      </div>

      <!-- CONTENIDO -->
      <div style="padding: 24px;">
        
        <!-- INFO DEL CLIENTE -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">📋 Información del Cliente</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
            <div>
              <div style="color: #999; margin-bottom: 4px;">Nombre/Razón Social</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_nombre}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">RUC</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_ruc}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Teléfono</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_tel}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Email</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_mail}</div>
            </div>
          </div>
        </div>

        <!-- DIRECCIÓN DE ENVÍO -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">📍 Dirección de Envío</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
            <div>
              <div style="color: #999; margin-bottom: 4px;">Ciudad</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_ciudad}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Barrio</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_barrio}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Departamento</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_depto}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Calle Principal</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_calle1}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Calle Secundaria</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_calle2 || "-"}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Nro Casa</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_nro || "-"}</div>
            </div>
          </div>
        </div>

        <!-- ITEMS DEL PEDIDO -->
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 16px;">📦 Ítems del Pedido (${items.length})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px; text-align: center; color: #666; font-weight: 600;">Cant.</th>
                <th style="padding: 12px; text-align: left; color: #666; font-weight: 600;">Producto</th>
                <th style="padding: 12px; text-align: right; color: #666; font-weight: 600;">Precio Unit.</th>
                <th style="padding: 12px; text-align: right; color: #666; font-weight: 600;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #999;">Sin ítems registrados</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- TOTALES Y DETALLES -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 14px;">
            <div>
              <div style="color: #999; margin-bottom: 4px;">Método de Pago</div>
              <div style="font-weight: 600; color: #1f2937; text-transform: capitalize;">${pedido.metodo_pago || "No especificado"}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 4px;">Fecha del Pedido</div>
              <div style="font-weight: 600; color: #1f2937;">${fecha}</div>
            </div>
          </div>
        </div>

        <!-- TOTAL FINAL -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 14px; opacity: 0.9; margin-bottom: 8px;">TOTAL DEL PEDIDO</div>
          <div style="font-size: 32px; font-weight: bold;">${total} Gs</div>
        </div>

        <!-- BOTONES DE ACCIÓN -->
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button onclick="this.closest('.modal-pedido').remove()" style="
            padding: 12px 24px;
            background: #e5e7eb;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
          "
          onmouseover="this.style.background='#d1d5db'"
          onmouseout="this.style.background='#e5e7eb'">
            Cerrar
          </button>
          <button style="
            padding: 12px 24px;
            background: #10b981;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s;
          "
          onmouseover="this.style.background='#059669'"
          onmouseout="this.style.background='#10b981'">
            Preparar Envío
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Cerrar al hacer click fuera del modal
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
}

// ============================================================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================================================

function actualizarStats() {
  const pendientes = allPedidos.filter(p => p.estado === "pendiente").length;
  const finalizados = allPedidos.filter(p => p.estado === "finalizado").length;
  const cancelados = allPedidos.filter(p => p.estado === "cancelado").length;

  console.log(`📊 Stats: Pendientes=${pendientes}, Finalizados=${finalizados}, Cancelados=${cancelados}`);

  const statPendientes = document.querySelector("[data-stat='pendientes']");
  const statFinalizados = document.querySelector("[data-stat='finalizados']");
  const statCancelados = document.querySelector("[data-stat='cancelados']");

  if (statPendientes) statPendientes.textContent = pendientes;
  if (statFinalizados) statFinalizados.textContent = finalizados;
  if (statCancelados) statCancelados.textContent = cancelados;
}

// ============================================================================
// INICIALIZAR
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Inicializando módulo de pedidos pendientes...");
  cargarPedidos();
  // Recargar cada 10 segundos
  setInterval(cargarPedidos, 10000);
  console.log("✅ Módulo de pedidos inicializado");
});
