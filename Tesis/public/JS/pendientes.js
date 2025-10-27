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
  new Date().toLocaleDateString("es-PY", { day:"2-digit", month:"long", year:"numeric" });

const ESTADOS_PEDIDO = ["pendiente", "pagado", "cancelado", "entregado"];
const ESTADOS_PAGO   = ["pendiente", "pagado", "fallido", "reembolsado"];
const LISTAR_COMO_PEND = ["pendiente"]; // lo que se muestra en esta vista

// pinta badge con color por estado
function badge(estado, palette) {
  const color = palette[estado] || "#444";
  return `<span class="badge" style="display:inline-block;padding:.15rem .5rem;border-radius:999px;background:${color}15;color:${color};border:1px solid ${color}40;font-size:.78rem;margin-left:.25rem;">${estado}</span>`;
}
const colorEstado = { pendiente:"#b38a00", pagado:"#1d6f42", cancelado:"#8b0000", entregado:"#2e7dd1" };
const colorPago   = { pendiente:"#b38a00", pagado:"#1d6f42", fallido:"#8b0000", reembolsado:"#6b4caf" };

$(".back")?.addEventListener("click", () => history.back());
$("#fecha").textContent = hoyLargo();

/* ========= Data ========= */
// 1) Pedidos pendientes con detalle
async function fetchPedidosPendientes() {
  const { data, error } = await supa
    .from("pedidos")
    .select(`
      id, creado_en, usuario_id,
      metodo_pago, monto_total,
      estado, estado_pago,
      detalles_pedido (
        cantidad, precio_unitario,
        productos ( id, nombre )
      )
    `)
    .in("estado", LISTAR_COMO_PEND)
    .order("creado_en", { ascending: true });
  if (error) throw error;
  return data || [];
}

// 2) Perfiles por user_id
async function fetchPerfiles(userIds) {
  if (!userIds.length) return new Map();
  const { data, error } = await supa
    .from("clientes_perfil")
    .select(`
      user_id,
      ruc, razon, tel, mail, contacto,
      ciudad, barrio, depto, postal,
      calle1, calle2, nro,
      created_at, updated_at
    `)
    .in("user_id", userIds);
  if (error) throw error;
  const map = new Map();
  (data || []).forEach((r) => map.set(r.user_id, r));
  return map;
}

async function updatePedido(id, payload) {
  Object.keys(payload).forEach((k) => {
    if (payload[k] === "" || payload[k] === undefined) delete payload[k];
  });
  const { error } = await supa.from("pedidos").update(payload).eq("id", id);
  if (error) throw error;
}

async function updatePerfil(user_id, payload) {
  Object.keys(payload).forEach((k) => {
    if (payload[k] === "" || payload[k] === undefined) delete payload[k];
  });
  const { error } = await supa
    .from("clientes_perfil")
    .update(payload)
    .eq("user_id", user_id);
  if (error) throw error;
}

async function fetchPedidoFull(id) {
  const { data: p, error } = await supa
    .from("pedidos")
    .select(`
      id, creado_en, usuario_id,
      metodo_pago, monto_total,
      estado, estado_pago,
      detalles_pedido (
        cantidad, precio_unitario,
        productos ( id, nombre )
      )
    `)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const perfMap = await fetchPerfiles([p.usuario_id]);
  p.perfil = perfMap.get(p.usuario_id) || {};
  return p;
}

/* ========= UI ========= */
const grid = $("#grid");

function render(list) {
  grid.innerHTML = "";
  if (!list.length) {
    grid.innerHTML = `<section class="card"><p>No hay pedidos pendientes.</p></section>`;
    return;
  }
  list.forEach((p) => grid.appendChild(cardPedido(p)));
}

function cardPedido(p) {
  const perf = p.perfil || {};
  const dets = (p.detalles_pedido || []).map((d) => {
    const qty  = Number(d?.cantidad ?? 0);
    const unit = Number(d?.precio_unitario ?? 0);
    return { titulo: d?.productos?.nombre ?? "(sin nombre)", cantidad: qty, precio: unit, subtotal: qty * unit };
  });
  const totalDet = dets.reduce((a, r) => a + r.subtotal, 0);
  const total = p.monto_total ?? totalDet;

  const sec = document.createElement("section");
  sec.className = "card";
  sec.dataset.id = p.id;

  sec.innerHTML = `
    <h3>Pedido N°: ${p.id}
      ${p.estado ? badge(p.estado, colorEstado) : ""}
      ${p.estado_pago ? badge(p.estado_pago, colorPago) : ""}
    </h3>

    <form class="info two-cols" data-mode="view">
      <div class="col">
        <label>Ruc / Ci : <input name="ruc" value="${dz(perf.ruc)}" disabled></label>
        <label>Nombre : <input name="razon" value="${dz(perf.razon)}" disabled></label>
        <label>Teléfono : <input name="tel" value="${dz(perf.tel)}" disabled></label>
        <label>Correo : <input name="mail" value="${dz(perf.mail)}" disabled></label>
        <label>Contacto : <input name="contacto" value="${dz(perf.contacto)}" disabled></label>
        <label>Dirección postal : <input name="postal" value="${dz(perf.postal)}" disabled></label>

        <div class="hr"></div>
        <div class="detalle">
          <b>Detalle de Pedido :</b>
          <ul class="det-list">
            ${
              dets.length
                ? dets.map(d => `<li>${d.titulo} — ${d.cantidad} × ${fmtGs(d.precio)} = <b>${fmtGs(d.subtotal)}</b></li>`).join("")
                : "<li>(sin ítems)</li>"
            }
          </ul>
        </div>
        <p style="margin-top:8px;"><b>Total :</b> <span class="total">${fmtGs(total)}</span></p>
      </div>

      <div class="col">
        <label>Ciudad : <input name="ciudad" value="${dz(perf.ciudad)}" disabled></label>
        <label>Barrio : <input name="barrio" value="${dz(perf.barrio)}" disabled></label>
        <label>Departamento : <input name="depto" value="${dz(perf.depto)}" disabled></label>
        <label>Calle 1 : <input name="calle1" value="${dz(perf.calle1)}" disabled></label>
        <label>Calle 2 : <input name="calle2" value="${dz(perf.calle2)}" disabled></label>
        <label>N° Casa : <input name="nro" value="${dz(perf.nro)}" disabled></label>

        <div class="hr"></div>

        <label>Método de Pago :
          <select name="metodo_pago" disabled>
            <option value="">—</option>
            ${["Transferencia", "Tarjeta", "Efectivo"]
              .map(opt => `<option value="${opt}" ${p.metodo_pago===opt?"selected":""}>${opt}</option>`).join("")}
          </select>
        </label>

        <label>Estado pago :
          <select name="estado_pago" disabled>
            <option value="">—</option>
            ${ESTADOS_PAGO.map(e => `<option value="${e}" ${p.estado_pago===e?"selected":""}>${e}</option>`).join("")}
          </select>
        </label>

        <label>Estado pedido :
          <select name="estado" disabled>
            <option value="">—</option>
            ${ESTADOS_PEDIDO.map(e => `<option value="${e}" ${p.estado===e?"selected":""}>${e}</option>`).join("")}
          </select>
        </label>
      </div>
    </form>

    <div class="acciones">
      <button class="btn brown btn-edit">Actualizar</button>
      <button class="btn green btn-ok">Finalizar</button>
      <!-- <button class="btn" data-cancel>Cancelar</button> -->
    </div>
  `;

  const form   = $("form", sec);
  const btnEd  = $(".btn-edit", sec);
  const btnOk  = $(".btn-ok", sec);
  let btnCancel = null;

  btnEd.addEventListener("click", async (e) => {
    e.preventDefault();
    const mode = form.dataset.mode;

    if (mode === "view") {
      $$("input, select", form).forEach((el) => (el.disabled = false));
      form.dataset.mode = "edit";
      btnEd.textContent = "Guardar";
      if (!btnCancel) {
        btnCancel = document.createElement("button");
        btnCancel.className = "btn";
        btnCancel.textContent = "Cancelar";
        $(".acciones", sec).insertBefore(btnCancel, btnOk);
        btnCancel.addEventListener("click", async (ev) => {
          ev.preventDefault();
          await reloadCard(sec, p.id);
        });
      }
    } else {
      const payload = serializeForm(form);

      // separar payloads
      const perfilPayload = pick(payload, [
        "ruc","razon","tel","mail","contacto","postal",
        "ciudad","barrio","depto","calle1","calle2","nro"
      ]);
      const pedidoPayload = pick(payload, ["metodo_pago","estado_pago","estado"]);

      try {
        btnEd.disabled = true;
        if (Object.keys(perfilPayload).length) {
          await updatePerfil(p.usuario_id, perfilPayload);
        }
        if (Object.keys(pedidoPayload).length) {
          await updatePedido(p.id, pedidoPayload);
        }
        await reloadCard(sec, p.id);
      } catch (err) {
        alert("No se pudo guardar: " + (err?.message || err));
        console.error(err);
      } finally {
        btnEd.disabled = false;
      }
    }
  });

  // Finaliza => estado 'entregado'
  btnOk.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!confirm("¿Dar por finalizado este pedido (estado: entregado)?")) return;

    try {
      btnOk.disabled = true;
      await updatePedido(p.id, { estado: "entregado" });
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

function serializeForm(form) {
  const out = {};
  $$("input, select", form).forEach((el) => {
    if (!el.name) return;
    out[el.name] = el.value;
  });
  return out;
}
function pick(obj, keys) {
  const out = {};
  keys.forEach((k) => { if (k in obj) out[k] = obj[k]; });
  return out;
}

async function reloadCard(oldNode, id) {
  try {
    const fresh = await fetchPedidoFull(id);
    const newNode = cardPedido(fresh);
    oldNode.replaceWith(newNode);
  } catch (err) {
    alert("No se pudo recargar el pedido: " + (err?.message || err));
    console.error(err);
  }
}

/* ========= Init ========= */
(async () => {
  try {
    const pedidos = await fetchPedidosPendientes();
    const ids = [...new Set(pedidos.map(p => p.usuario_id).filter(Boolean))];
    const perfMap = await fetchPerfiles(ids);
    pedidos.forEach(p => { p.perfil = perfMap.get(p.usuario_id) || {}; });
    render(pedidos);
  } catch (err) {
    alert("Error cargando pedidos: " + (err?.message || err));
    console.error(err);
  }
})();
