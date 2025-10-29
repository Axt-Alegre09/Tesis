// JS/pendientes.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Supabase ========= */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========= Helpers ========= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const dz = (v) => (v ?? "").toString().trim();
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
const hoyLargo = () =>
  new Date().toLocaleDateString("es-PY", { day: "2-digit", month: "long", year: "numeric" });

// (fix) no usar ?. a la izquierda de =
{
  const el = $("#fecha");
  if (el) el.textContent = hoyLargo();
}
const backBtn = $(".back");
if (backBtn) backBtn.addEventListener("click", () => history.back());

/* ========= Estados ========= */
// >>> Como pediste <<<
const ESTADOS_PEDIDO = ["pendiente", "finalizado", "cancelado"];
const ESTADOS_PAGO   = ["pendiente", "pagado"];
const colorEstado = { pendiente:"#b38a00", finalizado:"#1d6f42", cancelado:"#8b0000" };
const colorPago   = { pendiente:"#b38a00", pagado:"#1d6f42" };
const badge = (estado, palette) => {
  if (!estado) return "";
  const color = palette[estado] || "#444";
  return `<span class="badge" style="display:inline-block;padding:.15rem .5rem;border-radius:999px;background:${color}15;color:${color};border:1px solid ${color}40;font-size:.78rem;margin-left:.25rem;">${estado}</span>`;
};

/* ========= Data ========= */
async function fetchPendientes() {
  const { data, error } = await supa
    .from("v_pedidos_pendientes")
    .select("*")
    .eq("estado", "pendiente")                       // solo pendientes
    .order("creado_en", { ascending: false });       // más nuevo primero
  if (error) throw error;
  return data || [];
}

// Ítems reales del pedido (si RLS lo permite)
async function fetchItemsByPedido(pedido_id) {
  if (!pedido_id) return [];
  const { data, error } = await supa
    .from("detalles_pedido")
    .select(`
      cantidad,
      precio_unitario,
      productos:productos!detalles_pedido_producto_id_fkey ( id, nombre )
    `)
    .eq("pedido_id", pedido_id)
    .order("id", { ascending: true });
  if (error) {
    console.warn("detalles_pedido bloqueado o error:", error.message);
    return [];
  }
  return (data || []).map(d => ({
    titulo: d?.productos?.nombre || "(item)",
    cantidad: Number(d?.cantidad || 1),
    precio: Number(d?.precio_unitario || 0)
  }));
}

async function updatePedido(pedido_id, payload) {
  if (!pedido_id) throw new Error("Este snapshot no tiene pedido_id para actualizar.");
  const toSend = { ...payload };
  Object.keys(toSend).forEach(k => {
    if (toSend[k] === "" || typeof toSend[k] === "undefined") delete toSend[k];
  });
  const { error } = await supa.from("pedidos").update(toSend).eq("id", pedido_id);
  if (error) throw error;
}

/* ========= UI ========= */
const grid = $("#grid");

function render(list) {
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<section class="card"><p>No hay pedidos pendientes.</p></section>`;
    return;
  }
  list.forEach((p, idx) => grid.appendChild(cardPedido(p, idx)));
}

function cardPedido(p, idx) {
  const sec = document.createElement("section");
  sec.className = "card";
  sec.dataset.snapshot_id = p.snapshot_id ?? "";
  sec.dataset.pedido_id = p.pedido_id || "";

  const nro = typeof p.pedido_nro === "number" ? p.pedido_nro : idx;

  sec.innerHTML = `
    <h3>Pedido N°: ${nro}
      ${p.estado ? badge(p.estado, colorEstado) : ""}
      ${p.estado_pago ? badge(p.estado_pago, colorPago) : ""}
    </h3>

    <form class="info two-cols" data-mode="view">
      <div class="col">
        <label>Ruc / Ci : <input value="${dz(p.ruc)}" disabled></label>
        <label>Nombre : <input value="${dz(p.razon)}" disabled></label>
        <label>Teléfono : <input value="${dz(p.tel)}" disabled></label>
        <label>Correo : <input value="${dz(p.mail)}" disabled></label>
        <label>Contacto : <input value="${dz(p.contacto)}" disabled></label>
        <label>Dirección postal : <input value="${dz(p.postal)}" disabled></label>

        <div class="hr"></div>
        <div class="detalle">
          <b>Detalle de Pedido :</b>
          <div class="items-wrap">
            <div class="items-loading">(cargando ítems…)</div>
          </div>
        </div>
        <p style="margin-top:8px;"><b>Total :</b> <span class="total">${fmtGs(Number(p.total_real || 0))}</span></p>
      </div>

      <div class="col">
        <label>Ciudad : <input value="${dz(p.ciudad)}" disabled></label>
        <label>Barrio : <input value="${dz(p.barrio)}" disabled></label>
        <label>Departamento : <input value="${dz(p.depto)}" disabled></label>
        <label>Calle 1 : <input value="${dz(p.calle1)}" disabled></label>
        <label>Calle 2 : <input value="${dz(p.calle2)}" disabled></label>
        <label>N° Casa : <input value="${dz(p.nro)}" disabled></label>

        <div class="hr"></div>

        <label>Método de Pago :
          <select name="metodo_pago" ${p.pedido_id ? "" : "disabled"}>
            ${["Transferencia","Tarjeta","Efectivo"].map(opt => `<option value="${opt}" ${p.metodo_pago===opt?"selected":""}>${opt}</option>`).join("")}
          </select>
        </label>

        <label>Estado pago :
          <select name="estado_pago" ${p.pedido_id ? "" : "disabled"}>
            ${ESTADOS_PAGO.map(e => `<option value="${e}" ${p.estado_pago===e?"selected":""}>${e}</option>`).join("")}
          </select>
        </label>

        <label>Estado pedido :
          <select name="estado" ${p.pedido_id ? "" : "disabled"}>
            ${ESTADOS_PEDIDO.map(e => `<option value="${e}" ${p.estado===e?"selected":""}>${e}</option>`).join("")}
          </select>
        </label>
      </div>
    </form>

    <div class="acciones">
      <button class="btn brown btn-edit" ${p.pedido_id ? "" : "disabled"}>Actualizar</button>
      <button class="btn green btn-ok" ${p.pedido_id ? "" : "disabled"}>Finalizar</button>
    </div>
  `;

  const form      = $("form", sec);
  const btnEd     = $(".btn-edit", sec);
  const btnOk     = $(".btn-ok", sec);
  const itemsWrap = $(".items-wrap", sec);
  const totalSpan = $(".total", sec);
  let btnCancel = null;

  // ====== ÍTEMS (con fallback a snapshot) ======
  (async () => {
    let items = [];
    if (p.pedido_id) items = await fetchItemsByPedido(p.pedido_id);

    if (!items.length && Array.isArray(p.items) && p.items.length) {
      items = p.items.map(x => ({
        titulo: dz(x.titulo) || "(item)",
        cantidad: Number(x.cantidad || 1),
        precio: Number(x.precio || 0)
      }));
    }

    if (!items.length) {
      itemsWrap.innerHTML = `<div class="items-empty">(sin ítems)</div>`;
    } else {
      const rows = items.map(d => `
        <tr>
          <td>${dz(d.titulo)}</td>
          <td style="text-align:center;">${d.cantidad}</td>
          <td style="text-align:right;">${fmtGs(d.precio)}</td>
          <td style="text-align:right;"><b>${fmtGs(d.cantidad * d.precio)}</b></td>
        </tr>
      `).join("");

      itemsWrap.innerHTML = `
        <table class="items">
          <thead>
            <tr>
              <th>Producto</th>
              <th style="width:70px;text-align:center;">Cant.</th>
              <th style="width:150px;text-align:right;">Precio xU</th>
              <th style="width:160px;text-align:right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    }

    const calc = (items || []).reduce((a, r) => a + r.cantidad * r.precio, 0);
    const finalTotal = Number(p.total_real || 0) || calc;
    totalSpan.textContent = fmtGs(finalTotal);
  })().catch(console.error);

  // ====== Editar / Guardar ======
  btnEd?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!p.pedido_id) return alert("Este snapshot no tiene pedido vinculado (pedido_id).");

    const mode = form.dataset.mode;
    if (mode === "view") {
      $$("select[name='metodo_pago'], select[name='estado_pago'], select[name='estado']", form)
        .forEach(el => el.disabled = false);
      form.dataset.mode = "edit";
      btnEd.textContent = "Guardar";

      if (!btnCancel) {
        btnCancel = document.createElement("button");
        btnCancel.className = "btn";
        btnCancel.textContent = "Cancelar";
        $(".acciones", sec).insertBefore(btnCancel, btnOk);
        btnCancel.addEventListener("click", async (ev) => {
          ev.preventDefault();
          await reloadCard(sec, sec.dataset.snapshot_id || null);
        });
      }
    } else {
      const metodo_pago = form.querySelector("select[name='metodo_pago']")?.value || undefined;
      const estado_pago = form.querySelector("select[name='estado_pago']")?.value || undefined;
      const estado      = form.querySelector("select[name='estado']")?.value || undefined;

      try {
        btnEd.disabled = true;
        await updatePedido(p.pedido_id, { metodo_pago, estado_pago, estado });
        await reloadCard(sec, sec.dataset.snapshot_id || null);
      } catch (err) {
        alert("No se pudo guardar: " + (err?.message || err));
        console.error(err);
      } finally {
        btnEd.disabled = false;
      }
    }
  });

  // ====== Finalizar ======
  btnOk?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!p.pedido_id) return alert("Este snapshot no tiene pedido vinculado (pedido_id).");
    if (!confirm("¿Dar por finalizado este pedido (estado: finalizado)?")) return;

    try {
      btnOk.disabled = true;
      await updatePedido(p.pedido_id, { estado: "finalizado" });
      // quitamos la tarjeta; si no queda ninguna, mostramos vacío
      sec.remove();
      if (!grid.children.length) render([]);
    } catch (err) {
      alert("No se pudo finalizar: " + (err?.message || err));
      console.error(err);
    } finally {
      btnOk.disabled = false;
    }
  });

  return sec;
}

async function reloadCard(oldNode, snapshotId) {
  try {
    const pedidoId = oldNode?.dataset?.pedido_id || null;

    // Si no hay llaves, sacar la tarjeta
    if (!snapshotId && !pedidoId) {
      oldNode.remove();
      if (!grid.children.length) render([]);
      return;
    }

    // Construir query sin eq(null)
    let q = supa.from("v_pedidos_pendientes").select("*").limit(1);
    if (snapshotId && pedidoId) {
      q = q.or(`snapshot_id.eq.${snapshotId},pedido_id.eq.${pedidoId}`);
    } else if (snapshotId) {
      q = q.eq("snapshot_id", snapshotId);
    } else {
      q = q.eq("pedido_id", pedidoId);
    }

    const { data, error } = await q.single();
    if (error) throw error;

    if (!data) {
      oldNode.remove();
      if (!grid.children.length) render([]);
      return;
    }

    const idx = [...grid.children].indexOf(oldNode);
    const newNode = cardPedido(data, Math.max(0, idx));
    oldNode.replaceWith(newNode);
  } catch (err) {
    console.error("reloadCard error:", err);
    alert("No se pudo recargar el pedido: " + (err?.message || err));
  }
}

/* ========= Init ========= */
(async () => {
  try {
    const rows = await fetchPendientes();
    render(rows);
  } catch (err) {
    alert("Error cargando pedidos: " + (err?.message || err));
    console.error(err);
  }
})();

// ==== Masonry con Grid: calcula spans por altura ====
function aplicarMasonry() {
  const grid = document.getElementById('grid');
  if (!grid) return;

  const style = getComputedStyle(grid);
  const row = parseInt(style.getPropertyValue('grid-auto-rows')); // 8
  const gap = parseInt(style.getPropertyValue('gap')) || 0;

  grid.querySelectorAll('.card').forEach(card => {
    card.style.gridRowEnd = 'span 1'; // reset antes de medir
    const h = card.getBoundingClientRect().height;
    const span = Math.ceil((h + gap) / (row + gap));
    card.style.gridRowEnd = `span ${span}`;
  });
}

// Recalcular después de render, al cargar imágenes y al redimensionar
window.addEventListener('load', aplicarMasonry);
window.addEventListener('resize', aplicarMasonry);

// Si tu render es async, llama aplicarMasonry() justo después de insertar las cards.
// Opcional: observa cambios dinámicos:
new MutationObserver(aplicarMasonry).observe(document.getElementById('grid'), { childList: true, subtree: true });

