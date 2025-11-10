// JS/metodos-pago.js - VERSIÓN SIMPLE Y FUNCIONAL

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

let usuarioActual = null;
let tarjetaEditando = null;

// ========== AUTENTICACIÓN ==========
async function verificarAutenticacion() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      window.location.href = 'login.html';
      return false;
    }

    usuarioActual = session.user;
    return true;

  } catch (error) {
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
      listaTarjetas.innerHTML = `
        <div class="empty-state">
          <p style="color: #999;">No tenés tarjetas guardadas</p>
        </div>
      `;
      return;
    }

    listaTarjetas.innerHTML = tarjetas.map(tarjeta => crearTarjetaHTML(tarjeta)).join('');
    
    // Agregar event listeners a botones
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

  } catch (error) {
    console.error('Error al cargar tarjetas:', error);
    listaTarjetas.innerHTML = `<div class="empty-state"><p>Error al cargar</p></div>`;
  }
}

// ========== CREAR HTML TARJETA ==========
function crearTarjetaHTML(tarjeta) {
  const ultimos4 = tarjeta.numero_tarjeta.slice(-4);
  
  return `
    <div class="tarjeta-item ${tarjeta.es_predeterminada ? 'predeterminada' : ''}">
      <div class="tarjeta-numero">•••• •••• •••• ${ultimos4}</div>
      <div class="tarjeta-info">
        <div class="tarjeta-nombre">${tarjeta.nombre_titular}</div>
        <div class="tarjeta-exp">${tarjeta.mes_vencimiento}/${tarjeta.anio_vencimiento}</div>
      </div>
      ${tarjeta.es_predeterminada ? '<div class="tarjeta-badge">PREDETERMINADA</div>' : ''}
      <div class="tarjeta-actions">
        <button class="tarjeta-btn btn-editar-tarjeta" data-id="${tarjeta.id}" title="Editar">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="tarjeta-btn btn-eliminar-tarjeta" data-id="${tarjeta.id}" title="Eliminar">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `;
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

// ========== MODAL ==========
function abrirModal() {
  tarjetaEditando = null;
  document.querySelector('.modal-title').textContent = 'Agregar tarjeta';
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

    document.querySelector('.modal-title').textContent = 'Editar tarjeta';
    document.getElementById('modal-tarjeta').removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    actualizarVistaPrevia();

  } catch (error) {
    alert('Error al cargar la tarjeta');
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

  if (!validarNumeroTarjeta(numero)) {
    alert('Número de tarjeta inválido');
    return;
  }

  if (!validarCVV(cvv)) {
    alert('CVV inválido');
    return;
  }

  if (!validarFechaVencimiento(mes, anio)) {
    alert('La tarjeta está vencida');
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

    if (tarjetaEditando) {
      await supabase
        .from('metodos_pago')
        .update(datosTarjeta)
        .eq('id', tarjetaEditando.id);
    } else {
      await supabase
        .from('metodos_pago')
        .insert([datosTarjeta]);
    }

    cerrarModal();
    await cargarTarjetas();
    alert('Tarjeta guardada exitosamente');

  } catch (error) {
    alert('Error al guardar la tarjeta');
  }
}

// ========== ELIMINAR TARJETA ==========
async function eliminarTarjeta(id) {
  if (!confirm('¿Estás seguro de que querés eliminar esta tarjeta?')) {
    return;
  }

  try {
    await supabase
      .from('metodos_pago')
      .delete()
      .eq('id', id);

    await cargarTarjetas();
    alert('Tarjeta eliminada exitosamente');

  } catch (error) {
    alert('Error al eliminar la tarjeta');
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

  inputCvv.addEventListener('focus', () => tarjeta.classList.add('flip'));
  inputCvv.addEventListener('blur', () => tarjeta.classList.remove('flip'));
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
  document.getElementById('credit-card').classList.remove('flip');
}