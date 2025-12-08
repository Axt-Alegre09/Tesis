// JS/metodos-pago.js - VERSIÓN CORREGIDA

// ✅ Importar Supabase desde ScriptLogin (instancia compartida)
import { supabase } from './ScriptLogin.js';

console.log("✓ Supabase importado desde ScriptLogin");

// Variables globales
let usuarioActual = null;
let tarjetaEditando = null;

// Verificar autenticación PRIMERO
async function verificarAutenticacion() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Error al verificar sesión:', error);
      window.location.href = 'login.html';
      return false;
    }
    
    if (!session) {
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

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Iniciando aplicación...');
  
  // Primero verificar autenticación
  const autenticado = await verificarAutenticacion();
  
  if (!autenticado) {
    return; // Detener si no está autenticado
  }

  // Si está autenticado, continuar
  await cargarTarjetas();
  inicializarEventos();
  generarAnios();
  inicializarAnimacionTarjeta();
});

// Cargar tarjetas del usuario
async function cargarTarjetas() {
  const listaTarjetas = document.getElementById('lista-tarjetas');
  
  if (!usuarioActual) {
    console.error('No hay usuario actual');
    return;
  }

  console.log('Cargando tarjetas para usuario:', usuarioActual.id);
  
  try {
    const { data: tarjetas, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('usuario_id', usuarioActual.id)
      .order('es_predeterminada', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error de Supabase:', error);
      throw error;
    }

    console.log('Tarjetas cargadas:', tarjetas);

    if (!tarjetas || tarjetas.length === 0) {
      listaTarjetas.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-credit-card" style="font-size: 3rem; color: #999; margin-bottom: 1rem;"></i>
          <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No tenés tarjetas guardadas</p>
          <p class="text-muted">Agregá una tarjeta para pagar más rápido</p>
        </div>
      `;
      return;
    }

    listaTarjetas.innerHTML = tarjetas.map(tarjeta => crearTarjetaHTML(tarjeta)).join('');
    
    // Agregar eventos a los botones
    document.querySelectorAll('.btn-editar-tarjeta').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.btn-editar-tarjeta').dataset.id;
        editarTarjeta(id);
      });
    });

    document.querySelectorAll('.btn-eliminar-tarjeta').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.btn-eliminar-tarjeta').dataset.id;
        eliminarTarjeta(id);
      });
    });

    document.querySelectorAll('.btn-predeterminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.btn-predeterminar').dataset.id;
        establecerPredeterminada(id);
      });
    });

  } catch (error) {
    console.error('Error al cargar tarjetas:', error);
    listaTarjetas.innerHTML = `
      <div class="alert alert-danger">
        <i class="bi bi-exclamation-triangle"></i>
        Error al cargar las tarjetas: ${error.message}
      </div>
    `;
  }
}

// Crear HTML de una tarjeta
function crearTarjetaHTML(tarjeta) {
  const tipoBadge = obtenerTipoTarjeta(tarjeta.numero_tarjeta);
  const ultimos4 = tarjeta.numero_tarjeta.slice(-4);
  
  return `
    <div class="tarjeta-item ${tarjeta.es_predeterminada ? 'predeterminada' : ''}">
      <div class="tarjeta-info">
        <div class="tarjeta-header">
          <span class="tarjeta-tipo ${tipoBadge.clase}">${tipoBadge.nombre}</span>
          ${tarjeta.es_predeterminada ? '<span class="badge-predeterminada"><i class="bi bi-star-fill"></i> Predeterminada</span>' : ''}
        </div>
        <div class="tarjeta-numero">•••• •••• •••• ${ultimos4}</div>
        <div class="tarjeta-detalles">
          <span><i class="bi bi-person"></i> ${tarjeta.nombre_titular}</span>
          <span><i class="bi bi-calendar"></i> ${tarjeta.mes_vencimiento}/${tarjeta.anio_vencimiento}</span>
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

// Obtener tipo de tarjeta según el número
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

// Inicializar eventos
function inicializarEventos() {
  // Abrir modal para agregar tarjeta
  document.getElementById('btn-agregar').addEventListener('click', abrirModal);
  
  // Cerrar modal
  document.getElementById('modal-close').addEventListener('click', cerrarModal);
  document.getElementById('btn-cancelar').addEventListener('click', cerrarModal);
  
  // Cerrar al hacer clic fuera del modal
  document.getElementById('modal-tarjeta').addEventListener('click', (e) => {
    if (e.target.id === 'modal-tarjeta') cerrarModal();
  });

  // Enviar formulario
  document.getElementById('form-tarjeta').addEventListener('submit', guardarTarjeta);
}

// Abrir modal
function abrirModal() {
  tarjetaEditando = null;
  document.querySelector('.modal-title').textContent = 'Agregar tarjeta';
  document.getElementById('form-tarjeta').reset();
  document.getElementById('modal-tarjeta').removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  resetearTarjetaAnimada();
}

// Cerrar modal
function cerrarModal() {
  document.getElementById('modal-tarjeta').setAttribute('hidden', '');
  document.body.style.overflow = '';
  document.getElementById('form-tarjeta').reset();
  tarjetaEditando = null;
  resetearTarjetaAnimada();
}

// Editar tarjeta
async function editarTarjeta(id) {
  try {
    const { data: tarjeta, error } = await supabase
      .from('metodos_pago')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    tarjetaEditando = tarjeta;
    
    // Llenar formulario
    document.getElementById('input-numero').value = formatearNumeroTarjeta(tarjeta.numero_tarjeta);
    document.getElementById('input-nombre').value = tarjeta.nombre_titular;
    document.getElementById('input-mes').value = tarjeta.mes_vencimiento;
    document.getElementById('input-anio').value = tarjeta.anio_vencimiento;
    document.getElementById('input-cvv').value = ''; // Por seguridad
    document.getElementById('input-predeterminado').checked = tarjeta.es_predeterminada;

    document.querySelector('.modal-title').textContent = 'Editar tarjeta';
    document.getElementById('modal-tarjeta').removeAttribute('hidden');
    document.body.style.overflow = 'hidden';

    actualizarVistaPrevia();

  } catch (error) {
    console.error('Error al cargar tarjeta:', error);
    alert('Error al cargar la tarjeta');
  }
}

// Guardar tarjeta
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
    alert('Número de tarjeta inválido');
    return;
  }

  if (!validarCVV(cvv)) {
    alert('CVV inválido (debe ser de 3 o 4 dígitos)');
    return;
  }

  if (!validarFechaVencimiento(mes, anio)) {
    alert('La tarjeta está vencida');
    return;
  }

  try {
    // Si se marca como predeterminada, desmarcar las demás
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
    mostrarMensaje('Tarjeta guardada exitosamente', 'success');

  } catch (error) {
    console.error('Error al guardar tarjeta:', error);
    alert('Error al guardar la tarjeta: ' + error.message);
  }
}

// Eliminar tarjeta
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
    mostrarMensaje('Tarjeta eliminada exitosamente', 'success');

  } catch (error) {
    console.error('Error al eliminar tarjeta:', error);
    alert('Error al eliminar la tarjeta');
  }
}

// Establecer como predeterminada
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
    mostrarMensaje('Tarjeta predeterminada actualizada', 'success');

  } catch (error) {
    console.error('Error al establecer predeterminada:', error);
    alert('Error al actualizar la tarjeta predeterminada');
  }
}

// Validaciones
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

function mostrarMensaje(texto, tipo = 'info') {
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo}`;
  alerta.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${texto}`;
  alerta.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 9999; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); opacity: 0; transition: opacity 0.3s;';
  
  document.body.appendChild(alerta);
  setTimeout(() => alerta.style.opacity = '1', 100);
  setTimeout(() => {
    alerta.style.opacity = '0';
    setTimeout(() => alerta.remove(), 300);
  }, 3000);
}