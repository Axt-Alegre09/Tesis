// /api/ask.js
// ==================== CHATBOT PANIQUIÑOS v6.0 ====================
// CAMBIO DE ARQUITECTURA:
// - Backend detecta datos automáticamente (no depende de GPT)
// - GPT solo genera respuestas naturales
// - Estado más robusto con logging
// ==================================================================

import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supa = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/* ============== Utils ============== */
const toPY = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  return n.toLocaleString("es-PY");
};

const log = (tag, ...args) => console.log(`[${tag}]`, ...args);

/* ============== Parsers ============== */
function parseFecha(texto) {
  if (!texto) return null;
  const str = texto.toLowerCase().trim();
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  const meses = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'setiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  
  const matchFull = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})/);
  if (matchFull) return `${matchFull[3]}-${matchFull[2].padStart(2, '0')}-${matchFull[1].padStart(2, '0')}`;
  
  let dia = null, mes = null;
  const matchDia = str.match(/\b(\d{1,2})\b/);
  if (matchDia) dia = matchDia[1].padStart(2, '0');
  
  for (const [nombre, num] of Object.entries(meses)) {
    if (str.includes(nombre)) { mes = num; break; }
  }
  
  if (dia && mes) {
    const anio = new Date().getFullYear();
    return `${anio}-${mes}-${dia}`;
  }
  return null;
}

function parseHora(texto) {
  if (!texto) return null;
  const str = texto.toLowerCase().trim();
  
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const [h, m] = str.split(':');
    return `${h.padStart(2, '0')}:${m}`;
  }
  
  const match = str.match(/(\d{1,2})/);
  if (match) {
    let hora = parseInt(match[1]);
    if (str.includes('tarde') || str.includes('pm') || str.includes('noche')) {
      if (hora < 12) hora += 12;
    }
    return `${String(hora).padStart(2, '0')}:00`;
  }
  return null;
}

/* ============== Catálogo ============== */
let _cache = { at: 0, items: [] };

async function loadCatalog() {
  if (Date.now() - _cache.at < 180000 && _cache.items.length) return _cache.items;
  const { data } = await supa.from("v_productos_publicos").select("id, nombre, precio, categoria_nombre");
  _cache = { at: Date.now(), items: (data || []).map(p => ({ id: p.id, nombre: p.nombre?.trim(), precio: Number(p.precio), categoria: p.categoria_nombre?.trim() })) };
  return _cache.items;
}

async function buscarProducto(nombre) {
  const items = await loadCatalog();
  const n = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return items.find(p => p.nombre.toLowerCase().includes(n) || n.includes(p.nombre.toLowerCase()));
}

/* ============== Verificar cupo ============== */
async function verificarCupo(fecha) {
  try {
    const { data, error } = await supa.rpc('verificar_cupo_catering', { p_fecha: fecha });
    if (error) return { ok: true };
    return data.tiene_cupo ? { ok: true, disponible: data.disponible } : { ok: false, limite: data.limite };
  } catch (e) {
    return { ok: true };
  }
}

/* ============== Estado ============== */
const CAMPOS = ['nombre', 'telefono', 'email', 'tipoServicio', 'fecha', 'hora', 'menu', 'invitados', 'direccion'];

const ETIQUETAS = {
  nombre: 'Nombre',
  telefono: 'Teléfono', 
  email: 'Email',
  tipoServicio: 'Tipo de evento',
  fecha: 'Fecha',
  hora: 'Hora',
  menu: 'Menú',
  invitados: 'Invitados',
  direccion: 'Dirección'
};

const PREGUNTAS = {
  nombre: '¿Cuál es tu nombre completo?',
  telefono: '¿Tu número de teléfono?',
  email: '¿Tu correo electrónico?',
  tipoServicio: '¿Qué tipo de evento es? (cumpleaños, boda, corporativo, etc.)',
  fecha: '¿Qué fecha sería el evento?',
  hora: '¿A qué hora?',
  menu: '¿Qué menú o comida te gustaría?',
  invitados: '¿Cuántos invitados aproximadamente?',
  direccion: '¿Cuál es la dirección del evento?'
};

function crearCateringVacio() {
  return { activo: false, nombre: null, telefono: null, email: null, tipoServicio: null, fecha: null, hora: null, menu: null, invitados: null, direccion: null };
}

function getFaltantes(cat) { return CAMPOS.filter(c => !cat[c]); }
function getCompletos(cat) { return CAMPOS.filter(c => cat[c]); }
function todosCompletos(cat) { return CAMPOS.every(c => cat[c]); }

function initState(state) {
  return {
    history: Array.isArray(state?.history) ? state.history : [],
    cart: state?.cart || {},
    sessionId: state?.sessionId || `s_${Date.now()}`,
    catering: { ...crearCateringVacio(), ...(state?.catering || {}) }
  };
}

/* ============== DETECCIÓN AUTOMÁTICA DE DATOS ============== */
function detectarDatos(mensaje, campoEsperado, datosActuales) {
  const msg = mensaje.trim();
  const msgLower = msg.toLowerCase();
  const datos = {};

  // === DETECCIÓN GLOBAL (siempre buscar estos) ===
  
  // Email (muy específico, fácil de detectar)
  if (!datosActuales.email) {
    const emailMatch = msg.match(/[\w.\-]+@[\w.\-]+\.\w+/);
    if (emailMatch) datos.email = emailMatch[0];
  }
  
  // Teléfono (número de 9-10 dígitos empezando con 0)
  if (!datosActuales.telefono) {
    const telMatch = msg.match(/0\d{2,3}[\s\-]?\d{3}[\s\-]?\d{3,4}/);
    if (telMatch) {
      datos.telefono = telMatch[0].replace(/[\s\-]/g, '');
    } else {
      const telSimple = msg.match(/09\d{8}/);
      if (telSimple) datos.telefono = telSimple[0];
    }
  }
  
  // Fecha (menciona mes o tiene formato de fecha)
  if (!datosActuales.fecha) {
    const fecha = parseFecha(msg);
    if (fecha) datos.fecha = fecha;
  }
  
  // Hora (menciona horas, :, tarde, noche)
  if (!datosActuales.hora && /\d+\s*(horas?|hs|:|\s*(de la )?(tarde|noche|mañana))/.test(msgLower)) {
    const hora = parseHora(msg);
    if (hora) datos.hora = hora;
  }
  
  // Tipo de servicio
  if (!datosActuales.tipoServicio) {
    const tipos = {
      'cumpleaños': ['cumpleaños', 'cumple'],
      'boda': ['boda', 'casamiento', 'matrimonio'],
      'corporativo': ['corporativo', 'empresa', 'empresarial', 'oficina'],
      'bautismo': ['bautismo', 'bautizo'],
      'comunión': ['comunión', 'comunion', 'primera comunión'],
      'quinceañera': ['quinceañera', 'quince', '15 años'],
      'graduación': ['graduación', 'graduacion', 'egreso'],
      'aniversario': ['aniversario'],
      'reunión': ['reunión', 'reunion', 'junta'],
      'fiesta': ['fiesta']
    };
    for (const [tipo, keywords] of Object.entries(tipos)) {
      if (keywords.some(k => msgLower.includes(k))) {
        datos.tipoServicio = tipo;
        break;
      }
    }
  }
  
  // Invitados (número seguido de "personas", "invitados", o solo número si esperamos este campo)
  if (!datosActuales.invitados) {
    const invMatch = msg.match(/(\d+)\s*(personas?|invitados?|gente)?/i);
    if (invMatch && parseInt(invMatch[1]) >= 5 && parseInt(invMatch[1]) <= 1000) {
      // Solo si parece cantidad razonable de invitados
      if (invMatch[2] || campoEsperado === 'invitados') {
        datos.invitados = invMatch[1];
      }
    }
  }

  // === DETECCIÓN POR CAMPO ESPERADO ===
  if (campoEsperado && !datos[campoEsperado]) {
    switch (campoEsperado) {
      case 'nombre':
        // Acepta el mensaje completo como nombre si no tiene @ ni números largos
        if (!msg.includes('@') && !/\d{5,}/.test(msg) && msg.length >= 2 && msg.length <= 100) {
          // Limpiar comas y otros datos que ya detectamos
          let nombre = msg;
          if (datos.telefono) nombre = nombre.replace(datos.telefono, '');
          if (datos.email) nombre = nombre.replace(datos.email, '');
          nombre = nombre.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
          // Tomar las primeras palabras que parezcan nombre
          const palabras = nombre.split(' ').filter(p => p.length >= 2 && !/\d/.test(p));
          if (palabras.length >= 1) {
            datos.nombre = palabras.slice(0, 4).join(' '); // Max 4 palabras
          }
        }
        break;
        
      case 'telefono':
        // Si solo hay números en el mensaje
        const soloNum = msg.replace(/[\s\-\(\)]/g, '');
        if (/^\d{8,12}$/.test(soloNum)) {
          datos.telefono = soloNum;
        }
        break;
        
      case 'email':
        // Ya detectado arriba
        break;
        
      case 'tipoServicio':
        // Si no matcheó arriba, aceptar texto corto
        if (!datos.tipoServicio && msg.length <= 50 && !msg.includes('@') && !/\d{5,}/.test(msg)) {
          datos.tipoServicio = msg;
        }
        break;
        
      case 'menu':
        // Aceptar el texto como menú
        if (msg.length >= 2 && msg.length <= 500) {
          // Limpiar otros datos detectados
          let menu = msg;
          if (datos.fecha) menu = menu.replace(/\d{1,2}\s+de\s+\w+/gi, '').replace(/\d{4}-\d{2}-\d{2}/g, '');
          menu = menu.replace(/,\s*$/, '').trim();
          if (menu.length >= 2) datos.menu = menu;
        }
        break;
        
      case 'invitados':
        const numMatch = msg.match(/\d+/);
        if (numMatch) datos.invitados = numMatch[0];
        break;
        
      case 'direccion':
        // Aceptar el texto como dirección
        if (msg.length >= 3 && msg.length <= 300) {
          datos.direccion = msg;
        }
        break;
    }
  }

  return datos;
}

/* ============== PROCESAR CATERING ============== */
async function procesarCatering(mensaje, state) {
  const cat = state.catering;
  const msgLower = mensaje.toLowerCase();
  
  // Si no está activo, verificar si quiere iniciar
  if (!cat.activo) {
    const triggers = ['catering', 'reservar', 'reserva', 'agendar', 'evento', 'servicio de comida'];
    if (triggers.some(t => msgLower.includes(t))) {
      state.catering = { ...crearCateringVacio(), activo: true };
      return { handled: true, reply: `¡Perfecto! Vamos a reservar tu servicio de catering 🎉\n\n${PREGUNTAS.nombre}` };
    }
    return { handled: false };
  }

  // === COMANDOS ESPECIALES ===
  
  // "Qué datos tenés?"
  if (msgLower.includes('que datos') || msgLower.includes('qué datos') || msgLower.includes('que tenes') || msgLower.includes('qué tenés')) {
    const completos = getCompletos(cat);
    const faltantes = getFaltantes(cat);
    
    let respuesta = '📋 **Datos que tengo:**\n';
    if (completos.length > 0) {
      respuesta += completos.map(c => `✅ ${ETIQUETAS[c]}: ${cat[c]}`).join('\n');
    } else {
      respuesta += '(ninguno aún)';
    }
    respuesta += '\n\n';
    if (faltantes.length > 0) {
      respuesta += `❌ **Faltan:** ${faltantes.map(c => ETIQUETAS[c]).join(', ')}\n\n`;
      respuesta += PREGUNTAS[faltantes[0]];
    }
    return { handled: true, reply: respuesta };
  }
  
  // "Ya te di eso" / "ya me pediste eso"
  if (msgLower.includes('ya te di') || msgLower.includes('ya me pediste') || msgLower.includes('ya te dije')) {
    const faltantes = getFaltantes(cat);
    if (faltantes.length > 0) {
      return { handled: true, reply: `Disculpá, parece que no guardé bien. ${PREGUNTAS[faltantes[0]]}` };
    }
  }
  
  // "Cancelar"
  if (msgLower.includes('cancelar') || msgLower.includes('no quiero') || msgLower.includes('dejá')) {
    state.catering = crearCateringVacio();
    return { handled: true, reply: '✅ Reserva cancelada. ¿Te puedo ayudar con algo más?' };
  }
  
  // Pregunta de disponibilidad: "27 de diciembre tenés disponible?"
  if ((msgLower.includes('disponible') || msgLower.includes('hay cupo') || msgLower.includes('tenes disponible') || msgLower.includes('tenés disponible')) && !cat.fecha) {
    const fecha = parseFecha(mensaje);
    if (fecha) {
      const cupo = await verificarCupo(fecha);
      if (cupo.ok) {
        cat.fecha = fecha;
        log('GUARDADO', `fecha = "${fecha}" (pregunta de disponibilidad)`);
        const faltantes = getFaltantes(cat);
        const siguiente = faltantes[0];
        return { handled: true, reply: `¡Sí, el ${fecha} está disponible! 😊 ${PREGUNTAS[siguiente]}` };
      } else {
        return { handled: true, reply: `❌ El ${fecha} ya tiene ${cupo.limite} servicios agendados (cupo lleno). ¿Qué otra fecha te sirve?` };
      }
    }
  }

  // Catering activo - detectar datos
  const faltantes = getFaltantes(cat);
  const campoActual = faltantes[0];
  
  log('CATERING', `Campo esperado: ${campoActual}, Faltantes: ${faltantes.join(', ')}`);
  log('CATERING', `Estado actual:`, JSON.stringify(cat));
  
  const datosDetectados = detectarDatos(mensaje, campoActual, cat);
  log('DETECTADO', JSON.stringify(datosDetectados));
  
  // Guardar datos detectados
  let cupoError = null;
  for (const [campo, valor] of Object.entries(datosDetectados)) {
    if (!cat[campo] && valor) {
      // Validación especial para fecha
      if (campo === 'fecha') {
        const cupo = await verificarCupo(valor);
        if (!cupo.ok) {
          cupoError = `❌ El ${valor} ya tiene ${cupo.limite} servicios agendados (cupo lleno). ¿Qué otra fecha te sirve?`;
          continue;
        }
      }
      cat[campo] = valor;
      log('GUARDADO', `${campo} = "${valor}"`);
    }
  }
  
  // Si hubo error de cupo, retornarlo
  if (cupoError) {
    return { handled: true, reply: cupoError };
  }
  
  // Verificar si completamos todo
  if (todosCompletos(cat)) {
    log('CATERING', '✅ Todos los campos completos, ejecutando reserva...');
    return await ejecutarReserva(state);
  }
  
  // Si no detectamos nada para el campo actual, dar pista
  const nuevosFaltantes = getFaltantes(cat);
  const siguienteCampo = nuevosFaltantes[0];
  
  if (Object.keys(datosDetectados).length === 0) {
    // No entendió el dato
    return { 
      handled: true, 
      reply: `No entendí bien. ${PREGUNTAS[siguienteCampo]} 😊` 
    };
  }
  
  // Preguntar siguiente
  return { 
    handled: true, 
    reply: `Perfecto. ${PREGUNTAS[siguienteCampo]}` 
  };
}

async function ejecutarReserva(state) {
  const cat = state.catering;
  
  try {
    log('RESERVA', 'Ejecutando con:', JSON.stringify(cat));
    
    const { data, error } = await supa.rpc("catering_agendar", {
      p_razonsocial: cat.nombre,
      p_tipoevento: cat.tipoServicio,
      p_fecha: cat.fecha,
      p_hora: cat.hora,
      p_tipocomida: cat.menu,
      p_lugar: cat.direccion,
      p_ruc: 'CHAT-BOT',
      p_observaciones: null,
      p_invitados: parseInt(cat.invitados) || null,
      p_telefono: cat.telefono,
      p_email: cat.email
    });

    if (error) {
      log('RESERVA', 'Error:', error.message);
      if (error.message.includes('Cupo')) {
        cat.fecha = null;
        return { handled: true, reply: `❌ Cupo lleno para esa fecha. ¿Qué otra fecha te sirve?` };
      }
      return { handled: true, reply: `Error: ${error.message}` };
    }

    log('RESERVA', '✅ Creada:', data?.id);

    const resumen = `🎉 **¡Pre-reserva creada exitosamente!**

📋 **Datos de tu reserva:**
• **Nombre:** ${cat.nombre}
• **Teléfono:** ${cat.telefono}
• **Email:** ${cat.email}
• **Tipo de evento:** ${cat.tipoServicio}
• **Fecha:** ${cat.fecha}
• **Hora:** ${cat.hora}
• **Menú:** ${cat.menu}
• **Invitados:** ${cat.invitados}
• **Dirección:** ${cat.direccion}

📱 Te contactaremos vía WhatsApp al ${cat.telefono} para confirmar los datos y coordinar el pago.

¡Gracias por elegir Paniquiños! 😊`;

    // Limpiar estado
    state.catering = crearCateringVacio();
    
    return { handled: true, reply: resumen };

  } catch (e) {
    log('RESERVA', 'Exception:', e.message);
    return { handled: true, reply: 'Error técnico. Contactanos al +595 992 544 305' };
  }
}

/* ============== PROCESAR CARRITO ============== */
function normalizarTexto(texto) {
  return texto.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, ' ') // solo letras y números
    .replace(/\s+/g, ' ')
    .trim();
}

function buscarProductoEnMensaje(mensaje, catalogo) {
  const msgNorm = normalizarTexto(mensaje);
  const encontrados = [];
  
  // Palabras clave para cada tipo de producto
  const keywords = {
    'empanada de jamon y queso': ['jamon y queso', 'jamon queso', 'jamón y queso', 'jamón queso', 'jyq'],
    'empanada de carne': ['de carne', 'empanada carne'],
    'empanada de huevo': ['de huevo', 'empanada huevo'],
    'empanada de mandioca': ['de mandioca', 'empanada mandioca'],
    'empanada saltena': ['saltena', 'salteña'],
    'torta de chocolate': ['de chocolate', 'torta chocolate'],
    'torta de frutilla': ['de frutilla', 'torta frutilla'],
    'torta de dulce de leche': ['dulce de leche', 'torta dulce'],
    'chipa': ['chipa', 'chipas'],
    'mbeju': ['mbeju', 'mbejú'],
    'sopa paraguaya': ['sopa paraguaya', 'sopa'],
    'coca cola': ['coca', 'coca cola', 'cocacola'],
    'fanta': ['fanta'],
    'sprite': ['sprite'],
    'agua mineral': ['agua'],
    'jugo': ['jugo'],
    'cafe': ['cafe', 'café'],
    'medialunas': ['medialuna', 'medialunas'],
    'facturas': ['factura', 'facturas'],
    'pan': ['pan'],
    'bocaditos': ['bocadito', 'bocaditos'],
    'sandwich': ['sandwich', 'sandwiches', 'sanguche'],
    'flan': ['flan'],
    'helado': ['helado']
  };
  
  for (const prod of catalogo) {
    const prodNorm = normalizarTexto(prod.nombre);
    let matched = false;
    let matchedKeyword = '';
    
    // Buscar por nombre exacto normalizado
    if (msgNorm.includes(prodNorm)) {
      matched = true;
      matchedKeyword = prodNorm;
    }
    
    // Buscar por keywords
    if (!matched) {
      const kws = keywords[prodNorm] || [];
      for (const kw of kws) {
        const kwNorm = normalizarTexto(kw);
        if (msgNorm.includes(kwNorm)) {
          matched = true;
          matchedKeyword = kwNorm;
          break;
        }
      }
    }
    
    // Buscar palabras clave del nombre del producto (última palabra significativa)
    if (!matched) {
      const palabrasProd = prodNorm.split(' ').filter(p => p.length > 3 && !['combo', 'de', 'con', 'empanada', 'torta'].includes(p));
      for (const palabra of palabrasProd) {
        if (msgNorm.includes(palabra)) {
          matched = true;
          matchedKeyword = palabra;
          break;
        }
      }
    }
    
    if (matched) {
      // Buscar cantidad - múltiples estrategias
      let qty = 1;
      
      // Estrategia 1: número + "de" + keyword
      if (matchedKeyword) {
        const keywordFirst = matchedKeyword.split(' ')[0];
        const patterns = [
          new RegExp(`(\\d+)\\s*(?:empanadas?\\s+)?(?:de\\s+)?${keywordFirst}`, 'i'),
          new RegExp(`(\\d+)\\s+${keywordFirst}`, 'i'),
        ];
        for (const p of patterns) {
          const m = mensaje.toLowerCase().match(p);
          if (m) { qty = parseInt(m[1]) || 1; break; }
        }
      }
      
      // Estrategia 2: buscar patrón "N de X" donde X es parte del producto
      if (qty === 1) {
        const lastMeaningfulWord = prodNorm.split(' ').filter(p => p.length > 3).pop();
        if (lastMeaningfulWord) {
          const m = mensaje.toLowerCase().match(new RegExp(`(\\d+)\\s+(?:de\\s+)?${lastMeaningfulWord}`, 'i'));
          if (m) qty = parseInt(m[1]) || 1;
        }
      }
      
      // Estrategia 3: buscar posición del keyword y número antes (ignorando palabras como "empanadas de")
      if (qty === 1 && matchedKeyword) {
        const idx = msgNorm.indexOf(matchedKeyword);
        if (idx > 0) {
          const antes = msgNorm.substring(Math.max(0, idx - 25), idx);
          // Buscar número, permitiendo palabras intermedias
          const numMatch = antes.match(/(\d+)\s*(?:empanadas?\s+)?(?:de\s*)?$/);
          if (numMatch) qty = parseInt(numMatch[1]) || 1;
        }
      }
      
      // Estrategia 4: buscar "N empanadas de X" globalmente
      if (qty === 1) {
        const globalMatch = mensaje.match(/(\d+)\s*empanadas?\s+de\s+/i);
        if (globalMatch && encontrados.length === 0) {
          qty = parseInt(globalMatch[1]) || 1;
        }
      }
      
      encontrados.push({ prod, qty });
      log('MATCH', `"${matchedKeyword}" → ${prod.nombre} x${qty}`);
    }
  }
  
  return encontrados;
}

async function procesarCarrito(mensaje, state) {
  const msgLower = mensaje.toLowerCase();
  
  // Detectar intención de agregar al carrito
  const triggers = ['quiero', 'dame', 'agregar', 'añadir', 'poneme', 'agrega', 'necesito', 'pedido', 'pedir', 'llevar', 'llevo'];
  if (!triggers.some(t => msgLower.includes(t))) {
    return { handled: false };
  }
  
  const catalogo = await loadCatalog();
  const encontrados = buscarProductoEnMensaje(mensaje, catalogo);
  
  if (encontrados.length === 0) {
    return { handled: false };
  }
  
  const agregados = [];
  const actions = []; // Acciones para el frontend
  
  for (const { prod, qty } of encontrados) {
    if (!state.cart[prod.id]) {
      state.cart[prod.id] = { ...prod, qty: 0 };
    }
    state.cart[prod.id].qty += qty;
    agregados.push(`${qty}× ${prod.nombre}`);
    log('CARRITO', `Agregado: ${qty}× ${prod.nombre}`);
    
    // Acción para CartAPI del frontend
    actions.push({
      type: 'ADD_TO_CART',
      product: {
        id: prod.id,
        titulo: prod.nombre,
        precio: prod.precio,
        imagen: prod.imagen || null
      },
      qty: qty
    });
  }
  
  const total = Object.values(state.cart).reduce((s, i) => s + i.precio * i.qty, 0);
  
  // Si hay múltiples productos, envolver en MULTIPLE
  const action = actions.length === 1 
    ? actions[0] 
    : { type: 'MULTIPLE', actions };
  
  return { 
    handled: true, 
    reply: `✅ Agregué al carrito:\n${agregados.join('\n')}\n\n🛒 **Total: ${toPY(total)} Gs**\n\n¿Algo más?`,
    action
  };
}

/* ============== COMANDOS DE CARRITO ============== */
function procesarComandosCarrito(mensaje, state) {
  const msgLower = mensaje.toLowerCase();
  
  // Ver carrito
  if (msgLower.includes('ver carrito') || msgLower.includes('mi carrito') || msgLower.includes('que tengo') || msgLower.includes('qué tengo') || msgLower.includes('mostrar carrito')) {
    const items = Object.values(state.cart);
    if (items.length === 0) {
      return { handled: true, reply: '🛒 Tu carrito está vacío. ¿Qué te gustaría agregar?' };
    }
    
    const lista = items.map(i => `• ${i.qty}× ${i.nombre} - ${toPY(i.precio * i.qty)} Gs`).join('\n');
    const total = items.reduce((s, i) => s + i.precio * i.qty, 0);
    
    return { 
      handled: true, 
      reply: `🛒 **Tu carrito:**\n${lista}\n\n**Total: ${toPY(total)} Gs**\n\n¿Querés agregar algo más o finalizar el pedido?`
    };
  }
  
  // Vaciar carrito
  if (msgLower.includes('vaciar carrito') || msgLower.includes('limpiar carrito') || msgLower.includes('borrar carrito')) {
    state.cart = {};
    return { 
      handled: true, 
      reply: '🗑️ Carrito vaciado. ¿En qué puedo ayudarte?',
      action: { type: 'EMPTY_CART' }
    };
  }
  
  // Quitar producto
  if (msgLower.includes('quitar') || msgLower.includes('sacar') || msgLower.includes('eliminar')) {
    // Por ahora respuesta simple
    return { handled: true, reply: '¿Qué producto querés quitar del carrito?' };
  }
  
  return { handled: false };
}

/* ============== GPT PARA CONSULTAS GENERALES ============== */
async function consultarGPT(mensaje, state) {
  const catalogo = await loadCatalog();
  
  const catTexto = Object.entries(
    catalogo.reduce((acc, p) => { 
      if (!acc[p.categoria]) acc[p.categoria] = []; 
      acc[p.categoria].push(`${p.nombre}: ${toPY(p.precio)} Gs`); 
      return acc; 
    }, {})
  ).map(([cat, prods]) => `**${cat}:**\n${prods.join(', ')}`).join('\n\n');
  
  const carritoItems = Object.values(state.cart);
  const carritoTexto = carritoItems.length ? carritoItems.map(i => `${i.qty}× ${i.nombre}`).join(', ') : 'vacío';
  const total = carritoItems.reduce((s, i) => s + i.precio * i.qty, 0);

  const systemPrompt = `Sos el asistente de Paniquiños (panadería/confitería en Asunción, Paraguay).

CATÁLOGO:
${catTexto}

CARRITO ACTUAL: ${carritoTexto} (Total: ${toPY(total)} Gs)

SERVICIOS:
- Venta de productos (empanadas, tortas, bocaditos, etc.)
- Servicio de catering para eventos

INSTRUCCIONES:
- Respuestas cortas y amigables (1-3 líneas)
- Si preguntan por catering/eventos/reservas → decí "¿Querés que te ayude a agendar un servicio de catering?"
- Si quieren agregar productos → confirmar y preguntar si algo más
- Usá emojis ocasionalmente 😊`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...state.history.slice(-6),
    { role: "user", content: mensaje }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 200,
      messages
    });
    
    return completion.choices[0].message.content || "¿En qué puedo ayudarte?";
  } catch (e) {
    log('GPT', 'Error:', e.message);
    return "¿En qué puedo ayudarte? 😊";
  }
}

/* ============== HANDLER PRINCIPAL ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const startTime = Date.now();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const userMsg = body?.messages?.[0]?.content?.trim() ?? "";
    
    if (!userMsg) {
      return res.status(400).json({ error: "Mensaje vacío" });
    }

    const state = initState(body?.state);
    
    log('========', 'NUEVA CONSULTA', '========');
    log('USER', userMsg);
    log('STATE', 'Catering activo:', state.catering.activo);
    
    let reply = '';
    let action = null; // Acción para el frontend (CartAPI)
    
    // 1. Procesar catering (prioridad alta)
    const cateringResult = await procesarCatering(userMsg, state);
    if (cateringResult.handled) {
      reply = cateringResult.reply;
      action = cateringResult.action || null;
    } else {
      // 2. Comandos de carrito (ver, vaciar)
      const comandoCarrito = procesarComandosCarrito(userMsg, state);
      if (comandoCarrito.handled) {
        reply = comandoCarrito.reply;
        action = comandoCarrito.action || null;
      } else {
        // 3. Agregar al carrito
        const carritoResult = await procesarCarrito(userMsg, state);
        if (carritoResult.handled) {
          reply = carritoResult.reply;
          action = carritoResult.action || null;
        } else {
          // 4. Consulta general con GPT
          reply = await consultarGPT(userMsg, state);
        }
      }
    }
    
    // Guardar historial
    state.history.push({ role: "user", content: userMsg });
    state.history.push({ role: "assistant", content: reply });
    if (state.history.length > 12) state.history = state.history.slice(-12);
    
    log('REPLY', reply.substring(0, 100) + '...');
    log('ACTION', action ? JSON.stringify(action).substring(0, 100) : 'ninguna');
    log('TIME', `${Date.now() - startTime}ms`);
    
    // Tracking
    try {
      await supa.rpc('registrar_interaccion_chatbot', {
        p_user_id: null,
        p_tipo: state.catering.activo ? 'catering' : (action ? 'agregar_carrito' : 'consulta'),
        p_mensaje: userMsg.substring(0, 500),
        p_respuesta: reply.substring(0, 1000),
        p_accion: action ? JSON.stringify(action) : null,
        p_exitoso: true,
        p_tiempo_ms: Date.now() - startTime,
        p_metadata: { session: state.sessionId, catering_activo: state.catering.activo }
      });
    } catch (e) {}
    
    // Devolver action para que el frontend ejecute CartAPI
    return res.status(200).json({ reply, state, action });
    
  } catch (e) {
    log('ERROR', e.message);
    return res.status(500).json({ reply: "Error técnico. Intentá de nuevo.", state: {} });
  }
}