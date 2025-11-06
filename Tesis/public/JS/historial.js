// JS/historial.js - VERSIÓN CORREGIDA
import { supabase } from "./ScriptLogin.js";

const contenedor = document.getElementById("pedidosContainer");
const resumenBox = document.getElementById("resumen");
const filtroPeriodo = document.getElementById("filtroPeriodo");

let TODOS_LOS_PEDIDOS = [];

/* ========== Helpers ========== */

function fmtGs(n) {
  return new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";
}

function getTotalPedido(p) {
  return Number(p.monto_total ?? 0);
}

function getNumeroPedido(p) {
  return p.id;
}

function estadoBadgeClase(estado) {
  const s = String(estado || "").toLowerCase();
  if (s === "finalizado" || s === "entregado") return "finalizado";
  if (s === "en preparación" || s === "preparacion") return "preparacion";
  if (s === "cancelado") return "cancelado";
  return "pendiente";
}

function getIconoMetodo(metodo) {
  const m = String(metodo || "").toLowerCase();
  if (m.includes("tarjeta") || m.includes("credito") || m.includes("crédito")) {
    return "bi-credit-card";
  }
  if (m.includes("transferencia") || m.includes("banco")) {
    return "bi-bank";
  }
  if (m.includes("efectivo") || m.includes("cash")) {
    return "bi-cash";
  }
  return "bi-currency-dollar";
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
    (acc, p) => acc + getTotalPedido(p),
    0
  );

  const finalizados = pedidosFiltrados.filter((p) =>
    ["finalizado", "entregado"].includes(String(p.estado || "").toLowerCase())
  ).length;

  resumenBox.innerHTML = `
    <div class="card-resumen">
      <span class="label">📦 Pedidos totales</span>
      <span class="value">${totalPedidos}</span>
      <span class="sub">${finalizados} pedido${finalizados !== 1 ? 's' : ''} finalizado${finalizados !== 1 ? 's' : ''}</span>
    </div>
    <div class="card-resumen">
      <span class="label">💰 Total invertido</span>
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
        <i class="bi bi-basket"></i>
        <p>No encontramos pedidos en este periodo</p>
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
        month: "long",
        year: "numeric",
      });
      const horaTxt = fecha.toLocaleTimeString("es-PY", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const estadoClase = estadoBadgeClase(p.estado);
      const total = getTotalPedido(p);
      const numero = getNumeroPedido(p);
      const metodoPago = p.metodo_pago || null;
      const iconoMetodo = metodoPago ? getIconoMetodo(metodoPago) : "bi-currency-dollar";

      return `
      <article class="pedido-card">
        <div class="pedido-main">
          <div class="pedido-header">
            <span class="pedido-id">#${String(numero).slice(0, 8).toUpperCase()}</span>
            <span class="badge-estado ${estadoClase}">${p.estado || "Pendiente"}</span>
          </div>
          <span class="pedido-fecha">
            <i class="bi bi-calendar3"></i> ${fechaTxt} a las ${horaTxt}
          </span>
          <div class="pedido-detalle">
            <span class="tag">
              <i class="bi bi-currency-dollar"></i> ${fmtGs(total)}
            </span>
            ${
              metodoPago
                ? `<span class="tag"><i class="bi ${iconoMetodo}"></i> ${metodoPago}</span>`
                : ""
            }
          </div>
        </div>

        <div class="pedido-actions">
          <button class="btn-pill btn-primary btn-descargar" data-id="${p.id}">
            <i class="bi bi-file-earmark-pdf"></i>
            Descargar factura
          </button>
        </div>
      </article>
    `;
    })
    .join("");

  // Eventos de botones
  document.querySelectorAll(".btn-descargar").forEach((btn) => {
    btn.addEventListener("click", (e) =>
      descargarFactura(e.currentTarget.dataset.id, e.currentTarget)
    );
  });
}

/* ========== Filtro por periodo ========== */

function aplicarFiltro() {
  const val = filtroPeriodo.value;

  if (!TODOS_LOS_PEDIDOS.length) {
    renderResumen([]);
    renderPedidos([]);
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
      <i class="bi bi-arrow-clockwise"></i>
      <p>Cargando tus pedidos…</p>
    </div>
  `;
  resumenBox.innerHTML = "";

  const {
    data: { user },
  } = await supabase.auth.getUser();
  
  if (!user) {
    contenedor.innerHTML = `
      <div class="state-box">
        <i class="bi bi-person-x"></i>
        <p>Debes iniciar sesión para ver tu historial</p>
        <small>Iniciá sesión y volvé a esta pantalla</small>
      </div>
    `;
    return;
  }

  const { data, error } = await supabase
    .from("pedidos")
    .select(
      "id, usuario_id, estado, estado_pago, metodo_pago, monto_total, notas, creado_en, actualizado_en, paga_con"
    )
    .eq("usuario_id", user.id)
    .order("creado_en", { ascending: false });

  if (error) {
    console.error("Error al cargar pedidos:", error);
    contenedor.innerHTML = `
      <div class="state-box">
        <i class="bi bi-exclamation-triangle"></i>
        <p>Error al cargar tus pedidos</p>
        <small>Intentá de nuevo en unos minutos</small>
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

/* ========== Descargar factura ========== */

async function descargarFactura(pedidoId, btnElement) {
  console.log("🔵 Iniciando descarga de factura para pedido:", pedidoId);
  
  // Mostrar loading
  btnElement.classList.add("loading");
  btnElement.disabled = true;
  
  try {
    // 1. Buscar el pedido
    const pedido = TODOS_LOS_PEDIDOS.find((p) => p.id === pedidoId);
    if (!pedido) {
      throw new Error("Pedido no encontrado");
    }
    
    console.log("✅ Pedido encontrado:", pedido);

    // 2. Obtener items del pedido
    const { data: itemsData, error: itemsError } = await supabase
      .from("pedido_items")
      .select("producto_id, cantidad, precio_unitario, titulo")
      .eq("pedido_id", pedidoId);

    if (itemsError) {
      console.error("❌ Error al obtener items:", itemsError);
      throw itemsError;
    }
    
    console.log("✅ Items obtenidos:", itemsData);

    // Si no hay items, crear un item genérico MÁS DETALLADO
    let items = [];
    if (!itemsData || itemsData.length === 0) {
      console.log("⚠️ No hay items, creando genérico");
      
      // Crear descripción más detallada
      let descripcion = "Pedido";
      if (pedido.metodo_pago) {
        descripcion += ` - Pago con ${pedido.metodo_pago}`;
      }
      if (pedido.notas && !pedido.notas.includes("checkout_crear_pedido")) {
        descripcion += ` - ${pedido.notas}`;
      }
      
      items = [{
        titulo: descripcion,
        precio: pedido.monto_total || 0,
        cantidad: 1,
        tienePromo: false
      }];
    } else {
      // Obtener imágenes de productos (opcional)
      const productosIds = itemsData.map((item) => item.producto_id).filter(Boolean);
      let productosData = [];
      
      if (productosIds.length > 0) {
        const { data, error } = await supabase
          .from("productos")
          .select("id, imagen")
          .in("id", productosIds);
        
        if (!error && data) {
          productosData = data;
        }
      }

      // Construir items
      items = itemsData.map((item) => {
        const producto = productosData.find((p) => p.id === item.producto_id);
        return {
          titulo: item.titulo || "Producto",
          imagen: producto?.imagen || "",
          precio: Number(item.precio_unitario || 0),
          cantidad: Number(item.cantidad || 1),
          tienePromo: false,
        };
      });
    }

    // 3. Obtener datos del cliente
    const { data: clienteData, error: clienteError } = await supabase
      .from("clientes_perfil")
      .select("*")
      .eq("user_id", pedido.usuario_id)
      .single();

    if (clienteError) {
      console.warn("⚠️ No se encontró perfil del cliente:", clienteError);
    }
    
    console.log("✅ Cliente obtenido:", clienteData);

    // 4. Crear snapshot de factura
    const facturaSnapshot = {
      fechaISO: pedido.creado_en,
      metodo: pedido.metodo_pago || "efectivo",
      extra: {
        pedidoId: pedido.id,
        estadoPago: pedido.estado_pago,
      },
      cliente: {
        ruc: clienteData?.ruc || "",
        razon: clienteData?.razon || "",
        tel: clienteData?.tel || "",
        mail: clienteData?.mail || "",
        contacto: clienteData?.contacto || "",
        ciudad: clienteData?.ciudad || "",
        barrio: clienteData?.barrio || "",
        depto: clienteData?.depto || "",
        postal: clienteData?.postal || "",
        calle1: clienteData?.calle1 || "",
        calle2: clienteData?.calle2 || "",
        nro: clienteData?.nro || "",
      },
      items,
      total: Number(pedido.monto_total || 0),
    };

    console.log("✅ Snapshot creado:", facturaSnapshot);

    // 5. Cargar jsPDF si no está disponible
    await cargarJsPDF();
    
    console.log("✅ jsPDF cargado");

    // 6. Generar PDF
    await generarFacturaPDF(facturaSnapshot);
    
    console.log("✅ PDF generado exitosamente");

    // Mostrar mensaje de éxito
    mostrarNotificacion("✓ Factura descargada correctamente", "success");
    
  } catch (err) {
    console.error("❌ Error completo al descargar factura:", err);
    console.error("Stack:", err.stack);
    mostrarNotificacion(`✗ Error: ${err.message || 'No se pudo descargar la factura'}`, "error");
  } finally {
    // Quitar loading
    btnElement.classList.remove("loading");
    btnElement.disabled = false;
  }
}

/* ========== Cargar jsPDF dinámicamente ========== */

async function cargarJsPDF() {
  return new Promise((resolve, reject) => {
    // Si ya está cargado, resolver inmediatamente
    if (window.jspdf) {
      console.log("✅ jsPDF ya está cargado");
      resolve();
      return;
    }

    console.log("🔵 Cargando jsPDF...");

    // Cargar jsPDF
    const script1 = document.createElement("script");
    script1.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script1.onload = () => {
      console.log("✅ jsPDF cargado");
      
      // Cargar autotable
      const script2 = document.createElement("script");
      script2.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js";
      script2.onload = () => {
        console.log("✅ jsPDF autotable cargado");
        resolve();
      };
      script2.onerror = (err) => {
        console.error("❌ Error al cargar autotable:", err);
        reject(new Error("No se pudo cargar jsPDF autotable"));
      };
      document.head.appendChild(script2);
    };
    script1.onerror = (err) => {
      console.error("❌ Error al cargar jsPDF:", err);
      reject(new Error("No se pudo cargar jsPDF"));
    };
    document.head.appendChild(script1);
  });
}

/* ========== Generar PDF ========== */

async function generarFacturaPDF(snapshot) {
  console.log("🔵 Generando PDF con snapshot:", snapshot);
  
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Colores
  const C_TXT = [0, 0, 0];
  const C_GRAY = [80, 80, 80];
  const C_BORDER = [100, 100, 100];
  const C_HEADER_BG = [240, 240, 240];

  // Márgenes
  const M = 30;

  // Empresa
  const EMP = {
    nombre: "Paniquiños",
    actividad: "Panadería",
    direccion: "Avda Sabor 1500",
    telefono: "Tel: +595 992544305",
    ruc: "800260001-4",
    timbrado: "15181564",
    vigencia: "20/10/2021",
    logo: "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinos.png",
  };
  const QR_SRC =
    "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/QrGenerico.jpg";

  // Datos
  const metodo = snapshot.metodo || "efectivo";
  const cliente = snapshot.cliente || {};
  const items = snapshot.items || [];
  const totalUse = Number(snapshot.total ?? 0);

  // Cálculos
  const iva10 = Math.round(totalUse / 11);
  const subBase = totalUse - iva10;
  const fecha = snapshot.fechaISO ? new Date(snapshot.fechaISO) : new Date();
  const fechaStr = fecha.toLocaleDateString("es-PY");
  const nroFactura = `001-001-${String(
    Math.floor(Math.random() * 10000000)
  ).padStart(7, "0")}`;

  // Generar CDC (simulado - 44 dígitos)
  const timestamp = Date.now().toString();
  const rucNum = EMP.ruc.replace(/-/g, "");
  const factNum = nroFactura.replace(/-/g, "");
  const cdc = `01${rucNum}${factNum}${timestamp}`.padEnd(44, "0").slice(0, 44);

  let y = M;

  // ========== HEADER CON BORDE ==========
  const headerH = 110;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(1.5);
  doc.rect(M, y, pw - 2 * M, headerH);

  // Logo
  try {
    const logoData = await toDataURL(EMP.logo);
    doc.addImage(logoData, "PNG", M + 15, y + 15, 80, 80);
  } catch (e) {
    console.warn("⚠️ No se pudo cargar logo:", e);
  }

  // Título centrado
  const centerX = M + 110;
  let ty = y + 25;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(14)
    .setTextColor(...C_TXT);
  doc.text("KuDE de FACTURA ELECTRÓNICA", centerX, ty);

  ty += 20;
  doc.setFont("helvetica", "bold").setFontSize(12);
  doc.text(EMP.nombre, centerX, ty);

  ty += 16;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(EMP.actividad, centerX, ty);

  ty += 14;
  doc.text(EMP.direccion, centerX, ty);

  ty += 14;
  doc.text(EMP.telefono, centerX, ty);

  // Info fiscal (derecha)
  const rightX = pw - M - 15;
  let ry = y + 15;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...C_TXT);
  doc.text("RUC :", pw - M - 120, ry);
  doc.setFont("helvetica", "normal");
  doc.text(EMP.ruc, rightX, ry, { align: "right" });

  ry += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Timbrado", pw - M - 120, ry);
  doc.setFont("helvetica", "normal");
  doc.text(EMP.timbrado, rightX, ry, { align: "right" });

  ry += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Inicio de", pw - M - 120, ry);
  doc.setFont("helvetica", "normal");
  doc.text(EMP.vigencia, rightX, ry, { align: "right" });

  ry += 18;
  doc.setFont("helvetica", "bold").setFontSize(10);
  doc.text("FACTURA ELECTRÓNICA", rightX, ry, { align: "right" });

  ry += 14;
  doc.setFont("helvetica", "bold").setFontSize(11);
  doc.text(nroFactura, rightX, ry, { align: "right" });

  // ========== DATOS DEL CLIENTE CON BORDE ==========
  y += headerH + 10;
  const clienteH = 50;

  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(1);
  doc.rect(M, y, pw - 2 * M, clienteH);

  let cy = y + 16;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(9)
    .setTextColor(...C_TXT);
  doc.text("Fecha y hora de", M + 10, cy);
  doc.setFont("helvetica", "normal");
  doc.text(fechaStr, M + 90, cy);

  doc.setFont("helvetica", "bold");
  doc.text("Condición de venta:", pw - M - 200, cy);
  doc.setFont("helvetica", "normal");
  const condicion =
    metodo === "Transferencia"
      ? "Contado"
      : metodo === "Efectivo"
      ? "Efectivo"
      : "Crédito";
  doc.text(condicion, pw - M - 90, cy);

  cy += 14;
  doc.setFont("helvetica", "bold");
  doc.text("RUC/documento de identidad No:", M + 10, cy);
  doc.setFont("helvetica", "normal");
  doc.text(cliente.ruc || "-", M + 165, cy);

  doc.setFont("helvetica", "bold");
  doc.text("Cuotas:", pw - M - 200, cy);
  doc.setFont("helvetica", "normal");
  doc.text("1", pw - M - 90, cy);

  cy += 14;
  doc.setFont("helvetica", "bold");
  doc.text("Nombre o razón social:", M + 10, cy);
  doc.setFont("helvetica", "normal");
  doc.text(cliente.razon || "-", M + 140, cy);

  doc.setFont("helvetica", "bold");
  doc.text("Moneda:", pw - M - 200, cy);
  doc.setFont("helvetica", "normal");
  doc.text("Guaraní", pw - M - 90, cy);

  // ========== TABLA ==========
  y += clienteH + 10;

  const tableData = items.map((it) => {
    const titulo = it.titulo || "Producto";
    const precioFinal = Number(it.precio);
    const cantidad = Number(it.cantidad || 1);

    const formatter = new Intl.NumberFormat("es-PY", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true,
    });

    const precioStr = formatter.format(precioFinal);
    const subtotalNum = precioFinal * cantidad;
    const subtotalStr = formatter.format(subtotalNum) + ",";

    return [String(cantidad), titulo, precioStr, "", "0.0", "0.0", subtotalStr];
  });

  doc.autoTable({
    head: [
      [
        "Cantida",
        "Descripción",
        "Precio unitario",
        "Descuento",
        "Exentas",
        "5%",
        "10%",
      ],
    ],
    body: tableData,
    startY: y,
    margin: { left: M, right: M },
    tableWidth: "auto",
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: C_TXT,
      lineColor: C_BORDER,
      lineWidth: 1,
      overflow: "linebreak",
      halign: "left",
      font: "helvetica",
      minCellHeight: 20,
      valign: "middle",
    },
    headStyles: {
      fillColor: C_HEADER_BG,
      textColor: C_TXT,
      fontStyle: "bold",
      halign: "center",
      fontSize: 9,
      minCellHeight: 20,
      valign: "middle",
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 50 },
      1: { halign: "left", cellWidth: 175 },
      2: { halign: "right", cellWidth: 85 },
      3: { halign: "center", cellWidth: 70 },
      4: { halign: "right", cellWidth: 55 },
      5: { halign: "right", cellWidth: 45 },
      6: { halign: "right", cellWidth: 55 },
    },
    theme: "grid",
  });

  // ========== TOTALES ==========
  y = doc.lastAutoTable.finalY;

  function numeroATexto(num) {
    if (num === 0) return "CERO";
    if (num >= 1000000) return "UN MILLON O MAS";

    const unidades = [
      "",
      "UNO",
      "DOS",
      "TRES",
      "CUATRO",
      "CINCO",
      "SEIS",
      "SIETE",
      "OCHO",
      "NUEVE",
    ];
    const especiales = [
      "DIEZ",
      "ONCE",
      "DOCE",
      "TRECE",
      "CATORCE",
      "QUINCE",
      "DIECISEIS",
      "DIECISIETE",
      "DIECIOCHO",
      "DIECINUEVE",
    ];
    const decenas = [
      "",
      "",
      "VEINTE",
      "TREINTA",
      "CUARENTA",
      "CINCUENTA",
      "SESENTA",
      "SETENTA",
      "OCHENTA",
      "NOVENTA",
    ];
    const centenas = [
      "",
      "CIENTO",
      "DOSCIENTOS",
      "TRESCIENTOS",
      "CUATROCIENTOS",
      "QUINIENTOS",
      "SEISCIENTOS",
      "SETECIENTOS",
      "OCHOCIENTOS",
      "NOVECIENTOS",
    ];

    if (num < 10) return unidades[num];
    if (num < 20) return especiales[num - 10];
    if (num < 100) {
      const dec = Math.floor(num / 10);
      const uni = num % 10;
      if (dec === 2 && uni > 0) return "VEINTI" + unidades[uni];
      return decenas[dec] + (uni ? " Y " + unidades[uni] : "");
    }
    if (num < 1000) {
      const cen = Math.floor(num / 100);
      const resto = num % 100;
      return (
        (num === 100 ? "CIEN" : centenas[cen]) +
        (resto ? " " + numeroATexto(resto) : "")
      );
    }
    if (num < 1000000) {
      const miles = Math.floor(num / 1000);
      const resto = num % 1000;
      const textoMiles =
        miles === 1 ? "MIL" : numeroATexto(miles) + " MIL";
      return textoMiles + (resto ? " " + numeroATexto(resto) : "");
    }
    return "MONTO MAYOR";
  }

  const totalEnLetras = numeroATexto(Math.floor(totalUse)) + " GUARANIES";

  const formatter = new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    useGrouping: true,
  });

  const totalsData = [
    ["SUBTOTAL:", "", "", "", "", "", formatter.format(subBase) + ",00"],
    ["TOTAL DE LA", "", "", "", "", "", formatter.format(totalUse) + ",00"],
    [
      "TOTAL EN GUARANIES:",
      totalEnLetras,
      "",
      "",
      "",
      "",
      formatter.format(totalUse) + ",00",
    ],
    [
      "LIQUIDACION IVA:",
      "5%",
      "0,00",
      "10%",
      formatter.format(iva10),
      "TOTAL IVA",
      formatter.format(iva10),
    ],
  ];

  doc.autoTable({
    body: totalsData,
    startY: y,
    margin: { left: M, right: M },
    tableWidth: "auto",
    styles: {
      fontSize: 9,
      cellPadding: 5,
      textColor: C_TXT,
      lineColor: C_BORDER,
      lineWidth: 1,
      overflow: "linebreak",
      valign: "middle",
      font: "helvetica",
      minCellHeight: 20,
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 110, halign: "left" },
      1: { cellWidth: 130, halign: "left" },
      2: { halign: "right", cellWidth: 60 },
      3: { cellWidth: 50, halign: "left" },
      4: { halign: "right", cellWidth: 70 },
      5: { halign: "right", fontStyle: "bold", cellWidth: 60 },
      6: { halign: "right", fontStyle: "bold", cellWidth: 55 },
    },
    theme: "grid",
  });

  // ========== FOOTER CON CDC ==========
  y = doc.lastAutoTable.finalY + 20;

  const footerBoxH = 155;
  doc.setDrawColor(...C_BORDER);
  doc.setLineWidth(1);
  doc.rect(M, y, pw - 2 * M, footerBoxH);

  // QR
  try {
    const qrData = await toDataURL(QR_SRC);
    doc.addImage(qrData, "PNG", M + 15, y + 15, 100, 100);

    // Indicador CDC
    doc.setFillColor(50, 115, 220);
    doc.rect(M + 95, y + 105, 20, 10, "F");
    doc.rect(M + 105, y + 95, 10, 20, "F");
  } catch (e) {
    console.warn("⚠️ No se pudo cargar QR:", e);
  }

  // Texto CDC
  const cdcX = M + 130;
  let cdcY = y + 22;

  doc
    .setFont("helvetica", "bold")
    .setFontSize(10)
    .setTextColor(...C_TXT);
  doc.text(
    "Consulte la validez de esta Factura Electrónica con el número de CDC",
    cdcX,
    cdcY
  );

  cdcY += 16;
  doc
    .setFont("helvetica", "normal")
    .setFontSize(9)
    .setTextColor(0, 0, 255);
  doc.textWithLink("https://ekuatia.set.gov.py/consultas/", cdcX, cdcY, {
    url: "https://ekuatia.set.gov.py/consultas/",
  });

  cdcY += 22;
  doc
    .setFont("helvetica", "bold")
    .setFontSize(11)
    .setTextColor(...C_TXT);
  const cdcFormatted = `${cdc.substring(0, 10)} ${cdc.substring(
    10,
    20
  )} ${cdc.substring(20, 30)} ${cdc.substring(30, 40)} ${cdc.substring(
    40,
    44
  )}`;
  doc.text(cdcFormatted, cdcX, cdcY);

  cdcY += 20;
  doc.setFont("helvetica", "bold").setFontSize(9);
  doc.text(
    "ESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO",
    cdcX,
    cdcY
  );

  cdcY += 16;
  doc
    .setFont("helvetica", "normal")
    .setFontSize(8)
    .setTextColor(...C_GRAY);
  const warningText =
    "Si su documento electrónico presenta algún error, podrá solicitar la modificación dentro de las 72 horas";
  doc.text(warningText, cdcX, cdcY);
  cdcY += 10;
  doc.text("siguientes de la emisión", cdcX, cdcY);

  console.log("✅ Guardando PDF...");
  doc.save(`Factura_${EMP.nombre}_${nroFactura}.pdf`);
}

/* ========== Helper para imagen ========== */

async function toDataURL(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

/* ========== Sistema de notificaciones ========== */

function mostrarNotificacion(mensaje, tipo = "info") {
  // Crear elemento de notificación
  const notif = document.createElement("div");
  notif.className = `notificacion notif-${tipo}`;
  notif.textContent = mensaje;

  // Estilos inline
  Object.assign(notif.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "16px 24px",
    borderRadius: "12px",
    backgroundColor: tipo === "success" ? "#34a853" : "#ef4444",
    color: "#fff",
    fontWeight: "600",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
    zIndex: "10000",
    animation: "slideIn 0.3s ease",
  });

  document.body.appendChild(notif);

  // Remover después de 5 segundos
  setTimeout(() => {
    notif.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notif.remove(), 300);
  }, 5000);
}

// Agregar animaciones CSS
if (!document.querySelector("#notif-animations")) {
  const style = document.createElement("style");
  style.id = "notif-animations";
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

/* ========== Init ========== */

filtroPeriodo?.addEventListener("change", aplicarFiltro);

cargarHistorial();