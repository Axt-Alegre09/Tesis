// JS/checkout.js - VERSIÓN COMPATIBLE CON FLUJO ORIGINAL + TARJETAS GUARDADAS
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
      alert('El carrito está vacío');
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
      // ✅ VERIFICAR SI HAY TARJETA GUARDADA SELECCIONADA (usando función de checkout-tarjetas.js)
      const tarjetaGuardadaId = window.getTarjetaGuardadaSeleccionada ? window.getTarjetaGuardadaSeleccionada() : null;
      
      if (tarjetaGuardadaId) {
        // ✅ Tarjeta guardada seleccionada - SIN VALIDACIÓN, directo al pago
        console.log('✅ Pago con tarjeta guardada - Sin validación');
        alert('Pago aprobado. ¡Gracias por tu compra!');
        finalizeSuccess('tarjeta', { number: 'guardada' });
        return;
      }

      // ❌ Si NO hay tarjeta guardada, validar campos manuales (FLUJO ORIGINAL)
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

  // --------- Éxito + Factura (TU FLUJO ORIGINAL) ---------
  function finalizeSuccess(metodo, extra = {}) {
    const snap = saveFacturaSnapshot({ metodo, extra });

    console.log('🧹 Limpiando carrito después del pago...');

    Promise.resolve()
      .then(() => window.CartAPI?.empty?.())
      .catch(() => {})
      .finally(() => {
        // Limpiar todos los storages
        try { 
          localStorage.removeItem('productos-en-carrito'); 
          localStorage.removeItem('carrito');
          console.log('✅ localStorage limpiado');
        } catch {}

        try {
          sessionStorage.removeItem('carrito');
          sessionStorage.removeItem('productos-en-carrito');
          console.log('✅ sessionStorage limpiado');
        } catch {}

        // Mostrar sección de éxito (TU FLUJO ORIGINAL)
        form.classList.add('disabled');
        success.classList.remove('disabled');
        success.scrollIntoView({ behavior: 'smooth', block: 'start' });

        if (btnFactura) btnFactura.onclick = () => generateInvoicePDF(snap || loadFacturaSnapshot());
        
        try { window.CartAPI?.refreshBadge?.(); } catch {}

        console.log('✅ Carrito limpiado y sección de éxito mostrada');
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

  // ========== RESTO DE TU CÓDIGO DE FACTURA PDF (sin cambios) ==========
  async function generateInvoicePDF(snapshot) {
    // ... tu código completo de generación de PDF ...
    // (lo dejo igual, es muy largo para copiar aquí)
  }

})();