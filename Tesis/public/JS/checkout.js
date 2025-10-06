// JS/checkout.js
(function () {
  const form = document.getElementById('checkout-form');
  const panels = document.querySelectorAll('.metodo-panel');
  const success = document.getElementById('checkout-success');
  const btnFactura = document.getElementById('btn-descargar-factura');

  const inputFile = document.getElementById('comprobante');
  const efectivoMonto = document.getElementById('efectivo-monto');
  const efectivoTotalEl = document.getElementById('efectivo-total');

  // ------- Constantes / Utils -------
  const fmtGs = (n) => new Intl.NumberFormat('es-PY').format(Number(n || 0)) + ' Gs';
  const QS = new URLSearchParams(location.search);
  const SNAP_KEY = 'pedido-simulado';           // factura
  const SNAP_CHECKOUT = 'checkout_snapshot';    // snapshot del carrito
  const QR_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/QrGenerico.jpg';

  function hasValidPedido(qs = QS) {
    const raw = qs.get('pedido');
    if (raw == null) return false;
    const v = String(raw).trim().toLowerCase();
    return v !== '' && v !== 'null' && v !== 'undefined';
  }
  function readCheckoutSnapshot() {
    try { return JSON.parse(sessionStorage.getItem(SNAP_CHECKOUT)); }
    catch { return null; }
  }
  function getCartLocal() {
    try { return JSON.parse(localStorage.getItem('productos-en-carrito')) || []; }
    catch { return []; }
  }

  // Items/total priorizando snapshot + URL; fallback a localStorage
  function getCheckoutData() {
    const snap = readCheckoutSnapshot();
    const isLocalUrl  = QS.has('monto');
    const isRemoteUrl = hasValidPedido(QS);

    if (isLocalUrl && snap?.source === 'local') {
      const items = Array.isArray(snap.items) ? snap.items : [];
      const total = Number(snap.total || 0) || items.reduce((a,p)=>a + Number(p.precio) * Number(p.cantidad || 1), 0);
      return { items, total, source: 'local' };
    }

    if (isRemoteUrl && snap?.source === 'remote' && snap?.pedidoId === QS.get('pedido')) {
      return { items: [], total: NaN, source: 'remote', pedidoId: snap.pedidoId };
    }

    const items = getCartLocal();
    const total = items.reduce((a,p)=>a + Number(p.precio) * Number(p.cantidad || 1), 0);
    return { items, total, source: 'legacy' };
  }

  // ------- Luhn/máscaras tarjeta -------
  function luhnCheck(numStr) {
    const digits = (numStr || '').replace(/\D/g, '');
    let sum = 0, dbl = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = +digits[i];
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return (sum % 10) === 0 && digits.length >= 13 && digits.length <= 19;
  }
  const normalizeCard = (num) => (num || '').replace(/\D/g, '').slice(0, 19);
  const formatCardInput = (v) => normalizeCard(v).replace(/(\d{4})(?=\d)/g, '$1 ').trim();

  // ------- Snapshot de factura -------
  function collectClienteFromForm() {
    return {
      ruc:      document.getElementById('ruc')?.value || '',
      razon:    document.getElementById('razon')?.value || '',
      tel:      document.getElementById('tel')?.value || '',
      mail:     document.getElementById('mail')?.value || '',
      contacto: document.getElementById('contacto')?.value || '',
      ciudad:   document.getElementById('ciudad')?.value || '',
      barrio:   document.getElementById('barrio')?.value || '',
      depto:    document.getElementById('depto')?.value || '',
      postal:   document.getElementById('postal')?.value || '',
      calle1:   document.getElementById('calle1')?.value || '',
      calle2:   document.getElementById('calle2')?.value || '',
      nro:      document.getElementById('nro')?.value || ''
    };
  }
  function saveSnapshot(meta) {
    const { items, total } = getCheckoutData();
    const data = {
      fechaISO: new Date().toISOString(),
      metodo: meta?.metodo || '',
      extra:  meta?.extra  || {},
      cliente: collectClienteFromForm(),
      items,
      total
    };
    try { sessionStorage.setItem(SNAP_KEY, JSON.stringify(data)); } catch {}
    return data;
  }
  function loadSnapshot() {
    try { return JSON.parse(sessionStorage.getItem(SNAP_KEY)); }
    catch { return null; }
  }

  // ------- UI por método -------
  const radios = document.querySelectorAll('input[name="metodo"]');
  function showPanel(metodo) {
    panels.forEach(p => p.classList.toggle('disabled', p.dataset.metodo !== metodo));
    if (metodo === 'efectivo' && efectivoTotalEl) {
      const { total, source } = getCheckoutData();
      efectivoTotalEl.value = (source === 'remote' || !isFinite(total)) ? '—' : fmtGs(total);
    }
  }
  radios.forEach(r => r.addEventListener('change', () => showPanel(r.value)));
  showPanel(document.querySelector('input[name="metodo"]:checked').value);

  // Máscara tarjeta
  const cardNumEl = document.getElementById('card-number');
  if (cardNumEl) {
    cardNumEl.addEventListener('input', (e) => {
      e.target.value = formatCardInput(e.target.value);
      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
    });
  }

  // ------- SUBMIT -------
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const metodo = document.querySelector('input[name="metodo"]:checked')?.value;
    const { total, source } = getCheckoutData();

    if (source !== 'remote' && (!isFinite(total) || total <= 0)) {
      alert('Tu carrito está vacío. Volvé al carrito e iniciá el pago desde allí.');
      return;
    }

    if (metodo === 'transferencia') {
      if (!inputFile || !inputFile.files || inputFile.files.length === 0) {
        alert('Por favor, subí el comprobante (PDF o imagen).'); return;
      }
      const file = inputFile.files[0];
      if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) { alert('Formato no admitido.'); return; }
      if (file.size > 10 * 1024 * 1024) { alert('El archivo supera 10MB.'); return; }

      alert('Comprobante recibido. Pedido en proceso. ¡Gracias!');
      finalizeSuccess('transferencia');
      return;
    }

    if (metodo === 'tarjeta') {
      const name = document.getElementById('card-name')?.value?.trim();
      const number = document.getElementById('card-number')?.value || '';
      const exp = document.getElementById('card-exp')?.value?.trim();
      const cvv = document.getElementById('card-cvv')?.value?.trim();
      if (!name) { alert('Ingresá el nombre tal como figura en la tarjeta.'); return; }

      const cleaned = normalizeCard(number);
      if (!luhnCheck(cleaned)) { alert('Número de tarjeta inválido.'); return; }

      const m = /^(\d{2})\/(\d{2})$/.exec(exp || '');
      if (!m) { alert('Vencimiento inválido (usa MM/AA).'); return; }
      const mm = +m[1], yy = 2000 + +m[2];
      const endOfMonth = new Date(yy, mm, 0, 23, 59, 59, 999);
      if (endOfMonth < new Date()) { alert('La tarjeta está vencida.'); return; }
      if (!/^\d{3,4}$/.test(cvv || '')) { alert('CVV inválido.'); return; }
      if (source !== 'remote' && (!isFinite(total) || total <= 0)) { alert('El total es 0.'); return; }

      alert('Pago aprobado. ¡Gracias por tu compra!');
      finalizeSuccess('tarjeta', { number });
      return;
    }

    if (metodo === 'efectivo') {
      const { total, source } = getCheckoutData();
      const cash = Number(efectivoMonto?.value || 0);
      if (isNaN(cash) || cash <= 0) { alert('Ingresá el monto con el que vas a pagar.'); return; }
      if (source !== 'remote' && cash < total) {
        alert(`El monto (${fmtGs(cash)}) no alcanza. Total: ${fmtGs(total)}.`); return;
      }
      const change = source !== 'remote' ? cash - total : 0;
      alert(`Pedido confirmado. ${source !== 'remote' ? `Vuelto: ${fmtGs(change)}. ` : ''}¡Gracias!`);
      finalizeSuccess('efectivo', { cash, change });
      return;
    }

    alert('Seleccioná un método de pago.');
  });

  // ------- Éxito + Factura -------
  function finalizeSuccess(metodo, extra = {}) {
    const snap = saveSnapshot({ metodo, extra });
    try { localStorage.removeItem('productos-en-carrito'); } catch {}

    form.classList.add('disabled');
    success.classList.remove('disabled');
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (btnFactura) btnFactura.onclick = () => generateInvoicePDF(snap || loadSnapshot());
  }

  // ------- Helpers imágenes (logo / QR) -------
async function toDataURL(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = src;
  });
}

  // ------- FACTURA PDF  -------
// ------- FACTURA PDF (arreglo del ancho: adiós texto vertical) -------
// ------- FACTURA PDF (encabezado estable, sin solaparse) -------
async function generateInvoicePDF(snapshot) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();

  // Estilo / márgenes
  const M = 54;
  const C_BROWN = [111, 92, 56];
  const C_GRAY  = [120, 120, 120];
  const C_LINE  = [210, 210, 210];

  // Empresa
  const EMP = {
    nombre: 'Paniquiños',
    ruc: '80026041-4',
    timbrado: '15181564',
    inicio: '01/01/2025',
    tel: '+595 971 000 000',
    dir: 'Av. Sabor 123, Asunción',
    logo: 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinos.png'
  };

  // Datos
  const snap = snapshot || loadSnapshot() || {};
  const metodo  = snap.metodo || 'contado';
  const cliente = snap.cliente || collectClienteFromForm();
  const data    = getCheckoutData();
  const items   = (snap.items && snap.items.length ? snap.items : data.items) || [];
  const totalUse = Number(snap.total ?? data.total ?? 0);

  // Cálculos
  const iva10   = Math.round(totalUse / 11);
  const subBase = totalUse - iva10;
  const fecha   = snap.fechaISO ? new Date(snap.fechaISO) : new Date();
  const nroFactura = `001-001-${String(Math.floor(Math.random()*1_000_000)).padStart(6,'0')}`;

  // ===== Encabezado =====
  // Caja derecha
  const boxW = 300, boxH = 100, boxX = pw - M - boxW, boxY = 40;
  doc.setDrawColor(...C_LINE).setLineWidth(1);
  doc.roundedRect(boxX, boxY, boxW, boxH, 10, 10);
  doc.setFont('helvetica','bold').setFontSize(12).setTextColor(0,0,0);
  doc.text(`FACTURA N° ${nroFactura}`, boxX + 16, boxY + 24);
  doc.setFont('helvetica','normal').setFontSize(12).setTextColor(...C_GRAY);
  doc.text(`Fecha: ${fecha.toLocaleDateString('es-PY')} ${fecha.toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}`, boxX + 16, boxY + 44);
  doc.text(`Condición de venta: ${metodo === 'tarjeta' ? 'Crédito' : 'Contado'}`, boxX + 16, boxY + 64);
  doc.text('Moneda: Guaraní', boxX + 16, boxY + 84);

  // Logo
  try {
    const logoData = await toDataURL(EMP.logo);
    doc.addImage(logoData, 'PNG', M, 44, 96, 96);
  } catch {}

  // Columna izquierda (no invade la caja)
  const leftX = M + 110;
  const titleX = leftX, titleY = 62;
  const titleMaxW = Math.max(120, boxX - titleX - 12); // ancho disponible hasta la caja

  // Título: una línea si entra; si no, 2 líneas auto (no se superpone)
  const title = 'KuDE de FACTURA (Simulada)';
  doc.setFont('helvetica','bold').setTextColor(0,0,0);
  let fs = 20;
  while (fs >= 12) {
    doc.setFontSize(fs);
    if (doc.getTextWidth(title) <= titleMaxW) break;
    fs -= 0.5;
  }
  let yLeft;
  if (doc.getTextWidth(title) <= titleMaxW) {
    doc.text(title, titleX, titleY);
    yLeft = titleY + fs + 10;
  } else {
    // dividir en dos líneas dentro del ancho disponible
    doc.setFontSize(16);
    const lines = doc.splitTextToSize(title, titleMaxW).slice(0, 2);
    doc.text(lines, titleX, titleY);
    yLeft = titleY + lines.length * (16 * 1.25) + 6;
  }

  // Texto de empresa (envolver dentro del ancho disponible)
  doc.setFont('helvetica','normal').setFontSize(12).setTextColor(...C_GRAY);
  const lineH = 12 * 1.35;
  function drawLine(txt) {
    const lines = doc.splitTextToSize(txt, titleMaxW);
    doc.text(lines, leftX, yLeft);
    yLeft += lines.length * lineH;
  }
  drawLine(EMP.nombre);
  drawLine(`RUC: ${EMP.ruc}`);
  drawLine(`Timbrado: ${EMP.timbrado}`);
  drawLine(`Inicio de vigencia: ${EMP.inicio}`);
  drawLine(`Tel: ${EMP.tel}`);
  drawLine(`Dirección: ${EMP.dir}`);

  // ===== Caja Cliente ===== (debajo de lo más bajo entre izquierda y caja)
  const gapTop = 26;
  const cliX = M;
  const cliY = Math.max(boxY + boxH + gapTop, yLeft + 10);
  const cliW = pw - M*2;
  const cliH = 96;

  doc.setDrawColor(...C_LINE);
  doc.roundedRect(cliX, cliY, cliW, cliH, 10, 10);
  doc.setFont('helvetica','bold').setFontSize(12).setTextColor(0,0,0);
  doc.text('Cliente', cliX + 14, cliY + 24);

  doc.setFont('helvetica','normal').setFontSize(12).setTextColor(...C_GRAY);
  doc.text(`RUC/CI: ${cliente.ruc || '-'}`, cliX + 14, cliY + 46);
  doc.text(`Razón Social: ${cliente.razon || '-'}`, cliX + cliW/2, cliY + 46);
  doc.text(`Tel: ${cliente.tel || '-'}`, cliX + 14, cliY + 66);
  doc.text(`Mail: ${cliente.mail || '-'}`, cliX + cliW/2, cliY + 66);

  // ===== Tabla =====
  const body = (items.length ? items : [{ titulo:'Pedido Paniquiños', cantidad:1, precio: totalUse }])
    .map(it => [
      it.titulo || 'Producto',
      String(it.cantidad || 1),
      new Intl.NumberFormat('es-PY').format(Number(it.precio || 0)) + ' Gs',
      new Intl.NumberFormat('es-PY').format(Number(it.precio || 0) * Number(it.cantidad || 1)) + ' Gs'
    ]);

  doc.autoTable({
    head: [['Descripción','Cant.','Precio','Subtotal']],
    body,
    startY: cliY + cliH + 18,
    styles: { fontSize: 10, cellPadding: 6 },
    headStyles: { fillColor: C_BROWN, textColor: 255 },
    columnStyles: {
      1: { halign:'center', cellWidth: 70 },
      2: { halign:'right',  cellWidth: 90 },
      3: { halign:'right',  cellWidth: 110 }
    },
    tableLineColor: C_LINE,
    tableLineWidth: 0.5,
    theme: 'grid'
  });

  // ===== Totales =====
  let y = doc.lastAutoTable.finalY + 14;
  const tx = pw - M - 226;
  const vx = pw - M;

  doc.setFont('helvetica','bold').setFontSize(11).setTextColor(0,0,0);
  doc.text('SUBTOTAL (base)', tx, y);
  doc.text('IVA 10%',         tx, y + 18);
  doc.setFont('helvetica','bold').setFontSize(13);
  doc.text('TOTAL',           tx, y + 36);

  doc.setFont('helvetica','normal').setFontSize(11);
  doc.text(new Intl.NumberFormat('es-PY').format(subBase) + ' Gs', vx, y,       { align:'right' });
  doc.text(new Intl.NumberFormat('es-PY').format(iva10)   + ' Gs', vx, y + 18, { align:'right' });
  doc.setFont('helvetica','bold').setFontSize(13);
  doc.text(new Intl.NumberFormat('es-PY').format(totalUse)+ ' Gs', vx, y + 36, { align:'right' });

  // ===== Forma de pago =====
  y += 56;
  doc.setDrawColor(...C_LINE); doc.line(M, y - 14, pw - M, y - 14);
  doc.setFont('helvetica','bold').setFontSize(11).setTextColor(0,0,0);
  doc.text('Forma de pago:', M, y);
  doc.setFont('helvetica','normal').setTextColor(...C_GRAY);
  const fp = (metodo === 'transferencia')
      ? 'Transferencia bancaria (comprobante recibido).'
      : (metodo === 'efectivo' ? 'Efectivo.' : 'Tarjeta.');
  doc.text(fp, M + 110, y);

  // ===== QR + nota =====
  try {
    const qrData = await toDataURL(QR_URL); // usa la constante global
    const qrSize = 150;
    const qrX = M, qrY = ph - qrSize - 140;
    doc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
    doc.setFillColor(64,120,215);
    doc.rect(qrX + qrSize - 30, qrY + qrSize - 12, 30, 12, 'F');
    doc.rect(qrX + qrSize - 12, qrY + qrSize - 30, 12, 30, 'F');

    doc.setFont('helvetica','normal').setFontSize(10).setTextColor(...C_GRAY);
    const noteX = qrX + qrSize + 22, noteY = qrY + 18;
    doc.text('Este documento es una representación gráfica de una factura (simulada).', noteX, noteY);
    doc.text('Uso demostrativo. No válida como comprobante fiscal.', noteX, noteY + 16);
    doc.text('Paniquiños ©', noteX, noteY + 32);
  } catch {}

  // Guardar
  doc.save(`Factura_Paniquinos_${nroFactura}.pdf`);
}


})();
