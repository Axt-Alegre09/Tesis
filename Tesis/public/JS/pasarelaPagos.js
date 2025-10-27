// JS/pasarelaPagos.js
// Guarda SOLO el método de pago en "pedidos" (Transferencia/Efectivo/Tarjeta) con default Efectivo.
// No valida ni guarda otros datos.

import { supabase } from "./ScriptLogin.js";

const QS = new URLSearchParams(location.search);

// Mapea valores del <input value="..."> a etiqueta a guardar
const METODO_LABEL = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
};

function putMessage(msg, type = "info") {
  let box = document.querySelector("[data-checkout-msg]");
  if (!box) {
    box = document.createElement("div");
    box.setAttribute("data-checkout-msg", "1");
    box.style.border = "2px solid #6f5c38";
    box.style.background = "#fff";
    box.style.borderRadius = "12px";
    box.style.padding = "14px";
    box.style.margin = "10px 0";
    box.style.maxWidth = "980px";
    box.style.fontSize = "14px";
    document.body.prepend(box);
  }
  const title = type === "ok" ? "Listo: " : type === "warn" ? "Atención: " : "";
  box.innerHTML = `<b>${title}</b>${msg}`;
}

// Solo alterna paneles por método (visual)
function setupMetodoPagoUI() {
  const radios = document.querySelectorAll(".metodo-radio");
  const panels = document.querySelectorAll(".metodo-panel");
  const show = (m) =>
    panels.forEach((p) => p.classList.toggle("disabled", p.dataset.metodo !== m));
  radios.forEach((r) => {
    r.addEventListener("change", () => show(r.value));
    if (r.checked) show(r.value);
  });
}

// Inserta un pedido mínimo con solo metodo_pago
async function crearPedidoMinimal(metodoPago) {
  const { data: { user } = {} } = await supabase.auth.getUser();
  const insertObj = { metodo_pago: metodoPago };
  // Si hay sesión y querés relacionarlo, agregamos usuario_id sin validarlo
  if (user?.id) insertObj.usuario_id = user.id;

  const { data, error } = await supabase
    .from("pedidos")
    .insert([insertObj])
    .select("id, metodo_pago")
    .single();
  if (error) throw error;
  return data; // { id, metodo_pago }
}

// Actualiza solo el metodo_pago de un pedido existente
async function actualizarMetodoPago(pedidoId, metodoPago) {
  const { data, error } = await supabase
    .from("pedidos")
    .update({ metodo_pago: metodoPago })
    .eq("id", pedidoId)
    .select("id, metodo_pago")
    .single();
  if (error) throw error;
  return data; // { id, metodo_pago }
}

async function init() {
  setupMetodoPagoUI();

  const form = document.getElementById("checkout-form");
  const success = document.getElementById("checkout-success");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();

    // 1) Obtener el valor crudo del radio
    const raw = document.querySelector('input[name="metodo"]:checked')?.value || "efectivo";
    // 2) Mapear a etiqueta final (Title Case)
    const metodoPago = METODO_LABEL[raw] || "Efectivo"; // default “Efectivo”

    // 3) Si existe ?pedido=… -> update; sino -> insert minimal
    const pedidoId = QS.get("pedido")?.trim();
    try {
      form.querySelector('button[type="submit"]')?.setAttribute("disabled", "true");

      let saved;
      if (pedidoId) {
        saved = await actualizarMetodoPago(pedidoId, metodoPago);
      } else {
        saved = await crearPedidoMinimal(metodoPago);
      }

      // 4) Feedback y UI
      putMessage(`Método de pago guardado: <b>${saved.metodo_pago}</b> (Pedido: ${saved.id})`, "ok");
      success?.classList.remove("disabled");
      form.classList.add("disabled");

      // 5) Opcional: volver al inicio suave
      setTimeout(() => { window.location.assign("index.html"); }, 1200);
    } catch (err) {
      console.error(err);
      putMessage("No se pudo guardar el método de pago.");
      form.querySelector('button[type="submit"]')?.removeAttribute("disabled");
    }
  });
}

init();
