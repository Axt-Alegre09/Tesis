// JS/catering.js
// Panel Pedidos Catering — calendario 100% funcional con Supabase
import { supabase, requireAuth } from "./ScriptLogin.js";

/* ========= Utiles de fecha ========= */
const ymd  = d => d.toISOString().slice(0,10);
const fMY  = new Intl.DateTimeFormat("es-PY", { month: "long", year: "numeric" });
const fromYMD = s => new Date(`${s}T00:00:00`);
const isoWeek = (d) => { const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const n=t.getUTCDay()||7; t.setUTCDate(t.getUTCDate()+4-n); const y0=new Date(Date.UTC(t.getUTCFullYear(),0,1)); return Math.ceil((((t-y0)/86400000)+1)/7); };
const isWeekend = d => [0,6].includes(d.getDay());
const limiteDia = d => isWeekend(d) ? 3 : 2;

/* ========= Estado ========= */
let pivot = new Date(); pivot.setDate(1);
let cache = [];
let selectedId = null;
let editMode   = false;

/* ========= Nodos ========= */
const backBtn     = document.querySelector(".back");
const fechaHeader = document.querySelector(".fecha");
const monthTitle  = document.querySelector(".month-title");
const calTable    = document.querySelector(".calendar__table");
const [prevBtn, nextBtn] = document.querySelectorAll(".month-nav .icon-btn");

/* Detalle (Datos del Servicio) */
const D = {
  nombre:      document.getElementById("d_nombre"),
  telefono:    document.getElementById("d_telefono"),
  direccion:   document.getElementById("d_direccion"),
  email:       document.getElementById("d_email"),
  tipo:        document.getElementById("d_tipo"),
  menu:        document.getElementById("d_menu"),
  invitados:   document.getElementById("d_invitados"),
  fecha:       document.getElementById("d_fecha"),
  hora:        document.getElementById("d_hora"),
  form:        document.getElementById("formDetalle"),
  btnCancelar: document.getElementById("btnCancelar"),
  btnEnCurso:  document.getElementById("btnEnCurso"),
  btnEditar:   document.getElementById("btnEditar"),
  btnFin:      document.getElementById("btnFinalizar"),
};

/* Agendar */
const A = {
  form:       document.getElementById("formAgendar"),
  nombre:     document.getElementById("a_nombre"),
  telefono:   document.getElementById("a_telefono"),
  direccion:  document.getElementById("a_direccion"),
  email:      document.getElementById("a_email"),
  tipo:       document.getElementById("a_tipo"),
  menu:       document.getElementById("a_menu"),
  invitados:  document.getElementById("a_invitados"),
  fecha:      document.getElementById("a_fecha"),
  hora:       document.getElementById("a_hora"),
  btnCancel:  document.getElementById("btnAgendarCancelar")
};

/* ========= Helpers UI ========= */
const disableDetalle = (b) => {
  [D.nombre, D.telefono, D.direccion, D.email, D.tipo, D.menu, D.invitados, D.fecha, D.hora]
    .forEach(i => i && (i.disabled = b));
};
const findById = id => cache.find(r => r.id === id) || null;
const chipColor = (estado) => {
  if (estado === "cancelado")  return "var(--warn)";
  if (estado === "finalizado") return "var(--ok)";
  if (estado === "en_curso")   return "var(--brown-700)";
  return "var(--brown-700)";
};

/* ========= Data ========= */
async function loadMes(baseDate){
  const start = new Date(baseDate); start.setDate(1);
  const end   = new Date(start); end.setMonth(start.getMonth()+1);

  const { data, error } = await supabase
    .from("reservas_catering")
    .select("*")
    .gte("fecha", ymd(start))
    .lt("fecha",  ymd(end))
    .order("fecha", { ascending: true })
    .order("hora",  { ascending: true });
  if (error) {
    console.error("[catering] loadMes error", error);
    cache = [];
  } else {
    cache = data || [];
  }
}

/* ========= Render calendario ========= */
function renderCalendar(){
  const titulo = `${fMY.format(pivot)}`.replace(/^\w/, c => c.toUpperCase());
  monthTitle.textContent = titulo;
  fechaHeader.textContent = titulo;

  const heads = [
    h("div","wcol head","Sem"),
    ...["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"].map(t => h("div","head",t))
  ];
  calTable.replaceChildren(...heads);

  const first   = new Date(pivot);
  const dow     = first.getDay();
  const start   = new Date(first); start.setDate(1 - ((dow + 6) % 7));
  const days42  = [...Array(42)].map((_,i)=>{ const d=new Date(start); d.setDate(start.getDate()+i); return d; });

  for (let w=0; w<6; w++){
    calTable.appendChild(h("div","wcol", String(isoWeek(days42[w*7]))));

    for (let i=0;i<7;i++){
      const d = days42[w*7+i];
      const inMonth = d.getMonth() === pivot.getMonth();
      const day = h("div",`day${[0,6].includes(d.getDay())?" weekend":""}${inMonth?"":" muted"}`);
      day.appendChild(h("span","num", String(d.getDate())));

      const y = ymd(d);
      const delDia = cache.filter(r => r.fecha === y);
      delDia.forEach(r => {
        const chip = h("span","chip", `${r.razonsocial} | ${r.hora}`);
        chip.style.background = chipColor(r.estado);
        chip.title = `Invitados: ${r.invitados ?? "-"} • Estado: ${r.estado}`;
        chip.addEventListener("click", () => fillDetalle(r.id));
        day.appendChild(chip);
      });

      if (inMonth){
        const usados = delDia.filter(r => r.estado !== "cancelado").length;
        if (usados >= limiteDia(d)) day.style.opacity = .70;
      }

      calTable.appendChild(day);
    }
  }
}

function h(tag, cls, text){
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text!=null) el.textContent = text;
  return el;
}

/* ========= Detalle ========= */
function fillDetalle(id){
  const r = findById(id); if (!r) return;
  selectedId = id;
  editMode   = false;
  disableDetalle(true);
  D.btnEditar.textContent = "Editar";
  D.btnEditar.classList.remove("primary");

  D.nombre.value     = r.razonsocial || "";
  D.telefono.value   = r.telefono || "";
  D.direccion.value  = r.lugar || "";
  D.email.value      = r.email || "";
  D.tipo.value       = r.tipoevento || "";
  D.menu.value       = r.tipocomida || "";
  D.invitados.value  = r.invitados ?? "";
  D.fecha.value      = r.fecha;
  D.hora.value       = (r.hora || "").slice(0,5);
}

/* Toggle editar/aceptar */
D.btnEditar?.addEventListener("click", async () => {
  if (!selectedId) return;

  if (!editMode){
    editMode = true;
    disableDetalle(false);
    D.btnEditar.textContent = "Aceptar";
    D.btnEditar.classList.add("primary");
    return;
  }

  const payload = {
    p_id:          selectedId,
    p_razonsocial: D.nombre.value.trim(),
    p_ruc:         "",
    p_tipoevento:  D.tipo.value.trim(),
    p_fecha:       D.fecha.value,
    p_hora:        D.hora.value.trim(),
    p_tipocomida:  D.menu.value.trim(),
    p_lugar:       D.direccion.value.trim(),
    p_observaciones: "",
    p_invitados:   D.invitados.value ? Number(D.invitados.value) : null,
    p_telefono:    D.telefono.value.trim(),
    p_email:       D.email.value.trim()
  };
  const { data, error } = await supabase.rpc("catering_editar", payload);
  if (error){ alert(error.message || "No se pudo guardar cambios"); return; }

  const idx = cache.findIndex(r => r.id === selectedId);
  if (idx >= 0) cache[idx] = data;
  await reload();
  fillDetalle(selectedId);

  editMode = false;
  disableDetalle(true);
  D.btnEditar.textContent = "Editar";
  D.btnEditar.classList.remove("primary");
});

/* Cancelar */
D.btnCancelar?.addEventListener("click", async () => {
  if (!selectedId) return;
  if (!confirm("¿Cancelar este servicio?")) return;
  const { data, error } = await supabase.rpc("catering_set_estado", { p_id: selectedId, p_estado: "cancelado" });
  if (error) return alert(error.message || "No se pudo cancelar");
  const i = cache.findIndex(r => r.id === selectedId);
  if (i>=0) cache[i] = data;
  renderCalendar();
  fillDetalle(selectedId);
});

/* En curso */
D.btnEnCurso?.addEventListener("click", async () => {
  if (!selectedId) return;
  const { data, error } = await supabase.rpc("catering_set_estado", { p_id: selectedId, p_estado: "en_curso" });
  if (error) return alert(error.message || "No se pudo actualizar");
  const i = cache.findIndex(r => r.id === selectedId);
  if (i>=0) cache[i] = data;
  renderCalendar();
  fillDetalle(selectedId);
});

/* Finalizar */
D.btnFin?.addEventListener("click", async () => {
  if (!selectedId) return;
  if (!confirm("¿Finalizar este servicio?")) return;
  const { data, error } = await supabase.rpc("catering_set_estado", { p_id: selectedId, p_estado: "finalizado" });
  if (error) return alert(error.message || "No se pudo finalizar");
  const i = cache.findIndex(r => r.id === selectedId);
  if (i>=0) cache[i] = data;
  renderCalendar();
  fillDetalle(selectedId);
});

/* ========= Agendar ========= */
A.btnCancel?.addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("¿Desea limpiar todos los campos?")) A.form.reset();
});

A.form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const req = [A.nombre, A.telefono, A.invitados, A.fecha, A.hora];
  const miss = req.filter(el => !String(el.value||"").trim());
  if (miss.length){
    miss.forEach(el => el.style.outline = "2px solid red");
    setTimeout(()=> miss.forEach(el => el.style.outline=""), 1200);
    return alert("Faltan campos obligatorios.");
  }

  const fechaSel = A.fecha.value;
  const dJS      = fromYMD(fechaSel);
  const lim      = limiteDia(dJS);
  const usados   = cache.filter(r => r.fecha === fechaSel && r.estado !== "cancelado").length;
  if (usados >= lim) return alert(`Cupo lleno para ${fechaSel}. Cambiá de fecha.`);

  const payload = {
    p_razonsocial: A.nombre.value.trim(),
    p_ruc:         "",
    p_tipoevento:  (A.tipo.value || "Catering").trim(),
    p_fecha:       A.fecha.value,
    p_hora:        A.hora.value.trim(),
    p_tipocomida:  A.menu.value.trim(),
    p_lugar:       A.direccion.value.trim(),
    p_observaciones: "",
    p_invitados:   Number(A.invitados.value) || null,
    p_telefono:    A.telefono.value.trim(),
    p_email:       A.email.value.trim()
  };

  const { data, error } = await supabase.rpc("catering_agendar", payload);
  if (error) return alert(error.message || "No se pudo agendar");

  if (data.fecha.slice(0,7) === ymd(pivot).slice(0,7)) {
    cache.push(data);
    renderCalendar();
  }
  A.form.reset();
  selectedId = data.id;
  fillDetalle(data.id);
});

/* ========= Navegación + init ========= */
prevBtn?.addEventListener("click", async () => { pivot.setMonth(pivot.getMonth()-1); await reload(); });
nextBtn?.addEventListener("click", async () => { pivot.setMonth(pivot.getMonth()+1); await reload(); });

backBtn?.addEventListener("click", () => {
  if (history.length > 1) history.back(); else location.href = "index.html";
});

async function reload(){ await loadMes(pivot); renderCalendar(); }

(async function init(){
  try {
    await requireAuth(); // exige sesión
  } catch { return; }

  await reload();
  disableDetalle(true);
})();
