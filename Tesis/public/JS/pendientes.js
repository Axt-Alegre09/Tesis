// pendientes.js - VERSIÓN FINAL LIMPIA - SOLO PENDIENTES, SIN ERRORES

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase inicializado en pendientes.js");

let allPedidos = [];
let clientesMap = {};

// ============================================================================
// CARGAR SOLO PEDIDOS PENDIENTES
// ============================================================================

async function cargarPedidosPendientes() {
  try {
    console.log("🔄 Cargando SOLO pedidos pendientes...");

    // ⭐ FILTRAR POR estado = 'pendiente'
    const { data: pedidos, error } = await supabase
      .from("pedidos")
      .select("*")
      .eq("estado", "pendiente")  // ✅ SOLO PENDIENTES
      .order("creado_en", { ascending: false });

    if (error) {
      console.error("❌ Error en query:", error);
      return;
    }

    console.log(`📦 ${pedidos.length} pedidos PENDIENTES obtenidos`);

    if (pedidos.length === 0) {
      console.log("✅ No hay pedidos pendientes");
      mostrarSinPedidos();
      return;
    }

    // Extraer IDs de usuarios únicos
    const userIds = [...new Set(pedidos.map(p => p.usuario_id).filter(Boolean))];
    console.log(`👥 Cargando datos de ${userIds.length} clientes`);

    // Cargar datos del cliente
    const { data: clientes, error: clientError } = await supabase
      .from("clientes_perfil")
      .select("*");
    
    if (clientError) {
      console.warn("⚠️ Error cargando clientes:", clientError);
    }

    console.log(`✅ Clientes obtenidos: ${clientes?.length || 0}`);

    // Mapear clientes por user_id
    clientesMap = {};
    (clientes || []).forEach(c => {
      clientesMap[c.user_id] = c;
    });

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

    console.log(`✅ ${allPedidos.length} pedidos procesados`);

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
// MOSTRAR "SIN PEDIDOS"
// ============================================================================

function mostrarSinPedidos() {
  const mainContent = document.querySelector("main") || document.body;
  
  let container = mainContent.querySelector(".pedidos-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "pedidos-container";
    mainContent.appendChild(container);
  }

  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px; color: #999;">
      <div style="font-size: 48px; margin-bottom: 20px;">📋</div>
      <div style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">No hay pedidos pendientes</div>
      <div style="font-size: 14px;">Todos los pedidos han sido procesados</div>
    </div>
  `;
}

// ============================================================================
// CARGAR ITEMS PARA TODOS LOS PEDIDOS
// ============================================================================

async function cargarItemsParaTodosPedidos() {
  try {
    for (const pedido of allPedidos) {
      await cargarItemsPorPedido(pedido.id);
    }
    console.log(`✅ Items cargados para todos los ${allPedidos.length} pedidos`);
  } catch (err) {
    console.error("❌ Error cargando items:", err);
  }
}

async function cargarItemsPorPedido(pedidoId) {
  try {
    // ⭐ TABLA CORRECTA: pedido_items (SIN "S")
    const { data: items, error } = await supabase
      .from("pedido_items")  // ✅ CORRECTO
      .select("*")
      .eq("pedido_id", pedidoId);

    if (error) {
      // No lanzar error, simplemente asignar array vacío
      const pedido = allPedidos.find(p => p.id === pedidoId);
      if (pedido) pedido.items = [];
      return;
    }

    const pedido = allPedidos.find(p => p.id === pedidoId);
    if (pedido) {
      pedido.items = items || [];
    }
  } catch (err) {
    // Silenciar errores de items
    const pedido = allPedidos.find(p => p.id === pedidoId);
    if (pedido) pedido.items = [];
  }
}

// ============================================================================
// MOSTRAR PEDIDOS EN UI - GRID RESPONSIVE
// ============================================================================

function mostrarPedidos() {
  const mainContent = document.querySelector("main") || document.body;
  
  let container = mainContent.querySelector(".pedidos-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "pedidos-container";
    mainContent.appendChild(container);
  }

  const pedidosHtml = allPedidos
    .map(p => generarTarjetaPedido(p))
    .join("");
  
  // ⭐ GRID RESPONSIVE: 1 columna móvil, 2 tablet, 3-4 desktop
  container.innerHTML = `
    <div style="
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
      padding: 20px;
    ">
      ${pedidosHtml}
    </div>
  `;

  // Agregar event listeners
  document.querySelectorAll(".pedido-card").forEach(card => {
    card.addEventListener("click", (e) => {
      const pedidoId = e.currentTarget.dataset.pedidoId;
      const pedido = allPedidos.find(p => p.id === pedidoId);
      if (pedido) mostrarModalPedido(pedido);
    });
  });
}

function generarTarjetaPedido(pedido) {
  const nroPedido = pedido.id.substring(0, 8).toUpperCase();
  const total = new Intl.NumberFormat("es-PY").format(pedido.monto_total || 0);
  const items = pedido.items || [];

  return `
    <div class="pedido-card" data-pedido-id="${pedido.id}" 
         style="
           border: 1px solid #e5e7eb; 
           border-radius: 12px; 
           padding: 20px; 
           cursor: pointer; 
           transition: all 0.3s ease;
           background: white;
           box-shadow: 0 1px 3px rgba(0,0,0,0.1);
         "
         onmouseover="this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'; this.style.transform='translateY(-4px)'"
         onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)'; this.style.transform='translateY(0)'">
      
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
        <div>
          <div style="font-size: 11px; color: #999; margin-bottom: 4px; text-transform: uppercase;">PEDIDO</div>
          <div style="font-size: 18px; font-weight: bold; color: #1f2937;">#${nroPedido}</div>
        </div>
        <span style="background: #f59e0b; color: white; padding: 6px 12px; border-radius: 20px; font-size: 10px; font-weight: bold; text-transform: uppercase;">
          PENDIENTE
        </span>
      </div>

      <!-- CLIENTE -->
      <div style="border-top: 1px solid #f3f4f6; padding-top: 12px; margin-bottom: 12px;">
        <div style="font-size: 13px; font-weight: 600; color: #1f2937; margin-bottom: 6px;">
          ${pedido.cliente_nombre}
        </div>
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
          📱 ${pedido.cliente_tel}
        </div>
        <div style="font-size: 12px; color: #666;">
          📧 ${pedido.cliente_mail}
        </div>
      </div>

      <!-- ITEMS -->
      <div style="border-top: 1px solid #f3f4f6; padding-top: 12px; margin-bottom: 12px;">
        <div style="font-size: 11px; color: #999; margin-bottom: 8px; text-transform: uppercase;">
          📦 ${items.length} item${items.length !== 1 ? 's' : ''}
        </div>
        <div style="font-size: 12px; color: #666; line-height: 1.6;">
          ${items.length > 0 
            ? items.map(i => `• ${i.titulo || 'Producto'} (x${i.cantidad || 1})`).join('<br>')
            : '<span style="color: #bbb; font-style: italic;">Sin items</span>'
          }
        </div>
      </div>

      <!-- TOTAL -->
      <div style="border-top: 1px solid #f3f4f6; padding-top: 12px;">
        <div style="font-size: 11px; color: #999; margin-bottom: 6px; text-transform: uppercase;">TOTAL</div>
        <div style="font-size: 20px; font-weight: bold; color: #10b981;">
          ${total} Gs
        </div>
      </div>

      <!-- FOOTER -->
      <div style="border-top: 1px solid #f3f4f6; padding-top: 12px; margin-top: 12px; text-align: center;">
        <div style="font-size: 11px; color: #bbb;">
          Click para detalles →
        </div>
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
      <td style="padding: 12px;">${item.titulo || 'Producto'}</td>
      <td style="padding: 12px; text-align: right;">${new Intl.NumberFormat("es-PY").format(item.precio || 0)} Gs</td>
      <td style="padding: 12px; text-align: right; font-weight: 600;">${new Intl.NumberFormat("es-PY").format((item.precio || 0) * (item.cantidad || 1))} Gs</td>
    </tr>
  `).join("");

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
    overflow-y: auto;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 16px;
      max-width: 800px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      margin: auto;
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
          <div style="font-size: 13px; opacity: 0.9;">PEDIDO</div>
          <div style="font-size: 28px; font-weight: bold;">#${nroPedido}</div>
        </div>
        <button onclick="this.closest('.modal-pedido').remove()" style="
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          font-size: 28px;
          cursor: pointer;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        "
        onmouseover="this.style.background='rgba(255,255,255,0.3)'"
        onmouseout="this.style.background='rgba(255,255,255,0.2)'">×</button>
      </div>

      <!-- CONTENIDO -->
      <div style="padding: 24px; max-height: 70vh; overflow-y: auto;">
        
        <!-- INFO DEL CLIENTE -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px; font-weight: 600;">📋 Información del Cliente</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div>
              <div style="color: #999; margin-bottom: 3px; font-size: 11px;">Nombre/Razón</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_nombre}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 3px; font-size: 11px;">RUC</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_ruc}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 3px; font-size: 11px;">Teléfono</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_tel}</div>
            </div>
            <div>
              <div style="color: #999; margin-bottom: 3px; font-size: 11px;">Email</div>
              <div style="font-weight: 600; color: #1f2937;">${pedido.cliente_mail}</div>
            </div>
          </div>
        </div>

        <!-- DIRECCIÓN DE ENVÍO -->
        <div style="background: #f9fafb; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px; font-weight: 600;">📍 Dirección de Envío</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 13px;">
            <div><div style="color: #999; font-size: 11px;">Ciudad</div><div style="font-weight: 600;">${pedido.cliente_ciudad}</div></div>
            <div><div style="color: #999; font-size: 11px;">Barrio</div><div style="font-weight: 600;">${pedido.cliente_barrio}</div></div>
            <div><div style="color: #999; font-size: 11px;">Depto</div><div style="font-weight: 600;">${pedido.cliente_depto}</div></div>
            <div><div style="color: #999; font-size: 11px;">Calle Principal</div><div style="font-weight: 600;">${pedido.cliente_calle1}</div></div>
            <div><div style="color: #999; font-size: 11px;">Calle Secundaria</div><div style="font-weight: 600;">${pedido.cliente_calle2 || '-'}</div></div>
            <div><div style="color: #999; font-size: 11px;">Nro</div><div style="font-weight: 600;">${pedido.cliente_nro || '-'}</div></div>
          </div>
        </div>

        <!-- ITEMS DEL PEDIDO -->
        <div style="margin-bottom: 24px;">
          <h3 style="margin: 0 0 12px 0; color: #1f2937; font-size: 14px; font-weight: 600;">📦 Ítems (${items.length})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f3f4f6; border-bottom: 1px solid #e5e7eb;">
                <th style="padding: 10px; text-align: center; color: #666; font-weight: 600;">Cant.</th>
                <th style="padding: 10px; text-align: left; color: #666; font-weight: 600;">Producto</th>
                <th style="padding: 10px; text-align: right; color: #666; font-weight: 600;">Precio</th>
                <th style="padding: 10px; text-align: right; color: #666; font-weight: 600;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml || '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #999;">Sin ítems</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- TOTAL FINAL -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; padding: 20px; text-align: center;">
          <div style="font-size: 13px; opacity: 0.9; margin-bottom: 8px;">TOTAL DEL PEDIDO</div>
          <div style="font-size: 32px; font-weight: bold;">${total} Gs</div>
          <div style="font-size: 12px; opacity: 0.8; margin-top: 12px;">Creado: ${fecha}</div>
        </div>
      </div>

      <!-- BOTONES -->
      <div style="padding: 20px; border-top: 1px solid #f3f4f6; display: flex; gap: 12px; justify-content: center;">
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
  `;

  document.body.appendChild(modal);

  // Cerrar al hacer click fuera
  modal.addEventListener("click", (e) => {
    if (e.target === modal) modal.remove();
  });
}

// ============================================================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================================================

function actualizarStats() {
  console.log(`📊 Total pendientes cargados: ${allPedidos.length}`);

  const statPendientes = document.querySelector("[data-stat='pendientes']");
  if (statPendientes) statPendientes.textContent = allPedidos.length;
}

// ============================================================================
// INICIALIZAR
// ============================================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Inicializando pendientes.js...");
  cargarPedidosPendientes();
  // Recargar cada 30 segundos
  setInterval(cargarPedidosPendientes, 30000);
  console.log("✅ pendientes.js listo");
});