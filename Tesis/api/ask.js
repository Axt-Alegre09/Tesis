// /api/ask.js
// ==================== API CHATBOT OPTIMIZADA v2.0 ====================
// Cambios principales:
// 1. Migración de 'functions' a 'tools' con parallel_tool_calls
// 2. Nueva función para actualizar datos de catering parciales
// 3. Mejor manejo del estado conversacional
// 4. Prompt mejorado para evitar preguntas repetidas
// =====================================================================

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

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ============== Parser de fechas y horas naturales ============== */
function parseFechaNatural(texto) {
  if (!texto) return null;
  
  const str = texto.toLowerCase().trim();
  
  // Si ya está en formato YYYY-MM-DD, retornar tal cual
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  const meses = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'setiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  
  let dia = null, mes = null, anio = null;
  
  // Patrón: dd/mm/yyyy o dd-mm-yyyy
  const matchFull = str.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (matchFull) {
    return `${matchFull[3]}-${matchFull[2].padStart(2, '0')}-${matchFull[1].padStart(2, '0')}`;
  }
  
  // Buscar día (1-31)
  const matchDia = str.match(/\b(\d{1,2})\b/);
  if (matchDia) dia = matchDia[1].padStart(2, '0');
  
  // Buscar mes por nombre
  for (const [nombre, num] of Object.entries(meses)) {
    if (str.includes(nombre)) {
      mes = num;
      break;
    }
  }
  
  // Si no encontró mes por nombre, buscar número (formato 15/12 o 15-12)
  if (!mes) {
    const matchMes = str.match(/\b\d{1,2}[\/\-](\d{1,2})\b/);
    if (matchMes) mes = matchMes[1].padStart(2, '0');
  }
  
  // Buscar año explícito (2024, 2025, 2026, etc)
  const matchAnio = str.match(/\b(20\d{2})\b/);
  if (matchAnio) {
    anio = matchAnio[1];
  } else {
    const ahora = new Date();
    const anioActual = ahora.getFullYear();
    const mesActual = ahora.getMonth() + 1;
    const diaActual = ahora.getDate();
    
    if (mes && parseInt(mes) < mesActual) {
      anio = String(anioActual + 1);
    } else if (mes && parseInt(mes) === mesActual && dia && parseInt(dia) < diaActual) {
      anio = String(anioActual + 1);
    } else {
      anio = String(anioActual);
    }
  }
  
  if (!dia || !mes) return null;
  
  return `${anio}-${mes}-${dia}`;
}

function parseHoraNatural(texto) {
  if (!texto) return null;
  
  const str = texto.toLowerCase().trim();
  
  // Si ya está en formato HH:MM, retornar normalizado
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  
  let hora = null;
  
  // Buscar número de hora
  const matchHora = str.match(/\b(\d{1,2})\b/);
  if (matchHora) {
    hora = parseInt(matchHora[1]);
    
    // Ajustar por AM/PM / tarde / noche
    if (str.includes('tarde') || str.includes('pm')) {
      if (hora < 12) hora += 12;
    } else if (str.includes('mañana') || str.includes('am')) {
      if (hora === 12) hora = 0;
    } else if (str.includes('noche')) {
      if (hora < 12) hora += 12;
    }
    
    // Buscar minutos si existen
    const matchMinutos = str.match(/(\d{1,2})\s*:\s*(\d{2})/);
    const minutos = matchMinutos ? matchMinutos[2] : '00';
    
    return `${String(hora).padStart(2, '0')}:${minutos}`;
  }
  
  return null;
}

/* ============== Catálogo (cache) ============== */
let _cache = { at: 0, items: [] };
const CACHE_MS = 1000 * 60 * 3;

async function loadCatalog() {
  const now = Date.now();
  if (now - _cache.at < CACHE_MS && _cache.items.length) return _cache.items;

  const { data, error } = await supa
    .from("v_productos_publicos")
    .select("id, nombre, precio, categoria_nombre");
  
  if (error) {
    console.warn("loadCatalog:", error.message);
    return _cache.items || [];
  }
  
  const items = (data || []).map(p => ({
    id: p.id,
    nombre: String(p.nombre || "").trim(),
    precio: Number(p.precio || 0),
    categoria: String(p.categoria_nombre || "").trim(),
  }));
  
  _cache = { at: now, items };
  return items;
}

/* ============== Funciones de búsqueda de productos ============== */
async function buscarProductoPorNombre(nombre) {
  const items = await loadCatalog();
  const nombreNorm = norm(nombre);
  
  // Búsqueda exacta primero
  let producto = items.find(p => norm(p.nombre) === nombreNorm);
  
  // Si no hay exacta, búsqueda parcial
  if (!producto) {
    producto = items.find(p => 
      norm(p.nombre).includes(nombreNorm) ||
      nombreNorm.includes(norm(p.nombre))
    );
  }
  
  // Búsqueda más flexible (palabras clave)
  if (!producto) {
    const palabras = nombreNorm.split(' ').filter(p => p.length > 2);
    producto = items.find(p => {
      const pNorm = norm(p.nombre);
      return palabras.some(palabra => pNorm.includes(palabra));
    });
  }
  
  return producto || null;
}

/* ============== Sistema de estado conversacional ============== */
function initState(state) {
  return {
    history: state?.history || [],
    cart: state?.cart || {},
    sessionId: state?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    // Estado de catering con valores explícitos
    catering: {
      activo: state?.catering?.activo || false,
      razonsocial: state?.catering?.razonsocial || null,
      tipoevento: state?.catering?.tipoevento || null,
      fecha: state?.catering?.fecha || null,
      hora: state?.catering?.hora || null,
      tipocomida: state?.catering?.tipocomida || null,
      lugar: state?.catering?.lugar || null,
      invitados: state?.catering?.invitados || null,
      telefono: state?.catering?.telefono || null,
      email: state?.catering?.email || null,
    },
  };
}

function addToHistory(state, role, content) {
  state.history.push({ role, content, timestamp: Date.now() });
  // Mantener solo últimos 12 mensajes para mejor contexto
  if (state.history.length > 12) {
    state.history = state.history.slice(-12);
  }
}

/* ============== Construcción del contexto para GPT ============== */
async function buildContextForGPT(state) {
  const catalogo = await loadCatalog();
  
  // Crear resumen del catálogo por categoría
  const categorias = {};
  catalogo.forEach(p => {
    if (!categorias[p.categoria]) categorias[p.categoria] = [];
    categorias[p.categoria].push({ nombre: p.nombre, precio: p.precio });
  });
  
  const catalogoTexto = Object.entries(categorias)
    .map(([cat, prods]) => {
      const lista = prods.map(p => `- ${p.nombre}: ${toPY(p.precio)} Gs`).join('\n');
      return `**${cat}**:\n${lista}`;
    })
    .join('\n\n');
  
  // Carrito
  const carritoItems = Object.values(state.cart);
  const carritoTexto = carritoItems.length > 0
    ? carritoItems.map(item => `- ${item.qty}× ${item.nombre} (${toPY(item.precio)} Gs c/u)`).join('\n')
    : 'Carrito vacío';
  
  const total = carritoItems.reduce((sum, item) => sum + (item.precio * item.qty), 0);

  // Estado de catering en progreso
  const cat = state.catering;
  let cateringInfo = '';
  
  if (cat.activo) {
    const campos = [
      { key: 'razonsocial', label: 'Nombre', valor: cat.razonsocial },
      { key: 'tipoevento', label: 'Tipo evento', valor: cat.tipoevento },
      { key: 'fecha', label: 'Fecha', valor: cat.fecha },
      { key: 'hora', label: 'Hora', valor: cat.hora },
      { key: 'tipocomida', label: 'Menú', valor: cat.tipocomida },
      { key: 'lugar', label: 'Lugar', valor: cat.lugar },
      { key: 'invitados', label: 'Invitados', valor: cat.invitados, opcional: true },
      { key: 'telefono', label: 'Teléfono', valor: cat.telefono, opcional: true },
      { key: 'email', label: 'Email', valor: cat.email, opcional: true },
    ];
    
    const obligatorios = campos.filter(c => !c.opcional);
    const opcionales = campos.filter(c => c.opcional);
    const faltantes = obligatorios.filter(c => !c.valor);
    const completados = campos.filter(c => c.valor);
    
    cateringInfo = `
**🎉 CATERING EN PROGRESO - DATOS ACTUALES:**
${completados.map(c => `✅ ${c.label}: ${c.valor}`).join('\n')}
${faltantes.length > 0 ? `\n**DATOS QUE FALTAN (obligatorios):**\n${faltantes.map(c => `❌ ${c.label}`).join('\n')}` : ''}

**INSTRUCCIÓN CRÍTICA:** 
- Los datos marcados con ✅ YA LOS TENÉS, NO los vuelvas a preguntar.
- Solo preguntá por los datos que faltan (❌).
- Cuando tengas TODOS los obligatorios (nombre, tipo evento, fecha, hora, menú, lugar), llamá a agendar_catering.
- Los opcionales (invitados, teléfono, email) solo preguntá UNA VEZ al final si el usuario quiere agregarlos.`;
  }
  
  return { catalogo: catalogoTexto, carrito: carritoTexto, total: toPY(total), totalNumerico: total, cateringInfo };
}

/* ============== Sistema de prompt para GPT ============== */
function buildSystemPrompt(context, state) {
  const fechaHoy = new Date().toLocaleDateString('es-PY', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  return `Sos el asistente virtual de Paniquiños, una panadería y confitería en Asunción, Paraguay.
Fecha actual: ${fechaHoy}

**INFORMACIÓN DE LA TIENDA:**
📍 Ubicación: Asunción, Paraguay
⏰ Horarios: Lun-Vie 8:00-18:00, Sáb-Dom 8:00-13:00
🚚 Delivery: Asunción y Gran Asunción
📱 WhatsApp: +595 992 544 305

**CATÁLOGO:**
${context.catalogo}

**CARRITO ACTUAL:**
${context.carrito}
**Total:** ${context.total} Gs
${context.cateringInfo}

**REGLAS CRÍTICAS:**

1. **AGREGAR PRODUCTOS:**
   - Si el usuario pide VARIOS productos en un mensaje, usá la función agregar_multiples_al_carrito.
   - Ejemplo: "dame 2 empanadas de carne y 1 flan" → usar agregar_multiples_al_carrito con array de productos.
   - NUNCA agregues solo 1 si pidieron varios.

2. **CATERING - MEMORIA PERFECTA:**
   - JAMÁS preguntes por un dato que ya tenés (marcado con ✅ arriba).
   - Si el usuario dice "ya te di ese dato", revisá el contexto y usá el dato que ya tenés.
   - Preguntá los datos UNO POR UNO en este orden: nombre → tipo evento → fecha → hora → menú → lugar.
   - Una vez que tengas los 6 obligatorios, preguntá UNA SOLA VEZ si quiere agregar opcionales (invitados/teléfono/email).
   - Si dice "no" o similar, agendá inmediatamente.

3. **INTERPRETACIÓN DE FECHAS/HORAS:**
   - "26 de diciembre del 2025" → fecha: "26 de diciembre del 2025"
   - "7 de la tarde" o "19 horas" → hora: "19:00"
   - El sistema convierte automáticamente, solo pasá el texto.

4. **ESTILO:**
   - Amigable y conciso (2-4 líneas máximo).
   - Emojis ocasionales (🍰 🥐 😊 🎉).
   - NUNCA inventes productos ni precios.
   - Si no encontrás un producto, ofrecé alternativas del catálogo.

5. **NO HAGAS:**
   - NO repitas preguntas.
   - NO muestres resúmenes largos a menos que el usuario lo pida.
   - NO uses datos de conversaciones anteriores (cada sesión es independiente).`;
}

/* ============== Definición de herramientas (tools) ============== */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description: "Agregar UN producto al carrito. Usar solo cuando el usuario pide 1 solo producto.",
      parameters: {
        type: "object",
        properties: {
          producto: { type: "string", description: "Nombre exacto del producto del catálogo" },
          cantidad: { type: "number", description: "Cantidad a agregar (default 1)" }
        },
        required: ["producto"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "agregar_multiples_al_carrito",
      description: "Agregar VARIOS productos al carrito en una sola operación. USAR cuando el usuario pide más de un producto diferente.",
      parameters: {
        type: "object",
        properties: {
          productos: {
            type: "array",
            description: "Lista de productos a agregar",
            items: {
              type: "object",
              properties: {
                producto: { type: "string", description: "Nombre del producto" },
                cantidad: { type: "number", description: "Cantidad" }
              },
              required: ["producto", "cantidad"]
            }
          }
        },
        required: ["productos"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "quitar_del_carrito",
      description: "Quitar productos del carrito",
      parameters: {
        type: "object",
        properties: {
          producto: { type: "string", description: "Nombre del producto a quitar" },
          cantidad: { type: "number", description: "Cantidad a quitar" }
        },
        required: ["producto"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "actualizar_catering",
      description: "Actualizar datos parciales del catering en progreso. Usar cada vez que el usuario proporciona un dato nuevo.",
      parameters: {
        type: "object",
        properties: {
          razonsocial: { type: "string", description: "Nombre del cliente o empresa" },
          tipoevento: { type: "string", description: "Tipo de evento (cumpleaños, boda, corporativo)" },
          fecha: { type: "string", description: "Fecha en formato natural (ej: '26 de diciembre del 2025')" },
          hora: { type: "string", description: "Hora en formato natural (ej: '7 de la tarde', '19:00')" },
          tipocomida: { type: "string", description: "Menú o tipo de comida" },
          lugar: { type: "string", description: "Dirección del evento" },
          invitados: { type: "number", description: "Número de invitados (opcional)" },
          telefono: { type: "string", description: "Teléfono de contacto (opcional)" },
          email: { type: "string", description: "Email de contacto (opcional)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "agendar_catering",
      description: "Agendar el servicio de catering. SOLO usar cuando se tienen TODOS los datos obligatorios: razonsocial, tipoevento, fecha, hora, tipocomida, lugar.",
      parameters: {
        type: "object",
        properties: {
          razonsocial: { type: "string" },
          tipoevento: { type: "string" },
          fecha: { type: "string" },
          hora: { type: "string" },
          tipocomida: { type: "string" },
          lugar: { type: "string" },
          invitados: { type: "number" },
          telefono: { type: "string" },
          email: { type: "string" }
        },
        required: ["razonsocial", "tipoevento", "fecha", "hora", "tipocomida", "lugar"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "iniciar_catering",
      description: "Iniciar el proceso de agendamiento de catering cuando el usuario menciona que quiere reservar/agendar un servicio para evento.",
      parameters: {
        type: "object",
        properties: {
          tipoevento: { type: "string", description: "Si el usuario ya mencionó el tipo de evento" }
        }
      }
    }
  }
];

/* ============== Procesamiento de tool calls ============== */
async function processToolCall(toolCall, state) {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments || '{}');
  
  console.log(`[TOOL] ${name}:`, args);
  
  switch (name) {
    case "agregar_al_carrito": {
      const prod = await buscarProductoPorNombre(args.producto);
      if (prod) {
        const qty = Math.max(1, parseInt(args.cantidad) || 1);
        if (!state.cart[prod.id]) {
          state.cart[prod.id] = { ...prod, qty: 0 };
        }
        state.cart[prod.id].qty += qty;
        return {
          success: true,
          message: `Agregué ${qty}× ${prod.nombre} al carrito 🛒`,
          action: { type: "ADD_TO_CART", product: prod, qty }
        };
      }
      return { success: false, message: `No encontré "${args.producto}" en el catálogo.` };
    }
    
    case "agregar_multiples_al_carrito": {
      const resultados = [];
      const acciones = [];
      
      for (const item of (args.productos || [])) {
        const prod = await buscarProductoPorNombre(item.producto);
        if (prod) {
          const qty = Math.max(1, parseInt(item.cantidad) || 1);
          if (!state.cart[prod.id]) {
            state.cart[prod.id] = { ...prod, qty: 0 };
          }
          state.cart[prod.id].qty += qty;
          resultados.push(`${qty}× ${prod.nombre}`);
          acciones.push({ type: "ADD_TO_CART", product: prod, qty });
        } else {
          resultados.push(`❌ "${item.producto}" no encontrado`);
        }
      }
      
      return {
        success: true,
        message: `Agregué al carrito: ${resultados.join(', ')} 🛒`,
        actions: acciones
      };
    }
    
    case "quitar_del_carrito": {
      const prod = await buscarProductoPorNombre(args.producto);
      if (prod && state.cart[prod.id]) {
        const qty = Math.max(1, parseInt(args.cantidad) || 1);
        state.cart[prod.id].qty -= qty;
        if (state.cart[prod.id].qty <= 0) {
          delete state.cart[prod.id];
        }
        const items = Object.values(state.cart);
        const newTotal = items.reduce((sum, item) => sum + (item.precio * item.qty), 0);
        return {
          success: true,
          message: `Quité ${qty}× ${prod.nombre}. Nuevo total: ${toPY(newTotal)} Gs`,
          action: { type: "REMOVE_FROM_CART", product: prod, qty }
        };
      }
      return { success: false, message: "Ese producto no está en tu carrito." };
    }
    
    case "iniciar_catering": {
      state.catering.activo = true;
      if (args.tipoevento) {
        state.catering.tipoevento = args.tipoevento;
      }
      return {
        success: true,
        message: "CATERING_INICIADO",
        continueConversation: true
      };
    }
    
    case "actualizar_catering": {
      state.catering.activo = true;
      
      // Actualizar solo los campos proporcionados
      if (args.razonsocial) state.catering.razonsocial = args.razonsocial;
      if (args.tipoevento) state.catering.tipoevento = args.tipoevento;
      if (args.fecha) state.catering.fecha = args.fecha;
      if (args.hora) state.catering.hora = args.hora;
      if (args.tipocomida) state.catering.tipocomida = args.tipocomida;
      if (args.lugar) state.catering.lugar = args.lugar;
      if (args.invitados) state.catering.invitados = args.invitados;
      if (args.telefono) state.catering.telefono = args.telefono;
      if (args.email) state.catering.email = args.email;
      
      // Verificar qué falta
      const cat = state.catering;
      const obligatorios = ['razonsocial', 'tipoevento', 'fecha', 'hora', 'tipocomida', 'lugar'];
      const faltantes = obligatorios.filter(k => !cat[k]);
      
      return {
        success: true,
        message: "DATOS_ACTUALIZADOS",
        faltantes: faltantes,
        continueConversation: true
      };
    }
    
    case "agendar_catering": {
      try {
        // Usar datos del estado si no vienen en args
        const cat = state.catering;
        const datos = {
          razonsocial: args.razonsocial || cat.razonsocial,
          tipoevento: args.tipoevento || cat.tipoevento,
          fecha: args.fecha || cat.fecha,
          hora: args.hora || cat.hora,
          tipocomida: args.tipocomida || cat.tipocomida,
          lugar: args.lugar || cat.lugar,
          invitados: args.invitados || cat.invitados,
          telefono: args.telefono || cat.telefono,
          email: args.email || cat.email,
        };
        
        console.log('[CATERING] Datos finales:', datos);
        
        // Normalizar fecha y hora
        const fechaNormalizada = parseFechaNatural(datos.fecha);
        const horaNormalizada = parseHoraNatural(datos.hora);
        
        console.log('[CATERING] Normalizado:', { fecha: fechaNormalizada, hora: horaNormalizada });
        
        if (!fechaNormalizada) {
          return { success: false, message: `No entendí la fecha "${datos.fecha}". ¿Podés decirla como "26 de diciembre" o "26/12/2025"?` };
        }
        
        if (!horaNormalizada) {
          return { success: false, message: `No entendí la hora "${datos.hora}". ¿Podés decirla como "19:00" o "7 de la tarde"?` };
        }
        
        // Llamar a la función RPC
        const { data, error } = await supa.rpc("catering_agendar", {
          p_razonsocial: datos.razonsocial,
          p_tipoevento: datos.tipoevento,
          p_fecha: fechaNormalizada,
          p_hora: horaNormalizada,
          p_tipocomida: datos.tipocomida,
          p_lugar: datos.lugar,
          p_ruc: 'CHAT-BOT',
          p_observaciones: null,
          p_invitados: datos.invitados ? parseInt(datos.invitados) : null,
          p_telefono: datos.telefono || null,
          p_email: datos.email || null
        });

        if (error) {
          console.error('[CATERING] Error:', error);
          if (error.message.includes('Cupo lleno') || error.message.includes('cupo')) {
            return { 
              success: false, 
              message: `❌ ${error.message}\n\n¿Querés probar con otra fecha? Los fines de semana tenemos más disponibilidad.` 
            };
          }
          return { success: false, message: `Error: ${error.message}` };
        }

        console.log('[CATERING] Éxito:', data);

        // Limpiar estado de catering
        state.catering = {
          activo: false,
          razonsocial: null, tipoevento: null, fecha: null, hora: null,
          tipocomida: null, lugar: null, invitados: null, telefono: null, email: null
        };

        // Construir resumen
        let resumen = `🎉 ¡Perfecto! Tu catering está pre-agendado.\n\n📋 **Resumen:**\n- Evento: ${datos.tipoevento}\n- Fecha: ${fechaNormalizada}\n- Hora: ${horaNormalizada}\n- Lugar: ${datos.lugar}\n- Menú: ${datos.tipocomida}`;
        
        if (datos.invitados) resumen += `\n- Invitados: ${datos.invitados}`;
        if (datos.telefono) resumen += `\n- Teléfono: ${datos.telefono}`;
        if (datos.email) resumen += `\n- Email: ${datos.email}`;
        
        resumen += `\n\n📱 **Siguiente paso:**\nContactanos por WhatsApp al **+595 992 544 305** para confirmar disponibilidad y coordinar detalles.\n\n¡Gracias por elegirnos! 😊`;

        return {
          success: true,
          message: resumen,
          action: { type: "CATERING_AGENDADO", data }
        };

      } catch (err) {
        console.error("[CATERING] Error catch:", err);
        return { success: false, message: `Error técnico. Por favor contactanos por WhatsApp: +595 992 544 305` };
      }
    }
    
    default:
      return { success: false, message: "Función no reconocida." };
  }
}

/* ============== Procesamiento principal con GPT ============== */
async function processWithGPT(userMsg, state) {
  const context = await buildContextForGPT(state);
  const systemPrompt = buildSystemPrompt(context, state);
  
  // Construir historial limpio (solo últimos mensajes relevantes)
  const cleanHistory = state.history.slice(-8).map(h => ({
    role: h.role,
    content: h.content
  }));
  
  const messages = [
    { role: "system", content: systemPrompt },
    ...cleanHistory,
    { role: "user", content: userMsg }
  ];
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: true // Permite múltiples llamadas de herramientas
    });
    
    const choice = completion.choices[0];
    const message = choice.message;
    
    // Si hay tool calls, procesarlos
    if (message.tool_calls && message.tool_calls.length > 0) {
      const results = [];
      let actions = [];
      
      for (const toolCall of message.tool_calls) {
        const result = await processToolCall(toolCall, state);
        results.push(result);
        
        if (result.action) actions.push(result.action);
        if (result.actions) actions.push(...result.actions);
      }
      
      // Si alguna herramienta requiere continuar conversación, hacer segunda llamada
      const needsContinue = results.some(r => r.continueConversation);
      
      if (needsContinue) {
        // Reconstruir contexto con datos actualizados
        const newContext = await buildContextForGPT(state);
        const newSystemPrompt = buildSystemPrompt(newContext, state);
        
        const followUp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            { role: "system", content: newSystemPrompt },
            ...cleanHistory,
            { role: "user", content: userMsg },
            { role: "assistant", content: `[Datos actualizados correctamente]` }
          ]
        });
        
        return {
          reply: followUp.choices[0].message.content,
          action: actions.length === 1 ? actions[0] : (actions.length > 1 ? { type: "MULTIPLE", actions } : null),
          state
        };
      }
      
      // Combinar mensajes de resultados
      const successMessages = results.filter(r => r.success && r.message && !r.message.includes('_'));
      const errorMessages = results.filter(r => !r.success);
      
      let reply = '';
      if (successMessages.length > 0) {
        reply = successMessages.map(r => r.message).join('\n\n');
      }
      if (errorMessages.length > 0) {
        reply += (reply ? '\n\n' : '') + errorMessages.map(r => r.message).join('\n');
      }
      
      // Si no hay mensaje significativo, usar la respuesta del asistente
      if (!reply || reply.includes('DATOS_ACTUALIZADOS') || reply.includes('CATERING_INICIADO')) {
        // Hacer llamada adicional para obtener respuesta natural
        const followUp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: [
            { role: "system", content: buildSystemPrompt(await buildContextForGPT(state), state) },
            ...cleanHistory,
            { role: "user", content: userMsg }
          ]
        });
        reply = followUp.choices[0].message.content;
      }
      
      return {
        reply,
        action: actions.length === 1 ? actions[0] : (actions.length > 1 ? { type: "MULTIPLE", actions } : null),
        state
      };
    }
    
    // Respuesta normal de texto
    return {
      reply: message.content || "¿En qué más puedo ayudarte?",
      state
    };
    
  } catch (err) {
    console.error("GPT error:", err);
    return { 
      reply: "Disculpá, tuve un problema. ¿Podés repetir?",
      state 
    };
  }
}

/* ============== TRACKING ============== */
async function trackInteraction(userMsg, reply, action, state, startTime) {
  try {
    let tipo = 'consulta';
    if (action?.type === 'ADD_TO_CART' || action?.type === 'MULTIPLE') tipo = 'agregar_carrito';
    else if (action?.type === 'CATERING_AGENDADO') tipo = 'catering';
    else if (action?.type === 'REMOVE_FROM_CART') tipo = 'quitar_carrito';
    else if (userMsg.match(/hola|buen|hey|buenos dias|buenas tardes/i)) tipo = 'saludo';
    
    const tiempoMs = Date.now() - startTime;
    
    await supa.rpc('registrar_interaccion_chatbot', {
      p_user_id: null,
      p_tipo: tipo,
      p_mensaje: userMsg.substring(0, 500),
      p_respuesta: reply.substring(0, 1000),
      p_accion: action?.type || null,
      p_exitoso: true,
      p_tiempo_ms: tiempoMs,
      p_metadata: {
        state_size: JSON.stringify(state).length,
        has_cart: Object.keys(state.cart || {}).length > 0,
        session_id: state.sessionId || 'anonymous',
        catering_activo: state.catering?.activo || false
      }
    });
    
    console.log(`[TRACKING] ${tipo} - ${tiempoMs}ms ✓`);
  } catch (error) {
    console.error('[TRACKING FAIL]:', error);
  }
}

/* ============== HANDLER PRINCIPAL ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const startTime = Date.now();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const userState = body?.state || {};
    
    // Inicializar estado
    const state = initState(userState);
    
    // Agregar mensaje del usuario al historial
    addToHistory(state, "user", userMsgRaw);
    
    // Procesar con GPT
    const result = await processWithGPT(userMsgRaw, state);
    
    // Agregar respuesta al historial
    if (result.reply) {
      addToHistory(result.state || state, "assistant", result.reply);
    }
    
    // Tracking (no bloquea)
    trackInteraction(userMsgRaw, result.reply, result.action, result.state || state, startTime)
      .catch(err => console.error('[TRACKING] Silent fail:', err));
    
    return res.status(200).json({
      reply: result.reply,
      action: result.action,
      state: result.state || state
    });
    
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ 
      error: "Error interno",
      reply: "Disculpá, hubo un problema técnico. Intentá de nuevo." 
    });
  }
}