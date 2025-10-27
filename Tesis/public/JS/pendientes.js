
// === JS/pendientes.js ===
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/* ========= Supabase ========= */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ========= Helpers ========= */
const $  = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const dz = (v) => (v ?? "").toString().trim()
const fmtGs = (n) => new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs"
const hoyLargo = () => new Date().toLocaleDateString("es-PY", { day:"2-digit", month:"long", year:"numeric" })

$("#fecha").textContent = hoyLargo()
$(".back")?.addEventListener("click", () => history.back())

const ESTADOS_PEDIDO = ["pendiente", "pagado", "cancelado", "entregado"]
const ESTADOS_PAGO   = ["pendiente", "pagado", "fallido", "reembolsado"]
const colorEstado = { pendiente:"#b38a00", pagado:"#1d6f42", cancelado:"#8b0000", entregado:"#2e7dd1" }
const colorPago   = { pendiente:"#b38a00", pagado:"#1d6f42", fallido:"#8b0000", reembolsado:"#6b4caf" }
const badge = (estado, palette) => {
  if (!estado) return ""
  const color = palette[estado] || "#444"
  return `<span class="badge" style="display:inline-block;padding:.15rem .5rem;border-radius:999px;background:${color}15;color:${color};border:1px solid ${color}40;font-size:.78rem;margin-left:.25rem;">${estado}</span>`
}

/* ========= Data: leemos de pedidos_snapshot y traemos estado real desde pedidos ========= */
async function fetchSnapshotsConEstados() {
  const { data: snaps, error } = await supa
    .from("pedidos_snapshot")
    .select(`
      id, creado_en, pedido_id, usuario_id,
      metodo_pago, total,
      ruc, razon, tel, mail, contacto,
      ciudad, barrio, depto, postal,
      calle1, calle2, nro,
      hora_desde, hora_hasta,
      items
    `)
    .order("creado_en", { ascending: true })
  if (error) throw error

  const ids = [...new Set((snaps || []).map(s => s.pedido_id).filter(Boolean))]
  let mapEstado = new Map()
  if (ids.length) {
    const { data: pedidos, error: e2 } = await supa
      .from("pedidos")
      .select("id, estado, estado_pago, metodo_pago, monto_total")
      .in("id", ids)
    if (e2) throw e2
    mapEstado = new Map(pedidos.map(p => [p.id, p]))
  }

  return (snaps || []).map(s => {
    const ped = s.pedido_id ? mapEstado.get(s.pedido_id) : null
    return {
      ...s,
      estado: ped?.estado || "pendiente",
      estado_pago: ped?.estado_pago || "pendiente",
      metodo_pago_real: ped?.metodo_pago || s.metodo_pago,
      total_real: (Number(ped?.monto_total || 0) || Number(s.total || 0) || 0)
    }
  })
}

async function updatePedido(pedido_id, payload) {
  if (!pedido_id) throw new Error("Este snapshot no tiene pedido_id para actualizar.")
  const toSend = { ...payload }
  Object.keys(toSend).forEach(k => {
    if (toSend[k] === "" || typeof toSend[k] === "undefined") delete toSend[k]
  })
  const { error } = await supa.from("pedidos").update(toSend).eq("id", pedido_id)
  if (error) throw error
}

async function fetchSnapshotById(id) {
  const { data: s, error } = await supa
    .from("pedidos_snapshot")
    .select(`
      id, creado_en, pedido_id, usuario_id,
      metodo_pago, total,
      ruc, razon, tel, mail, contacto,
      ciudad, barrio, depto, postal,
      calle1, calle2, nro,
      hora_desde, hora_hasta,
      items
    `)
    .eq("id", id)
    .maybeSingle()
  if (error) throw error

  let estado = "pendiente", estado_pago = "pendiente", metodo_pago = s.metodo_pago, total = Number(s.total || 0)
  if (s.pedido_id) {
    const { data: p } = await supa
      .from("pedidos")
      .select("estado, estado_pago, metodo_pago, monto_total")
      .eq("id", s.pedido_id)
      .maybeSingle()
    if (p) {
      estado = p.estado || estado
      estado_pago = p.estado_pago || estado_pago
      metodo_pago = p.metodo_pago || metodo_pago
      total = Number(p.monto_total || total)
    }
  }
  return { ...s, estado, estado_pago, metodo_pago_real: metodo_pago, total_real: total }
}

/* ========= NUEVO: Traer ítems de un pedido usando relación explícita =========
   ¡IMPORTANTE! Usamos el constraint name para desambiguar:
   - detalle -> productos:  productos!detalles_pedido_producto_id_fkey
*/
async function fetchItemsByPedido(pedido_id) {
  if (!pedido_id) return []
  const { data, error } = await supa
    .from("detalles_pedido")
    .select(`
      cantidad,
      precio_unitario,
      productos:productos!detalles_pedido_producto_id_fkey ( id, nombre )
    `)
    .eq("pedido_id", pedido_id)
    .order("id", { ascending: true })
  if (error) {
    console.error("Error items:", error)
    return []
  }
  return (data || []).map(d => ({
    titulo: d?.productos?.nombre || "(item)",
    cantidad: Number(d?.cantidad || 1),
    precio: Number(d?.precio_unitario || 0)
  }))
}

/* ========= UI ========= */
const grid = $("#grid")

function render(list) {
  grid.innerHTML = ""
  if (!list.length) {
    grid.innerHTML = `<section class="card"><p>No hay pedidos pendientes.</p></section>`
    return
  }
  list.forEach((p, idx) => grid.appendChild(cardPedido(p, idx)))
}

function cardPedido(p, idx) {
  // Snapshot puede traer “items” embebidos (tu pasarela), pero preferimos los reales de la venta:
  const snapshotItems = Array.isArray(p.items) ? p.items : []

  const sec = document.createElement("section")
  sec.className = "card"
  sec.dataset.snapshot_id = p.id
  sec.dataset.pedido_id = p.pedido_id || ""

  sec.innerHTML = `
    <h3>Pedido N°: ${idx}
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
          <ul class="det-list"><li>(cargando ítems…)</li></ul>
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
            ${["Transferencia","Tarjeta","Efectivo"].map(opt => `<option value="${opt}" ${(p.metodo_pago_real||p.metodo_pago)===opt ? "selected":""}>${opt}</option>`).join("")}
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
  `

  const form   = $("form", sec)
  const btnEd  = $(".btn-edit", sec)
  const btnOk  = $(".btn-ok", sec)
  const detUL  = $(".det-list", sec)
  const totalSpan = $(".total", sec)
  let btnCancel = null

  // ====== Cargar ÍTEMS ======
  ;(async () => {
    // Preferimos leer de la venta real si existe pedido_id; si no, usamos snapshotItems
    let items = []
    if (p.pedido_id) {
      items = await fetchItemsByPedido(p.pedido_id)
    }
    if (!items.length && snapshotItems.length) {
      // fallback a los items del snapshot (si tu pasarela los guardó)
      items = snapshotItems.map(x => ({
        titulo: dz(x.titulo) || "(item)",
        cantidad: Number(x.cantidad || 1),
        precio: Number(x.precio || 0)
      }))
    }

    if (!items.length) {
      detUL.innerHTML = "<li>(sin ítems)</li>"
      // total: si no viene de BD ni snapshot, dejamos el total ya pintado (p.total_real)
      return
    }

    const lis = items.map(d =>
      `<li>${dz(d.titulo)} — ${d.cantidad} × ${fmtGs(d.precio)} = <b>${fmtGs(d.cantidad * d.precio)}</b></li>`
    ).join("")
    detUL.innerHTML = lis

    // Recalcular total si el de BD era 0:
    const calcTotal = items.reduce((a, r) => a + r.cantidad * r.precio, 0)
    const finalTotal = Number(p.total_real || 0) || calcTotal
    totalSpan.textContent = fmtGs(finalTotal)
  })().catch(console.error)

  // ====== Editar / Guardar ======
  btnEd?.addEventListener("click", async (e) => {
    e.preventDefault()
    if (!p.pedido_id) return alert("Este snapshot no tiene pedido vinculado (pedido_id).")

    const mode = form.dataset.mode
    if (mode === "view") {
      $$("select[name='metodo_pago'], select[name='estado_pago'], select[name='estado']", form)
        .forEach(el => el.disabled = false)
      form.dataset.mode = "edit"
      btnEd.textContent = "Guardar"

      if (!btnCancel) {
        btnCancel = document.createElement("button")
        btnCancel.className = "btn"
        btnCancel.textContent = "Cancelar"
        $(".acciones", sec).insertBefore(btnCancel, btnOk)
        btnCancel.addEventListener("click", async (ev) => {
          ev.preventDefault()
          await reloadCard(sec, p.id)
        })
      }
    } else {
      const metodo_pago = form.querySelector("select[name='metodo_pago']")?.value || undefined
      const estado_pago = form.querySelector("select[name='estado_pago']")?.value || undefined
      const estado      = form.querySelector("select[name='estado']")?.value || undefined

      try {
        btnEd.disabled = true
        await updatePedido(p.pedido_id, { metodo_pago, estado_pago, estado })
        await reloadCard(sec, p.id)
      } catch (err) {
        alert("No se pudo guardar: " + (err?.message || err))
        console.error(err)
      } finally {
        btnEd.disabled = false
      }
    }
  })

  // ====== Finalizar ======
  btnOk?.addEventListener("click", async (e) => {
    e.preventDefault()
    if (!p.pedido_id) return alert("Este snapshot no tiene pedido vinculado (pedido_id).")
    if (!confirm("¿Dar por finalizado este pedido (estado: entregado)?")) return

    try {
      btnOk.disabled = true
      await updatePedido(p.pedido_id, { estado: "entregado" })
      sec.remove()
      if (!grid.children.length) render([])
    } catch (err) {
      alert("No se pudo finalizar: " + (err?.message || err))
      console.error(err)
    } finally {
      btnOk.disabled = false
    }
  })

  return sec
}

async function reloadCard(oldNode, snapshotId) {
  try {
    const fresh = await fetchSnapshotById(snapshotId)
    const idx = [...grid.children].indexOf(oldNode)
    const newNode = cardPedido(fresh, Math.max(0, idx))
    oldNode.replaceWith(newNode)
  } catch (err) {
    alert("No se pudo recargar el pedido: " + (err?.message || err))
    console.error(err)
  }
}

/* ========= Init ========= */
;(async () => {
  try {
    const snaps = await fetchSnapshotsConEstados()
    // Solo los que están realmente pendientes en 'pedidos' (cuando exista), o pendientes por defecto
    const pendientes = snaps.filter(s => (s.estado || "pendiente") === "pendiente")
    render(pendientes)
  } catch (err) {
    alert("Error cargando pedidos: " + (err?.message || err))
    console.error(err)
  }
})()

