// JS/_carrito.js  (usar con <script type="module">)
import { createClient } from "https://esm.sh/@supabase/supabase-js";

// ====== Supabase ======
const SUPABASE_URL  = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ====== Estado Carrito (localStorage) ======
let productosEnCarrito = JSON.parse(localStorage.getItem("productos-en-carrito")) || [];

const contenedorCarritoVacio     = document.querySelector("#carrito-vacio");
const contenedorCarritoProductos = document.querySelector("#carrito-productos");
const contenedorCarritoAcciones  = document.querySelector("#carrito-acciones");
const contenedorCarritoComprado  = document.querySelector("#carrito-comprado");

const botonVaciar  = document.querySelector("#carrito-acciones-vaciar");
const botonComprar = document.querySelector("#carrito-acciones-comprar");
const totalEl      = document.querySelector("#total");

// ====== Helpers UI ======
function setEstado(estado) {
  if (estado === "vacio") {
    contenedorCarritoVacio?.classList.remove("disabled");
    contenedorCarritoProductos?.classList.add("disabled");
    contenedorCarritoAcciones?.classList.add("disabled");
    contenedorCarritoComprado?.classList.add("disabled");
  } else if (estado === "conItems") {
    contenedorCarritoVacio?.classList.add("disabled");
    contenedorCarritoProductos?.classList.remove("disabled");
    contenedorCarritoAcciones?.classList.remove("disabled");
    contenedorCarritoComprado?.classList.add("disabled");
  } else if (estado === "comprado") {
    contenedorCarritoVacio?.classList.add("disabled");
    contenedorCarritoProductos?.classList.add("disabled");
    contenedorCarritoAcciones?.classList.add("disabled");
    contenedorCarritoComprado?.classList.remove("disabled");
  }
}

function formatearGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n) || 0) + " Gs";
}

// ====== Render Carrito ======
function cargarProductosCarrito() {
  if (!productosEnCarrito || productosEnCarrito.length === 0) {
    contenedorCarritoProductos && (contenedorCarritoProductos.innerHTML = "");
    totalEl && (totalEl.textContent = formatearGs(0));
    setEstado("vacio");
    return;
  }

  setEstado("conItems");
  contenedorCarritoProductos.innerHTML = "";

  productosEnCarrito.forEach((producto) => {
    const precio = Number(producto.precio);
    const div = document.createElement("div");
    div.classList.add("carrito-producto");
    div.innerHTML = `
      <img class="carrito-producto-imagen" src="${producto.imagen}" alt="${producto.titulo}">
      <div class="carrito-producto-titulo">
        <b><h6>Título</h6><h4>${producto.titulo}</h4></b>
      </div>
      <div class="carrito-producto-cantidad">
        <h6>Cantidad</h6>
        <p>${producto.cantidad}</p>
      </div>
      <div class="carrito-producto-precio">
        <h6>Precio</h6>
        <p>${formatearGs(precio)}</p>
      </div>
      <div class="carrito-producto-subtotal">
        <h6>Subtotal</h6>
        <p>${formatearGs(precio * (producto.cantidad || 1))}</p>
      </div>
      <button class="carrito-producto-eliminar" data-id="${String(producto.id)}">
        <i class="bi bi-trash"></i>
      </button>
    `;
    contenedorCarritoProductos.append(div);
  });

  contenedorCarritoProductos
    .querySelectorAll(".carrito-producto-eliminar")
    .forEach(btn => btn.addEventListener("click", eliminarDelCarrito));

  actualizarTotal();
}

function actualizarTotal() {
  if (!totalEl) return;
  const total = productosEnCarrito.reduce(
    (acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1),
    0
  );
  totalEl.textContent = formatearGs(total);
}

function eliminarDelCarrito(e) {
  const id = e.currentTarget.dataset.id;
  productosEnCarrito = productosEnCarrito.filter(p => String(p.id) !== String(id));
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  cargarProductosCarrito();
}

botonVaciar?.addEventListener("click", () => {
  productosEnCarrito = [];
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  cargarProductosCarrito();
});

// ====== Flujo de Compra con Supabase ======

// 0) Asegura sesión (tu RLS exige auth.uid() = usuario_id)
async function requireSession() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    alert("Debes iniciar sesión para comprar.");
    // Aquí podrías redirigir a tu pantalla de login:
    // window.location.href = "login.html";
    throw new Error("Sin sesión");
  }
  return data.user;
}

// 1) Resolver producto_id (UUID) para cada ítem del carrito
//    - Si el carrito ya trae productoId (UUID desde tu catálogo Supabase), lo usa.
//    - Si no, busca por nombre en DB (p.nombre = producto.titulo).
async function mapearCarritoAItemsDB(carrito) {
  const items = [];
  for (const p of carrito) {
    let productoId = p.productoId || p.id; // si ya viene UUID desde el catálogo de Supabase
    if (!isUUID(productoId)) {
      // Buscar por nombre (titulo) en DB
      const { data, error } = await supabase
        .from("productos")
        .select("id, nombre")
        .eq("nombre", p.titulo)
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        console.error("No se encontró el producto en DB:", p.titulo, error);
        throw new Error(`Producto no encontrado en DB: ${p.titulo}`);
      }
      productoId = data.id;
    }

    items.push({
      producto_id: productoId,
      cantidad: Number(p.cantidad || 1),
      precio_unitario: Number(p.precio),
      // pedido_id se agrega al insertar
    });
  }
  return items;
}

function isUUID(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v));
}

// 2) Crear pedido, insertar detalles y finalizar (RPC)
async function crearPedido(carrito) {
  const user = await requireSession();

  // A) Crear pedido vacío
  const { data: pedido, error: e1 } = await supabase
    .from("pedidos")
    .insert({
      usuario_id: user.id,
      estado: "pendiente",
      estado_pago: "pendiente",
      metodo_pago: "simulado",
      monto_total: 0,
      notas: "Pedido desde web"
    })
    .select("id")
    .single();

  if (e1) {
    console.error("Error creando pedido:", e1);
    alert("No se pudo crear el pedido.");
    return;
  }

  // B) Preparar e insertar ítems
  const items = await mapearCarritoAItemsDB(carrito);
  const itemsConPedido = items.map(it => ({ ...it, pedido_id: pedido.id }));

  const { error: e2 } = await supabase
    .from("detalles_pedido")
    .insert(itemsConPedido);

  if (e2) {
    console.error("Error insertando ítems:", e2);
    alert("No se pudieron agregar los ítems.");
    return;
  }

  // C) Finalizar (recalcula total, marca pagado, acredita puntos)
  const { data: fin, error: e3 } = await supabase
    .rpc("finalizar_pedido", { p_pedido_id: pedido.id });

  if (e3) {
    console.error("Error finalizando pedido:", e3);
    alert("No se pudo finalizar el pedido.");
    return;
  }

  // Éxito
  const total = fin?.[0]?.monto_total ?? 0;
  const puntos = fin?.[0]?.puntos_agregados ?? 0;
  alert(`✅ Pedido confirmado.\nTotal: ${formatearGs(total)} — Puntos: ${puntos}`);

  // Limpiar carrito y mostrar estado "comprado"
  productosEnCarrito = [];
  localStorage.setItem("productos-en-carrito", JSON.stringify(productosEnCarrito));
  setEstado("comprado");
}

// Botón COMPRAR
botonComprar?.addEventListener("click", async () => {
  if (!productosEnCarrito || productosEnCarrito.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }
  try {
    await crearPedido(productosEnCarrito);
  } catch (err) {
    // Si no hay sesión, evitamos romper la UI
    console.warn(err?.message || err);
  }
});

// ====== iniciar ======
cargarProductosCarrito();
