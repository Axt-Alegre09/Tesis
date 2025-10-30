// App Router (Edge Runtime)
export const runtime = 'edge';

/**
 * /api/ask
 * Body esperado: { messages: [{role, content}, ...], products?: [] }
 * Devuelve: { reply: string, rich?: { products?: [], promos?: [] } }
 */

// ===== Util =====
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

// ===== Entorno =====
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

// Tablas/columnas (ajusta si cambian los nombres)
const TB_PRODUCTOS = 'productos';
const COLS_PRODUCTOS = 'id,nombre,descripcion,precio,imagen,activo,categoria_id';
const TB_INFO = 'negocio_info'; // opcional; si no existe, quedará vacío

// Zona horaria para promos
const TZ = 'America/Asuncion';

// ===== Helpers tiempo/promos =====
function isPromoWindowNow(d = new Date()) {
  try {
    const local = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
    const day = local.getDay(); // 5 = viernes
    const hh = local.getHours();
    const mm = local.getMinutes();
    return day === 5 && (hh > 16 && (hh < 19 || (hh === 19 && mm === 0)));
  } catch {
    return false;
  }
}

function getActivePromos() {
  const promos = [];
  if (isPromoWindowNow()) {
    promos.push({
      id: 'emp-2x1',
      title: '2x1 en Empanadas',
      detail: 'Válido hoy de 17:00 a 19:00 (hora de Asunción). 🥟✨',
      cta: { text: 'Ver empanadas', payload: 'ver empanadas' },
    });
  }
  return promos;
}

// ===== Supabase helpers (REST + RPC) =====
async function supaSelect(table, columns, opts = {}) {
  const { q } = opts;
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set('select', columns);

    // filtro simple por nombre/descripcion si hay texto de búsqueda
    if (q && q.trim()) {
      // PostgREST OR: nombre ILIKE *q* OR descripcion ILIKE *q*
      url.searchParams.set('or', `nombre.ilike.*${q}*,descripcion.ilike.*${q}*`);
    }

    // Solo productos activos si existe la columna "activo"
    if (table === TB_PRODUCTOS) url.searchParams.set('activo', 'eq.true');

    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.error('[ask] supaSelect error:', e);
    return [];
  }
}

// RPC: kb_search (RAG fallback con embeddings)
async function supaKbSearch(queryEmbedding, matchCount = 5) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/kb_search`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query_embedding: queryEmbedding,
        match_count: matchCount,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.error('[ask] supaKbSearch error:', e);
    return [];
  }
}

// ===== OpenAI helpers =====
async function openaiChat(messages, temperature = 0.4, model = 'gpt-4o-mini') {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI chat error: ${t}`);
  }
  const j = await res.json();
  return j?.choices?.[0]?.message?.content?.trim() || null;
}

async function openaiEmbedding(input, model = 'text-embedding-3-small') {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, input }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI embedding error: ${t}`);
  }
  const j = await res.json();
  return j?.data?.[0]?.embedding || null;
}

// ===== Productos sugeridos (scoring sencillo) =====
function pickSuggestedProducts(all, userText, max = 5) {
  if (!Array.isArray(all) || !all.length) return [];
  const t = String(userText || '').toLowerCase();

  const score = (p) => {
    const n = String(p?.nombre || '').toLowerCase();
    const d = String(p?.descripcion || '').toLowerCase();
    let s = 0;
    for (const w of t.split(/\s+/)) {
      if (!w) continue;
      if (n.includes(w)) s += 2;
      if (d.includes(w)) s += 1;
    }
    if (/(empan|bocadit|combo|alfajor|torta|pan|milanesa)/.test(t)) s += 1;
    if (p?.activo === true) s += 0.5;
    return s;
  };

  return [...all]
    .map((p) => ({ ...p, __s: score(p) }))
    .sort((a, b) => b.__s - a.__s)
    .slice(0, max)
    .map(({ __s, ...p }) => p);
}

// ===== Handler principal =====
export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { messages = [], products: frontProducts = [] } = await req.json().catch(() => ({}));
    const lastUser =
      messages.slice().reverse().find((m) => m.role === 'user')?.content?.slice(0, 2000) ||
      '';

    // 1) Cargar datos desde Supabase
    const dbProducts =
      (frontProducts && frontProducts.length ? frontProducts : await supaSelect(TB_PRODUCTOS, COLS_PRODUCTOS)) || [];

    const negocioInfoRows = await supaSelect(TB_INFO, '*');
    const negocioInfo = negocioInfoRows?.[0] || {};

    // 2) Promos dinámicas
    const promos = getActivePromos();

    // 3) Elegir subset de productos relevantes (para dar contexto al modelo)
    const suggested = pickSuggestedProducts(dbProducts, lastUser, 5);

    // 4) RAG: si el texto es informativo y/o hay poco match, usar embeddings + kb_search
    let kbContext = '';
    try {
      const needKb =
        suggested.length < 1 ||
        /horario|direccion|dirección|telefono|teléfono|whats|ubicacion|ubicación|quien|quién|historia|info|informacion|información|servicio|catering/i.test(
          lastUser
        );
      if (needKb && lastUser) {
        const emb = await openaiEmbedding(lastUser);
        if (emb) {
          const matches = await supaKbSearch(emb, 5);
          if (Array.isArray(matches) && matches.length) {
            kbContext = matches.map((m) => m?.content).filter(Boolean).join('\n');
          }
        }
      }
    } catch (e) {
      console.warn('[ask] RAG fallback warning:', e);
    }

    // 5) System prompt — tono “mozo del local”, ultra natural y conciso
    const systemPrompt = `
Eres “Paniquiños Bot”, el asistente de una confitería en Paraguay.
Hablas de forma natural, cálida y profesional (estilo mozo amable). 
Reglas:
- Responde SIEMPRE en español.
- Usa SOLO la información provista (productos, negocio, promos y KB). Si algo no está, decí que no tenés ese dato.
- Para precios, usa el formato "99.999 Gs".
- Si preguntan por horarios/dirección/teléfono, usa "negocioInfo".
- Si hay una promo activa y es relevante, menciónala una sola vez sin insistir.
- Evita respuestas largas; usa bullets solo cuando mejora la claridad (máx 5).
- No inventes disponibilidad, tamaños o sabores que no estén en los datos.
`;

    // 6) Preparar mensajes para OpenAI
    const messagesForLLM = [
      { role: 'system', content: systemPrompt.trim() },
      { role: 'system', content: `negocioInfo:\n${JSON.stringify(negocioInfo, null, 2)}` },
      { role: 'system', content: `productos (subset):\n${JSON.stringify(suggested, null, 2)}` },
      { role: 'system', content: `promos activas:\n${JSON.stringify(promos, null, 2)}` },
    ];

    if (kbContext) {
      messagesForLLM.push({
        role: 'system',
        content: `KB (contexto adicional verificado, no inventes fuera de esto):\n${kbContext}`,
      });
    }

    messagesForLLM.push({ role: 'user', content: lastUser || 'Hola' });

    // 7) Llamada al modelo
    const reply =
      (await openaiChat(messagesForLLM, 0.4, 'gpt-4o-mini')) ||
      'Ahora mismo no tengo ese dato. ¿Querés preguntarme de otra forma?';

    // 8) Payload “rico” para el front (tarjetas/promos)
    const rich = {};
    if (promos.length) rich.promos = promos;
    if (suggested.length) {
      rich.products = suggested.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio || 0),
        imagen: p.imagen || null,
      }));
    }

    return json({ reply, rich }, 200);
  } catch (e) {
    console.error('[/api/ask] ERROR:', e);
    return json(
      {
        reply:
          'Perdón, algo falló al preparar la respuesta. Podés intentar de nuevo en un momento.',
        rich: null,
      },
      500
    );
  }
}
