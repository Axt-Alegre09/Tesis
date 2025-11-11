// JS/checkout.js - VERSIÓN CON GUARDAR CARRITO EN localStorage
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
  form?.addEventListener("submit", (e) => {
    e.preventDefault();

    const metodo = document.querySelector('input[name="metodo"]:checked')?.value;
    const { total, source, items } = getCheckoutData();

    // ⭐ GUARDAR CARRITO EN localStorage ANTES DE NAVEGAR
    try {
      const cartToSave = {
        items: items || [],
        total: total || 0
      };
      localStorage.setItem("carrito", JSON.stringify(cartToSave));
      console.log("✅ Carrito guardado en localStorage:", cartToSave);
    } catch (err) {
      console.warn("⚠️ Error guardando carrito en localStorage:", err);
    }

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
      // ✅ VERIFICAR SI HAY TARJETA GUARDADA SELECCIONADA
      const tarjetaSeleccionada = document.querySelector('input[name="tarjeta-guardada"]:checked');
      
      if (tarjetaSeleccionada) {
        // ✅ Tarjeta guardada seleccionada - Sin validación, solo simular
        console.log('✅ Tarjeta guardada seleccionada - Procesando...');
        alert('Pago aprobado. ¡Gracias por tu compra!');
        finalizeSuccess('tarjeta', { number: 'guardada' });
        return;
      }

      // ❌ Si no hay tarjeta guardada, validar campos manuales
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

  // ========== FACTURA PDF ESTILO STARSOFT ==========
  async function generateInvoicePDF(snapshot) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

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
      nombre: 'Paniquiños',
      actividad: 'Panadería',
      direccion: 'Avda Sabor 1500',
      telefono: 'Tel: +595 992544305',
      ruc: '800260001-4',
      timbrado: '15181564',
      vigencia: '20/10/2021',
      logo: 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/paniquinos.png'
    };
    const QR_SRC = 'https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/QrGenerico.jpg';

    // Datos
    const snap = snapshot || loadFacturaSnapshot() || {};
    const metodo = snap.metodo || 'efectivo';
    const cliente = snap.cliente || collectClienteFromForm();
    const data = getCheckoutData();
    const items = (snap.items && snap.items.length ? snap.items : data.items) || [];
    const totalUse = Number(snap.total ?? data.total ?? 0);

    // Promos
    const tienePromos = items.some(it => it.tienePromo);
    let totalSinDescuento = 0;
    if (tienePromos) {
      items.forEach(it => {
        const precioOrig = Number(it.precioOriginal || it.precio);
        totalSinDescuento += precioOrig * Number(it.cantidad || 1);
      });
    }
    const ahorroTotal = tienePromos ? (totalSinDescuento - totalUse) : 0;

    // Cálculos
    const iva10 = Math.round(totalUse / 11);
    const subBase = totalUse - iva10;
    const fecha = snap.fechaISO ? new Date(snap.fechaISO) : new Date();
    const fechaStr = fecha.toLocaleDateString('es-PY');
    const nroFactura = `001-001-${String(Math.floor(Math.random()*10000000)).padStart(7,'0')}`;
    
    // Generar CDC (simulado - 44 dígitos)
    const timestamp = Date.now().toString();
    const rucNum = EMP.ruc.replace(/-/g, '');
    const factNum = nroFactura.replace(/-/g, '');
    const cdc = `01${rucNum}${factNum}${timestamp}`.padEnd(44, '0').slice(0, 44);

    let y = M;

    // ========== HEADER CON BORDE (como Starsoft) ==========
    const headerH = 110;
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(1.5);
    doc.rect(M, y, pw - 2*M, headerH);

    // Logo
    try {
      const logoData = await toDataURL(EMP.logo);
      doc.addImage(logoData, 'PNG', M + 15, y + 15, 80, 80);
    } catch {}

    // Título centrado
    const centerX = M + 110;
    let ty = y + 25;
    doc.setFont('helvetica','bold').setFontSize(14).setTextColor(...C_TXT);
    doc.text('KuDE de FACTURA ELECTRÓNICA', centerX, ty);

    ty += 20;
    doc.setFont('helvetica','bold').setFontSize(12);
    doc.text(EMP.nombre, centerX, ty);

    ty += 16;
    doc.setFont('helvetica','normal').setFontSize(9);
    doc.text(EMP.actividad, centerX, ty);

    ty += 14;
    doc.text(EMP.direccion, centerX, ty);

    ty += 14;
    doc.text(EMP.telefono, centerX, ty);

    // Info fiscal (derecha)
    const rightX = pw - M - 15;
    let ry = y + 15;
    
    doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_TXT);
    doc.text('RUC :', pw - M - 120, ry);
    doc.setFont('helvetica','normal');
    doc.text(EMP.ruc, rightX, ry, { align: 'right' });

    ry += 14;
    doc.setFont('helvetica','bold');
    doc.text('Timbrado', pw - M - 120, ry);
    doc.setFont('helvetica','normal');
    doc.text(EMP.timbrado, rightX, ry, { align: 'right' });

    ry += 14;
    doc.setFont('helvetica','bold');
    doc.text('Inicio de', pw - M - 120, ry);
    doc.setFont('helvetica','normal');
    doc.text(EMP.vigencia, rightX, ry, { align: 'right' });

    ry += 18;
    doc.setFont('helvetica','bold').setFontSize(10);
    doc.text('FACTURA ELECTRÓNICA', rightX, ry, { align: 'right' });

    ry += 14;
    doc.setFont('helvetica','bold').setFontSize(11);
    doc.text(nroFactura, rightX, ry, { align: 'right' });

    // ========== DATOS DEL CLIENTE CON BORDE ==========
    y += headerH + 10;
    const clienteH = 50;
    
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(1);
    doc.rect(M, y, pw - 2*M, clienteH);

    let cy = y + 16;
    doc.setFont('helvetica','bold').setFontSize(9).setTextColor(...C_TXT);
    doc.text('Fecha y hora de', M + 10, cy);
    doc.setFont('helvetica','normal');
    doc.text(fechaStr, M + 90, cy);

    doc.setFont('helvetica','bold');
    doc.text('Condición de venta:', pw - M - 200, cy);
    doc.setFont('helvetica','normal');
    const condicion = metodo === 'transferencia' ? 'Contado' : metodo === 'efectivo' ? 'Efectivo' : 'Crédito';
    doc.text(condicion, pw - M - 90, cy);

    cy += 14;
    doc.setFont('helvetica','bold');
    doc.text('RUC/documento de identidad No:', M + 10, cy);
    doc.setFont('helvetica','normal');
    doc.text(cliente.ruc || '-', M + 165, cy);

    doc.setFont('helvetica','bold');
    doc.text('Cuotas:', pw - M - 200, cy);
    doc.setFont('helvetica','normal');
    doc.text('1', pw - M - 90, cy);

    cy += 14;
    doc.setFont('helvetica','bold');
    doc.text('Nombre o razón social:', M + 10, cy);
    doc.setFont('helvetica','normal');
    doc.text(cliente.razon || '-', M + 140, cy);

    doc.setFont('helvetica','bold');
    doc.text('Moneda:', pw - M - 200, cy);
    doc.setFont('helvetica','normal');
    doc.text('Guaraní', pw - M - 90, cy);

    // ========== TABLA ESTILO STARSOFT CON COLUMNAS CUADRADAS ==========
    y += clienteH + 10;

    const tableData = items.map(it => {
      const titulo = it.titulo || 'Producto';
      const tienePromo = it.tienePromo;
      const descuento = tienePromo ? Math.round(it.descuentoPorcentaje || 0) : 0;
      const tituloDisplay = tienePromo ? `${titulo} (${descuento}% OFF)` : titulo;
      
      const precioOrig = Number(it.precioOriginal || it.precio);
      const precioFinal = Number(it.precio);
      const cantidad = Number(it.cantidad || 1);
      
      // Formatear números correctamente
      const formatter = new Intl.NumberFormat('es-PY', { 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        useGrouping: true
      });
      
      const precioStr = formatter.format(precioFinal);
      const subtotalNum = precioFinal * cantidad;
      const subtotalStr = formatter.format(subtotalNum) + ',';
      
      return [
        String(cantidad),
        tituloDisplay,
        precioStr,
        '',
        '0.0',
        '0.0',
        subtotalStr
      ];
    });

    // ========== ANCHOS PERFECTAMENTE CUADRADOS ==========
    // Total disponible: 595pt - 60pt (márgenes) = 535pt
    // Distribución: 50 + 175 + 85 + 70 + 55 + 45 + 55 = 535pt ✓
    
    doc.autoTable({
      head: [['Cantida', 'Descripción', 'Precio unitario', 'Descuento', 'Exentas', '5%', '10%']],
      body: tableData,
      startY: y,
      margin: { left: M, right: M },
      tableWidth: 'auto',  // Permite que las columnas usen cellWidth exactos
      styles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: C_TXT,
        lineColor: C_BORDER,
        lineWidth: 1,
        overflow: 'linebreak',  // Permite wrap en textos largos
        halign: 'left',
        font: 'helvetica',
        minCellHeight: 20,
        valign: 'middle'
      },
      headStyles: {
        fillColor: C_HEADER_BG,
        textColor: C_TXT,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
        minCellHeight: 20,
        valign: 'middle'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 50 },    // Cantida: 50pt
        1: { halign: 'left', cellWidth: 175 },     // Descripción: 175pt
        2: { halign: 'right', cellWidth: 85 },     // Precio unitario: 85pt
        3: { halign: 'center', cellWidth: 70 },    // Descuento: 70pt
        4: { halign: 'right', cellWidth: 55 },     // Exentas: 55pt
        5: { halign: 'right', cellWidth: 45 },     // 5%: 45pt
        6: { halign: 'right', cellWidth: 55 }      // 10%: 55pt (CORREGIDO)
      },
      theme: 'grid'
    });

    // ========== TOTALES DENTRO DE LA TABLA ==========
    y = doc.lastAutoTable.finalY;
    
    // Función para convertir números a texto
    function numeroATexto(num) {
      if (num === 0) return 'CERO';
      if (num >= 1000000) return 'UN MILLON O MAS';
      
      const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
      const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
      const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
      const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
      
      if (num < 10) return unidades[num];
      if (num < 20) return especiales[num - 10];
      if (num < 100) {
        const dec = Math.floor(num / 10);
        const uni = num % 10;
        if (dec === 2 && uni > 0) return 'VEINTI' + unidades[uni];
        return decenas[dec] + (uni ? ' Y ' + unidades[uni] : '');
      }
      if (num < 1000) {
        const cen = Math.floor(num / 100);
        const resto = num % 100;
        return (num === 100 ? 'CIEN' : centenas[cen]) + (resto ? ' ' + numeroATexto(resto) : '');
      }
      if (num < 1000000) {
        const miles = Math.floor(num / 1000);
        const resto = num % 1000;
        const textoMiles = miles === 1 ? 'MIL' : numeroATexto(miles) + ' MIL';
        return textoMiles + (resto ? ' ' + numeroATexto(resto) : '');
      }
      return 'MONTO MAYOR';
    }
    
    const totalEnLetras = numeroATexto(Math.floor(totalUse)) + ' GUARANIES';
    
    const formatter = new Intl.NumberFormat('es-PY', { 
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    });
    
    const totalsData = [
      ['SUBTOTAL:', '', '', '', '', '', formatter.format(subBase) + ',00'],
      ['TOTAL DE LA', '', '', '', '', '', formatter.format(totalUse) + ',00'],
      ['TOTAL EN GUARANIES:', totalEnLetras, '', '', '', '', formatter.format(totalUse) + ',00'],
      ['LIQUIDACION IVA:', '5%', '0,00', '10%', formatter.format(iva10), 'TOTAL IVA', formatter.format(iva10)]
    ];

    doc.autoTable({
      body: totalsData,
      startY: y,
      margin: { left: M, right: M },
      tableWidth: 'auto',  // Usar mismo sistema
      styles: {
        fontSize: 9,
        cellPadding: 5,
        textColor: C_TXT,
        lineColor: C_BORDER,
        lineWidth: 1,
        overflow: 'linebreak',
        valign: 'middle',
        font: 'helvetica',
        minCellHeight: 20
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 110, halign: 'left' },   // Label
        1: { cellWidth: 130, halign: 'left' },                      // Texto/5%
        2: { halign: 'right', cellWidth: 60 },                      // 0,00
        3: { cellWidth: 50, halign: 'left' },                       // 10%
        4: { halign: 'right', cellWidth: 70 },                      // Valor IVA
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 60 },   // TOTAL IVA
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 55 }    // Valor final (CORREGIDO: 55pt)
      },
      theme: 'grid'
    });

    // Badge de promo si aplica
    if (tienePromos && ahorroTotal > 0) {
      y = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica','bold').setFontSize(9).setTextColor(220, 38, 38);
      doc.text(`✓ Compra con descuentos aplicados - Ahorraste: ${fmtGs(ahorroTotal)}`, M + 10, y);
    }

    // ========== FOOTER CON CDC ==========
    y = doc.lastAutoTable.finalY + 20;
    
    const footerBoxH = 155;
    doc.setDrawColor(...C_BORDER);
    doc.setLineWidth(1);
    doc.rect(M, y, pw - 2*M, footerBoxH);

    // QR
    try {
      const qrData = await toDataURL(QR_SRC);
      doc.addImage(qrData, 'PNG', M + 15, y + 15, 100, 100);
      
      // Indicador CDC
      doc.setFillColor(50, 115, 220);
      doc.rect(M + 95, y + 105, 20, 10, 'F');
      doc.rect(M + 105, y + 95, 10, 20, 'F');
    } catch {}

    // Texto CDC
    const cdcX = M + 130;
    let cdcY = y + 22;
    
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(...C_TXT);
    const maxWidth = pw - 2*M - 145;
    doc.text('Consulte la validez de esta Factura Electrónica con el número de CDC', cdcX, cdcY);
    
    cdcY += 16;
    doc.setFont('helvetica','normal').setFontSize(9).setTextColor(0, 0, 255);
    doc.textWithLink('https://ekuatia.set.gov.py/consultas/', cdcX, cdcY, { url: 'https://ekuatia.set.gov.py/consultas/' });
    
    cdcY += 22;
    doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...C_TXT);
    // Dividir CDC en grupos de 10 para mejor legibilidad
    const cdcPart1 = cdc.substring(0, 10);
    const cdcPart2 = cdc.substring(10, 20);
    const cdcPart3 = cdc.substring(20, 30);
    const cdcPart4 = cdc.substring(30, 40);
    const cdcPart5 = cdc.substring(40, 44);
    const cdcFormatted = `${cdcPart1} ${cdcPart2} ${cdcPart3} ${cdcPart4} ${cdcPart5}`;
    doc.text(cdcFormatted, cdcX, cdcY);
    
    cdcY += 20;
    doc.setFont('helvetica','bold').setFontSize(9);
    doc.text('ESTE DOCUMENTO ES UNA REPRESENTACIÓN GRÁFICA DE UN DOCUMENTO', cdcX, cdcY);
    
    cdcY += 16;
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(...C_GRAY);
    const warningText = 'Si su documento electrónico presenta algún error, podrá solicitar la modificación dentro de las 72 horas';
    doc.text(warningText, cdcX, cdcY);
    cdcY += 10;
    doc.text('siguientes de la emisión', cdcX, cdcY);

    doc.save(`Factura_${EMP.nombre}_${nroFactura}.pdf`);
  }

})();