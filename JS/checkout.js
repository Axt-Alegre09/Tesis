// JS/checkout.js
(function () {
  const form = document.getElementById('checkout-form');
  const panels = document.querySelectorAll('.metodo-panel');
  const success = document.getElementById('checkout-success');

  const inputFile = document.getElementById('comprobante');
  const efectivoMonto = document.getElementById('efectivo-monto');
  const efectivoTotalEl = document.getElementById('efectivo-total');

  // ===== Helpers =====
  function formatearGs(n) {
    return new Intl.NumberFormat('es-PY').format(Number(n || 0)) + ' Gs';
  }
  function getCart() {
    try { return JSON.parse(localStorage.getItem('productos-en-carrito')) || []; }
    catch { return []; }
  }
  function cartTotal() {
    const cart = getCart();
    return cart.reduce((acc, p) => acc + Number(p.precio) * Number(p.cantidad || 1), 0);
  }
  function luhnCheck(numStr) {
    const digits = (numStr || '').replace(/\D/g, '');
    let sum = 0, shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let d = parseInt(digits[i], 10);
      if (shouldDouble) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
      shouldDouble = !shouldDouble;
    }
    return (sum % 10) === 0 && digits.length >= 13 && digits.length <= 19;
  }
  function normalizeCard(num) {
    return (num || '').replace(/\D/g, '').slice(0, 19);
  }
  function formatCardInput(value) {
    const v = normalizeCard(value);
    return v.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  // ===== Simulador de tarjeta =====
  // Números de prueba -> escenarios
  const CARD_TESTS = {
    '4111111111111111': 'APPROVED',
    '4999999999990000': 'NOT_FOUND',
    '4999999999990001': 'NO_FUNDS',
    '4999999999990002': 'BLOCKED'
  };
  function simulateCardCharge({ number, exp, cvv, amount }) {
    const now = new Date();
    const m = /^(\d{2})\/(\d{2})$/.exec(exp || '');
    if (!m) return { ok: false, code: 'INVALID_EXP', msg: 'Vencimiento inválido (usa MM/AA).' };
    const mm = Number(m[1]), yy = 2000 + Number(m[2]);
    if (mm < 1 || mm > 12) return { ok: false, code: 'INVALID_EXP', msg: 'Mes inválido.' };
    const endOfMonth = new Date(yy, mm, 0, 23, 59, 59, 999);
    if (endOfMonth < now) return { ok: false, code: 'EXPIRED', msg: 'La tarjeta está vencida.' };

    if (!/^\d{3,4}$/.test(cvv || '')) return { ok: false, code: 'INVALID_CVV', msg: 'CVV inválido.' };

    const cleaned = normalizeCard(number);
    if (!luhnCheck(cleaned)) return { ok: false, code: 'INVALID_LUHN', msg: 'Número de tarjeta inválido.' };

    const scenario = CARD_TESTS[cleaned] || 'APPROVED';
    if (scenario === 'NOT_FOUND')  return { ok: false, code: 'NOT_FOUND', msg: 'Tarjeta inexistente.' };
    if (scenario === 'NO_FUNDS')   return { ok: false, code: 'NO_FUNDS',  msg: 'Saldo insuficiente.' };
    if (scenario === 'BLOCKED')    return { ok: false, code: 'BLOCKED',   msg: 'Tarjeta bloqueada.' };

    if (amount <= 0) return { ok: false, code: 'ZERO_AMOUNT', msg: 'El total es 0.' };
    return { ok: true, code: 'APPROVED', msg: 'Pago aprobado.' };
  }

  // ===== UI: alternar paneles según método =====
  const radios = document.querySelectorAll('input[name="metodo"]');
  function showPanel(metodo) {
    panels.forEach(p => p.classList.toggle('disabled', p.dataset.metodo !== metodo));
    if (metodo === 'efectivo' && efectivoTotalEl) {
      efectivoTotalEl.value = formatearGs(cartTotal());
    }
  }
  radios.forEach(r => r.addEventListener('change', () => showPanel(r.value)));
  showPanel(document.querySelector('input[name="metodo"]:checked').value);

  // Enmascarar número de tarjeta al tipear
  const cardNumEl = document.getElementById('card-number');
  if (cardNumEl) {
    cardNumEl.addEventListener('input', (e) => {
      const before = e.target.value;
      e.target.value = formatCardInput(before);
      e.target.selectionStart = e.target.selectionEnd = e.target.value.length;
    });
  }

  // ===== Submit: Simular pago =====
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const metodo = document.querySelector('input[name="metodo"]:checked')?.value;
    const amount = cartTotal();

    if (amount <= 0) {
      alert('Tu carrito está vacío.');
      return;
    }

    if (metodo === 'transferencia') {
      if (!inputFile || !inputFile.files || inputFile.files.length === 0) {
        alert('Por favor, subí el comprobante (PDF o imagen).');
        return;
      }
      const file = inputFile.files[0];
      if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) {
        alert('Formato no admitido. Usa PDF o imagen (png/jpg/webp).');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('El archivo supera 10MB.');
        return;
      }
      alert('Comprobante recibido. Pedido en proceso. ¡Gracias!');
      finalizeSuccess();
      return;
    }

    if (metodo === 'tarjeta') {
      const name = document.getElementById('card-name')?.value?.trim();
      const number = document.getElementById('card-number')?.value || '';
      const exp = document.getElementById('card-exp')?.value?.trim();
      const cvv = document.getElementById('card-cvv')?.value?.trim();

      if (!name) { alert('Ingresá el nombre tal como figura en la tarjeta.'); return; }

      const res = simulateCardCharge({ number, exp, cvv, amount });

      if (!res.ok) {
        alert(`Pago rechazado: ${res.msg}`);
        return;
      }

      alert('Pago aprobado. ¡Gracias por tu compra!');
      finalizeSuccess();
      return;
    }

    if (metodo === 'efectivo') {
      const cash = Number(efectivoMonto?.value || 0);
      if (isNaN(cash) || cash <= 0) {
        alert('Ingresá el monto con el que vas a pagar.');
        return;
      }
      if (cash < amount) {
        alert(`El monto ingresado (${formatearGs(cash)}) no alcanza. Total: ${formatearGs(amount)}.`);
        return;
      }
      const change = cash - amount;
      alert(`Pedido confirmado. Vuelto: ${formatearGs(change)}. ¡Gracias!`);
      finalizeSuccess();
      return;
    }

    alert('Seleccioná un método de pago.');
  });

  function finalizeSuccess() {
    try { localStorage.removeItem('productos-en-carrito'); } catch {}
    form.classList.add('disabled');
    success.classList.remove('disabled');
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
})();
