// /api/ask.js
// ==================== API CHATBOT v3.0 - CORRECCIONES CRÍTICAS ====================
// Cambios v3:
// 1. FORZAR llamada a agendar_catering cuando hay datos completos
// 2. Limpiar estado completamente al iniciar nuevo catering
// 3. Verificar cupo ANTES de recopilar todos los datos
// 4. Prompt más estricto para evitar invención de datos
// ==================================================================================

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
  
  const matchDia = str.match(/\b(\d{1,2})\b/);
  if (matchDia) dia = matchDia[1].padStart(2, '0');
  
  for (const [nombre, num] of Object.entries(meses)) {
    if (str.includes(nombre)) {
      mes = num;
      break;
    }
  }
  
  if (!mes) {
    const matchMes = str.match(/\b\d{1,2}[\/\-](\d{1,2})\b/);
    if (matchMes) mes = matchMes[1].padStart(2, '0');
  }
  
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
  
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  
  let hora = null;
  
  const matchHora = str.match(/\b(\d{1,2})\b/);
  if (matchHora) {
    hora = parseInt(matchHora[1]);
    
    if (str.includes('tarde') || str.includes('pm')) {
      if (hora < 12) hora += 12;
    } else if (str.includes('mañana') || str.includes('am')) {
      if (hora === 12) hora = 0;
    } else if (str.includes('noche')) {
      if (hora < 12) hora += 12;
    }
    
    const matchMinutos = str.match(/(\d{1,2})\s*:\s*(\d{2})/);
    const minutos = matchMinutos ? matchMinutos[2] : '00';
    
    return `${String(hora).padStart(2, '0')}:${minutos}`;
  }
  
  return null;
}

/* ============== Verificar cupo ============== */
async function verificarCupoFecha(fecha) {
  try {
    const fechaNorm = parseFechaNatural(fecha);
    if (!fechaNorm) return { tiene_cupo: true, mensaje: null };
    
    const { data, error } = await supa.rpc('verificar_cupo_catering', {
      p_fecha: fechaNorm
    });
    
    if (error) {
      console.error('Error verificando cupo:', error);
      return { tiene_cupo: true, mensaje: null };
    }
    
    return {
      tiene_cupo: data.tiene_cupo,
      disponible: data.disponible,
      limite: data.limite,
      fecha: fechaNorm,
      mensaje: !data.tiene_cupo 
        ? `❌ El ${fechaNorm} ya tiene ${data.limite} servicios agendados (cupo lleno). ¿Querés elegir otra fecha?`
        : null
    };
  } catch (err) {
    console.error('Error verificando cupo:', err);
    return { tiene_cupo: true, mensaje: null };
  }
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

/* ============== Búsqueda de productos ============== */
async function buscarProductoPorNombre(nombre) {
  const items = await loadCatalog();
  const nombreNorm = norm(nombre);
  
  let producto = items.find(p => norm(p.nombre) === nombreNorm);
  
  if (!producto) {
    producto = items.find(p => 
      norm(p.nombre).includes(nombreNorm) ||
      nombreNorm.includes(norm(p.nombre))
    );
  }
  
  if (!producto) {
    const palabras = nombreNorm.split(' ').filter(p => p.length > 2);
    producto = items.find(p => {
      const pNorm = norm(p.nombre);
      return palabras.some(palabra => pNorm.includes(palabra));
    });
  }
  
  return producto || null;
}

/* ============== Estado de sesión LIMPIO ============== */
function createFreshCateringState() {
  return {
    activo: false,
    razonsocial: null,
    tipoevento: null,
    fecha: null,
    hora: null,
    tipocomida: null,
    lugar: null,
    invitados: null,
    telefono: null,
    email: null,
  };
}

function initState(state) {
  return {
    history: state?.history || [],
    cart: state?.cart || {},
    sessionId: state?.sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    catering: state?.catering?.activo ? state.catering : createFreshCateringState(),
  };
}

function addToHistory(state, role, content) {
  state.history.push({ role, content, timestamp: Date.now() });
  if (state.history.length > 10) {
    state.history = state.history.slice(-10);
  }
}

/* ============== Contexto para GPT ============== */
async function buildContextForGPT(state) {
  const catalogo = await loadCatalog();
  
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
  
  const carritoItems = Object.values(state.cart);
  const carritoTexto = carritoItems.length > 0
    ? carritoItems.map(item => `- ${item.qty}× ${item.nombre} (${toPY(item.precio)} Gs c/u)`).join('\n')
    : 'Carrito vacío';
  
  const total = carritoItems.reduce((sum, item) => sum + (item.precio * item.qty), 0);

  // Estado de catering
  const cat = state.catering;
  let cateringInfo = '';
  
  if (cat.activo) {
    const datosActuales = [];
    const datosFaltantes = [];
    
    if (cat.razonsocial) datosActuales.push(`✅ Nombre: ${cat.razonsocial}`);
    else datosFaltantes.push('❌ Nombre');
    
    if (cat.tipoevento) datosActuales.push(`✅ Tipo evento: ${cat.tipoevento}`);
    else datosFaltantes.push('❌ Tipo evento');
    
    if (cat.fecha) datosActuales.push(`✅ Fecha: ${cat.fecha}`);
    else datosFaltantes.push('❌ Fecha');
    
    if (cat.hora) datosActuales.push(`✅ Hora: ${cat.hora}`);
    else datosFaltantes.push('❌ Hora');
    
    if (cat.tipocomida) datosActuales.push(`✅ Menú: ${cat.tipocomida}`);
    else datosFaltantes.push('❌ Menú');
    
    if (cat.lugar) datosActuales.push(`✅ Lugar: ${cat.lugar}`);
    else datosFaltantes.push('❌ Lugar');
    
    // Opcionales
    if (cat.invitados) datosActuales.push(`✅ Invitados: ${cat.invitados}`);
    if (cat.telefono) datosActuales.push(`✅ Teléfono: ${cat.telefono}`);
    if (cat.email) datosActuales.push(`✅ Email: ${cat.email}`);
    
    const obligatoriosCompletos = !datosFaltantes.some(d => 
      d.includes('Nombre') || d.includes('Tipo evento') || d.includes('Fecha') || 
      d.includes('Hora') || d.includes('Menú') || d.includes('Lugar')
    );
    
    cateringInfo = `
═══════════════════════════════════════════
🎉 CATERING EN PROGRESO - DATOS ACTUALES:
═══════════════════════════════════════════
${datosActuales.join('\n')}
${datosFaltantes.length > 0 ? `\n**FALTAN (obligatorios):**\n${datosFaltantes.join('\n')}` : ''}
═══════════════════════════════════════════

${obligatoriosCompletos ? `
⚠️ ¡¡¡IMPORTANTE!!! TENÉS TODOS LOS DATOS OBLIGATORIOS.
DEBÉS llamar a la función "agendar_catering" AHORA MISMO.
NO muestres resúmenes. NO preguntes más. EJECUTÁ la función.
` : `
Preguntá SOLO por el siguiente dato faltante.
NUNCA inventes datos. Si el usuario ya dijo algo, usá ESE valor exacto.
`}`;
  }
  
  return { catalogo: catalogoTexto, carrito: carritoTexto, total: toPY(total), totalNumerico: total, cateringInfo };
}

/* ============== Prompt del sistema ============== */
function buildSystemPrompt(context, state) {
  const fechaHoy = new Date().toLocaleDateString('es-PY', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });
  
  return `Sos el asistente de Paniquiños (panadería/confitería en Asunción, Paraguay).
Fecha actual: ${fechaHoy}

TIENDA:
- Horarios: Lun-Vie 8:00-18:00, Sáb-Dom 8:00-13:00
- Delivery: Asunción y alrededores
- WhatsApp: +595 992 544 305
- Catering: Límite 2 servicios/día (L-V), 3 servicios/día (S-D)

CATÁLOGO:
${context.catalogo}

CARRITO:
${context.carrito}
Total: ${context.total} Gs
${context.cateringInfo}

═══════════════════════════════════════════
REGLAS ABSOLUTAS (NO IGNORAR):
═══════════════════════════════════════════

1. **PRODUCTOS MÚLTIPLES:**
   - Si piden varios productos → usar "agregar_multiples_al_carrito"
   - Ejemplo: "2 empanadas y 1 flan" → agregar_multiples_al_carrito

2. **CATERING - REGLAS ESTRICTAS:**
   - NUNCA inventes datos. Si no te dijeron algo, está VACÍO.
   - USA EXACTAMENTE lo que el usuario dijo, sin modificar.
   - Preguntá UN dato a la vez en este orden: nombre → tipo evento → fecha → hora → menú → lugar
   - Cuando tengas los 6 datos obligatorios: LLAMÁ "agendar_catering" INMEDIATAMENTE
   - NO muestres "resúmenes bonitos". Llamá la función.
   - Si falla por cupo, preguntá SOLO nueva fecha (mantené resto de datos)

3. **DATOS OPCIONALES (invitados/teléfono/email):**
   - Solo preguntá DESPUÉS de tener los 6 obligatorios
   - Preguntá UNA vez: "¿Querés agregar invitados, teléfono o email?"
   - Si dice no → agendar inmediatamente

4. **PROHIBIDO:**
   - Inventar nombres, fechas, horas o cualquier dato
   - Mostrar datos de conversaciones anteriores
   - Decir "Diego" si el usuario dijo "Juan"
   - Decir "Boda" si el usuario dijo "corporativo"
   - Mostrar resúmenes sin ejecutar la función

5. **ESTILO:**
   - Respuestas cortas (1-3 líneas)
   - Emojis ocasionales
   - Amigable pero eficiente`;
}

/* ============== Definición de herramientas ============== */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "agregar_al_carrito",
      description: "Agregar UN producto al carrito",
      parameters: {
        type: "object",
        properties: {
          producto: { type: "string", description: "Nombre exacto del producto" },
          cantidad: { type: "number", description: "Cantidad (default 1)" }
        },
        required: ["producto"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "agregar_multiples_al_carrito",
      description: "Agregar VARIOS productos en una operación. USAR cuando piden más de 1 producto diferente.",
      parameters: {
        type: "object",
        properties: {
          productos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                producto: { type: "string" },
                cantidad: { type: "number" }
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
          producto: { type: "string" },
          cantidad: { type: "number" }
        },
        required: ["producto"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "iniciar_catering",
      description: "Iniciar proceso de catering. IMPORTANTE: Limpia cualquier catering anterior.",
      parameters: {
        type: "object",
        properties: {
          tipoevento: { type: "string", description: "Si ya mencionó el tipo de evento" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "guardar_dato_catering",
      description: "Guardar UN dato del catering. Llamar cada vez que el usuario proporciona información.",
      parameters: {
        type: "object",
        properties: {
          campo: { 
            type: "string", 
            enum: ["razonsocial", "tipoevento", "fecha", "hora", "tipocomida", "lugar", "invitados", "telefono", "email"],
            description: "Qué campo guardar"
          },
          valor: { type: "string", description: "Valor EXACTO que dijo el usuario" }
        },
        required: ["campo", "valor"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "agendar_catering",
      description: "EJECUTAR cuando se tienen TODOS los datos obligatorios. NO mostrar resumen, ejecutar directamente.",
      parameters: {
        type: "object",
        properties: {
          confirmar: { type: "boolean", description: "Siempre true para confirmar" }
        },
        required: ["confirmar"]
      }
    }
  }
];

/* ============== Procesamiento de tool calls ============== */
async function processToolCall(toolCall, state) {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments || '{}');
  
  console.log(`[TOOL] ${name}:`, JSON.stringify(args));
  
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
      return { success: false, message: `No encontré "${args.producto}". ¿Podés ser más específico?` };
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
        if (state.cart[prod.id].qty <= 0) delete state.cart[prod.id];
        
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
      // LIMPIAR completamente cualquier catering anterior
      state.catering = createFreshCateringState();
      state.catering.activo = true;
      
      if (args.tipoevento) {
        state.catering.tipoevento = args.tipoevento;
      }
      
      console.log('[CATERING] Iniciado limpio:', state.catering);
      return {
        success: true,
        message: null, // Sin mensaje, que GPT pregunte el primer dato
        continueConversation: true
      };
    }
    
    case "guardar_dato_catering": {
      if (!state.catering.activo) {
        state.catering = createFreshCateringState();
        state.catering.activo = true;
      }
      
      const campo = args.campo;
      const valor = args.valor;
      
      // Validación especial para fecha - verificar cupo
      if (campo === 'fecha') {
        const cupoCheck = await verificarCupoFecha(valor);
        if (!cupoCheck.tiene_cupo) {
          return {
            success: false,
            message: cupoCheck.mensaje,
            continueConversation: true
          };
        }
      }
      
      // Guardar el valor
      state.catering[campo] = valor;
      
      console.log(`[CATERING] Guardado ${campo}:`, valor);
      console.log('[CATERING] Estado actual:', state.catering);
      
      // Verificar si ya tenemos todos los obligatorios
      const cat = state.catering;
      const obligatoriosCompletos = cat.razonsocial && cat.tipoevento && 
                                     cat.fecha && cat.hora && 
                                     cat.tipocomida && cat.lugar;
      
      return {
        success: true,
        message: null,
        datosCompletos: obligatoriosCompletos,
        continueConversation: true
      };
    }
    
    case "agendar_catering": {
      const cat = state.catering;
      
      console.log('[CATERING] Intentando agendar con:', cat);
      
      // Validar que tenemos los datos obligatorios
      if (!cat.razonsocial || !cat.tipoevento || !cat.fecha || !cat.hora || !cat.tipocomida || !cat.lugar) {
        const faltantes = [];
        if (!cat.razonsocial) faltantes.push('nombre');
        if (!cat.tipoevento) faltantes.push('tipo de evento');
        if (!cat.fecha) faltantes.push('fecha');
        if (!cat.hora) faltantes.push('hora');
        if (!cat.tipocomida) faltantes.push('menú');
        if (!cat.lugar) faltantes.push('lugar');
        
        return {
          success: false,
          message: `Faltan datos: ${faltantes.join(', ')}. Por favor proporcioná esa información.`,
          continueConversation: true
        };
      }
      
      try {
        const fechaNormalizada = parseFechaNatural(cat.fecha);
        const horaNormalizada = parseHoraNatural(cat.hora);
        
        console.log('[CATERING] Normalizado:', { fecha: fechaNormalizada, hora: horaNormalizada });
        
        if (!fechaNormalizada) {
          return { 
            success: false, 
            message: `No entendí la fecha "${cat.fecha}". Decila como "26 de diciembre" o "26/12/2025".`,
            continueConversation: true
          };
        }
        
        if (!horaNormalizada) {
          return { 
            success: false, 
            message: `No entendí la hora "${cat.hora}". Decila como "19:00" o "7 de la tarde".`,
            continueConversation: true
          };
        }
        
        // Llamar a Supabase
        const { data, error } = await supa.rpc("catering_agendar", {
          p_razonsocial: cat.razonsocial,
          p_tipoevento: cat.tipoevento,
          p_fecha: fechaNormalizada,
          p_hora: horaNormalizada,
          p_tipocomida: cat.tipocomida,
          p_lugar: cat.lugar,
          p_ruc: 'CHAT-BOT',
          p_observaciones: null,
          p_invitados: cat.invitados ? parseInt(cat.invitados) : null,
          p_telefono: cat.telefono || null,
          p_email: cat.email || null
        });

        if (error) {
          console.error('[CATERING] Error Supabase:', error);
          
          if (error.message.includes('Cupo lleno') || error.message.includes('cupo')) {
            // Limpiar SOLO la fecha
            state.catering.fecha = null;
            return { 
              success: false, 
              message: `❌ Cupo lleno para ${fechaNormalizada}. ¿Qué otra fecha te sirve? (Los demás datos los mantengo)`,
              continueConversation: true
            };
          }
          return { success: false, message: `Error: ${error.message}` };
        }

        console.log('[CATERING] ✅ Agendado:', data);

        // Construir resumen
        let resumen = `🎉 ¡Listo! Tu catering está pre-agendado.\n\n`;
        resumen += `📋 **Resumen:**\n`;
        resumen += `- Cliente: ${cat.razonsocial}\n`;
        resumen += `- Evento: ${cat.tipoevento}\n`;
        resumen += `- Fecha: ${fechaNormalizada}\n`;
        resumen += `- Hora: ${horaNormalizada}\n`;
        resumen += `- Menú: ${cat.tipocomida}\n`;
        resumen += `- Lugar: ${cat.lugar}`;
        
        if (cat.invitados) resumen += `\n- Invitados: ${cat.invitados}`;
        if (cat.telefono) resumen += `\n- Teléfono: ${cat.telefono}`;
        if (cat.email) resumen += `\n- Email: ${cat.email}`;
        
        resumen += `\n\n📱 Contactanos al **+595 992 544 305** para confirmar. ¡Gracias! 😊`;

        // LIMPIAR estado de catering
        state.catering = createFreshCateringState();

        return {
          success: true,
          message: resumen,
          action: { type: "CATERING_AGENDADO", data }
        };

      } catch (err) {
        console.error("[CATERING] Error:", err);
        return { success: false, message: `Error técnico. Contactanos por WhatsApp: +595 992 544 305` };
      }
    }
    
    default:
      return { success: false, message: "Función no reconocida." };
  }
}

/* ============== Procesamiento principal ============== */
async function processWithGPT(userMsg, state) {
  const context = await buildContextForGPT(state);
  const systemPrompt = buildSystemPrompt(context, state);
  
  const cleanHistory = state.history.slice(-6).map(h => ({
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
      temperature: 0.5, // Más determinístico
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: true
    });
    
    const choice = completion.choices[0];
    const message = choice.message;
    
    // Si hay tool calls, procesarlos
    if (message.tool_calls && message.tool_calls.length > 0) {
      const results = [];
      let actions = [];
      let needsContinue = false;
      
      for (const toolCall of message.tool_calls) {
        const result = await processToolCall(toolCall, state);
        results.push(result);
        
        if (result.action) actions.push(result.action);
        if (result.actions) actions.push(...result.actions);
        if (result.continueConversation) needsContinue = true;
      }
      
      // Construir respuesta
      const messagesWithResults = results
        .filter(r => r.message)
        .map(r => r.message);
      
      if (messagesWithResults.length > 0) {
        return {
          reply: messagesWithResults.join('\n\n'),
          action: actions.length === 1 ? actions[0] : (actions.length > 1 ? { type: "MULTIPLE", actions } : null),
          state
        };
      }
      
      // Si necesita continuar conversación (ej: después de guardar dato)
      if (needsContinue) {
        const newContext = await buildContextForGPT(state);
        const newSystemPrompt = buildSystemPrompt(newContext, state);
        
        const followUp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.5,
          messages: [
            { role: "system", content: newSystemPrompt },
            ...cleanHistory,
            { role: "user", content: userMsg }
          ],
          tools: TOOLS,
          tool_choice: "auto"
        });
        
        const followUpMsg = followUp.choices[0].message;
        
        // Si el follow-up también tiene tool calls, procesarlos
        if (followUpMsg.tool_calls && followUpMsg.tool_calls.length > 0) {
          for (const toolCall of followUpMsg.tool_calls) {
            const result = await processToolCall(toolCall, state);
            if (result.message) {
              return {
                reply: result.message,
                action: result.action,
                state
              };
            }
          }
        }
        
        return {
          reply: followUpMsg.content || "¿En qué más puedo ayudarte?",
          action: actions.length > 0 ? (actions.length === 1 ? actions[0] : { type: "MULTIPLE", actions }) : null,
          state
        };
      }
    }
    
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
    
    await supa.rpc('registrar_interaccion_chatbot', {
      p_user_id: null,
      p_tipo: tipo,
      p_mensaje: userMsg.substring(0, 500),
      p_respuesta: reply.substring(0, 1000),
      p_accion: action?.type || null,
      p_exitoso: true,
      p_tiempo_ms: Date.now() - startTime,
      p_metadata: {
        state_size: JSON.stringify(state).length,
        has_cart: Object.keys(state.cart || {}).length > 0,
        session_id: state.sessionId,
        catering_activo: state.catering?.activo || false
      }
    });
  } catch (error) {
    console.error('[TRACKING]:', error);
  }
}

/* ============== HANDLER ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const startTime = Date.now();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsgRaw = body?.messages?.[0]?.content ?? "";
    const userState = body?.state || {};
    
    const state = initState(userState);
    addToHistory(state, "user", userMsgRaw);
    
    const result = await processWithGPT(userMsgRaw, state);
    
    if (result.reply) {
      addToHistory(result.state || state, "assistant", result.reply);
    }
    
    trackInteraction(userMsgRaw, result.reply, result.action, result.state || state, startTime)
      .catch(err => console.error('[TRACKING]:', err));
    
    return res.status(200).json({
      reply: result.reply,
      action: result.action,
      state: result.state || state
    });
    
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ 
      error: "Error interno",
      reply: "Disculpá, hubo un problema. Intentá de nuevo." 
    });
  }
}