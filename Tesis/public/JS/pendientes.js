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
const nnum = (v, d=0) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
};
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
const hoyLargo = () =>
  new Date().toLocaleDateString("es-PY", { day:"2-digit", month:"long", year:"numeric" });

$("#fecha").textContent = hoyLargo();
$(".back")?.addEventListener("click", () => history.back());

const ESTADOS_PEDIDO = ["pendiente", "pagado", "cancelado", "entregado"];
const ESTADOS_PAGO   = ["pendiente", "pagado", "fallido", "reembolsado"];
const colorEstado = { pendiente:"#b38a00", pagado:"#1d6f42", cancelado:"#8b0000", entregado:"#2e7dd1" };
const colorPago   = { pendiente:"#b38a00", pagado:"#1d6f42", fallido:"#8b0000", reembolsado:"#6b4caf" };
const badge = (estado, palette) => {
  if (!estado) return "";
  const color = palette[estado] || "#444";
  return `<span class="badge" style="display:inline-block;padding:.15rem .5rem;border-radius:999px;background:${color}15;color:${color};border:1px solid ${color}40;font-size:.78rem;margin-left:.25rem;">${estado}</span>`;
};

/* ========= Normalización de ítems ========= */
function normalizeItems(items) {
  // items puede venir como array, string JSON o null
  let arr = [];
  if (Array.isArray(items)) arr = items;
  else if (typeof items === "string" && items.trim()) {
    try { arr = JSON.parse(items); } catch { arr = []; }
  }
  // homogeneizamos campos esperados: titulo/nombre y precio/precio_unitario
  return arr.map((d) => {
    const titulo = dz(d.titulo || d.nombre || d?.productos?.nombre || "");
    const cantidad = nnum(d.cantidad, 1);
    const precio = nnum(d.precio ?? d.precio_unitario ?? d.unitario, 0);
    return { titulo, cantidad, precio };
  });
}

/* ========= Data (vista v_pedidos_pendientes) ========= */
async function fetchPendientes() {
  const { data, error } = await supa
    .from("v_pedidos_pendientes")
    .select(`
      pedido_nro,
      pedido_id,
      creado_en,
      estado_pedido,
      estado_pago,
      metodo_pago,
      total,
      usuario_id,
      ruc, razon, tel, mail, contacto,
      ciudad, barrio, depto, postal,
      calle1, calle2, numero_casa,
      hora_desde, hora_hasta,
      items,
      extra
    `)
    .order("pedido_nro", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Carga ítems en vivo cuando la vista no los trae
async function fetchPedidoItems(pedido_id) {
  if (!pedido_id) return [];
  const { data, error } = await supa
    .from("detalles_pedido")
    .select(`
      cantidad,
      precio_unitario,
      productos ( nombre )
    `)
    .eq("pedido_id", pedido_id);
  if (error) throw error;
  return (data || []).map((r) => ({
    titulo: dz(r?.productos?.nombre || ""),
    cantidad: nnum(r?.cantidad, 1),
    precio: nnum(r?.precio_unitario, 0),
  }));
}

async function updatePedido(pedido_id, payload) {
  const clean = { ...payload };
  Object.keys(clean).forEach((k) => {
    if (clean[k] === "" || typeof clean[k] === "undefined") delete clean[k];
  });
  const { error } = await supa.from("pedidos").update(clean).eq("id", pedido_id);
  if (error) throw error;
}

async function fetchFromViewByPedidoId(pedido_id) {
  const { data, error } = await supa
    .from("v_pedidos_pendientes")
    .select(`
      pedido_nro,
      pedido_id,
      creado_en,
      estado_pedido,
      estado_pago,
      metodo_pago,
      total,
      usuario_id,
      ruc, razon, tel, mail, contacto,
      ciudad, barrio, depto, postal,
      calle1, calle2, numero_casa,
      hora_desde, hora_hasta,
      items,
      extra
    `)
    .eq("pedido_id", pedido_id)
    .maybeSingle();
  if (error) throw error;
  return data || null;
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
  // 1) Normalizamos items que vengan en la vista
  let dets = normalizeItems(p.items);
  // 2) Calculamos total con esos ítems
  let detTotal = dets.reduce((a, d) => a + nnum(d.precio)*nnum(d.cantidad), 0);
  let total = nnum(p.total, detTotal);

  const sec = document.createElement("section");
  sec.className = "card";
  sec.dataset.pedido_id = p.pedido_id || "";

  sec.innerHTML = `
    <h3>Pedido N°: ${p.pedido_nro}
      ${p.estado_pedido ? badge(p.estado_pedido, colorEstado) : ""}
      ${p.estado_pago   ? badge(p.estado_pago,   colorPago)   : ""}
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
          <ul class="det-list">
            ${
              dets.length
                ? dets.map(d =>
                    `<li>${dz(d.titulo)||"(item)"} — ${nnum(d.cantidad)} × ${fmtGs(nnum(d.precio))} = <b>${fmtGs(nnum(d.precio)*nnum(d.cantidad))}</b></li>`
                  ).join("")
                : "<li>(sin ítems)</li>"
            }
          </ul>
        </div>
        <p style="margin-top:8px;"><b>Total :</b> <span class="total">${fmtGs(total)}</span></p>
      </div>

      <div class="col">
        <label>Ciudad : <input value="${dz(p.ciudad)}" disabled></label>
        <label>Barrio : <input value="${dz(p.barrio)}" disabled></label>
        <label>Departamento : <input value="${dz(p.depto)}" disabled></label>
        <label>Calle 1 : <input value="${dz(p.calle1)}" disabled></label>
        <label>Calle 2 : <input value="${dz(p.calle2)}" disabled></label>
        <label>N° Casa : <input value="${dz(p.numero_casa)}" disabled></label>

        <div class="hr"></div>

        <label>Método de Pago :
          <select name="metodo_pago" disabled>
            ${["Transferencia","Tarjeta","Efectivo"]
              .map(opt => `<option value="${opt}" ${ (p.metodo_pago)===opt ? "selected":"" }>${opt}</option>`).join("")}
          </select>
        </label>

        <label>Estado pago :
          <select name="estado_pago">
            ${ESTADOS_PAGO.map(e => `<option value="${e}" ${p.estado_pago===e?"selected":""}>${e}</option>`).join("")}
          </select>
        </label>

        <label>Estado pedido :
          <select name="estado_pedido">
            ${ESTADOS_PEDIDO.map(e => `<option value="${e}" ${p.estado_pedido===e?"selected":""}>${e}</option>`).join("")}
          </select>
        </label>
      </div>
    </form>

    <div class="acciones">
      <button class="btn brown btn-edit">Actualizar</button>
      <button class="btn green btn-ok">Finalizar</button>
    </div>
  `;

  // ==== Fallback: si no había items en la vista, los buscamos en vivo y rehidratamos ====
  if ((!dets.length || total === 0) && p.pedido_id) {
    // marcador visual rápido
    const ul = $(".det-list", sec);
    if (ul && !dets.length) {
      ul.innerHTML = `<li>(cargando ítems…)</li>`;
    }
    fetchPedidoItems(p.pedido_id).then((rows) => {
      if (!rows.length) {
        if (ul) ul.innerHTML = "<li>(sin ítems)</li>";
        return;
      }
      const nuevos = rows;
      const newHtml = nuevos.map(d =>
        `<li>${dz(d.titulo)||"(item)"} — ${nnum(d.cantidad)} × ${fmtGs(nnum(d.precio))} = <b>${fmtGs(nnum(d.precio)*nnum(d.cantidad))}</b></li>`
      ).join("");
      if (ul) ul.innerHTML = newHtml;
      const nuevoTotal = nuevos.reduce((a, d) => a + nnum(d.precio)*nnum(d.cantidad), 0);
      const totalSpan = $(".total", sec);
      if (totalSpan) totalSpan.textContent = fmtGs(nuevoTotal);
    }).catch(console.error);
  }

  // ==== Acciones ====
  const form   = $("form", sec);
  const btnEd  = $(".btn-edit", sec);
  const btnOk  = $(".btn-ok", sec);
  let btnCancel = null;

  btnEd?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!p.pedido_id) return alert("No se puede actualizar: falta 'pedido_id'.");

    const mode = form.dataset.mode;
    if (mode === "view") {
      $$("select[name='metodo_pago'], select[name='estado_pago'], select[name='estado_pedido']", form)
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
          await reloadCard(sec, p.pedido_id);
        });
      }
    } else {
      const metodo_pago   = form.querySelector("select[name='metodo_pago']")?.value || undefined;
      const estado_pago   = form.querySelector("select[name='estado_pago']")?.value || undefined;
      const estado_pedido = form.querySelector("select[name='estado_pedido']")?.value || undefined;

      try {
        btnEd.disabled = true;
        await updatePedido(p.pedido_id, { metodo_pago, estado_pago, estado: estado_pedido });
        await reloadCard(sec, p.pedido_id);
      } catch (err) {
        alert("No se pudo guardar: " + (err?.message || err));
        console.error(err);
      } finally {
        btnEd.disabled = false;
      }
    }
  });

  btnOk?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!p.pedido_id) return alert("No se puede finalizar: falta 'pedido_id'.");
    if (!confirm("¿Dar por finalizado este pedido (estado: entregado)?")) return;

    try {
      btnOk.disabled = true;
      await updatePedido(p.pedido_id, { estado: "entregado" });
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

async function reloadCard(oldNode, pedido_id) {
  try {
    const fresh = await fetchFromViewByPedidoId(pedido_id);
    if (!fresh) {
      oldNode.remove();
      if (!grid.children.length) render([]);
      return;
    }
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
    const rows = await fetchPendientes();
    render(rows);
  } catch (err) {
    alert("Error cargando pedidos: " + (err?.message || err));
    console.error(err);
  }
})();
