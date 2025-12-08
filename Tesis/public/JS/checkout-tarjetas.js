// JS/checkout-tarjetas.js - VERSIÓN CON PAGO SIMPLIFICADO Y POPUP
// Script para cargar tarjetas guardadas y manejar pago simplificado

import { supabase } from './ScriptLogin.js';

console.log("✓ checkout-tarjetas.js cargado (con pago simplificado)");

let tarjetaSeleccionada = null;

// ============================================================================
// POPUP DE CONFIRMACIÓN PROFESIONAL
// ============================================================================

function mostrarPopupConfirmacion(datosPedido) {
  // Crear overlay
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease;
  `;

  // Crear popup
  const popup = document.createElement('div');
  popup.className = 'popup-confirmacion';
  popup.style.cssText = `
    background: white;
    border-radius: 20px;
    padding: 3rem;
    max-width: 500px;
    width: 90%;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    animation: slideUp 0.4s ease;
    position: relative;
  `;

  // Contenido del popup
  popup.innerHTML = `
    <div style="margin-bottom: 1.5rem;">
      <div style="
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        animation: scaleIn 0.5s ease;
      ">
        <i class="bi bi-check-lg" style="font-size: 3rem; color: white;"></i>
      </div>
    </div>
    
    <h2 style="
      font-size: 1.8rem;
      font-weight: 700;
      color: #333;
      margin-bottom: 0.5rem;
    ">
      ¡Pago Confirmado!
    </h2>
    
    <p style="
      font-size: 1.1rem;
      color: #666;
      margin-bottom: 2rem;
    ">
      Tu pedido ha sido procesado exitosamente
    </p>
    
    <div style="
      background: #f8f9fa;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      text-align: left;
    ">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
        <span style="color: #666; font-weight: 500;">Pedido #</span>
        <span style="color: #333; font-weight: 600;">${datosPedido.pedidoId || 'N/A'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
        <span style="color: #666; font-weight: 500;">Total</span>
        <span style="color: #333; font-weight: 600;">${new Intl.NumberFormat('es-PY').format(datosPedido.total)} Gs</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span style="color: #666; font-weight: 500;">Método</span>
        <span style="color: #333; font-weight: 600;">${datosPedido.metodo}</span>
      </div>
    </div>
    
    <button id="btn-cerrar-popup" style="
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      padding: 1rem 2.5rem;
      font-size: 1.1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease;
      width: 100%;
      margin-bottom: 1rem;
    "
    onmouseover="this.style.transform='scale(1.02)'"
    onmouseout="this.style.transform='scale(1)'">
      Continuar
    </button>
    
    <button id="btn-ver-pedidos" style="
      background: transparent;
      color: #667eea;
      border: 2px solid #667eea;
      border-radius: 12px;
      padding: 1rem 2.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      width: 100%;
    "
    onmouseover="this.style.background='#667eea'; this.style.color='white'"
    onmouseout="this.style.background='transparent'; this.style.color='#667eea'">
      Ver mis pedidos
    </button>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Eventos de botones
  document.getElementById('btn-cerrar-popup').addEventListener('click', () => {
    overlay.remove();
    window.location.href = 'index.html';
  });

  document.getElementById('btn-ver-pedidos').addEventListener('click', () => {
    overlay.remove();
    window.location.href = 'mispedidos.html'; // Ajusta la URL según tu proyecto
  });

  // Cerrar al hacer clic fuera
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
      window.location.href = 'index.html';
    }
  });
}

// Agregar animaciones CSS
const estilosAnimaciones = document.createElement('style');
estilosAnimaciones.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(30px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes scaleIn {
    0% {
      transform: scale(0);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;
document.head.appendChild(estilosAnimaciones);

// ============================================================================
// CARGAR TARJETAS GUARDADAS
// ============================================================================

async function cargarTarjetasGuardadas() {
  const container = document.getElementById('tarjetas-guardadas-container');
  const lista = document.getElementById('lista-tarjetas-guardadas');
  
  if (!container || !lista) {
    console.log('Contenedor de tarjetas no encontrado');
    return;
  }

  try {
    // Obtener usuario actual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log('Usuario no autenticado');
      return;
    }

    // Obtener tarjetas del usuario
    const { data: tarjetas, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('usuario_id', user.id)
      .order('es_predeterminada', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error al cargar tarjetas:', error);
      return;
    }

    if (!tarjetas || tarjetas.length === 0) {
      container.style.display = 'none';
      return;
    }

    // Mostrar container y renderizar tarjetas
    container.style.display = 'block';
    lista.innerHTML = tarjetas.map((tarjeta, index) => crearTarjetaCheckoutHTML(tarjeta, index === 0)).join('');

    // Agregar eventos a las tarjetas
    document.querySelectorAll('.tarjeta-guardada-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        seleccionarTarjeta(id, tarjetas);
      });
    });

    // Preseleccionar la primera tarjeta (predeterminada o más reciente)
    if (tarjetas.length > 0) {
      seleccionarTarjeta(tarjetas[0].id, tarjetas);
    }

  } catch (error) {
    console.error('Error en cargarTarjetasGuardadas:', error);
  }
}

// Crear HTML de tarjeta para checkout
function crearTarjetaCheckoutHTML(tarjeta, isFirst) {
  const tipo = obtenerTipoTarjeta(tarjeta.numero_tarjeta);
  const ultimos4 = tarjeta.numero_tarjeta.slice(-4);
  
  return `
    <div class="tarjeta-guardada-item ${isFirst ? 'selected' : ''}" data-id="${tarjeta.id}">
      <div class="tarjeta-guardada-content">
        <div class="tarjeta-tipo-badge ${tipo.clase}">
          ${tipo.icono} ${tipo.nombre}
        </div>
        <div class="tarjeta-numero-display">
          •••• •••• •••• ${ultimos4}
        </div>
        <div class="tarjeta-info-small">
          ${tarjeta.nombre_titular} • ${tarjeta.mes_vencimiento}/${tarjeta.anio_vencimiento}
        </div>
      </div>
      <div class="tarjeta-check">
        <i class="bi bi-check-circle-fill"></i>
      </div>
    </div>
  `;
}

// Obtener tipo de tarjeta
function obtenerTipoTarjeta(numero) {
  const primerDigito = numero.charAt(0);
  const primerosDosDigitos = numero.substring(0, 2);
  
  if (primerDigito === '4') {
    return { 
      nombre: 'Visa', 
      clase: 'visa',
      icono: '<i class="bi bi-credit-card-2-front"></i>'
    };
  } else if (['51', '52', '53', '54', '55'].includes(primerosDosDigitos)) {
    return { 
      nombre: 'Mastercard', 
      clase: 'mastercard',
      icono: '<i class="bi bi-credit-card"></i>'
    };
  } else if (['34', '37'].includes(primerosDosDigitos)) {
    return { 
      nombre: 'Amex', 
      clase: 'amex',
      icono: '<i class="bi bi-credit-card-2-back"></i>'
    };
  } else {
    return { 
      nombre: 'Tarjeta', 
      clase: 'otra',
      icono: '<i class="bi bi-credit-card"></i>'
    };
  }
}

// Seleccionar tarjeta
function seleccionarTarjeta(id, tarjetas) {
  // Quitar selección de todas
  document.querySelectorAll('.tarjeta-guardada-item').forEach(item => {
    item.classList.remove('selected');
  });

  // Seleccionar la clickeada
  const item = document.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.classList.add('selected');
  }

  // Guardar tarjeta seleccionada
  tarjetaSeleccionada = tarjetas.find(t => t.id === id);
  
  // Limpiar campos del formulario de nueva tarjeta
  const cardName = document.getElementById('card-name');
  const cardNumber = document.getElementById('card-number');
  const cardExp = document.getElementById('card-exp');
  const cardCvv = document.getElementById('card-cvv');
  
  if (cardName) cardName.value = '';
  if (cardNumber) cardNumber.value = '';
  if (cardExp) cardExp.value = '';
  if (cardCvv) cardCvv.value = '';

  console.log('✓ Tarjeta seleccionada:', tarjetaSeleccionada);
}

// ============================================================================
// PROCESAMIENTO DE PAGO SIMPLIFICADO
// ============================================================================

async function procesarPagoConTarjetaGuardada(event) {
  event.preventDefault();
  
  const metodoRadio = document.querySelector('input[name="metodo"]:checked');
  const metodoSeleccionado = metodoRadio ? metodoRadio.value : 'transferencia';
  
  // Si el método es tarjeta Y hay una tarjeta guardada seleccionada
  if (metodoSeleccionado === 'tarjeta' && tarjetaSeleccionada) {
    console.log('🚀 Procesando pago con tarjeta guardada...');
    
    try {
      // Obtener datos del carrito
      const cartData = obtenerCarrito();
      if (!cartData || cartData.total === 0) {
        alert('El carrito está vacío');
        return;
      }

      // Obtener usuario
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        alert('Debes iniciar sesión');
        window.location.href = 'login.html';
        return;
      }

      // Obtener datos del formulario
      const formData = obtenerDatosFormulario();
      
      // Construir payload para el pedido
      const payload = {
        items: cartData.items.map(item => ({
          id: item.id,
          precio: Number(item.precio),
          cantidad: Number(item.cantidad),
          nombre: item.titulo || item.nombre || "Sin nombre"
        })),
        total: Number(cartData.total),
        metodo_pago: 'tarjeta_guardada',
        tarjeta_id: tarjetaSeleccionada.id,
        tarjeta_ultimos4: tarjetaSeleccionada.numero_tarjeta.slice(-4),
        ...formData
      };

      // Crear pedido en la base de datos
      const { data, error } = await supabase.rpc("crear_pedido_desde_checkout", {
        p_usuario: user.id,
        p_checkout: payload
      });

      if (error) {
        console.error('Error al crear pedido:', error);
        throw error;
      }

      console.log('✅ Pedido creado exitosamente:', data);

      // Limpiar carrito
      localStorage.removeItem('carrito');
      sessionStorage.removeItem('carrito');
      localStorage.removeItem('productos-en-carrito');

      // Mostrar popup de confirmación
      mostrarPopupConfirmacion({
        pedidoId: data[0]?.pedido_id || 'Procesado',
        total: cartData.total,
        metodo: `Tarjeta •••• ${tarjetaSeleccionada.numero_tarjeta.slice(-4)}`
      });

    } catch (error) {
      console.error('❌ Error al procesar pago:', error);
      alert('Error al procesar el pago. Por favor intenta de nuevo.');
    }
    
    return; // Detener el procesamiento normal
  }
  
  // Si no es tarjeta guardada, dejar que pasarelaPagos.js maneje el resto
  console.log('Dejando que pasarelaPagos.js maneje el pago...');
}

// Obtener carrito
function obtenerCarrito() {
  const storedCartLocal = localStorage.getItem("carrito");
  if (storedCartLocal) {
    try {
      return JSON.parse(storedCartLocal);
    } catch (err) {
      console.warn("Error parseando localStorage:", err);
    }
  }

  const storedCart = sessionStorage.getItem("carrito");
  if (storedCart) {
    try {
      return JSON.parse(storedCart);
    } catch (err) {
      console.warn("Error parseando sessionStorage:", err);
    }
  }

  return null;
}

// Obtener datos del formulario
function obtenerDatosFormulario() {
  const form = document.querySelector("#checkout-form");
  if (!form) return {};

  const formData = new FormData(form);
  const data = {};

  for (let [key, value] of formData.entries()) {
    data[key] = value;
  }

  return data;
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

function inicializarEventosMetodoPago() {
  const radioTarjeta = document.querySelector('input[name="metodo"][value="tarjeta"]');
  
  if (radioTarjeta) {
    // Cargar tarjetas cuando se seleccione el método "tarjeta"
    radioTarjeta.addEventListener('change', (e) => {
      if (e.target.checked) {
        cargarTarjetasGuardadas();
      }
    });

    // Si ya está seleccionada, cargar inmediatamente
    if (radioTarjeta.checked) {
      cargarTarjetasGuardadas();
    }
  }
}

function interceptarFormularioPago() {
  const form = document.querySelector("#checkout-form");
  
  if (!form) {
    console.log('Esperando formulario...');
    setTimeout(interceptarFormularioPago, 100);
    return;
  }

  console.log('✓ Formulario encontrado, interceptando submit...');
  
  // Agregar listener ANTES que cualquier otro
  form.addEventListener('submit', procesarPagoConTarjetaGuardada, true);
}

// Inicializar cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando checkout con tarjetas guardadas...');
  inicializarEventosMetodoPago();
  interceptarFormularioPago();
});

// ============================================================================
// ESTILOS
// ============================================================================

const estilos = document.createElement('style');
estilos.textContent = `
  #tarjetas-guardadas-container {
    margin-bottom: 20px;
  }

  #tarjetas-guardadas-container h4 {
    margin-bottom: 15px;
    font-weight: bold;
    color: #333;
  }

  .tarjeta-guardada-item {
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 12px;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
  }

  .tarjeta-guardada-item:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    transform: translateY(-2px);
  }

  .tarjeta-guardada-item.selected {
    border-color: #667eea;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf4 100%);
    box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
  }

  .tarjeta-guardada-content {
    flex: 1;
  }

  .tarjeta-tipo-badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .tarjeta-tipo-badge.visa {
    background: #1a1f71;
    color: white;
  }

  .tarjeta-tipo-badge.mastercard {
    background: #eb001b;
    color: white;
  }

  .tarjeta-tipo-badge.amex {
    background: #006fcf;
    color: white;
  }

  .tarjeta-tipo-badge.otra {
    background: #6c757d;
    color: white;
  }

  .tarjeta-numero-display {
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 2px;
    margin: 8px 0;
    color: #333;
  }

  .tarjeta-info-small {
    font-size: 0.85rem;
    color: #666;
  }

  .tarjeta-check {
    font-size: 1.5rem;
    color: #e0e0e0;
    transition: color 0.3s ease;
  }

  .tarjeta-guardada-item.selected .tarjeta-check {
    color: #667eea;
  }
`;
document.head.appendChild(estilos);

// Exportar para uso externo
export function getTarjetaSeleccionada() {
  return tarjetaSeleccionada;
}