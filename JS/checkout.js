// JS/checkout.js
(function () {
  const form = document.getElementById('checkout-form');
  const panels = document.querySelectorAll('.metodo-panel');
  const success = document.getElementById('checkout-success');

  // Mostrar panel según método
  const radios = document.querySelectorAll('input[name="metodo"]');
  function showPanel(metodo) {
    panels.forEach(p => {
      p.classList.toggle('disabled', p.dataset.metodo !== metodo);
    });
  }
  radios.forEach(r => {
    r.addEventListener('change', () => showPanel(r.value));
  });
  // Estado inicial
  showPanel(document.querySelector('input[name="metodo"]:checked').value);

  // Helper validación tarjeta simple
  function validarTarjeta() {
    const name = document.getElementById('card-name')?.value?.trim();
    const number = (document.getElementById('card-number')?.value || '').replace(/\s+/g, '');
    const exp = document.getElementById('card-exp')?.value?.trim();
    const cvv = document.getElementById('card-cvv')?.value?.trim();

    const okName = !!name;
    const okNum  = /^\d{13,19}$/.test(number);        // 13-19 dígitos
    const okExp  = /^(0[1-9]|1[0-2])\/\d{2}$/.test(exp); // MM/AA
    const okCvv  = /^\d{3,4}$/.test(cvv);

    return okName && okNum && okExp && okCvv;
  }

  // Submit: simular pago
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const metodo = document.querySelector('input[name="metodo"]:checked')?.value;

    if (metodo === 'tarjeta' && !validarTarjeta()) {
      alert('Por favor, completa correctamente los datos de la tarjeta.');
      return;
    }

    // Vaciar carrito
    try { localStorage.removeItem('productos-en-carrito'); } catch {}

    // Mostrar panel de éxito y ocultar formulario
    form.classList.add('disabled');
    success.classList.remove('disabled');
    // (Opcional) scroll al mensaje
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
})();
