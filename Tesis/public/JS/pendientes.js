// pendientes.js - VERSIÓN CON ITEMS MOSTRADOS EN TABLA

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
      .order("created_at", { ascending: false });

    if (error) throw error;

    console.log("📦 " + pedidos.length + " pedidos obtenidos");

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
    
    console.log(`✅ Clientes obtenidos: ${clientes.length}`);
    if (errorClientes) {
      console.warn("⚠️ Error en query clientes:", errorClientes.message);
    }

    // Mapear clientes por user_id
    clientesMap = {};
    (clientes || []).forEach(c => {
      clientesMap[c.user_id] = c;
      console.log(`   ✅ Cliente mapeado: ${c.user_id} -> ${c.razon}`);
    });

    console.log(`✅ Total ${Object.keys(clientesMap).length} clientes mapeados`);
    console.log(`   Clientes esperados: ${userIds.length}`);
    console.log(`   Clientes encontrados: ${clientes.length}`);

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
        cliente_barrio: cliente.barrio || ""
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
    console.log(`📦 Cargando items para pedido: ${pedidoId}`);

    const { data: items, error } = await supabase
      .from("pedidos_items")
      .select("*")
      .eq("pedido_id", pedidoId);

    if (error) throw error;

    if (!items || items.length === 0) {
      console.log(`📦 Sin ítems para este pedido`);
      // Buscar en pedidos_snapshot
      const { data: snapshot } = await supabase
        .from("pedidos_snapshot")
        .select("*")
        .eq("pedido_id", pedidoId)
        .maybeSingle();
      
      if (snapshot?.items_data) {
        const pedido = allPedidos.find(p => p.id === pedidoId);
        if (pedido) pedido.items = JSON.parse(snapshot.items_data);
      }
    } else {
      const pedido = allPedidos.find(p => p.id === pedidoId);
      if (pedido) pedido.items = items;
    }
  } catch (err) {
    console.error("❌ Error cargando items:", err);
  }
}

// ============================================================================
// MOSTRAR PEDIDOS EN UI
// ============================================================================

function mostrarPedidos() {
  const contenedor = document.querySelector("[role='main']");
  if (!contenedor) return;

  const pedidosHtml = allPedidos.map(p => generarTarjetaPedido(p)).join("");
  
  const html = `
    <div class="pedidos-grid">
      ${pedidosHtml}
    </div>
  `;

  const mainContent = contenedor.querySelector("section") || contenedor;
  mainContent.innerHTML = html;
}

function generarTarjetaPedido(pedido) {
  const items = pedido.items || [];
  const itemsHtml = items.map(item => `
    <tr>
      <td>${item.cantidad || 1}</td>
      <td>${item.titulo || item.nombre || "Producto"}</td>
      <td>${new Intl.NumberFormat("es-PY").format(item.precio || 0)} Gs</td>
    </tr>
  `).join("");

  const estado = pedido.estado || "pendiente";
  const colorEstado = estado === "finalizado" ? "#10b981" : estado === "cancelado" ? "#ef4444" : "#f59e0b";
  
  const fecha = new Date(pedido.created_at).toLocaleDateString("es-PY");

  return `
    <div class="pedido-card" style="border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <h3 style="margin: 0;">#${pedido.id.substring(0, 8).toUpperCase()}</h3>
        <span style="background: ${colorEstado}; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; font-weight: bold;">
          ${estado.toUpperCase()}
        </span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 14px;">
        <div>
          <strong>Cliente:</strong> ${pedido.cliente_nombre}
        </div>
        <div>
          <strong>RUC:</strong> ${pedido.cliente_ruc}
        </div>
        <div>
          <strong>Teléfono:</strong> ${pedido.cliente_tel}
        </div>
        <div>
          <strong>Email:</strong> ${pedido.cliente_mail}
        </div>
        <div>
          <strong>Ciudad:</strong> ${pedido.cliente_ciudad}
        </div>
        <div>
          <strong>Barrio:</strong> ${pedido.cliente_barrio}
        </div>
      </div>

      <div style="margin-bottom: 15px;">
        <strong>📦 Ítems del pedido:</strong>
        <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 1px solid #ddd;">
              <th style="padding: 8px; text-align: left;">Cant.</th>
              <th style="padding: 8px; text-align: left;">Producto</th>
              <th style="padding: 8px; text-align: right;">Precio</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml || '<tr><td colspan="3" style="padding: 8px; text-align: center; color: #999;">Sin ítems</td></tr>'}
          </tbody>
        </table>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #ddd; padding-top: 10px;">
        <div>
          <strong>Total:</strong> <span style="font-size: 18px; color: #10b981;">${new Intl.NumberFormat("es-PY").format(pedido.total || 0)} Gs</span>
        </div>
        <div style="font-size: 12px; color: #999;">
          ${fecha}
        </div>
      </div>
    </div>
  `;
}

// ============================================================================
// ACTUALIZAR ESTADÍSTICAS
// ============================================================================

function actualizarStats() {
  const pendientes = allPedidos.filter(p => p.estado === "pendiente").length;
  const finalizados = allPedidos.filter(p => p.estado === "finalizado").length;
  const cancelados = allPedidos.filter(p => p.estado === "cancelado").length;

  console.log(`📊 Stats: Pendientes=${pendientes}, Finalizados=${finalizados}, Cancelados=${cancelados}`);

  // Actualizar en UI si existen elementos
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
  // Recargar cada 5 segundos
  setInterval(cargarPedidos, 5000);
  console.log("✅ Módulo de pedidos inicializado");
});