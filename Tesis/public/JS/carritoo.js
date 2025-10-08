// JS/carritoo.js
import { supabase } from "./ScriptLogin.js";

/* =========================
   Estado y elementos
========================= */
let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito") || "[]");
let ultimoRemoto = [];      // snapshot de items remotos para totales
let modoActual = "local";   // "local" | "remote"

const contenedorCarritoVacio     = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones  = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado  = document.querySelector("#carrito-comprado");

const botonVaciar  = document.querySelector("#carrito-acciones-vaciar");
const botonComprar = document.querySelector("#carrito-acciones-comprar");
const totalEl      = document.querySelector("#total");

/* =========================
   Constantes
========================= */
const IMG_FALLBACK = "https://placehold.co/256x256?text=Imagen";
const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

/* =========================
   Helpers
========================= */

function calcularTotal(items) {
  return (items || []).reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
}

function buildSnapshotFromItems(items) {
  const norm = (items || []).map(p => ({
    id: String(p.id),
    titulo: p.titulo,
    precio: Number(p.precio),
    cantidad: Number(p.cantidad || 1),
    imagen: p.imagen || null
  }));
  return {
    source: "local",
    items: norm,
    total: calcularTotal(norm),
    ts: Date.now()
  };
}

function irPasarelaConItems(pasarelaUrl, items) {
  const snap = buildSnapshotFromItems(items);
  pasarelaUrl.searchParams.set("monto", String(snap.total));
  sessionStorage.setItem("checkout_snapshot", JSON.stringify(snap));
  window.location.assign(pasarelaUrl.toString());
}

function buildSnapshotLocal(){
  const itemsLocal = (productosEnCarrito || []).map(p => ({
    id: String(p.id),
    titulo: p.titulo,
    precio: Number(p.precio),
    cantidad: Number(p.cantidad || 1),
    imagen: p.imagen || null
  }));
  return {
    source: "local",
    items: itemsLocal,
    total: calcularTotalLocal(),
    ts: Date.now()
  };
}

function irPasarelaLocal(pasarelaUrl){
  const total = calcularTotalLocal();
  pasarelaUrl.searchParams.set("monto", String(total));
  sessionStorage.setItem("checkout_snapshot", JSON.stringify(buildSnapshotLocal()));
  window.location.assign(pasarelaUrl.toString());
}

function logSupabaseError(prefix, err) {
  const out = {
    message: err?.message ?? String(err),
    details: err?.details,
    hint: err?.hint,
    code: err?.code,
    name: err?.name
  };
  console.error(prefix, out);
  return out;
}

function toPublicImageUrl(value) {
  if (!value) return IMG_FALLBACK;
  let v = String(value).trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (v.toLowerCase().startsWith("productos/")) v = v.slice("productos/".length);
  return STORAGE_BASE + encodeURIComponent(v);
}

function formatearGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
}

function setEstado(estado) {
  if (estado === "vacio") {
    contenedorCarritoVacio.classList.remove("disabled");
    contenedorCarritoProductos.classList.add("disabled");
    contenedorCarritoAcciones.classList.add("disabled");
    contenedorCarritoComprado.classList.add("disabled");
  } else if (estado === "conItems") {
    contenedorCarritoVacio.classList.add("disabled");
    contenedorCarritoProductos.classList.remove("disabled");
    contenedorCarritoAcciones.classList.remove("disabled");
    contenedorCarritoComprado.classList.add("disabled");
  } else if (estado === "comprado") {
    contenedorCarritoVacio.classList.add("disabled");
    contenedorCarritoProductos.classList.add("disabled");
    contenedorCarritoAcciones.classList.add("disabled");
    contenedorCarritoComprado.classList.remove("disabled");
  }
}

/* =========================
   Auth
========================= */
async function obtenerUsuarioId() {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
}

/* =========================
   Remoto (DB)
========================= */
async function fetchCarritoRemoto() {
  const { data: carritoId, error: errEns } = await supabase.rpc("asegurar_carrito");
  if (errEns) { logSupabaseError("[carrito] asegurar_carrito", errEns); throw errEns; }

  const { data: items, error: errItems } = await supabase
    .from("carrito_items")
    .select("id, producto_id, cantidad")
    .eq("carrito_id", carritoId);

  if (errItems) { logSupabaseError("[carrito] items", errItems); throw errItems; }
  if (!items || items.length === 0) return [];

  const ids = items.map(i => i.producto_id);
  const { data: prods, error: errProds } = await supabase
    .from("v_productos_publicos")
    .select("id, nombre, precio, imagen")
    .in("id", ids);

  if (errProds) { logSupabaseError("[carrito] productos", errProds); throw errProds; }

  const mapProd = new Map(prods.map(p => [p.id, p]));
  return items.map(i => {
    const p = mapProd.get(i.producto_id);
    return {
      id: i.producto_id,
      titulo: p?.nombre || "Producto",
      precio: Number(p?.precio || 0),
      imagen: toPublicImageUrl(p?.imagen || ""),
      cantidad: Number(i.cantidad || 1),
      _itemId: i.id
    };
  });
}

async function eliminarItemRemoto(itemId) {
  const { error } = await supabase.from("carrito_items").delete().eq("id", itemId);
  if (error) { logSupabaseError("[carrito] eliminarItemRemoto", error); return false; }
  return true;
}

async function vaciarCarritoRemoto() {
  const { error } = await supabase.rpc("carrito_vaciar");
  if (error) { logSupabaseError("[carrito] vaciar", error); return false; }
  return true;
}

async function checkoutRemoto() {
  const { data, error } = await supabase.rpc("carrito_checkout_v2");
  if (error) throw error;
  return data; // uuid del pedido
}

async function setCantidadRemoto(itemId, nuevaCantidad) {
  nuevaCantidad = Math.max(1, Number(nuevaCantidad || 1));
  const { error } = await supabase.from("carrito_items")
    .update({ cantidad: nuevaCantidad })
    .eq("id", itemId);
  if (error) { logSupabaseError("[carrito] setCantidadRemoto", error); return false; }
  await cargarCarrito(); // refresca UI y total
  return true;
}

/* =========================
   Local (storage)
========================= */
function guardarLocal() {
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito || []));
}

function eliminarDelCarritoLocal(id) {
  productosEnCarrito = (productosEnCarrito || []).filter(p => String(p.id) !== String(id));
  guardarLocal();
  renderLocal();
}

function setCantidadLocal(id, nuevaCantidad) {
  nuevaCantidad = Math.max(1, Number(nuevaCantidad || 1));
  productosEnCarrito = (productosEnCarrito || []).map(p =>
    String(p.id) === String(id) ? { ...p, cantidad: nuevaCantidad } : p
  );
  guardarLocal();
  renderLocal();
}

function deltaCantidadLocal(id, delta) {
  const item = (productosEnCarrito || []).find(p => String(p.id) === String(id));
  if (!item) return;
  setCantidadLocal(id, Number(item.cantidad || 1) + Number(delta || 0));
}

function calcularTotalLocal() {
  return (productosEnCarrito || []).reduce(
    (acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0
  );
}

/* =========================
   Render
========================= */
function plantillaItem({ img, titulo, precio, cantidad, idAttrKey, idAttrVal }) {
  // idAttrKey: "data-id" (local) o "data-itemid" (remoto)
  return `
    <img class="carrito-producto-imagen" src="${img}" alt="${titulo}">
    <div class="carrito-producto-titulo">
      <h6>Título</h6>
      <h4>${titulo}</h4>
    </div>

    <div class="carrito-producto-cantidad">
      <h6>Cantidad</h6>
      <div class="qty-ctrl">
        <button class="qty-btn" data-action="dec" ${idAttrKey}="${idAttrVal}" aria-label="Disminuir">−</button>
        <span class="qty" data-qty>${Number(cantidad || 1)}</span>
        <button class="qty-btn" data-action="inc" ${idAttrKey}="${idAttrVal}" aria-label="Aumentar">+</button>
      </div>
    </div>

    <div class="carrito-producto-precio">
      <h6>Precio</h6>
      <p>${formatearGs(precio)}</p>
    </div>

    <div class="carrito-producto-subtotal">
      <h6>Subtotal</h6>
      <p>${formatearGs(precio * cantidad)}</p>
    </div>

    <button class="carrito-producto-eliminar" title="Eliminar" ${idAttrKey}="${idAttrVal}">
      <i class="bi bi-trash"></i>
    </button>
  `;
}

function renderLocal() {
  modoActual = "local";
  const items = productosEnCarrito || [];

  if (items.length === 0) {
    contenedorCarritoProductos.innerHTML = "";
    if (totalEl) totalEl.textContent = formatearGs(0);
    setEstado("vacio");
    return;
  }

  setEstado("conItems");
  contenedorCarritoProductos.innerHTML = "";

  items.forEach(producto => {
    const div = document.createElement("div");
    div.className = "carrito-producto";
    div.innerHTML = plantillaItem({
      img: producto.imagen || IMG_FALLBACK,
      titulo: producto.titulo,
      precio: Number(producto.precio),
      cantidad: Number(producto.cantidad || 1),
      idAttrKey: "data-id",
      idAttrVal: String(producto.id)
    });

    const img = div.querySelector(".carrito-producto-imagen");
    img.addEventListener("error", () => { img.src = IMG_FALLBACK; });

    contenedorCarritoProductos.appendChild(div);
  });

  actualizarTotalLocal();
}

function renderRemoto(items) {
  modoActual = "remote";
  ultimoRemoto = items || [];

  if (!items || items.length === 0) {
    contenedorCarritoProductos.innerHTML = "";
    if (totalEl) totalEl.textContent = formatearGs(0);
    setEstado("vacio");
    return;
  }

  setEstado("conItems");
  contenedorCarritoProductos.innerHTML = "";

  items.forEach(producto => {
    const div = document.createElement("div");
    div.className = "carrito-producto";
    div.innerHTML = plantillaItem({
      img: producto.imagen,
      titulo: producto.titulo,
      precio: Number(producto.precio),
      cantidad: Number(producto.cantidad || 1),
      idAttrKey: "data-itemid",
      idAttrVal: String(producto._itemId)
    });

    const img = div.querySelector(".carrito-producto-imagen");
    img.addEventListener("error", () => { img.src = IMG_FALLBACK; });

    contenedorCarritoProductos.appendChild(div);
  });

  actualizarTotalRemoto(ultimoRemoto);
}

function actualizarTotalLocal() {
  if (!totalEl) return;
  totalEl.textContent = formatearGs(calcularTotalLocal());
}

function actualizarTotalRemoto(items) {
  if (!totalEl) return;
  const total = (items || []).reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
  totalEl.textContent = formatearGs(total);
}

/* =========================
   Delegación de eventos (1 sola vez)
========================= */
contenedorCarritoProductos.addEventListener("click", async (e) => {
  const btn = e.target.closest(".qty-btn, .carrito-producto-eliminar");
  if (!btn) return;

  // Local vs remoto por el atributo presente
  const isLocal = btn.hasAttribute("data-id");
  const isRemoto = btn.hasAttribute("data-itemid");

  // Papelera
  if (btn.classList.contains("carrito-producto-eliminar")) {
    if (isLocal) {
      const id = btn.getAttribute("data-id");
      eliminarDelCarritoLocal(id);
    } else if (isRemoto) {
      const itemId = btn.getAttribute("data-itemid");
      const ok = await eliminarItemRemoto(itemId);
      if (ok) await cargarCarrito();
    }
    return;
  }

  // Botones +/−
  if (btn.classList.contains("qty-btn")) {
    const action = btn.getAttribute("data-action"); // "inc" | "dec"
    const delta = action === "inc" ? +1 : -1;

    if (isLocal) {
      const id = btn.getAttribute("data-id");
      deltaCantidadLocal(id, delta);
    } else if (isRemoto) {
      const itemId = btn.getAttribute("data-itemid");
      // Leer cantidad visible y enviar setCantidadRemoto con la nueva
      const row = btn.closest(".carrito-producto");
      const qEl = row?.querySelector("[data-qty]");
      const qty = Number(qEl?.textContent || "1");
      await setCantidadRemoto(itemId, qty + delta);
    }
  }
});

/* =========================
   Botones Vaciar / Comprar
========================= */
botonVaciar?.addEventListener("click", async () => {
  const uid = await obtenerUsuarioId();
  if (uid) {
    const ok = await vaciarCarritoRemoto();
    if (ok) await cargarCarrito();
  } else {
    productosEnCarrito = [];
    guardarLocal();
    renderLocal();
  }
});

botonComprar?.addEventListener("click", async () => {
  const uid = await obtenerUsuarioId();

  botonComprar.setAttribute("disabled", "true");
  botonComprar.textContent = "Redirigiendo…";

  const pasarelaUrl = new URL("./pasarelaPagos.html", window.location.href);

  try {
    if (uid) {
      // ---------- INTENTO REMOTO ----------
      try {
        const pedidoId = await checkoutRemoto();
        const okId = typeof pedidoId === "string" && pedidoId.trim() !== "" &&
                     !/^null|undefined$/i.test(pedidoId.trim());

        if (okId) {
          pasarelaUrl.searchParams.set("pedido", pedidoId);
          sessionStorage.setItem("checkout_snapshot", JSON.stringify({
            source: "remote",
            pedidoId: String(pedidoId),
            ts: Date.now()
          }));
          window.location.assign(pasarelaUrl.toString());
          return;
        } else {
          console.warn("[checkout] pedidoId inválido, fallback a LOCAL:", pedidoId);
          // ✅ Fallback usando items remotos si existen
          if (ultimoRemoto && ultimoRemoto.length) {
            irPasarelaConItems(pasarelaUrl, ultimoRemoto);
            return;
          }
          // Si no hay remoto cargado, probamos local
          if (productosEnCarrito && productosEnCarrito.length) {
            irPasarelaConItems(pasarelaUrl, productosEnCarrito);
            return;
          }
          alert("Tu carrito está vacío.");
          return;
        }
      } catch (e) {
        console.error("[checkout] checkoutRemoto falló; fallback a LOCAL:", e);
        // ✅ Fallback usando items remotos si existen
        if (ultimoRemoto && ultimoRemoto.length) {
          irPasarelaConItems(pasarelaUrl, ultimoRemoto);
          return;
        }
        if (productosEnCarrito && productosEnCarrito.length) {
          irPasarelaConItems(pasarelaUrl, productosEnCarrito);
          return;
        }
        alert("Tu carrito está vacío.");
        return;
      }
    }

    // ---------- INVITADO: LOCAL DIRECTO ----------
    if (productosEnCarrito && productosEnCarrito.length) {
      irPasarelaConItems(pasarelaUrl, productosEnCarrito);
      return;
    }
    alert("Tu carrito está vacío.");
    return;

  } catch (e) {
    console.error("[checkout] Error redirigiendo:", e);
    alert("No se pudo iniciar el pago. Intenta de nuevo.");
  } finally {
    if (!document.hidden) {
      botonComprar.removeAttribute("disabled");
      botonComprar.textContent = "Comprar ahora";
    }
  }
});

async function generateInvoicePDF(snapshot) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();

  const EMP = {
    nombre: 'Paniquiños',
    ruc: '80026041-4',
    tel: '+595 971 000 000',
    dir: 'Av. Sabor 123, Asunción',
    timbrado: '15181564',
    inicio: '01/01/2025'
  };

  const snap = snapshot || loadSnapshot() || {};
  const metodo = snap.metodo || 'contado';
  const extra = snap.extra || {};
  const cliente = snap.cliente || collectClienteFromForm();

  const data = getCheckoutData();
  const items = (snap.items && snap.items.length ? snap.items : data.items) || [];
  const totalUse = snap.total || data.total || 0;

  const iva10 = Math.round(totalUse / 11);
  const subBase = totalUse - iva10;
  const fecha = snap.fechaISO ? new Date(snap.fechaISO) : new Date();
  const nroFactura = `001-001-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

  // --------- Encabezado Empresa ---------
  doc.setFontSize(18);
  doc.text(EMP.nombre, 40, 50);
  doc.setFontSize(11);
  doc.text(`RUC: ${EMP.ruc}`, 40, 70);
  doc.text(`Tel: ${EMP.tel}`, 40, 85);
  doc.text(`Dir: ${EMP.dir}`, 40, 100);
  doc.text(`Timbrado: ${EMP.timbrado} (inicio ${EMP.inicio})`, 40, 115);

  // --------- Datos Cliente ---------
  doc.setFontSize(12);
  doc.text("Factura Nº: " + nroFactura, pw - 250, 50);
  doc.text("Fecha: " + fecha.toLocaleDateString(), pw - 250, 70);
  doc.text("Método: " + metodo, pw - 250, 85);

  doc.setFontSize(11);
  doc.text("Cliente:", 40, 150);
  doc.text(`${cliente.razon || ''}`, 100, 150);
  doc.text("RUC: " + (cliente.ruc || ''), 40, 165);
  doc.text("Tel: " + (cliente.tel || ''), 40, 180);

  // --------- Tabla de Items ---------
  const body = items.map(it => [
    it.titulo,
    it.cantidad,
    new Intl.NumberFormat("es-PY").format(it.precio),
    new Intl.NumberFormat("es-PY").format(it.precio * it.cantidad)
  ]);

  doc.autoTable({
    head: [["Producto", "Cant.", "Precio", "Subtotal"]],
    body,
    startY: 210,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [111, 92, 56] }
  });

  // --------- Totales ---------
  let y = doc.lastAutoTable.finalY + 20;
  doc.text("Sub-total: " + new Intl.NumberFormat("es-PY").format(subBase) + " Gs", pw - 200, y);
  y += 15;
  doc.text("IVA 10%: " + new Intl.NumberFormat("es-PY").format(iva10) + " Gs", pw - 200, y);
  y += 15;
  doc.setFontSize(13);
  doc.text("TOTAL: " + new Intl.NumberFormat("es-PY").format(totalUse) + " Gs", pw - 200, y);

  // --------- Guardar ---------
  doc.save(`Factura_Paniquinos_${nroFactura}.pdf`);
}




/* =========================
   Carga inicial
========================= */
async function cargarCarrito() {
  const uid = await obtenerUsuarioId();
  if (uid) {
    try {
      const items = await fetchCarritoRemoto();
      renderRemoto(items);
    } catch (e) {
      console.error("Error cargando carrito remoto, usando local:", e);
      renderLocal();
    }
  } else {
    renderLocal();
  }
}


/* =========================
   API para el Chatbot
   (disponible en window.CartAPI)
========================= */

// --- remoto
async function addItemRemoto(productoId, qty = 1) {
  qty = Math.max(1, Number(qty));
  const { data: carritoId, error: e1 } = await supabase.rpc("asegurar_carrito");
  if (e1) throw e1;

  // ¿existe ya?
  const { data: item, error: e2 } = await supabase
    .from("carrito_items")
    .select("id, cantidad")
    .eq("carrito_id", carritoId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (e2) throw e2;

  if (item) {
    const nueva = Number(item.cantidad || 1) + qty;
    const { error: e3 } = await supabase
      .from("carrito_items")
      .update({ cantidad: nueva })
      .eq("id", item.id);
    if (e3) throw e3;
  } else {
    const { error: e4 } = await supabase
      .from("carrito_items")
      .insert({ carrito_id: carritoId, producto_id: productoId, cantidad: qty });
    if (e4) throw e4;
  }

  await cargarCarrito();
  return true;
}

// --- local
function addItemLocal(prod, qty = 1) {
  qty = Math.max(1, Number(qty));
  const id = String(prod.id);
  const i = (productosEnCarrito || []).findIndex(p => String(p.id) === id);
  if (i >= 0) {
    productosEnCarrito[i].cantidad = Number(productosEnCarrito[i].cantidad || 1) + qty;
  } else {
    productosEnCarrito.push({
      id,
      titulo: prod.titulo,
      precio: Number(prod.precio || 0),
      cantidad: qty,
      imagen: prod.imagen || null
    });
  }
  guardarLocal();
  renderLocal();
  return true;
}

// helpers comunes
async function removeRemotoByItemId(itemId) {
  const ok = await eliminarItemRemoto(itemId);
  if (ok) await cargarCarrito();
  return ok;
}
function removeLocalById(id) {
  eliminarDelCarritoLocal(id);
  return true;
}
async function setQtyRemotoByItemId(itemId, qty) {
  await setCantidadRemoto(itemId, qty);
  return true;
}
function setQtyLocalById(id, qty) {
  setCantidadLocal(id, qty);
  return true;
}

// snapshot para el bot (por si quiere leer)
function getSnapshot() {
  if (modoActual === "remote") {
    return {
      mode: "remote",
      items: (ultimoRemoto || []).map(p => ({
        id: String(p.id),
        titulo: p.titulo,
        precio: Number(p.precio),
        cantidad: Number(p.cantidad || 1),
        imagen: p.imagen
      })),
      total: (ultimoRemoto || []).reduce((a,p)=>a+Number(p.precio)*Number(p.cantidad||1),0)
    };
  }
  return {
    mode: "local",
    items: (productosEnCarrito || []).map(p => ({
      id: String(p.id),
      titulo: p.titulo,
      precio: Number(p.precio),
      cantidad: Number(p.cantidad || 1),
      imagen: p.imagen || null
    })),
    total: calcularTotalLocal()
  };
}

// API pública para el chatbot
window.CartAPI = {
  // Si el usuario está logueado, usar addById (tiene el UUID). Para invitado, usar addProduct.
  addById: async (productoId, qty=1) => {
    const uid = await obtenerUsuarioId();
    if (uid) return addItemRemoto(productoId, qty);
    throw new Error("addById requiere sesión (remoto). Para invitados usar addProduct(producto, qty).");
  },
  addProduct: async (productoObj, qty=1) => {
    const uid = await obtenerUsuarioId();
    if (uid && productoObj?.id && /^[0-9a-f-]{36}$/i.test(String(productoObj.id))) {
      return addItemRemoto(String(productoObj.id), qty);
    }
    return addItemLocal(productoObj, qty);
  },
  remove: async ({ itemId, id }) => {
    // remoto: pasar itemId (id de carrito_items). local: pasar id (id del producto en el storage)
    if (itemId) return removeRemotoByItemId(itemId);
    if (id)     return removeLocalById(id);
    return false;
  },
  setQty: async ({ itemId, id }, qty) => {
    qty = Math.max(1, Number(qty || 1));
    if (itemId) return setQtyRemotoByItemId(itemId, qty);
    if (id)     return setQtyLocalById(id, qty);
    return false;
  },
  getSnapshot,
  refresh: cargarCarrito
};


cargarCarrito();
