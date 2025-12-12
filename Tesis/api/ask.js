// /api/ask.js
// ==================== CHATBOT PANIQUIÑOS v4.0 ====================
// Flujo de negocio correcto:
// 1. Recopilar TODOS los datos del cliente (9 campos)
// 2. Verificar cupo de fecha
// 3. Agendar y mostrar resumen completo
// 4. "Te contactaremos vía WhatsApp para confirmar"
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

const norm = (s = "") =>
  String(s)
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/* ============== Parsers ============== */
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
  
  const matchFull = str.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
  if (matchFull) {
    return `${matchFull[3]}-${matchFull[2].padStart(2, '0')}-${matchFull[1].padStart(2, '0')}`;
  }
  
  const matchDia = str.match(/\b(\d{1,2})\b/);
  if (matchDia) dia = matchDia[1].padStart(2, '0');
  
  for (const [nombre, num] of Object.entries(meses)) {
    if (str.includes(nombre)) { mes = num; break; }
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
  
  const matchHora = str.match(/\b(\d{1,2})\b/);
  if (matchHora) {
    let hora = parseInt(matchHora[1]);
    
    if (str.includes('tarde') || str.includes('pm')) {
      if (hora < 12) hora += 12;
    } else if (str.includes('noche')) {
      if (hora < 12) hora += 12;
    } else if (str.includes('mañana') || str.includes('am')) {
      if (hora === 12) hora = 0;
    }
    
    return `${String(hora).padStart(2, '0')}:00`;
  }
  
  return null;
}

/* ============== Verificar cupo ============== */
async function verificarCupo(fechaTexto) {
  const fechaNorm = parseFechaNatural(fechaTexto);
  if (!fechaNorm) return { ok: false, error: `No entendí la fecha "${fechaTexto}". Decila como "26 de diciembre" o "26/12/2025".` };
  
  try {
    const { data, error } = await supa.rpc('verificar_cupo_catering', { p_fecha: fechaNorm });
    
    if (error) {
      console.error('Error cupo:', error);
      return { ok: true, fecha: fechaNorm }; // Si falla, asumir que hay cupo
    }
    
    if (!data.tiene_cupo) {
      return { 
        ok: false, 
        error: `❌ El ${fechaNorm} ya tiene ${data.limite} servicios agendados (cupo lleno). ¿Qué otra fecha te sirve?`,
        cupoLleno: true
      };
    }
    
    return { ok: true, fecha: fechaNorm, disponible: data.disponible };
  } catch (err) {
    console.error('Error cupo:', err);
    return { ok: true, fecha: fechaNorm };
  }
}

/* ============== Catálogo ============== */
let _cache = { at: 0, items: [] };

async function loadCatalog() {
  const now = Date.now();
  if (now - _cache.at < 180000 && _cache.items.length) return _cache.items;

  const { data } = await supa.from("v_productos_publicos").select("id, nombre, precio, categoria_nombre");
  const items = (data || []).map(p => ({
    id: p.id,
    nombre: String(p.nombre || "").trim(),
    precio: Number(p.precio || 0),
    categoria: String(p.categoria_nombre || "").trim(),
  }));
  
  _cache = { at: now, items };
  return items;
}

async function buscarProducto(nombre) {
  const items = await loadCatalog();
  const nombreNorm = norm(nombre);
  
  return items.find(p => norm(p.nombre) === nombreNorm) ||
         items.find(p => norm(p.nombre).includes(nombreNorm) || nombreNorm.includes(norm(p.nombre))) ||
         items.find(p => nombreNorm.split(' ').filter(x => x.length > 2).some(palabra => norm(p.nombre).includes(palabra))) ||
         null;
}

/* ============== Estado ============== */
function crearCateringLimpio() {
  return {
    activo: false,
    paso: 0, // Para saber en qué paso estamos
    nombre: null,
    telefono: null,
    email: null,
    direccion: null,
    tipoServicio: null,
    menu: null,
    invitados: null,
    fecha: null,
    hora: null,
  };
}

function initState(state) {
  return {
    history: state?.history || [],
    cart: state?.cart || {},
    sessionId: state?.sessionId || `s_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    catering: state?.catering?.activo ? state.catering : crearCateringLimpio(),
  };
}

function addToHistory(state, role, content) {
  state.history.push({ role, content, ts: Date.now() });
  if (state.history.length > 12) state.history = state.history.slice(-12);
}

/* ============== Campos del catering ============== */
const CAMPOS_CATERING = [
  { key: 'nombre', pregunta: '¿Cuál es tu nombre completo?', ejemplo: 'Ej: Juan Pérez' },
  { key: 'telefono', pregunta: '¿Tu número de teléfono?', ejemplo: 'Ej: 0991234567' },
  { key: 'email', pregunta: '¿Tu correo electrónico?', ejemplo: 'Ej: juan@gmail.com' },
  { key: 'tipoServicio', pregunta: '¿Qué tipo de evento es?', ejemplo: 'Ej: cumpleaños, boda, corporativo' },
  { key: 'fecha', pregunta: '¿Qué fecha sería el evento?', ejemplo: 'Ej: 26 de diciembre', verificarCupo: true },
  { key: 'hora', pregunta: '¿A qué hora?', ejemplo: 'Ej: 19:00 o 7 de la tarde' },
  { key: 'menu', pregunta: '¿Qué menú o comida te gustaría?', ejemplo: 'Ej: empanadas, bocaditos, torta' },
  { key: 'invitados', pregunta: '¿Cuántos invitados aproximadamente?', ejemplo: 'Ej: 50 personas' },
  { key: 'direccion', pregunta: '¿Cuál es la dirección del evento?', ejemplo: 'Ej: Avda. España 1234' },
];

function getSiguienteCampoFaltante(catering) {
  for (const campo of CAMPOS_CATERING) {
    if (!catering[campo.key]) return campo;
  }
  return null; // Todos completos
}

function getDatosCompletos(catering) {
  return CAMPOS_CATERING.every(c => catering[c.key]);
}

/* ============== Construir contexto ============== */
async function buildContext(state) {
  const catalogo = await loadCatalog();
  
  const categorias = {};
  catalogo.forEach(p => {
    if (!categorias[p.categoria]) categorias[p.categoria] = [];
    categorias[p.categoria].push(`${p.nombre}: ${toPY(p.precio)} Gs`);
  });
  
  const catalogoTexto = Object.entries(categorias)
    .map(([cat, prods]) => `**${cat}:**\n${prods.map(p => `- ${p}`).join('\n')}`)
    .join('\n\n');
  
  const carritoItems = Object.values(state.cart);
  const carritoTexto = carritoItems.length > 0
    ? carritoItems.map(item => `- ${item.qty}× ${item.nombre}`).join('\n')
    : 'Vacío';
  const total = carritoItems.reduce((sum, item) => sum + (item.precio * item.qty), 0);

  // Info de catering
  let cateringInfo = '';
  if (state.catering.activo) {
    const cat = state.catering;
    const datosActuales = [];
    const faltante = getSiguienteCampoFaltante(cat);
    
    CAMPOS_CATERING.forEach(campo => {
      if (cat[campo.key]) {
        datosActuales.push(`✅ ${campo.key}: ${cat[campo.key]}`);
      }
    });
    
    cateringInfo = `
══════════════════════════════════════
🎉 RESERVA DE CATERING EN PROGRESO
══════════════════════════════════════
${datosActuales.length > 0 ? datosActuales.join('\n') : '(Sin datos aún)'}

${faltante ? `
➡️ SIGUIENTE PREGUNTA: ${faltante.pregunta}
   ${faltante.ejemplo}
` : `
✅ ¡TODOS LOS DATOS COMPLETOS!
⚠️ DEBÉS llamar "ejecutar_reserva" AHORA.
`}
══════════════════════════════════════`;
  }
  
  return { catalogo: catalogoTexto, carrito: carritoTexto, total: toPY(total), cateringInfo };
}

/* ============== Prompt ============== */
function buildSystemPrompt(context) {
  return `Sos el asistente de Paniquiños (panadería/confitería en Asunción, Paraguay).

INFORMACIÓN:
- Horarios: Lun-Vie 8:00-18:00, Sáb-Dom 8:00-13:00
- WhatsApp: +595 992 544 305
- Límite catering: 2/día (L-V), 3/día (S-D)

CATÁLOGO:
${context.catalogo}

CARRITO: ${context.carrito} | Total: ${context.total} Gs
${context.cateringInfo}

══════════════════════════════════════
REGLAS IMPORTANTES:
══════════════════════════════════════

1. **CARRITO:**
   - 1 producto → "agregar_carrito"
   - Varios productos → "agregar_multiples"

2. **CATERING:**
   - Cuando el usuario quiera reservar/agendar → "iniciar_catering"
   - Luego, por CADA respuesta del usuario → "guardar_dato" con el campo y valor EXACTO
   - NUNCA inventes datos. Usá EXACTAMENTE lo que dijo el usuario.
   - Preguntá UN campo a la vez, en orden.
   - Cuando estén los 9 datos → "ejecutar_reserva"

3. **PROHIBIDO:**
   - Inventar nombres, fechas, teléfonos o cualquier dato
   - Decir un nombre diferente al que dijo el usuario
   - Mostrar resúmenes sin ejecutar la función
   - Saltear campos

4. **ESTILO:**
   - Corto y amigable (1-2 líneas)
   - Emojis ocasionales 😊
   - Cuando guardes un dato, preguntá inmediatamente el siguiente`;
}

/* ============== Tools ============== */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "agregar_carrito",
      description: "Agregar UN producto al carrito",
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
      name: "agregar_multiples",
      description: "Agregar VARIOS productos al carrito",
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
              }
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
      name: "iniciar_catering",
      description: "Iniciar el proceso de reserva de catering. Limpia datos anteriores.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "guardar_dato",
      description: "Guardar UN dato del catering. Llamar con el campo y valor EXACTO que dijo el usuario.",
      parameters: {
        type: "object",
        properties: {
          campo: { 
            type: "string", 
            enum: ["nombre", "telefono", "email", "tipoServicio", "fecha", "hora", "menu", "invitados", "direccion"]
          },
          valor: { type: "string", description: "Valor EXACTO que dijo el usuario, sin modificar" }
        },
        required: ["campo", "valor"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ejecutar_reserva",
      description: "Ejecutar la reserva de catering. Solo llamar cuando TODOS los 9 campos estén completos.",
      parameters: { type: "object", properties: {} }
    }
  }
];

/* ============== Procesar tool calls ============== */
async function processToolCall(toolCall, state) {
  const name = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments || '{}');
  
  console.log(`[TOOL] ${name}:`, args);
  
  switch (name) {
    case "agregar_carrito": {
      const prod = await buscarProducto(args.producto);
      if (prod) {
        const qty = Math.max(1, parseInt(args.cantidad) || 1);
        if (!state.cart[prod.id]) state.cart[prod.id] = { ...prod, qty: 0 };
        state.cart[prod.id].qty += qty;
        return { message: `Agregué ${qty}× ${prod.nombre} al carrito 🛒` };
      }
      return { message: `No encontré "${args.producto}". ¿Podés ser más específico?` };
    }
    
    case "agregar_multiples": {
      const resultados = [];
      for (const item of (args.productos || [])) {
        const prod = await buscarProducto(item.producto);
        if (prod) {
          const qty = Math.max(1, parseInt(item.cantidad) || 1);
          if (!state.cart[prod.id]) state.cart[prod.id] = { ...prod, qty: 0 };
          state.cart[prod.id].qty += qty;
          resultados.push(`${qty}× ${prod.nombre}`);
        }
      }
      return { message: resultados.length > 0 ? `Agregué al carrito: ${resultados.join(', ')} 🛒` : 'No encontré esos productos.' };
    }
    
    case "iniciar_catering": {
      state.catering = crearCateringLimpio();
      state.catering.activo = true;
      const primerCampo = CAMPOS_CATERING[0];
      return { 
        message: `¡Perfecto! Vamos a reservar tu servicio de catering. 🎉\n\n${primerCampo.pregunta} ${primerCampo.ejemplo}`,
        continuar: true
      };
    }
    
    case "guardar_dato": {
      if (!state.catering.activo) {
        state.catering = crearCateringLimpio();
        state.catering.activo = true;
      }
      
      const { campo, valor } = args;
      
      // Validación especial para fecha
      if (campo === 'fecha') {
        const cupoCheck = await verificarCupo(valor);
        if (!cupoCheck.ok) {
          return { message: cupoCheck.error, continuar: true };
        }
        state.catering.fecha = cupoCheck.fecha; // Guardar fecha normalizada
      } else {
        state.catering[campo] = valor;
      }
      
      console.log(`[CATERING] Guardado ${campo}:`, state.catering[campo]);
      
      // Ver qué sigue
      const siguiente = getSiguienteCampoFaltante(state.catering);
      
      if (siguiente) {
        return { 
          message: `Perfecto. ${siguiente.pregunta} ${siguiente.ejemplo}`,
          continuar: true
        };
      } else {
        // ¡Todos los datos! Ejecutar reserva automáticamente
        return await ejecutarReserva(state);
      }
    }
    
    case "ejecutar_reserva": {
      return await ejecutarReserva(state);
    }
    
    default:
      return { message: "¿En qué puedo ayudarte?" };
  }
}

async function ejecutarReserva(state) {
  const cat = state.catering;
  
  // Validar que tenemos todo
  const faltante = getSiguienteCampoFaltante(cat);
  if (faltante) {
    return { 
      message: `Todavía falta: ${faltante.pregunta}`,
      continuar: true
    };
  }
  
  try {
    const fechaNorm = parseFechaNatural(cat.fecha) || cat.fecha;
    const horaNorm = parseHoraNatural(cat.hora) || cat.hora;
    
    console.log('[RESERVA] Ejecutando:', { ...cat, fechaNorm, horaNorm });
    
    const { data, error } = await supa.rpc("catering_agendar", {
      p_razonsocial: cat.nombre,
      p_tipoevento: cat.tipoServicio,
      p_fecha: fechaNorm,
      p_hora: horaNorm,
      p_tipocomida: cat.menu,
      p_lugar: cat.direccion,
      p_ruc: 'CHAT-BOT',
      p_observaciones: null,
      p_invitados: parseInt(cat.invitados) || null,
      p_telefono: cat.telefono,
      p_email: cat.email
    });

    if (error) {
      console.error('[RESERVA] Error:', error);
      
      if (error.message.includes('Cupo lleno')) {
        state.catering.fecha = null;
        return { 
          message: `❌ Cupo lleno para esa fecha. ¿Qué otra fecha te sirve?`,
          continuar: true
        };
      }
      return { message: `Error: ${error.message}. Intentá de nuevo.` };
    }

    console.log('[RESERVA] ✅ Éxito:', data);

    // Construir resumen bonito
    const resumen = `
🎉 **¡Pre-reserva creada exitosamente!**

📋 **Datos de tu reserva:**
• **Nombre:** ${cat.nombre}
• **Teléfono:** ${cat.telefono}
• **Email:** ${cat.email}
• **Tipo de evento:** ${cat.tipoServicio}
• **Fecha:** ${fechaNorm}
• **Hora:** ${horaNorm}
• **Menú:** ${cat.menu}
• **Invitados:** ${cat.invitados}
• **Dirección:** ${cat.direccion}

📱 **Te contactaremos vía WhatsApp al ${cat.telefono} para confirmar los datos y coordinar el pago.**

¡Gracias por elegir Paniquiños! 😊
    `.trim();

    // Limpiar estado
    state.catering = crearCateringLimpio();

    return { message: resumen, reservaExitosa: true };

  } catch (err) {
    console.error('[RESERVA] Error:', err);
    return { message: `Error técnico. Contactanos al +595 992 544 305` };
  }
}

/* ============== Proceso principal ============== */
async function processWithGPT(userMsg, state) {
  const context = await buildContext(state);
  const systemPrompt = buildSystemPrompt(context);
  
  const messages = [
    { role: "system", content: systemPrompt },
    ...state.history.slice(-8).map(h => ({ role: h.role, content: h.content })),
    { role: "user", content: userMsg }
  ];
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3, // Más determinístico
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      parallel_tool_calls: true
    });
    
    const message = completion.choices[0].message;
    
    if (message.tool_calls?.length > 0) {
      let respuestaFinal = '';
      
      for (const toolCall of message.tool_calls) {
        const result = await processToolCall(toolCall, state);
        if (result.message) {
          respuestaFinal = result.message; // Usar la última respuesta
        }
      }
      
      return { reply: respuestaFinal || message.content || "¿En qué más puedo ayudarte?", state };
    }
    
    return { reply: message.content || "¿En qué más puedo ayudarte?", state };
    
  } catch (err) {
    console.error("GPT error:", err);
    return { reply: "Disculpá, tuve un problema. ¿Podés repetir?", state };
  }
}

/* ============== Tracking ============== */
async function track(userMsg, reply, state, startTime) {
  try {
    let tipo = 'consulta';
    if (userMsg.match(/hola|buen|hey/i)) tipo = 'saludo';
    if (reply.includes('Pre-reserva creada')) tipo = 'catering';
    if (reply.includes('carrito')) tipo = 'agregar_carrito';
    
    await supa.rpc('registrar_interaccion_chatbot', {
      p_user_id: null,
      p_tipo: tipo,
      p_mensaje: userMsg.substring(0, 500),
      p_respuesta: reply.substring(0, 1000),
      p_accion: tipo,
      p_exitoso: true,
      p_tiempo_ms: Date.now() - startTime,
      p_metadata: { session_id: state.sessionId, catering_activo: state.catering?.activo }
    });
  } catch (e) { console.error('[TRACK]:', e); }
}

/* ============== Handler ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const startTime = Date.now();

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const userMsg = body?.messages?.[0]?.content ?? "";
    
    const state = initState(body?.state || {});
    addToHistory(state, "user", userMsg);
    
    const result = await processWithGPT(userMsg, state);
    
    addToHistory(result.state, "assistant", result.reply);
    
    track(userMsg, result.reply, result.state, startTime).catch(() => {});
    
    return res.status(200).json({
      reply: result.reply,
      state: result.state
    });
    
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ reply: "Error técnico. Intentá de nuevo." });
  }
}