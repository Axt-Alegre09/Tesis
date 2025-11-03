// JS/historial.js
import { supabase } from "./ScriptLogin.js";

const contenedor = document.getElementById("pedidosContainer");
const resumenBox = document.getElementById("resumen");
const filtroPeriodo = document.getElementById("filtroPeriodo");

let TODOS_LOS_PEDIDOS = [];

/* ========== Helpers ========== */

function fmtGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
}

function estadoBadgeClase(estado) {
  const s = String(estado || "").toLowerCase();
  if (s === "entregado" || s === "finalizado") return "entregado";
  if (s === "en preparación" || s === "preparacion") return "preparacion";
  if (s === "cancelado") return "cancelado";
  return "pendiente";
}

/* ========== Render resumen ========== */

function renderResumen(pedidosFiltrados) {
  if (!pedidosFiltrados.length) {
    resumenBox.innerHTML = `
      <div class="card-resumen">
        <span class="label">Tus pedidos</span>
        <span class="value">0</span>
        <span class="sub">Aún no registramos compras en el periodo seleccionado.</span>
      </div>
    `;
    return;
  }

  const totalPedidos = pedidosFiltrados.length;
  const totalGs = pedidosFiltrados.reduce(
    (acc, p) => acc + Number(p.total || 0),
    0
  );

  const entregados = pedidosFiltrados.filter(
    (p) => String(p.estado || "").toLowerCase() === "entregado"
      || String(p.estado || "").toLowerCase() === "finalizado"
  ).length;

  resumenBox.innerHTML = `
    <div class="card-resumen">
      <span class="label">Pedidos en el periodo</span>
      <span class="value">${totalPedidos}</span>
      <span class="sub">${entregados} marcados como entregados</span>
    </div>
    <div class="card-resumen">
      <span class="label">Total consumido</span>
      <span class="value">${fmtGs(totalGs)}</span>
      <span class="sub">Sumando todos los pedidos del periodo</span>
    </div>
  `;
}

/* ========== Render listado ========== */

function renderPedidos(pedidosFiltrados) {
  if (!pedidosFiltrados.length) {
    contenedor.innerHTML = `
      <div class="state-box">
        <i class="bi bi-clipboard-heart"></i>
        <p>No encontramos pedidos en el periodo seleccionado.</p>
        <small>Probá ampliando el rango de fechas o realizando tu primera compra 🥐</small>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = pedidosFiltrados
    .map((p) => {
      const fecha = new Date(p.creado_en);
      const fechaTxt = fecha.toLocaleDateString("es-PY", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      const estadoClase = estadoBadgeClase(p.estado);

      return `
      <article class="pedido-card">
        <div class="pedido-main">
          <div class="pedido-header">
            <span class="pedido-id">Pedido #${(p.numero || p.id || "").toString().slice(0, 8)}</span>
            <span class="badge-estado ${estadoClase}">${p.estado}</span>
          </div>
          <span class="pedido-fecha">
            <i class="bi bi-calendar3"></i> ${fechaTxt}
          </span>
          <div class="pedido-detalle">
            <span class="tag">
              <i class="bi bi-currency-dollar"></i> Total: ${fmtGs(p.total)}
            </span>
            ${
              p.metodo_pago
                ? `<span class="tag"><i class="bi bi-credit-card"></i> ${p.metodo_pago}</span>`
                : ""
            }
          </div>
        </div>

        <div class="pedido-actions">
          <button class="btn-pill btn-primary btn-descargar" data-id="${p.id}">
            <i class="bi bi-file-earmark-arrow-down"></i>
            Descargar comprobante
          </button>
          <button class="btn-pill btn-ghost btn-repetir" data-id="${p.id}">
            <i class="bi bi-arrow-repeat"></i>
            Repetir pedido
          </button>
        </div>
      </article>
    `;
    })
    .join("");

  // Eventos de botones
  document.querySelectorAll(".btn-descargar").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      descargarFactura(e.currentTarget.dataset.id)
    );
  });
  document.querySelectorAll(".btn-repetir").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      repetirPedido(e.currentTarget.dataset.id)
    );
  });
}

/* ========== Filtro por periodo ========== */

function aplicarFiltro() {
  const val = filtroPeriodo.value;
  if (!TODOS_LOS_PEDIDOS.length) {
    renderResumen([]);
    contenedor.innerHTML = "";
    return;
  }

  let filtrados = [...TODOS_LOS_PEDIDOS];

  if (val !== "all") {
    const dias = Number(val);
    const hoy = new Date();
    const limite = new Date(hoy);
    limite.setDate(hoy.getDate() - dias);

    filtrados = filtrados.filter((p) => {
      const f = new Date(p.creado_en);
      return f >= limite;
    });
  }

  renderResumen(filtrados);
  renderPedidos(filtrados);
}

/* ========== Llamadas Supabase ========== */

async function cargarHistorial() {
  contenedor.innerHTML = `
    <div class="state-box">
      <i class="bi bi-arrow-repeat"></i>
      <p>Cargando tus pedidos…</p>
    </div>
  `;
  resumenBox.innerHTML = "";

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    contenedor.innerHTML = `
      <div class="state-box">
        <i class="bi bi-person-circle"></i>
        <p>Debes iniciar sesión para ver tus pedidos.</p>
        <small>Iniciá sesión y volvé a esta pantalla.</small>
      </div>
    `;
    return;
  }

  const { data, error } = await supabase
    .from("pedidos")
    .select("id, creado_en, total, estado, metodo_pago, numero")
    .eq("user_id", user.id)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error(error);
    contenedor.innerHTML = `
      <div class="state-box">
        <i class="bi bi-exclamation-triangle"></i>
        <p>Error al cargar tus pedidos.</p>
        <small>Intentá de nuevo en unos minutos.</small>
      </div>
    `;
    return;
  }

  if (!data || !data.length) {
    TODOS_LOS_PEDIDOS = [];
    aplicarFiltro();
    return;
  }

  TODOS_LOS_PEDIDOS = data;
  aplicarFiltro();
}

/* ========== Acciones: descargar y repetir ========== */

async function descargarFactura(pedidoId) {
  try {
    // Aquí podés conectar con una RPC que genere el PDF y devuelva una URL
    const { data, error } = await supabase.rpc("generar_factura_pdf", {
      p_pedido_id: pedidoId,
    });

    if (error) throw error;
    if (data?.url_pdf) {
      window.open(data.url_pdf, "_blank");
    } else {
      alert("No se encontró el comprobante para este pedido.");
    }
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el comprobante.");
  }
}

async function repetirPedido(pedidoId) {
  try {
    const { data, error } = await supabase.rpc("repetir_pedido", {
      p_pedido_id: pedidoId,
    });
    if (error) throw error;

    alert("Pedido agregado al carrito. Podés revisar tu carrito para confirmar.");
    // Si tenés CartAPI y querés refrescar badge, podrías llamar a una RPC
    // o recargar la página principal después.
  } catch (err) {
    console.error(err);
    alert("No se pudo repetir el pedido.");
  }
}

/* ========== Init ========== */

filtroPeriodo?.addEventListener("change", aplicarFiltro);

cargarHistorial();
