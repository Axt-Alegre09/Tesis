// JS/checkout-tarjetas.js - Integración de tarjetas guardadas en pasarela

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let tarjetasGuardadas = [];
let tarjetaSeleccionadaId = null;

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Inicializando checkout-tarjetas.js');
  
  await cargarTarjetasGuardadas();
  configurarToggleTarjetas();
  agregarEventosTarjetas();
  configurarCamposTarjeta();
});

// ========== CARGAR TARJETAS GUARDADAS ==========
async function cargarTarjetasGuardadas() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.log('Usuario no autenticado - tarjetas guardadas no disponibles');
      return;
    }

    const { data: tarjetas, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('usuario_id', user.id)
      .order('es_predeterminada', { ascending: false });

    if (error) throw error;

    if (tarjetas && tarjetas.length > 0) {
      tarjetasGuardadas = tarjetas;
      console.log(` ${tarjetas.length} tarjeta(s) guardada(s) cargada(s)`);
      
      mostrarTarjetasGuardadas();
      document.getElementById('tarjetas-guardadas-container').style.display = 'block';
    } else {
      console.log('ℹ No hay tarjetas guardadas');
      document.getElementById('tarjetas-guardadas-container').style.display = 'none';
    }

  } catch (error) {
    console.error(' Error cargando tarjetas:', error);
    document.getElementById('tarjetas-guardadas-container').style.display = 'none';
  }
}

// ========== MOSTRAR TARJETAS ==========
function mostrarTarjetasGuardadas() {
  const contenedor = document.getElementById('lista-tarjetas-guardadas');
  
  contenedor.innerHTML = tarjetasGuardadas.map(tarjeta => {
    const tipo = obtenerTipoTarjeta(tarjeta.numero_tarjeta);
    const ultimos4 = tarjeta.numero_tarjeta.slice(-4);
    const esPredeterminada = tarjeta.es_predeterminada;
    
    return `
      <div class="tarjeta-checkout-item" style="border: 2px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 10px; cursor: pointer;">
        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
          <input type="radio" name="tarjeta-guardada" value="${tarjeta.id}" ${esPredeterminada ? 'checked' : ''} style="width: 18px; height: 18px; cursor: pointer;">
          <div style="flex: 1;">
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
              <span style="background: #667eea; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                ${tipo.nombre}
              </span>
              ${esPredeterminada ? '<span style="background: #fbbf24; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">⭐ Predeterminada</span>' : ''}
            </div>
            <div style="font-family: monospace; font-size: 16px; font-weight: bold; margin-bottom: 8px;">•••• •••• •••• ${ultimos4}</div>
            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #666;">
              <span>${tarjeta.nombre_titular}</span>
              <span>${tarjeta.mes_vencimiento}/${tarjeta.anio_vencimiento}</span>
            </div>
          </div>
        </label>
      </div>
    `;
  }).join('');
}

// ========== TIPO DE TARJETA ==========
function obtenerTipoTarjeta(numero) {
  const primerDigito = numero.charAt(0);
  const primerosDosDigitos = numero.substring(0, 2);
  
  if (primerDigito === '4') {
    return { nombre: 'Visa', clase: 'visa' };
  } else if (['51', '52', '53', '54', '55'].includes(primerosDosDigitos)) {
    return { nombre: 'Mastercard', clase: 'mastercard' };
  } else if (['34', '37'].includes(primerosDosDigitos)) {
    return { nombre: 'American Express', clase: 'amex' };
  } else {
    return { nombre: 'Tarjeta', clase: 'otra' };
  }
}

// ========== CONFIGURAR TOGGLE ==========
function configurarToggleTarjetas() {
  const radios = document.querySelectorAll('input[name="metodo"]');
  
  radios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.value === 'tarjeta') {
        // Mostrar u ocultar selector de tarjetas
        if (tarjetasGuardadas.length > 0) {
          document.getElementById('tarjetas-guardadas-container').style.display = 'block';
        }
      }
    });
  });
}

// ========== EVENT LISTENERS ==========
function agregarEventosTarjetas() {
  document.addEventListener('change', (e) => {
    if (e.target.name === 'tarjeta-guardada') {
      tarjetaSeleccionadaId = e.target.value;
      console.log(' Tarjeta seleccionada:', tarjetaSeleccionadaId);
      
      // Limpiar campos manuales cuando se selecciona una guardada
      limpiarCamposTarjeta();
      
      // Destacar visualmente la selección
      actualizarEstiloSeleccion();
    }
  });
}

function actualizarEstiloSeleccion() {
  document.querySelectorAll('.tarjeta-checkout-item').forEach(item => {
    const radio = item.querySelector('input[type="radio"]');
    if (radio && radio.checked) {
      item.style.backgroundColor = '#f0f7ff';
      item.style.borderColor = '#3b82f6';
    } else {
      item.style.backgroundColor = '';
      item.style.borderColor = '#ccc';
    }
  });
}

// ========== CAMPOS DE TARJETA MANUAL ==========
function configurarCamposTarjeta() {
  const cardNumber = document.getElementById('card-number');
  const cardExp = document.getElementById('card-exp');
  const cardCvv = document.getElementById('card-cvv');

  // Desseleccionar tarjeta guardada si se edita manual
  if (cardNumber) {
    cardNumber.addEventListener('input', (e) => {
      if (e.target.value.trim() !== '') {
        document.querySelectorAll('input[name="tarjeta-guardada"]').forEach(r => r.checked = false);
        tarjetaSeleccionadaId = null;
        actualizarEstiloSeleccion();
      }
    });
  }

  if (cardExp) {
    cardExp.addEventListener('input', (e) => {
      if (e.target.value.trim() !== '') {
        document.querySelectorAll('input[name="tarjeta-guardada"]').forEach(r => r.checked = false);
        tarjetaSeleccionadaId = null;
        actualizarEstiloSeleccion();
      }
    });
  }

  if (cardCvv) {
    cardCvv.addEventListener('input', (e) => {
      if (e.target.value.trim() !== '') {
        document.querySelectorAll('input[name="tarjeta-guardada"]').forEach(r => r.checked = false);
        tarjetaSeleccionadaId = null;
        actualizarEstiloSeleccion();
      }
    });
  }
}

function limpiarCamposTarjeta() {
  const cardName = document.getElementById('card-name');
  const cardNumber = document.getElementById('card-number');
  const cardExp = document.getElementById('card-exp');
  const cardCvv = document.getElementById('card-cvv');
  
  if (cardName) cardName.value = '';
  if (cardNumber) cardNumber.value = '';
  if (cardExp) cardExp.value = '';
  if (cardCvv) cardCvv.value = '';
}

// ========== FUNCIÓN PARA OBTENER DATOS DE TARJETA EN CHECKOUT ==========
window.obtenerDatosTarjetaCheckout = function() {
  // Si hay tarjeta seleccionada, usarla
  if (tarjetaSeleccionadaId) {
    const tarjeta = tarjetasGuardadas.find(t => t.id === tarjetaSeleccionadaId);
    if (tarjeta) {
      return {
        usaTarjetaGuardada: true,
        numero: tarjeta.numero_tarjeta,
        nombre: tarjeta.nombre_titular,
        mes: tarjeta.mes_vencimiento,
        anio: tarjeta.anio_vencimiento,
        cvv: tarjeta.cvv
      };
    }
  }

  // Si no, devolver datos manuales
  return {
    usaTarjetaGuardada: false,
    numero: document.getElementById('card-number')?.value || '',
    nombre: document.getElementById('card-name')?.value || '',
    mes: null,
    anio: null,
    cvv: document.getElementById('card-cvv')?.value || ''
  };
};

console.log('checkout-tarjetas.js cargado correctamente');