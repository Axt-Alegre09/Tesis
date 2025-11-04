// /api/ask.js
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
  
  // Mapeo de meses en español
  const meses = {
    'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
    'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
    'septiembre': '09', 'setiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
  };
  
  // Patrón: "15 de diciembre" o "15 diciembre" o "15/12" o "15-12"
  let dia = null, mes = null, anio = null;
  
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
  
  // Buscar año explícito (2024, 2025, etc)
  const matchAnio = str.match(/\b(20\d{2})\b/);
  if (matchAnio) {
    anio = matchAnio[1];
  } else {
    // Si no hay año, determinar si es este año o el siguiente
    const ahora = new Date();
    const anioActual = ahora.getFullYear();
    const mesActual = ahora.getMonth() + 1;
    const diaActual = ahora.getDate();
    
    if (mes && parseInt(mes) < mesActual) {
      // Si el mes ya pasó, es el año siguiente
      anio = String(anioActual + 1);
    } else if (mes && parseInt(mes) === mesActual && dia && parseInt(dia) < diaActual) {
      // Si es el mismo mes pero el día ya pasó, es el año siguiente
      anio = String(anioActual + 1);
    } else {
      // En cualquier otro caso, es este año
      anio = String(anioActual);
    }
  }
  
  // Validar que tengamos día y mes
  if (!dia || !mes) return null;
  
  return `${anio}-${mes}-${dia}`;
}

function parseHoraNatural(texto) {
  if (!texto) return null;
  
  const str = texto.toLowerCase().trim();
  
  // Si ya está en formato HH:MM, retornar tal cual
  if (/^\d{1,2}:\d{2}$/.test(str)) {
    const parts = str.split(':');
    return `${parts[0].padStart(2, '0')}:${parts[1]}`;
  }
  
  let hora = null;
  
  // Patrones comunes
  // "17 horas", "17 hs", "5 de la tarde", "5 de la mañana"
  
  // Buscar número de hora
  const matchHora = str.match(/\b(\d{1,2})\b/);
  if (matchHora) {
    hora = parseInt(matchHora[1]);
    
    // Ajustar por AM/PM
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
    
    // Formato con :00 por defecto
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
async function buscarProductosPorCategoria(categoria) {
  const items = await loadCatalog();
  const catNorm = norm(categoria);
  
  return items.filter(p => 
    norm(p.categoria).includes(catNorm) ||
    norm(p.nombre).includes(catNorm)
  );
}

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
  
  return producto || null;
}

/* ============== Sistema de memoria conversacional ============== */
function initState(state) {
  return {
    history: state?.history || [],
    cart: state?.cart || {},
    lastCategory: state?.lastCategory || null,
    // 🆕 NUEVO: Estado para recopilar datos de catering paso a paso
    cateringData: state?.cateringData || {
      enProgreso: false,
      razonsocial: null,
      tipoevento: null,
      fecha: null,
      hora: null,
      tipocomida: null,
      lugar: null,
      invitados: null,
      telefono: null,
      email: null
    },
  };
}

function addToHistory(state, role, content) {
  state.history.push({ role, content, timestamp: Date.now() });
  // Mantener solo últimos 10 mensajes
  if (state.history.length > 10) {
    state.history = state.history.slice(-10);
  }
}

/* ============== Construcción del contexto para GPT ============== */
async function buildContextForGPT(userMsg, state) {
  // Obtener catálogo completo
  const catalogo = await loadCatalog();
  
  // Crear resumen del catálogo por categoría
  const categorias = {};
  catalogo.forEach(p => {
    if (!categorias[p.categoria]) categorias[p.categoria] = [];
    categorias[p.categoria].push({
      nombre: p.nombre,
      precio: p.precio
    });
  });
  
  const catalogoTexto = Object.entries(categorias)
    .map(([cat, prods]) => {
      const lista = prods.map(p => 
        `- ${p.nombre}: ${toPY(p.precio)} Gs`
      ).join('\n');
      return `**${cat}**:\n${lista}`;
    })
    .join('\n\n');
  
  // Crear contexto del carrito
  const carritoItems = Object.values(state.cart);
  const carritoTexto = carritoItems.length > 0
    ? carritoItems.map(item => 
        `- ${item.qty}× ${item.nombre} (${toPY(item.precio)} Gs c/u)`
      ).join('\n')
    : 'Carrito vacío';
  
  const total = carritoItems.reduce((sum, item) => 
    sum + (item.precio * item.qty), 0
  );

  // 🆕 Contexto de catering en progreso
  const cateringInfo = state.cateringData?.enProgreso ? 
    `\n\n**CATERING EN PROGRESO:**
Datos recopilados hasta ahora:
${state.cateringData.razonsocial ? `- Nombre: ${state.cateringData.razonsocial}` : '- Nombre: FALTA'}
${state.cateringData.tipoevento ? `- Tipo evento: ${state.cateringData.tipoevento}` : '- Tipo evento: FALTA'}
${state.cateringData.fecha ? `- Fecha: ${state.cateringData.fecha}` : '- Fecha: FALTA'}
${state.cateringData.hora ? `- Hora: ${state.cateringData.hora}` : '- Hora: FALTA'}
${state.cateringData.tipocomida ? `- Menú: ${state.cateringData.tipocomida}` : '- Menú: FALTA'}
${state.cateringData.lugar ? `- Lugar: ${state.cateringData.lugar}` : '- Lugar: FALTA'}
${state.cateringData.invitados ? `- Invitados: ${state.cateringData.invitados}` : ''}
${state.cateringData.telefono ? `- Teléfono: ${state.cateringData.telefono}` : ''}
${state.cateringData.email ? `- Email: ${state.cateringData.email}` : ''}

SOLO preguntá por los datos que dicen "FALTA". Si ya están completos los obligatorios, agendá automáticamente.`
    : '';
  
  return {
    catalogo: catalogoTexto,
    carrito: carritoTexto,
    total: toPY(total),
    totalNumerico: total,
    cateringInfo
  };
}

/* ============== Sistema de prompt para GPT ============== */
function buildSystemPrompt(context) {
  return `Sos el asistente virtual de Paniquiños, una panadería y confitería. Tu objetivo es ayudar a los clientes de forma natural, amigable y eficiente.

**INFORMACIÓN DE LA TIENDA:**
📍 **Ubicación:** Asunción, Paraguay
⏰ **Horarios:**
   - Lunes a Viernes: 8:00 AM a 6:00 PM
   - Sábados y Domingos: 8:00 AM a 1:00 PM
🚚 **Delivery:** Disponible en Asunción y Gran Asunción
📱 **WhatsApp:** +595 992 544 305

🎉 **SERVICIO DE CATERING:**
Paniquiños ofrece servicio de catering para eventos. Podés agendar directamente desde el chat.
**Datos necesarios para agendar:**
- Nombre del cliente/empresa (razonsocial)
- Tipo de evento (cumpleaños, boda, corporativo, etc.)
- Fecha del evento (acepta formato natural: "15 de diciembre", "15/12", etc.)
- Hora del evento (acepta formato natural: "17:00", "5 de la tarde", "17 horas")
- Tipo de comida/menú deseado
- Lugar del evento (dirección completa)
- Número de invitados (opcional)
- Teléfono de contacto (opcional)
- Email (opcional)

**IMPORTANTE sobre CATERING:**
- Los productos mencionados para catering NO se agregan al carrito
- El catering se agenda en la base de datos y luego el cliente coordina detalles y pago por WhatsApp
- Aceptá fechas en formato paraguayo: "15 de diciembre", "15/12/2024", etc.
- Aceptá horas en formato paraguayo: "5 de la tarde", "17 horas", "17:00"
- Si el cliente pide productos para catering (ej: "Quiero Combo 1 para el catering"), anotá eso en "tipocomida" pero NO lo agregues al carrito
- Solo agregá productos al carrito si el cliente dice explícitamente "agregá al carrito" o "quiero comprar ahora"

Cuando el cliente mencione catering o eventos, recopilá los datos de forma conversacional y natural.

**CATÁLOGO DISPONIBLE:**
${context.catalogo}

**CARRITO ACTUAL DEL CLIENTE:**
${context.carrito}
**Total actual:** ${context.total} Gs
${context.cateringInfo || ''}

**INSTRUCCIONES:**
1. Cuando te pregunten por productos o categorías, menciona SIEMPRE los nombres exactos y precios del catálogo
2. Si preguntan "¿Tienen empanadas?" → Lista los tipos de empanadas con sus precios
3. Si piden agregar algo, identifica el producto EXACTO del catálogo y responde confirmando
4. **CATERING - Recopilación natural:**
   - Cuando el usuario mencione catering, preguntá los datos UNO POR UNO
   - IMPORTANTE: Una vez que el usuario te dé un dato (fecha, hora, etc), YA LO TENÉS. No lo vuelvas a pedir.
   - Cuando el usuario responda con un dato, ese dato ya está en tu memoria de conversación
   - Cuando tengas TODOS los datos obligatorios (nombre, tipo evento, fecha, hora, menú, lugar), llamá a la función agendar_catering INMEDIATAMENTE
   - Los datos opcionales (invitados, teléfono, email) solo preguntá si el usuario quiere agregarlos
   - Formato de fechas: Aceptá "15 de diciembre", "15/12", etc. (el sistema los convierte automáticamente)
   - Formato de horas: Aceptá "17:00", "5 de la tarde", "17 horas" (el sistema los convierte automáticamente)
   - Si mencionan productos para el catering, eso es parte del "menú" (NO va al carrito)
5. Cuando pregunten por el total, calcula sumando todo el carrito
6. Si piden quitar algo, confirma qué se quitó y el nuevo total
7. Si preguntan por horarios, delivery o contacto, usa la información de la tienda
8. Sé conversacional pero preciso: usa los datos reales
9. Usa formato claro cuando listes productos:
    - Nombre: Precio Gs
10. NUNCA inventes productos, precios o información de la tienda
11. Mantén respuestas cortas (2-4 líneas) salvo que listen varios productos o estés en medio de agendar catering

**ESTILO:**
- Amigable y cercano (vos argentino/paraguayo)
- Natural, como un mozo/a atento
- Emojis ocasionales (🍰 🥐 😊 🎉)
- Directo y útil`;
}

/* ============== Procesamiento de intención con GPT ============== */
async function processWithGPT(userMsg, state) {
  const context = await buildContextForGPT(userMsg, state);
  const systemPrompt = buildSystemPrompt(context);
  
  // Construir historial para GPT
  const messages = [
    { role: "system", content: systemPrompt },
    ...state.history.slice(-6), // Últimos 6 mensajes
    { role: "user", content: userMsg }
  ];
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages,
      functions: [
        {
          name: "agregar_al_carrito",
          description: "Agregar productos al carrito del cliente",
          parameters: {
            type: "object",
            properties: {
              producto: { type: "string", description: "Nombre exacto del producto" },
              cantidad: { type: "number", description: "Cantidad a agregar" }
            },
            required: ["producto", "cantidad"]
          }
        },
        {
          name: "quitar_del_carrito",
          description: "Quitar productos del carrito",
          parameters: {
            type: "object",
            properties: {
              producto: { type: "string", description: "Nombre exacto del producto" },
              cantidad: { type: "number", description: "Cantidad a quitar" }
            },
            required: ["producto", "cantidad"]
          }
        },
        {
          name: "mostrar_total",
          description: "Mostrar el total del carrito",
          parameters: { type: "object", properties: {} }
        },
        // 🆕 NUEVA FUNCIÓN: Agendar catering
        {
          name: "agendar_catering",
          description: "Agendar un servicio de catering para eventos. Solo usar cuando se tengan TODOS los datos obligatorios.",
          parameters: {
            type: "object",
            properties: {
              razonsocial: { 
                type: "string", 
                description: "Nombre del cliente o empresa" 
              },
              tipoevento: { 
                type: "string", 
                description: "Tipo de evento (cumpleaños, boda, corporativo, etc.)" 
              },
              fecha: { 
                type: "string", 
                description: "Fecha del evento. Puede ser en formato natural como '15 de diciembre' o '15/12/2024'" 
              },
              hora: { 
                type: "string", 
                description: "Hora del evento. Puede ser en formato natural como '17:00', '5 de la tarde', '17 horas'" 
              },
              tipocomida: { 
                type: "string", 
                description: "Tipo de comida o menú solicitado" 
              },
              lugar: { 
                type: "string", 
                description: "Dirección o lugar del evento" 
              },
              invitados: { 
                type: "number", 
                description: "Número de invitados (opcional)" 
              },
              telefono: { 
                type: "string", 
                description: "Teléfono de contacto (opcional)" 
              },
              email: { 
                type: "string", 
                description: "Email de contacto (opcional)" 
              }
            },
            required: ["razonsocial", "tipoevento", "fecha", "hora", "tipocomida", "lugar"]
          }
        }
      ]
    });
    
    const choice = completion.choices[0];
    
    // Si GPT decidió usar una función
    if (choice.finish_reason === "function_call") {
      const funcCall = choice.message.function_call;
      const args = JSON.parse(funcCall.arguments);
      
      switch (funcCall.name) {
        case "agregar_al_carrito": {
          const prod = await buscarProductoPorNombre(args.producto);
          if (prod) {
            const qty = Math.max(1, parseInt(args.cantidad));
            if (!state.cart[prod.id]) {
              state.cart[prod.id] = { ...prod, qty: 0 };
            }
            state.cart[prod.id].qty += qty;
            
            return {
              reply: `Listo! Agregué ${qty}× ${prod.nombre} al carrito 🛒`,
              action: { 
                type: "ADD_TO_CART", 
                product: prod, 
                qty 
              },
              state
            };
          }
          return { 
            reply: "No encontré ese producto exacto. ¿Podés ser más específico?",
            state 
          };
        }
        
        case "quitar_del_carrito": {
          const prod = await buscarProductoPorNombre(args.producto);
          if (prod && state.cart[prod.id]) {
            const qty = Math.max(1, parseInt(args.cantidad));
            state.cart[prod.id].qty -= qty;
            
            if (state.cart[prod.id].qty <= 0) {
              delete state.cart[prod.id];
            }
            
            const items = Object.values(state.cart);
            const newTotal = items.reduce((sum, item) => 
              sum + (item.precio * item.qty), 0
            );
            
            return {
              reply: `Listo! Quité ${qty}× ${prod.nombre}. Tu nuevo total es ${toPY(newTotal)} Gs`,
              action: { 
                type: "REMOVE_FROM_CART", 
                product: prod, 
                qty 
              },
              state
            };
          }
          return { 
            reply: "Ese producto no está en tu carrito.",
            state 
          };
        }
        
        case "mostrar_total": {
          return {
            reply: `Tu total actual es ${context.total} Gs 💰`,
            action: { type: "GET_CART_TOTAL" },
            state
          };
        }

        // 🆕 NUEVO CASO: Agendar catering
        case "agendar_catering": {
          try {
            console.log('[CATERING] Args originales:', args);
            
            // 🆕 Normalizar fecha y hora a formato correcto
            const fechaNormalizada = parseFechaNatural(args.fecha);
            const horaNormalizada = parseHoraNatural(args.hora);
            
            console.log('[CATERING] Fecha normalizada:', args.fecha, '→', fechaNormalizada);
            console.log('[CATERING] Hora normalizada:', args.hora, '→', horaNormalizada);
            
            if (!fechaNormalizada) {
              return {
                reply: `No pude entender la fecha "${args.fecha}". ¿Podés decirla de nuevo? Por ejemplo: "15 de diciembre" o "15/12/2024"`,
                state
              };
            }
            
            if (!horaNormalizada) {
              return {
                reply: `No pude entender la hora "${args.hora}". ¿Podés decirla de nuevo? Por ejemplo: "17:00" o "5 de la tarde"`,
                state
              };
            }
            
            // Llamar a la función de Supabase con el ORDEN CORRECTO de parámetros
            const { data, error } = await supa.rpc("catering_agendar", {
              p_razonsocial: args.razonsocial,
              p_tipoevento: args.tipoevento,
              p_fecha: fechaNormalizada,
              p_hora: horaNormalizada,
              p_tipocomida: args.tipocomida,
              p_lugar: args.lugar,
              p_ruc: 'CHAT-BOT',
              p_observaciones: null,
              p_invitados: args.invitados || null,
              p_telefono: args.telefono || null,
              p_email: args.email || null
            });

            if (error) {
              console.error('[CATERING] Error de Supabase:', error);
              
              // Si es error de cupo lleno
              if (error.message.includes('Cupo lleno') || error.message.includes('cupo')) {
                return {
                  reply: `❌ ${error.message}\n\n¿Querés probar con otra fecha? Los fines de semana tenemos más disponibilidad (hasta 3 servicios).`,
                  state
                };
              }
              
              // Otro tipo de error
              return {
                reply: `❌ Hubo un problema: ${error.message}\n\n¿Podés verificar los datos e intentar de nuevo?`,
                state
              };
            }

            console.log('[CATERING] Agendado exitosamente:', data);

            // Éxito - Limpiar estado de catering
            state.cateringData = {
              enProgreso: false,
              razonsocial: null,
              tipoevento: null,
              fecha: null,
              hora: null,
              tipocomida: null,
              lugar: null,
              invitados: null,
              telefono: null,
              email: null
            };

            return {
              reply: `🎉 ¡Perfecto! Tu catering está pre-agendado.\n\n📋 **Resumen:**\n- Evento: ${args.tipoevento}\n- Fecha: ${fechaNormalizada}\n- Hora: ${horaNormalizada}\n- Lugar: ${args.lugar}\n- Menú: ${args.tipocomida}${args.invitados ? `\n- Invitados: ${args.invitados}` : ''}${args.telefono ? `\n- Contacto: ${args.telefono}` : ''}\n\n📱 **Siguiente paso:**\nContactanos por WhatsApp al **+595 992 544 305** para:\n✓ Confirmar disponibilidad\n✓ Ajustar menú y cantidades\n✓ Coordinar forma de pago (transferencia/efectivo)\n✓ Detalles finales del servicio\n\n¡Gracias por elegirnos! 😊`,
              action: {
                type: "CATERING_AGENDADO",
                data: data
              },
              state
            };

          } catch (err) {
            console.error("[CATERING] Error catch:", err);
            return {
              reply: `⚠️ Error técnico: ${err.message}\n\nPor favor intentá de nuevo o contactanos por WhatsApp: +595 992 544 305`,
              state
            };
          }
        }
      }
    }
    
    // Respuesta normal de texto
    const reply = choice.message.content.trim() || "¿En qué más te puedo ayudar?";
    return { reply, state };
    
  } catch (err) {
    console.error("GPT error:", err);
    return { 
      reply: "Disculpá, tuve un problema. ¿Podés repetir?",
      state 
    };
  }
}

/* ============== Handler principal ============== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

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
    
    return res.status(200).json({
      reply: result.reply,
      action: result.action,
      state: result.state || state
    });
    
  } catch (err) {
    console.error("Error /api/ask:", err);
    return res.status(500).json({ 
      error: "Error interno del servidor",
      reply: "Disculpá, hubo un problema técnico. Intentá de nuevo." 
    });
  }
}