// JS/checkout.js - VERSIÓN MEJORADA CON PROMOS Y FORMATEO
(function () {
  // --------- DOM ---------
  const form = document.getElementById('checkout-form');
  const panels = document.querySelectorAll('.metodo-panel');
  const success = document.getElementById('checkout-success');
  const btnFactura = document.getElementById('btn-descargar-factura');

  const inputFile = document.getElementById('comprobante');
  const efectivoMonto = document.getElementById('efectivo-monto');
  const efectivoTotalEl = document.getElementById('efectivo-total');

  // --------- Constantes / Utils ---------
  const fmtGs = (n) => new Intl.NumberFormat('es-PY').format(Number(n || 0)) + ' Gs';
  const QS = new URLSearchParams(location.search);

  // Claves de sessionStorage
  const SNAP_FACTURA = 'pedido-simulado';
  const SNAP_CHECKOUT_PRIMARY = 'checkout_snapshot';
  const SNAP_CHECKOUT_FALLBACK = 'checkout';

  function hasValidPedido(qs = QS) {
    const raw = qs.get('pedido');
    if (raw == null) return false;
    const v = String(raw).trim().toLowerCase();
    return v !== '' && v !== 'null' && v !== 'undefined';
  }

  function readCheckoutSnapshot() {
    try {
      const raw =
        sessionStorage.getItem(SNAP_CHECKOUT_PRIMARY) ??
        sessionStorage.getItem(SNAP_CHECKOUT_FALLBACK);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function getCartLocal() {
    try { return JSON.parse(localStorage.getItem('productos-en-carrito')) || []; }
    catch { return []; }
  }

  // Datos del checkout con soporte de promos
  function getCheckoutData() {
    const snap = readCheckoutSnapshot();
    const isLocalUrl  = QS.has('monto');
    const isRemoteUrl = hasValidPedido(QS);

    if (isLocalUrl && snap?.source === 'local') {
      const items = Array.isArray(snap.items) ? snap.items : [];
      const total = Number(snap.total || 0) || items.reduce((a, p) =>
        a + Number(p.precio) * Number(p.cantidad || 1), 0);
      return { items, total, source: 'local' };
    }

    if (isRemoteUrl && snap?.source === 'remote' && snap?.pedidoId === QS.get('pedido')) {
      return { items: [], total: NaN, source: 'remote', pedidoId: snap.pedidoId };
    }

    const items = getCartLocal();
    const total = items.reduce((a, p) => a + Number(p.precio) * Number(p.cantidad || 1), 0);
    return { items, total, source: 'legacy' };
  }

  // --------- Validación tarjeta (Luhn) y máscaras ---------
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

  // --------- Snapshot de factura ---------
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

  function saveFacturaSnapshot(meta) {
    const { items, total } = getCheckoutData();
    const data = {
      fechaISO: new Date().toISOString(),
      metodo: meta?.metodo || '',
      extra:  meta?.extra  || {},
      cliente: collectClienteFromForm(),
      items,
      total
    };
    try { sessionStorage.setItem(SNAP_FACTURA, JSON.stringify(data)); } catch {}
    return data;
  }

  function loadFacturaSnapshot() {
    try { return JSON.parse(sessionStorage.getItem(SNAP_FACTURA)); }
    catch { return null; }
  }

  // --------- UI por método ---------
  const radios = document.querySelectorAll('input[name="metodo"]');
  function showPanel(metodo) {
    panels.forEach(p => p.classList.toggle('disabled', p.dataset.metodo !== metodo));
    if (metodo === 'efectivo' && efectivoTotalEl) {
      const { total, source } = getCheckoutData();
      efectivoTotalEl.value = (source === 'remote' || !isFinite(total)) ? '—' : fmtGs(total);
    }
  }
  if (radios.length) {
    radios.forEach(r => r.addEventListener('change', () => showPanel(r.value)));
    const checked = document.querySelector('input[name="metodo"]:checked');
    if (checked) showPanel(checked.value);
  }

  // Máscara de tarjeta
  const cardNumEl = document.getElementById('card-number');
  if (cardNumEl) {
    cardNumEl.addEventListener('input', (e) => {
      e.target.value = formatCardInput(e.target.value);
      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
    });
  }

  // ========== FORMATEO DE EFECTIVO CON SEPARADORES ==========
  if (efectivoMonto) {
    efectivoMonto.addEventListener('input', (e) => {
      const raw = e.target.value.replace(/\D/g, ''); // Solo números
      if (raw === '') {
        e.target.value = '';
        e.target.dataset.rawValue = '0';
        return;
      }
      const num = parseInt(raw, 10);
      e.target.value = new Intl.NumberFormat('es-PY').format(num);
      e.target.dataset.rawValue = String(num); // Guardar valor numérico
    });
    
    // Placeholder formateado
    efectivoMonto.placeholder = '100.000';
  }

  // --------- Envío del formulario ---------
  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const metodo = document.querySelector('input[name="metodo"]:checked')?.value;
    const { total, source, items } = getCheckoutData();

    if (source !== 'remote' && (!isFinite(total) || total <= 0)) {
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

      alert('Pago aprobado. ¡Gracias por tu compra!');
      finalizeSuccess('tarjeta', { number: cleaned.slice(-4) });
      return;
    }

    if (metodo === 'efectivo') {
      // Obtener valor numérico desde dataset
      const cashRaw = efectivoMonto?.dataset.rawValue || efectivoMonto?.value.replace(/\D/g, '');
      const cash = Number(cashRaw || 0);
      
      if (isNaN(cash) || cash <= 0) { 
        alert('Ingresá el monto con el que vas a pagar.'); 
        return; 
      }
      if (source !== 'remote' && cash < total) {
        alert(`El monto (${fmtGs(cash)}) no alcanza. Total: ${fmtGs(total)}.`); 
        return;
      }
      const change = source !== 'remote' ? cash - total : 0;
      alert(`Pedido confirmado. ${source !== 'remote' ? `Vuelto: ${fmtGs(change)}. ` : ''}¡Gracias!`);
      finalizeSuccess('efectivo', { cash, change });
      return;
    }

    alert('Seleccioná un método de pago.');
  });

  // --------- Éxito + Factura ---------
  function finalizeSuccess(metodo, extra = {}) {
    const snap = saveFacturaSnapshot({ metodo, extra });

    Promise.resolve()
      .then(() => window.CartAPI?.empty?.())
      .catch(() => {})
      .finally(() => {
        try { localStorage.removeItem('productos-en-carrito'); } catch {}

        form.classList.add('disabled');
        success.classList.remove('disabled');
        success.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (btnFactura) btnFactura.onclick = () => generateInvoicePDF(snap || loadFacturaSnapshot());
        
        try { window.CartAPI?.refreshBadge?.(); } catch {}
      });
  }

  // --------- Helpers imagen a dataURL ---------
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

  // ========== FACTURA PDF PROFESIONAL CON PROMOS ==========
  async function generateInvoicePDF(snapshot) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Paleta profesional
    const M = 40;
    const C_TXT  = [30, 30, 30];
    const C_MUT  = [100, 100, 100];
    const C_LIGHT = [150, 150, 150];
    const C_LINE = [200, 200, 200];
    const C_HEAD = [111, 92, 56];
    const C_PROMO = [220, 38, 38]; // Rojo más suave

    // Empresa
    const EMP = {
      nombre: 'Paniquiños',
      actividad: 'Panadería',
      dir: 'Avda Sabor 1500',
      tel: '+595 992544305',
      ruc: '800260001-4',
      timbrado: '15181564',
      inicio: '20/10/2021',
      logo: 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinos.png'
    };
    const QR_SRC = 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/QrGenerico.jpg';

    // Snapshot
    const snap = snapshot || loadFacturaSnapshot() || {};
    const metodo = snap.metodo || 'contado';
    const cliente = snap.cliente || collectClienteFromForm();
    const data = getCheckoutData();
    const items = (snap.items && snap.items.length ? snap.items : data.items) || [];
    const totalUse = Number(snap.total ?? data.total ?? 0);

    // Calcular totales con y sin promos
    let totalSinDescuento = 0;
    let totalConDescuento = totalUse;
    const tienePromos = items.some(it => it.tienePromo);

    if (tienePromos) {
      items.forEach(it => {
        const precioOriginal = Number(it.precioOriginal || it.precio);
        const precioFinal = it.tienePromo ? Number(it.precio) : precioOriginal;
        const cantidad = Number(it.cantidad || 1);
        
        totalSinDescuento += precioOriginal * cantidad;
        totalConDescuento += (precioFinal - precioOriginal) * cantidad;
      });
    }

    const ahorroTotal = tienePromos ? (totalSinDescuento - totalConDescuento) : 0;

    // Cálculos IVA
    const iva10 = Math.round(totalUse / 11);
    const subBase = totalUse - iva10;
    const fecha = snap.fechaISO ? new Date(snap.fechaISO) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-PY');
    const nroFactura = `001-001-${String(Math.floor(Math.random()*1_000_000)).padStart(6,'0')}`;

    // ===== HEADER PROFESIONAL =====
    let yPos = M;
    
    // Línea superior decorativa
    doc.setFillColor(...C_HEAD);
    doc.rect(0, 0, pw, 8, 'F');

    // Logo
    try {
      const logoData = await toDataURL(EMP.logo);
      doc.addImage(logoData, 'PNG', M, yPos, 90, 90);
    } catch {}

    // Info empresa (centro)
    const centerX = M + 110;
    yPos += 15;
    
    doc.setFont('helvetica','bold').setFontSize(18).setTextColor(...C_TXT);
    doc.text('KuDE de FACTURA ELECTRÓNICA', centerX, yPos);
    
    yPos += 25;
    doc.setFont('helvetica','bold').setFontSize(14).setTextColor(...C_HEAD);
    doc.text(EMP.nombre, centerX, yPos);
    
    yPos += 18;
    doc.setFont('helvetica','normal').setFontSize(10).setTextColor(...C_MUT);
    doc.text(EMP.actividad, centerX, yPos);
    
    yPos += 14;
    doc.text(EMP.dir, centerX, yPos);
    
    yPos += 14;
    doc.text(`Tel: ${EMP.tel}`, centerX, yPos);

    // Info fiscal (derecha)
    const rightX = pw - M - 160;
    yPos = M + 15;
    
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...C_TXT);
    doc.text('RUC:', rightX, yPos);
    doc.setFont('helvetica','normal');
    doc.text(EMP.ruc, rightX + 70, yPos, { align: 'right' });
    
    yPos += 16;
    doc.setFont('helvetica','bold');
    doc.text('Timbrado:', rightX, yPos);
    doc.setFont('helvetica','normal');
    doc.text(EMP.timbrado, rightX + 70, yPos, { align: 'right' });
    
    yPos += 16;
    doc.setFont('helvetica','bold');
    doc.text('Inicio de:', rightX, yPos);
    doc.setFont('helvetica','normal');
    doc.text(EMP.inicio, rightX + 70, yPos, { align: 'right' });

    // Número de factura destacado
    yPos += 24;
    doc.setDrawColor(...C_LINE);
    doc.setFillColor(248, 248, 248);
    doc.roundedRect(rightX - 10, yPos - 12, 180, 32, 4, 4, 'FD');
    
    doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...C_HEAD);
    doc.text('FACTURA ELECTRÓNICA', rightX, yPos);
    yPos += 16;
    doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...C_TXT);
    doc.text(nroFactura, rightX, yPos);

    // Línea separadora
    yPos = M + 105;
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.5);
    doc.line(M, yPos, pw - M, yPos);

    // ===== CLIENTE =====
    yPos += 20;
    doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...C_TXT);
    doc.text('DATOS DEL CLIENTE', M, yPos);
    
    yPos += 18;
    doc.setFont('helvetica','normal').setFontSize(10).setTextColor(...C_MUT);
    
    // Fila 1
    doc.setFont('helvetica','bold');
    doc.text('RUC/CI:', M, yPos);
    doc.setFont('helvetica','normal');
    doc.text(cliente.ruc || '-', M + 50, yPos);
    
    doc.setFont('helvetica','bold');
    doc.text('Fecha:', pw/2, yPos);
    doc.setFont('helvetica','normal');
    doc.text(fechaStr, pw/2 + 40, yPos);
    
    // Fila 2
    yPos += 16;
    doc.setFont('helvetica','bold');
    doc.text('Razón Social:', M, yPos);
    doc.setFont('helvetica','normal');
    doc.text(cliente.razon || '-', M + 80, yPos);
    
    // Fila 3
    yPos += 16;
    doc.setFont('helvetica','bold');
    doc.text('Teléfono:', M, yPos);
    doc.setFont('helvetica','normal');
    doc.text(cliente.tel || '-', M + 50, yPos);
    
    doc.setFont('helvetica','bold');
    doc.text('Email:', pw/2, yPos);
    doc.setFont('helvetica','normal');
    doc.text(cliente.mail || '-', pw/2 + 40, yPos);

    yPos += 18;
    doc.setDrawColor(...C_LINE);
    doc.line(M, yPos, pw - M, yPos);

    // ===== BADGE DE PROMO (más sutil) =====
    if (tienePromos && ahorroTotal > 0) {
      yPos += 16;
      doc.setFillColor(255, 245, 245);
      doc.setDrawColor(...C_PROMO);
      doc.setLineWidth(1);
      doc.roundedRect(M, yPos - 8, pw - 2*M, 28, 4, 4, 'FD');
      
      doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...C_PROMO);
      doc.text('🎉 COMPRA CON DESCUENTO', M + 10, yPos + 8);
      doc.text(`Ahorrás: ${fmtGs(ahorroTotal)}`, pw - M - 10, yPos + 8, { align: 'right' });
      
      yPos += 20;
    }

    // ===== TABLA PROFESIONAL =====
    yPos += 16;
    const tableItems = items.length ? items : [{ titulo:'Servicio/Producto', cantidad:1, precio: totalUse }];
    const body = tableItems.map(it => {
      const titulo = it.titulo || 'Item';
      const tienePromo = it.tienePromo;
      const descuento = tienePromo ? Math.round(it.descuentoPorcentaje || 0) : 0;
      
      const tituloDisplay = tienePromo ? `${titulo} (${descuento}% OFF)` : titulo;
      
      const precioOriginal = Number(it.precioOriginal || it.precio);
      const precioFinal = tienePromo ? Number(it.precio) : precioOriginal;
      const precioStr = tienePromo 
        ? `${new Intl.NumberFormat('es-PY').format(precioOriginal)} → ${new Intl.NumberFormat('es-PY').format(precioFinal)}`
        : new Intl.NumberFormat('es-PY').format(precioFinal);
      
      return [
        tituloDisplay,
        String(it.cantidad || 1),
        precioStr + ' Gs',
        new Intl.NumberFormat('es-PY').format(precioFinal * Number(it.cantidad || 1)) + ' Gs'
      ];
    });

    doc.autoTable({
      head: [['Descripción','Cant.','Precio Unitario','Subtotal']],
      body,
      startY: yPos,
      margin: { left: M, right: M },
      styles: { 
        fontSize: 9.5, 
        cellPadding: 8,
        textColor: C_TXT,
        lineColor: C_LINE,
        lineWidth: 0.5
      },
      headStyles: { 
        fillColor: C_HEAD, 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10
      },
      columnStyles: { 
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 50 }, 
        2: { halign: 'right', cellWidth: 100 }, 
        3: { halign: 'right', cellWidth: 100 } 
      },
      alternateRowStyles: { fillColor: [252, 252, 252] },
      theme: 'grid'
    });

    // ===== TOTALES PROFESIONALES =====
    yPos = doc.lastAutoTable.finalY + 20;
    
    // Caja de totales
    const totalsX = pw - M - 220;
    const totalsW = 220;
    
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(...C_LINE);
    doc.roundedRect(totalsX, yPos - 10, totalsW, 90, 4, 4, 'FD');
    
    yPos += 4;
    
    // Subtotal
    doc.setFont('helvetica','normal').setFontSize(10).setTextColor(...C_MUT);
    doc.text('Subtotal (Base):', totalsX + 12, yPos);
    doc.text(new Intl.NumberFormat('es-PY').format(subBase) + ' Gs', totalsX + totalsW - 12, yPos, { align: 'right' });
    
    yPos += 20;
    doc.text('IVA 10%:', totalsX + 12, yPos);
    doc.text(new Intl.NumberFormat('es-PY').format(iva10) + ' Gs', totalsX + totalsW - 12, yPos, { align: 'right' });
    
    // Línea separadora
    yPos += 10;
    doc.setDrawColor(...C_LINE);
    doc.line(totalsX + 12, yPos, totalsX + totalsW - 12, yPos);
    
    // Total destacado
    yPos += 18;
    doc.setFont('helvetica','bold').setFontSize(13).setTextColor(...C_HEAD);
    doc.text('TOTAL:', totalsX + 12, yPos);
    doc.text(new Intl.NumberFormat('es-PY').format(totalUse) + ' Gs', totalsX + totalsW - 12, yPos, { align: 'right' });

    // ===== FORMA DE PAGO =====
    yPos += 30;
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...C_TXT);
    doc.text('Forma de pago:', M, yPos);
    doc.setFont('helvetica','normal').setTextColor(...C_MUT);
    const fp = (metodo === 'transferencia') ? 'Transferencia bancaria' :
              (metodo === 'efectivo') ? 'Efectivo' : 'Tarjeta de crédito';
    doc.text(fp, M + 90, yPos);

    // ===== FOOTER CON QR =====
    const footerY = ph - 180;
    
    // Línea separadora
    doc.setDrawColor(...C_LINE);
    doc.line(M, footerY, pw - M, footerY);
    
    try {
      const qrData = await toDataURL(QR_SRC);
      const qrSize = 110;
      const qrX = M;
      const qrY = footerY + 20;
      
      // QR con borde sutil
      doc.setDrawColor(...C_LINE);
      doc.setLineWidth(1);
      doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4);
      doc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
      
      // Indicador CDC
      doc.setFillColor(64,120,215);
      doc.rect(qrX + qrSize - 22, qrY + qrSize - 10, 22, 10, 'F');
      doc.rect(qrX + qrSize - 10, qrY + qrSize - 22, 10, 22, 'F');

      // Texto informativo
      const noteX = qrX + qrSize + 30;
      let noteY = qrY + 10;
      
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_TXT);
      doc.text('Validez del documento', noteX, noteY);
      
      noteY += 16;
      doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(...C_MUT);
      doc.text('Este documento es una representación gráfica', noteX, noteY);
      noteY += 12;
      doc.text('de una factura electrónica (simulada).', noteX, noteY);
      noteY += 12;
      doc.text('Uso demostrativo.', noteX, noteY);
      
      if (tienePromos) {
        noteY += 18;
        doc.setFont('helvetica','bold').setFontSize(8.5).setTextColor(...C_PROMO);
        doc.text('✓ Compra con descuentos aplicados', noteX, noteY);
      }
      
      noteY += 18;
      doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...C_LIGHT);
      doc.text(`© ${new Date().getFullYear()} ${EMP.nombre} - Todos los derechos reservados`, noteX, noteY);
      
    } catch (err) {
      console.error('Error al cargar QR:', err);
    }

    // Línea decorativa inferior
    doc.setFillColor(...C_HEAD);
    doc.rect(0, ph - 8, pw, 8, 'F');

    doc.save(`Factura_${EMP.nombre}_${nroFactura}.pdf`);
  }

})();