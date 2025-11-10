// JS/metodos-pago.js - VERSIÓN MEJORADA

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Configuración de Supabase
const SUPABASE_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales
let usuarioActual = null;
let tarjetaEditando = null;

// ========== AUTENTICACIÓN ==========
async function verificarAutenticacion() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      console.log('No hay sesión activa');
      window.location.href = 'login.html';
      return false;
    }

    usuarioActual = session.user;
    console.log('Usuario autenticado:', usuarioActual.email);
    return true;

  } catch (error) {
    console.error('Error en verificación:', error);
    window.location.href = 'login.html';
    return false;
  }
}

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', async () => {
  const autenticado = await verificarAutenticacion();
  
  if (!autenticado) return;

  generarAnios();
  inicializarEventos();
  inicializarAnimacionTarjeta();
  await cargarTarjetas();
});

// ========== CARGAR TARJETAS ==========
async function cargarTarjetas() {
  const listaTarjetas = document.getElementById('lista-tarjetas');
  
  if (!usuarioActual) return;

  try {
    const { data: tarjetas, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('usuario_id', usuarioActual.id)
      .order('es_predeterminada', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!tarjetas || tarjetas.length === 0) {
      mostrarEstadoVacio(listaTarjetas);
      return;
    }

    listaTarjetas.innerHTML = tarjetas.map(tarjeta => crearTarjetaHTML(tarjeta)).join('');
    
    // Agregar event listeners
    agregarEventListeners();

  } catch (error) {
    console.error('Error al cargar tarjetas:', error);
    mostrarError(listaTarjetas, error.message);
  }
}

// ========== UI HELPERS ==========
function mostrarEstadoVacio(contenedor) {
  contenedor.innerHTML = `
    <div class="empty-state">
      <i class="bi bi-credit-card"></i>
      <h4>No tenés tarjetas guardadas</h4>
      <p>Agregá una tarjeta para pagar más rápido en tu próxima compra</p>
    </div>
  `;
}

function mostrarError(contenedor, mensaje) {
  contenedor.innerHTML = `
    <div class="alert alert-danger">
      <i class="bi bi-exclamation-triangle"></i>
      <strong>Error:</strong> ${mensaje}
    </div>
  `;
}

// ========== CREAR HTML TARJETA ==========
function crearTarjetaHTML(tarjeta) {
  const tipoBadge = obtenerTipoTarjeta(tarjeta.numero_tarjeta);
  const ultimos4 = tarjeta.numero_tarjeta.slice(-4);
  
  return `
    <div class="tarjeta-item ${tarjeta.es_predeterminada ? 'predeterminada' : ''}">
      <div class="tarjeta-info">
        <div class="tarjeta-header">
          <span class="tarjeta-tipo ${tipoBadge.clase}">
            <i class="bi bi-${tipoBadge.icono}"></i> ${tipoBadge.nombre}
          </span>
          ${tarjeta.es_predeterminada ? '<span class="badge-predeterminada"><i class="bi bi-star-fill"></i> Predeterminada</span>' : ''}
        </div>
        <div class="tarjeta-numero">
          <i class="bi bi-card-list"></i> •••• •••• •••• ${ultimos4}
        </div>
        <div class="tarjeta-detalles">
          <span><i class="bi bi-person"></i> ${tarjeta.nombre_titular}</span>
          <span><i class="bi bi-calendar-event"></i> ${tarjeta.mes_vencimiento}/${tarjeta.anio_vencimiento}</span>
        </div>
      </div>
      <div class="tarjeta-acciones">
        ${!tarjeta.es_predeterminada ? `
          <button class="btn-icon btn-predeterminar" data-id="${tarjeta.id}" title="Establecer como predeterminada">
            <i class="bi bi-star"></i>
          </button>
        ` : ''}
        <button class="btn-icon btn-editar-tarjeta" data-id="${tarjeta.id}" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn-icon btn-eliminar-tarjeta" data-id="${tarjeta.id}" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;
}

// ========== TIPO DE TARJETA ==========
function obtenerTipoTarjeta(numero) {
  const primerDigito = numero.charAt(0);
  const primerosDosDigitos = numero.substring(0, 2);
  
  if (primerDigito === '4') {
    return { nombre: 'Visa', clase: 'visa', icono: 'credit-card' };
  } else if (['51', '52', '53', '54', '55'].includes(primerosDosDigitos)) {
    return { nombre: 'Mastercard', clase: 'mastercard', icono: 'credit-card-2-front' };
  } else if (['34', '37'].includes(primerosDosDigitos)) {
    return { nombre: 'American Express', clase: 'amex', icono: 'credit-card-2-back' };
  } else {
    return { nombre: 'Tarjeta', clase: 'otra', icono: 'credit-card' };
  }
}

// ========== EVENTOS ==========
function inicializarEventos() {
  document.getElementById('btn-agregar').addEventListener('click', abrirModal);
  document.getElementById('modal-close').addEventListener('click', cerrarModal);
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  
  document.getElementById('modal-tarjeta').addEventListener('click', (e) => {
    if (e.target.id === 'modal-tarjeta') cerrarModal();
  });

  document.getElementById('form-tarjeta').addEventListener('submit', guardarTarjeta);
}

function agregarEventListeners() {
  document.querySelectorAll('.btn-editar-tarjeta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      editarTarjeta(id);
    });
  });

  document.querySelectorAll('.btn-eliminar-tarjeta').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      eliminarTarjeta(id);
    });
  });

  document.querySelectorAll('.btn-predeterminar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      establecerPredeterminada(id);
    });
  });
}

// ========== MODAL ==========
function abrirModal() {
  tarjetaEditando = null;
  document.getElementById('modal-title').textContent = 'Agregar tarjeta';
  document.getElementById('form-tarjeta').reset();
  document.getElementById('modal-tarjeta').removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  resetearTarjetaAnimada();
}

function cerrarModal() {
  document.getElementById('modal-tarjeta').setAttribute('hidden', '');
  document.body.style.overflow = '';
  document.getElementById('form-tarjeta').reset();
  tarjetaEditando = null;
  resetearTarjetaAnimada();
}

// ========== EDITAR TARJETA ==========
async function editarTarjeta(id) {
  try {
    const { data: tarjeta, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    tarjetaEditando = tarjeta;
    
    document.getElementById('input-numero').value = formatearNumeroTarjeta(tarjeta.numero_tarjeta);
    document.getElementById('input-nombre').value = tarjeta.nombre_titular;
    document.getElementById('input-mes').value = tarjeta.mes_vencimiento;
    document.getElementById('input-anio').value = tarjeta.anio_vencimiento;
    document.getElementById('input-cvv').value = '';
    document.getElementById('input-predeterminado').checked = tarjeta.es_predeterminada;

    document.getElementById('modal-title').textContent = 'Editar tarjeta';
    document.getElementById('modal-tarjeta').removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    actualizarVistaPrevia();

  } catch (error) {
    console.error('Error al cargar tarjeta:', error);
    mostrarAlerta('Error al cargar la tarjeta', 'danger');
  }
}

// ========== GUARDAR TARJETA ==========
async function guardarTarjeta(e) {
  e.preventDefault();

  const numero = document.getElementById('input-numero').value.replace(/\s/g, '');
  const nombre = document.getElementById('input-nombre').value.toUpperCase();
  const mes = document.getElementById('input-mes').value;
  const anio = document.getElementById('input-anio').value;
  const cvv = document.getElementById('input-cvv').value;
  const esPredeterminada = document.getElementById('input-predeterminado').checked;

  // Validaciones
  if (!validarNumeroTarjeta(numero)) {
    mostrarAlerta('Número de tarjeta inválido', 'danger');
    return;
  }

  if (!validarCVV(cvv)) {
    mostrarAlerta('CVV inválido (debe ser de 3 o 4 dígitos)', 'danger');
    return;
  }

  if (!validarFechaVencimiento(mes, anio)) {
    mostrarAlerta('La tarjeta está vencida', 'danger');
    return;
  }

  try {
    if (esPredeterminada) {
      await supabase
        .from('metodos_pago')
        .update({ es_predeterminada: false })
        .eq('usuario_id', usuarioActual.id);
    }

    const datosTarjeta = {
      usuario_id: usuarioActual.id,
      numero_tarjeta: numero,
      nombre_titular: nombre,
      mes_vencimiento: mes,
      anio_vencimiento: anio,
      cvv: cvv,
      es_predeterminada: esPredeterminada
    };

    let resultado;

    if (tarjetaEditando) {
      resultado = await supabase
        .from('metodos_pago')
        .update(datosTarjeta)
        .eq('id', tarjetaEditando.id);
    } else {
      resultado = await supabase
        .from('metodos_pago')
        .insert([datosTarjeta]);
    }

    if (resultado.error) throw resultado.error;

    cerrarModal();
    await cargarTarjetas();
    mostrarAlerta('Tarjeta guardada exitosamente', 'success');

  } catch (error) {
    console.error('Error al guardar tarjeta:', error);
    mostrarAlerta('Error al guardar la tarjeta: ' + error.message, 'danger');
  }
}

// ========== ELIMINAR TARJETA ==========
async function eliminarTarjeta(id) {
  if (!confirm('¿Estás seguro de que querés eliminar esta tarjeta?')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('metodos_pago')
      .delete()
      .eq('id', id);

    if (error) throw error;

    await cargarTarjetas();
    mostrarAlerta('Tarjeta eliminada exitosamente', 'success');

  } catch (error) {
    console.error('Error al eliminar tarjeta:', error);
    mostrarAlerta('Error al eliminar la tarjeta', 'danger');
  }
}

// ========== PREDETERMINADA ==========
async function establecerPredeterminada(id) {
  try {
    await supabase
      .from('metodos_pago')
      .update({ es_predeterminada: false })
      .eq('usuario_id', usuarioActual.id);

    const { error } = await supabase
      .from('metodos_pago')
      .update({ es_predeterminada: true })
      .eq('id', id);

    if (error) throw error;

    await cargarTarjetas();
    mostrarAlerta('Tarjeta predeterminada actualizada', 'success');

  } catch (error) {
    console.error('Error al establecer predeterminada:', error);
    mostrarAlerta('Error al actualizar la tarjeta predeterminada', 'danger');
  }
}

// ========== VALIDACIONES ==========
function validarNumeroTarjeta(numero) {
  if (!/^\d{13,19}$/.test(numero)) return false;
  
  let suma = 0;
  let esSegundo = false;
  
  for (let i = numero.length - 1; i >= 0; i--) {
    let digito = parseInt(numero.charAt(i));
    if (esSegundo) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
    esSegundo = !esSegundo;
  }
  
  return suma % 10 === 0;
}

function validarCVV(cvv) {
  return /^\d{3,4}$/.test(cvv);
}

function validarFechaVencimiento(mes, anio) {
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear() % 100;
  
  const mesNum = parseInt(mes);
  const anioNum = parseInt(anio);
  
  if (anioNum < anioActual) return false;
  if (anioNum === anioActual && mesNum < mesActual) return false;
  
  return true;
}

// ========== FORMATEO ==========
function formatearNumeroTarjeta(numero) {
  return numero.replace(/(\d{4})/g, '$1 ').trim();
}

function generarAnios() {
  const selectAnio = document.getElementById('input-anio');
  const anioActual = new Date().getFullYear();
  
  for (let i = 0; i < 15; i++) {
    const anio = anioActual + i;
    const anioCorto = anio.toString().slice(-2);
    const option = document.createElement('option');
    option.value = anioCorto;
    option.textContent = anioCorto;
    selectAnio.appendChild(option);
  }
}

// ========== ANIMACIÓN TARJETA ==========
function inicializarAnimacionTarjeta() {
  const inputNumero = document.getElementById('input-numero');
  const inputNombre = document.getElementById('input-nombre');
  const inputMes = document.getElementById('input-mes');
  const inputAnio = document.getElementById('input-anio');
  const inputCvv = document.getElementById('input-cvv');
  const tarjeta = document.getElementById('credit-card');

  inputNumero.addEventListener('input', (e) => {
    let valor = e.target.value.replace(/\s/g, '').replace(/\D/g, '').substring(0, 16);
    e.target.value = formatearNumeroTarjeta(valor);
    actualizarVistaPrevia();
  });

  inputNombre.addEventListener('input', actualizarVistaPrevia);
  inputMes.addEventListener('change', actualizarVistaPrevia);
  inputAnio.addEventListener('change', actualizarVistaPrevia);

  inputCvv.addEventListener('focus', () => tarjeta.classList.add('flipped'));
  inputCvv.addEventListener('blur', () => tarjeta.classList.remove('flipped'));
  inputCvv.addEventListener('input', (e) => {
    let valor = e.target.value.replace(/\D/g, '').substring(0, 4);
    e.target.value = valor;
    document.getElementById('card-display-cvv').textContent = valor || '***';
  });
}

function actualizarVistaPrevia() {
  const numero = document.getElementById('input-numero').value.replace(/\s/g, '');
  const nombre = document.getElementById('input-nombre').value || 'TU NOMBRE';
  const mes = document.getElementById('input-mes').value || 'MM';
  const anio = document.getElementById('input-anio').value || 'AA';

  const displayNumero = document.getElementById('card-display-number');
  const grupos = numero.match(/.{1,4}/g) || [];
  displayNumero.innerHTML = '';
  for (let i = 0; i < 4; i++) {
    const span = document.createElement('span');
    span.textContent = grupos[i] || '####';
    displayNumero.appendChild(span);
  }

  document.getElementById('card-display-name').textContent = nombre.toUpperCase();
  document.getElementById('card-display-exp').textContent = `${mes}/${anio}`;
}

function resetearTarjetaAnimada() {
  document.getElementById('card-display-number').innerHTML = '<span>####</span><span>####</span><span>####</span><span>####</span>';
  document.getElementById('card-display-name').textContent = 'TU NOMBRE';
  document.getElementById('card-display-exp').textContent = 'MM/AA';
  document.getElementById('card-display-cvv').textContent = '***';
  document.getElementById('credit-card').classList.remove('flipped');
}

// ========== ALERTAS ==========
function mostrarAlerta(texto, tipo = 'info') {
  const alerta = document.createElement('div');
  const iconos = {
    'success': 'check-circle-fill',
    'danger': 'exclamation-triangle-fill',
    'info': 'info-circle-fill'
  };
  
  alerta.className = `alert alert-${tipo}`;
  alerta.innerHTML = `<i class="bi bi-${iconos[tipo]}"></i> ${texto}`;
  alerta.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transition: opacity 0.3s;';
  
  document.body.appendChild(alerta);
  setTimeout(() => alerta.style.opacity = '1', 100);
  setTimeout(() => {
    alerta.style.opacity = '0';
    setTimeout(() => alerta.remove(), 300);
  }, 3000);
}

// Exportar función para usar en otros módulos
export async function obtenerTarjetasGuardadas() {
  if (!usuarioActual) return [];
  
  try {
    const { data: tarjetas, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('usuario_id', usuarioActual.id)
      .order('es_predeterminada', { ascending: false });

    if (error) throw error;
    return tarjetas || [];
  } catch (error) {
    console.error('Error al obtener tarjetas:', error);
    return [];
  }
}