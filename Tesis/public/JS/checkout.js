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

  // ========== FACTURA PDF PROFESIONAL ==========
  async function generateInvoicePDF(snapshot) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();

    // Paleta de colores
    const C_TXT  = [30, 30, 30];
    const C_GRAY = [100, 100, 100];
    const C_LIGHT = [150, 150, 150];
    const C_LINE = [220, 220, 220];
    const C_BRAND = [111, 92, 56]; // Marrón corporativo
    const C_PROMO = [220, 38, 38];

    // Márgenes
    const ML = 50; // Margen izquierdo
    const MR = 50; // Margen derecho
    const MT = 50; // Margen superior

    // Empresa
    const EMP = {
      nombre: 'Paniquiños',
      actividad: 'Panadería',
      direccion: 'Avda Sabor 1500',
      telefono: '+595 992544305',
      ruc: '800260001-4',
      timbrado: '15181564',
      vigencia: '20/10/2021',
      logo: 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinos.png'
    };
    const QR_SRC = 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/QrGenerico.jpg';

    // Datos del snapshot
    const snap = snapshot || loadFacturaSnapshot() || {};
    const metodo = snap.metodo || 'efectivo';
    const cliente = snap.cliente || collectClienteFromForm();
    const data = getCheckoutData();
    const items = (snap.items && snap.items.length ? snap.items : data.items) || [];
    const totalUse = Number(snap.total ?? data.total ?? 0);

    // Calcular si hay promos
    const tienePromos = items.some(it => it.tienePromo);
    let totalSinDescuento = 0;
    if (tienePromos) {
      items.forEach(it => {
        const precioOrig = Number(it.precioOriginal || it.precio);
        totalSinDescuento += precioOrig * Number(it.cantidad || 1);
      });
    }
    const ahorroTotal = tienePromos ? (totalSinDescuento - totalUse) : 0;

    // Cálculos fiscales
    const iva10 = Math.round(totalUse / 11);
    const subBase = totalUse - iva10;
    const fecha = snap.fechaISO ? new Date(snap.fechaISO) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-PY');
    const nroFactura = `001-001-${String(Math.floor(Math.random()*1_000_000)).padStart(7,'0')}`;

    // ========== HEADER ==========
    let y = MT;

    // Logo
    try {
      const logoData = await toDataURL(EMP.logo);
      doc.addImage(logoData, 'PNG', ML, y, 80, 80);
    } catch {}

    // Título centrado
    doc.setFont('helvetica','bold').setFontSize(16).setTextColor(...C_TXT);
    doc.text('KuDE de FACTURA ELECTRÓNICA', pw/2, y + 10, { align: 'center' });

    // Info empresa (debajo del título)
    y += 28;
    doc.setFont('helvetica','bold').setFontSize(13).setTextColor(...C_BRAND);
    doc.text(EMP.nombre, pw/2, y, { align: 'center' });
    
    y += 16;
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(...C_GRAY);
    doc.text(EMP.actividad, pw/2, y, { align: 'center' });
    
    y += 12;
    doc.text(EMP.direccion, pw/2, y, { align: 'center' });
    
    y += 12;
    doc.text(`Tel: ${EMP.telefono}`, pw/2, y, { align: 'center' });

    // Caja de datos fiscales (derecha)
    const boxX = pw - MR - 180;
    const boxY = MT;
    const boxW = 180;
    const boxH = 95;
    
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.5);
    doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, 'FD');
    
    let by = boxY + 16;
    doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_TXT);
    doc.text('RUC:', boxX + 10, by);
    doc.setFont('helvetica','normal');
    doc.text(EMP.ruc, boxX + boxW - 10, by, { align: 'right' });
    
    by += 14;
    doc.setFont('helvetica','bold');
    doc.text('Timbrado:', boxX + 10, by);
    doc.setFont('helvetica','normal');
    doc.text(EMP.timbrado, boxX + boxW - 10, by, { align: 'right' });
    
    by += 14;
    doc.setFont('helvetica','bold');
    doc.text('Inicio de:', boxX + 10, by);
    doc.setFont('helvetica','normal');
    doc.text(EMP.vigencia, boxX + boxW - 10, by, { align: 'right' });
    
    by += 18;
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...C_BRAND);
    doc.text('FACTURA ELECTRÓNICA', boxX + boxW/2, by, { align: 'center' });
    
    by += 14;
    doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...C_TXT);
    doc.text(nroFactura, boxX + boxW/2, by, { align: 'center' });

    // Línea separadora
    y += 30;
    doc.setDrawColor(...C_LINE);
    doc.setLineWidth(0.5);
    doc.line(ML, y, pw - MR, y);

    // ========== DATOS DEL CLIENTE ==========
    y += 20;
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...C_TXT);
    doc.text('DATOS DEL CLIENTE', ML, y);
    
    y += 16;
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(...C_GRAY);
    
    // Fila 1: RUC y Fecha
    doc.setFont('helvetica','bold');
    doc.text('RUC/CI:', ML, y);
    doc.setFont('helvetica','normal');
    doc.text(cliente.ruc || '-', ML + 60, y);
    
    doc.setFont('helvetica','bold');
    doc.text('Fecha:', pw - MR - 150, y);
    doc.setFont('helvetica','normal');
    doc.text(fechaStr, pw - MR - 100, y);
    
    // Fila 2: Razón Social
    y += 14;
    doc.setFont('helvetica','bold');
    doc.text('Razón Social:', ML, y);
    doc.setFont('helvetica','normal');
    doc.text(cliente.razon || '-', ML + 80, y);
    
    // Fila 3: Teléfono y Email
    y += 14;
    doc.setFont('helvetica','bold');
    doc.text('Teléfono:', ML, y);
    doc.setFont('helvetica','normal');
    doc.text(cliente.tel || '-', ML + 60, y);
    
    doc.setFont('helvetica','bold');
    doc.text('Email:', pw - MR - 250, y);
    doc.setFont('helvetica','normal');
    doc.text(cliente.mail || '-', pw - MR - 210, y);

    y += 16;
    doc.setDrawColor(...C_LINE);
    doc.line(ML, y, pw - MR, y);

    // ========== BADGE DE PROMO ==========
    if (tienePromos && ahorroTotal > 0) {
      y += 14;
      const badgeH = 24;
      doc.setFillColor(255, 250, 250);
      doc.setDrawColor(...C_PROMO);
      doc.setLineWidth(1);
      doc.roundedRect(ML, y - 6, pw - ML - MR, badgeH, 4, 4, 'FD');
      
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_PROMO);
      doc.text('🎉 COMPRA CON DESCUENTO', ML + 10, y + 6);
      doc.text(`Ahorrás: ${fmtGs(ahorroTotal)}`, pw - MR - 10, y + 6, { align: 'right' });
      
      y += badgeH + 4;
    }

    // ========== TABLA ==========
    y += 16;
    
    const tableItems = items.length ? items : [{ titulo:'Producto/Servicio', cantidad:1, precio: totalUse }];
    const body = tableItems.map(it => {
      const titulo = it.titulo || 'Item';
      const tienePromo = it.tienePromo;
      const descuento = tienePromo ? Math.round(it.descuentoPorcentaje || 0) : 0;
      
      const tituloDisplay = tienePromo ? `${titulo} (${descuento}% OFF)` : titulo;
      
      const precioOrig = Number(it.precioOriginal || it.precio);
      const precioFinal = tienePromo ? Number(it.precio) : precioOrig;
      const precioStr = tienePromo 
        ? `${new Intl.NumberFormat('es-PY').format(precioOrig)} → ${new Intl.NumberFormat('es-PY').format(precioFinal)}`
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
      startY: y,
      margin: { left: ML, right: MR },
      styles: { 
        fontSize: 9, 
        cellPadding: 7,
        textColor: C_TXT,
        lineColor: C_LINE,
        lineWidth: 0.5
      },
      headStyles: { 
        fillColor: C_BRAND, 
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9.5
      },
      columnStyles: { 
        0: { cellWidth: 'auto' },
        1: { halign: 'center', cellWidth: 50 }, 
        2: { halign: 'right', cellWidth: 120 }, 
        3: { halign: 'right', cellWidth: 100 } 
      },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      theme: 'grid'
    });

    // ========== TOTALES ==========
    y = doc.lastAutoTable.finalY + 20;
    
    const totW = 240;
    const totX = pw - MR - totW;
    
    doc.setFillColor(248, 248, 248);
    doc.setDrawColor(...C_LINE);
    doc.roundedRect(totX, y - 8, totW, 80, 4, 4, 'FD');
    
    y += 4;
    
    // Subtotal
    doc.setFont('helvetica','normal').setFontSize(9.5).setTextColor(...C_GRAY);
    doc.text('Subtotal (Base):', totX + 12, y);
    doc.text(new Intl.NumberFormat('es-PY').format(subBase) + ' Gs', totX + totW - 12, y, { align: 'right' });
    
    y += 18;
    doc.text('IVA 10%:', totX + 12, y);
    doc.text(new Intl.NumberFormat('es-PY').format(iva10) + ' Gs', totX + totW - 12, y, { align: 'right' });
    
    // Separador
    y += 10;
    doc.setDrawColor(...C_LINE);
    doc.line(totX + 12, y, totX + totW - 12, y);
    
    // Total
    y += 16;
    doc.setFont('helvetica','bold').setFontSize(12).setTextColor(...C_BRAND);
    doc.text('TOTAL:', totX + 12, y);
    doc.text(new Intl.NumberFormat('es-PY').format(totalUse) + ' Gs', totX + totW - 12, y, { align: 'right' });

    // Forma de pago
    y += 28;
    doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_TXT);
    doc.text('Forma de pago:', ML, y);
    doc.setFont('helvetica','normal').setTextColor(...C_GRAY);
    const fpTexto = metodo === 'transferencia' ? 'Transferencia bancaria' :
                    metodo === 'efectivo' ? 'Efectivo' : 'Tarjeta de crédito';
    doc.text(fpTexto, ML + 90, y);

    // ========== FOOTER CON QR ==========
    const footerY = ph - 160;
    
    doc.setDrawColor(...C_LINE);
    doc.line(ML, footerY, pw - MR, footerY);
    
    try {
      const qrData = await toDataURL(QR_SRC);
      const qrSize = 100;
      const qrX = ML + 10;
      const qrY = footerY + 20;
      
      doc.setDrawColor(...C_LINE);
      doc.rect(qrX - 1, qrY - 1, qrSize + 2, qrSize + 2);
      doc.addImage(qrData, 'PNG', qrX, qrY, qrSize, qrSize);
      
      // Indicador CDC
      doc.setFillColor(50, 115, 220);
      doc.rect(qrX + qrSize - 20, qrY + qrSize - 8, 20, 8, 'F');
      doc.rect(qrX + qrSize - 8, qrY + qrSize - 20, 8, 20, 'F');

      // Texto informativo
      const txtX = qrX + qrSize + 30;
      let txtY = qrY + 12;
      
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_TXT);
      doc.text('Validez del documento', txtX, txtY);
      
      txtY += 16;
      doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...C_GRAY);
      doc.text('Este documento es una representación gráfica', txtX, txtY);
      txtY += 11;
      doc.text('de una factura electrónica (simulada).', txtX, txtY);
      txtY += 11;
      doc.text('Uso demostrativo.', txtX, txtY);
      
      if (tienePromos) {
        txtY += 16;
        doc.setFont('helvetica','bold').setFontSize(8).setTextColor(...C_PROMO);
        doc.text('✓ Compra con descuentos aplicados', txtX, txtY);
      }
      
      txtY += 16;
      doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(...C_LIGHT);
      doc.text(`© ${new Date().getFullYear()} ${EMP.nombre} - Todos los derechos reservados`, txtX, txtY);
      
    } catch (err) {
      console.error('Error al cargar QR:', err);
    }

    doc.save(`Factura_${EMP.nombre}_${nroFactura}.pdf`);
  }

})();