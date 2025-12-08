// JS/checkout-tarjetas.js - VERSIÓN CORREGIDA
// Script para cargar y seleccionar tarjetas guardadas en la pasarela de pago

// ✅ Importar Supabase desde ScriptLogin (instancia compartida)
import { supabase } from './ScriptLogin.js';

console.log("✓ checkout-tarjetas.js cargado");

let tarjetaSeleccionada = null;

// Cargar tarjetas guardadas cuando el método de pago sea "tarjeta"
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
  document.getElementById('card-name').value = '';
  document.getElementById('card-number').value = '';
  document.getElementById('card-exp').value = '';
  document.getElementById('card-cvv').value = '';

  console.log('Tarjeta seleccionada:', tarjetaSeleccionada);
}

// Obtener tarjeta seleccionada (para usar en pasarelaPagos.js)
export function getTarjetaSeleccionada() {
  return tarjetaSeleccionada;
}

// Inicializar cuando se cambie el método de pago
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

// Inicializar cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
  inicializarEventosMetodoPago();
});

// Agregar estilos para las tarjetas guardadas (si no existen en CSS)
const estilos = document.createElement('style');
estilos.textContent = `
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
    border-color: #007bff;
    box-shadow: 0 4px 12px rgba(0,123,255,0.15);
    transform: translateY(-2px);
  }

  .tarjeta-guardada-item.selected {
    border-color: #007bff;
    background: #f0f8ff;
    box-shadow: 0 4px 16px rgba(0,123,255,0.2);
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
    color: #007bff;
  }
`;
document.head.appendChild(estilos);