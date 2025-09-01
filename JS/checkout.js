// JS/checkout.js
(function () {
  const form = document.getElementById('checkout-form');
  const panels = document.querySelectorAll('.metodo-panel');
  const success = document.getElementById('checkout-success');
  const btnFactura = document.getElementById('btn-descargar-factura');

  const inputFile = document.getElementById('comprobante');
  const efectivoMonto = document.getElementById('efectivo-monto');
  const efectivoTotalEl = document.getElementById('efectivo-total');

  // ------- Utils -------
  const fmtGs = (n) => new Intl.NumberFormat('es-PY').format(Number(n || 0)) + ' Gs';
  const SNAP_KEY = 'pedido-simulado'; // snapshot del pedido confirmado

  function getCart() {
    try { return JSON.parse(localStorage.getItem('productos-en-carrito')) || []; }
    catch { return []; }
  }
  function cartTotal(items = getCart()) {
    return items.reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
  }

  // ------- Luhn + máscaras -------
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

  // ------- Snapshot del pedido -------
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
    const items = getCart();
    const total = cartTotal(items);
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

  // ------- Simulador de tarjeta (escenarios) -------
  const CARD_TESTS = {
    '4111111111111111': 'APPROVED',
    '4999999999990000': 'NOT_FOUND',
    '4999999999990001': 'NO_FUNDS',
    '4999999999990002': 'BLOCKED'
  };
  function simulateCardCharge({ number, exp, cvv, amount }) {
    const now = new Date();
    const m = /^(\d{2})\/(\d{2})$/.exec(exp || '');
    if (!m) return { ok: false, msg: 'Vencimiento inválido (usa MM/AA).' };
    const mm = +m[1], yy = 2000 + +m[2];
    if (mm < 1 || mm > 12) return { ok: false, msg: 'Mes inválido.' };
    const endOfMonth = new Date(yy, mm, 0, 23, 59, 59, 999);
    if (endOfMonth < now) return { ok: false, msg: 'La tarjeta está vencida.' };
    if (!/^\d{3,4}$/.test(cvv || '')) return { ok: false, msg: 'CVV inválido.' };

    const cleaned = normalizeCard(number);
    if (!luhnCheck(cleaned)) return { ok: false, msg: 'Número de tarjeta inválido.' };

    const scenario = CARD_TESTS[cleaned] || 'APPROVED';
    if (scenario === 'NOT_FOUND') return { ok: false, msg: 'Tarjeta inexistente.' };
    if (scenario === 'NO_FUNDS')  return { ok: false, msg: 'Saldo insuficiente.' };
    if (scenario === 'BLOCKED')   return { ok: false, msg: 'Tarjeta bloqueada.' };

    if (amount <= 0) return { ok: false, msg: 'El total es 0.' };
    return { ok: true, msg: 'Pago aprobado.' };
  }

  // ------- UI: paneles por método -------
  const radios = document.querySelectorAll('input[name="metodo"]');
  function showPanel(metodo) {
    panels.forEach(p => p.classList.toggle('disabled', p.dataset.metodo !== metodo));
    if (metodo === 'efectivo' && efectivoTotalEl) efectivoTotalEl.value = fmtGs(cartTotal());
  }
  radios.forEach(r => r.addEventListener('change', () => showPanel(r.value)));
  showPanel(document.querySelector('input[name="metodo"]:checked').value);

  // Máscara del número de tarjeta
  const cardNumEl = document.getElementById('card-number');
  if (cardNumEl) {
    cardNumEl.addEventListener('input', (e) => {
      e.target.value = formatCardInput(e.target.value);
      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
    });
  }

  // ------- Submit: simular pago -------
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const metodo = document.querySelector('input[name="metodo"]:checked')?.value;
    const amount = cartTotal();
    if (amount <= 0) { alert('Tu carrito está vacío.'); return; }

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

      const res = simulateCardCharge({ number, exp, cvv, amount });
      if (!res.ok) { alert(`Pago rechazado: ${res.msg}`); return; }

      alert('Pago aprobado. ¡Gracias por tu compra!');
      finalizeSuccess('tarjeta', { number });
      return;
    }

    if (metodo === 'efectivo') {
      const cash = Number(efectivoMonto?.value || 0);
      if (isNaN(cash) || cash <= 0) { alert('Ingresá el monto con el que vas a pagar.'); return; }
      if (cash < amount) { alert(`El monto (${fmtGs(cash)}) no alcanza. Total: ${fmtGs(amount)}.`); return; }

      const change = cash - amount;
      alert(`Pedido confirmado. Vuelto: ${fmtGs(change)}. ¡Gracias!`);
      finalizeSuccess('efectivo', { cash, change });
      return;
    }

    alert('Seleccioná un método de pago.');
  });

  function finalizeSuccess(metodo, extra = {}) {
    // 1) Guardamos snapshot ANTES de vaciar el carrito
    const snap = saveSnapshot({ metodo, extra });

    // 2) Limpiamos carrito
    try { localStorage.removeItem('productos-en-carrito'); } catch {}

    // 3) UI de éxito
    form.classList.add('disabled');
    success.classList.remove('disabled');
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // 4) Botón factura genera desde snapshot (aunque el carrito esté vacío)
    if (btnFactura) {
      btnFactura.onclick = () => generateInvoicePDF(snap || loadSnapshot());
    }
  }

  // ------- FACTURA PDF -------
  async function generateInvoicePDF(snapshot) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth();

    // Empresa (ficticia)
    const EMP = {
      nombre: 'Paniquiños',
      ruc: '80026041-4',
      tel: '+595 971 000 000',
      dir: 'Av. Sabor 123, Asunción',
      timbrado: '15181564',
      inicio: '01/01/2025'
    };

    // Data desde snapshot (o fallback)
    const snap = snapshot || loadSnapshot() || {};
    const metodo = snap.metodo || 'contado';
       const extra = snap.extra || {};
    const cliente = snap.cliente || collectClienteFromForm();
    const items = (snap.items && snap.items.length ? snap.items : getCart());
    const totalUse = snap.total || cartTotal(items);

    // IVA (precios IVA inc.): IVA10 = total/11
    const iva10 = Math.round(totalUse / 11);
    const subBase = totalUse - iva10;

    const fecha = snap.fechaISO ? new Date(snap.fechaISO) : new Date();
    const nroFactura = `001-001-${String(Math.floor(Math.random()*1000000)).padStart(6,'0')}`;

    // Logo (ojo con mayúsculas/minúsculas en ruta)
    try {
      const logoDataURL = await toDataURL('/img/paniquinos.png');
      doc.addImage(logoDataURL, 'PNG', 32, 28, 90, 90);
    } catch {}

    // Encabezado
    doc.setFont('helvetica','bold').setFontSize(16);
    doc.text('KuDE de FACTURA (Simulada)', 140, 46);
    doc.setFont('helvetica','normal').setFontSize(11);
    doc.text(`${EMP.nombre}`, 140, 66);
    doc.text(`RUC: ${EMP.ruc}`, 140, 84);
    doc.text(`Timbrado: ${EMP.timbrado}`, 140, 100);
    doc.text(`Inicio de vigencia: ${EMP.inicio}`, 140, 116);
    doc.text(`Tel: ${EMP.tel}`, 140, 132);
    doc.text(`Dirección: ${EMP.dir}`, 140, 148);

    doc.setFont('helvetica','bold');
    doc.text(`FACTURA N° ${nroFactura}`, pw - 32, 46, { align: 'right' });
    doc.setFont('helvetica','normal');
    doc.text(
      `Fecha: ${fecha.toLocaleDateString('es-PY')} ${fecha.toLocaleTimeString('es-PY',{hour:'2-digit',minute:'2-digit'})}`,
      pw - 32, 66, { align: 'right' }
    );
    doc.text(`Condición de venta: ${metodo === 'tarjeta' ? 'Crédito' : 'Contado'}`, pw - 32, 84, { align: 'right' });
    doc.text(`Moneda: Guaraní`, pw - 32, 100, { align: 'right' });

    // Cliente
    doc.setDrawColor(160).setLineWidth(1);
    doc.roundedRect(28, 170, pw-56, 72, 6, 6);
    doc.setFont('helvetica','bold'); doc.text('Cliente', 36, 188);
    doc.setFont('helvetica','normal');
    doc.text(`RUC/CI: ${cliente.ruc || '-'}`, 36, 208);
    doc.text(`Razón Social: ${cliente.razon || '-'}`, 210, 208);
    doc.text(`Tel: ${cliente.tel || '-'}  |  Mail: ${cliente.mail || '-'}`, 36, 228);

    // Ítems (si no hay, línea genérica con total)
    const body = (items && items.length ? items : [{ titulo: 'Pedido Paniquiños', cantidad: 1, precio: totalUse }])
      .map(p => [
        p.titulo || 'Producto',
        String(p.cantidad || 1),
        fmtGs(p.precio || 0),
        fmtGs(Number(p.precio || 0) * Number(p.cantidad || 1))
      ]);

    doc.autoTable({
      startY: 260,
      head: [['Descripción', 'Cant.', 'Precio', 'Subtotal']],
      body,
      styles: { fontSize: 10, cellPadding: 6 },
      headStyles: { fillColor: [111,92,56], textColor: 255 },
      theme: 'grid',
      columnStyles: { 1: { halign:'center', cellWidth: 60 }, 2: { halign:'right', cellWidth: 90 }, 3: { halign:'right', cellWidth: 110 } }
    });

    let y = doc.lastAutoTable.finalY + 14;

    // Totales
    doc.setFont('helvetica','bold');
    doc.text(`SUBTOTAL (base)`, pw-240, y);
    doc.text(`IVA 10%`, pw-240, y+18);
    doc.text(`TOTAL`, pw-240, y+36);
    doc.setFont('helvetica','normal');
    doc.text(fmtGs(subBase), pw-32, y, { align:'right' });
    doc.text(fmtGs(iva10), pw-32, y+18, { align:'right' });
    doc.text(fmtGs(totalUse), pw-32, y+36, { align:'right' });

    // Forma de pago
    y += 60;
    doc.setDrawColor(200); doc.line(28, y, pw-28, y);
    y += 16;
    doc.setFont('helvetica','bold'); doc.text('Forma de pago:', 28, y);
    doc.setFont('helvetica','normal');
    let nota = '';
    if (metodo === 'transferencia') {
      nota = 'Transferencia bancaria (comprobante recibido).';
    } else if (metodo === 'tarjeta') {
      const last4 = (extra.number || '').replace(/\D/g,'').slice(-4);
      nota = `Tarjeta de crédito •••• ${last4} (aprobada - simulación).`;
    } else {
      nota = 'Efectivo contra entrega (simulación).';
    }
    doc.text(nota, 140, y);

    // Pie + QR con imagen genérica
    y += 40;
    try {
      const qrDataURL = await toDataURL('/IMG/QrGenerico.jpg'); // respeta mayúsculas/minúsculas
      const qrSize = 120;
      doc.addImage(qrDataURL, 'PNG', 28, y, qrSize, qrSize);
    } catch {
      doc.setDrawColor(120);
      doc.roundedRect(28, y, 120, 120, 6, 6);
      doc.setFontSize(9).text('QR (genérico no disponible)', 88, y + 62, { angle: -90, align: 'center' });
    }

    // Texto a la derecha del QR
    doc.setFontSize(10);
    doc.text('Este documento es una representación gráfica de una factura (simulada).', 160, y + 20);
    doc.text('Uso demostrativo. No válida como comprobante fiscal.', 160, y + 36);
    doc.text('Paniquiños ©', 160, y + 52);

    // ¡Faltaba guardar!
    doc.save(`Factura_Paniquinos_${nroFactura}.pdf`);
  }

  // Cargar imagen como dataURL para jsPDF (debe estar FUERA de generateInvoicePDF)
  function toDataURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = this.naturalWidth;
        canvas.height = this.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = reject;
      img.src = url;
    });
  }
})();
