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
  
  return {
    catalogo: catalogoTexto,
    carrito: carritoTexto,
    total: toPY(total),
    totalNumerico: total
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

**CATÁLOGO DISPONIBLE:**
${context.catalogo}

**CARRITO ACTUAL DEL CLIENTE:**
${context.carrito}
**Total actual:** ${context.total} Gs

**INSTRUCCIONES:**
1. Cuando te pregunten por productos o categorías, menciona SIEMPRE los nombres exactos y precios del catálogo
2. Si preguntan "¿Tienen empanadas?" → Lista los tipos de empanadas con sus precios
3. Si piden agregar algo, identifica el producto EXACTO del catálogo y responde confirmando
4. Cuando pregunten por el total, calcula sumando todo el carrito
5. Si piden quitar algo, confirma qué se quitó y el nuevo total
6. Si preguntan por horarios, delivery o contacto, usa la información de la tienda
7. Para pedidos por WhatsApp, menciona que pueden escribir al número de la tienda
8. Sé conversacional pero preciso: usa los datos reales
9. Si algo no está en el catálogo, dilo claramente y sugiere alternativas
10. Usa formato claro cuando listes productos:
    - Nombre: Precio Gs
11. NUNCA inventes productos, precios o información de la tienda
12. Mantén respuestas cortas (2-4 líneas) salvo que listen varios productos

**ESTILO:**
- Amigable y cercano (vos argentino/paraguayo)
- Natural, como un mozo/a atento
- Emojis ocasionales (🍰 🥐 😊)
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