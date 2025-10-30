// api/ask/route.js
export const runtime = 'edge';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;

function ensureEnv() {
  const miss = [];
  if (!OPENAI_API_KEY) miss.push('OPENAI_API_KEY');
  if (!SUPABASE_URL) miss.push('SUPABASE_URL');
  if (!SUPABASE_SERVICE_ROLE) miss.push('SUPABASE_SERVICE_ROLE');
  if (miss.length) throw new Error(`Faltan variables: ${miss.join(', ')}`);
}

const TB_PRODUCTOS = 'productos';
const COLS_PRODUCTOS = 'id,nombre,descripcion,precio,imagen,activo,categoria_id';
const TB_INFO = 'negocio_info';
const TZ = 'America/Asuncion';

function isPromoWindowNow(d = new Date()) {
  try {
    const local = new Date(d.toLocaleString('en-US', { timeZone: TZ }));
    const day = local.getDay();
    const hh = local.getHours();
    const mm = local.getMinutes();
    return day === 5 && (hh > 16 && (hh < 19 || (hh === 19 && mm === 0)));
  } catch { return false; }
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

async function supaSelect(table, columns, opts = {}) {
  const { q } = opts;
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
    url.searchParams.set('select', columns);
    if (q && q.trim()) {
      url.searchParams.set('or', `nombre.ilike.*${q}*,descripcion.ilike.*${q}*`);
    }
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

async function supaKbSearch(queryEmbedding, matchCount = 5) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/kb_search`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query_embedding: queryEmbedding, match_count: matchCount }),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  } catch (e) {
    console.warn('[ask] kb_search warn:', e);
    return [];
  }
}

async function openaiChat(messages, temperature = 0.5, model = 'gpt-4o-mini') {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature }),
  });
  if (!res.ok) throw new Error(`OpenAI chat error: ${await res.text()}`);
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
  if (!res.ok) throw new Error(`OpenAI embedding error: ${await res.text()}`);
  const j = await res.json();
  return j?.data?.[0]?.embedding || null;
}

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

function buildSystemPrompt(negocioInfo, promos, suggested) {
  return `
Eres “Paniquiños Bot”, el mozo digital de una confitería en Paraguay.
Tono: cálido, breve, directo; ofrecé ayuda como en mostrador.
Reglas:
- Español siempre.
- Solo usá lo provisto (negocioInfo, productos, promos, KB). Si no está, decí que no tenés ese dato.
- Formateá precios como "99.999 Gs".
- Si preguntan por horarios/dirección/teléfono, usá negocioInfo.
- Si hay promo activa y es relevante, mencionála una vez (sin insistir).
- Evitá párrafos largos; usá listas cortas (máx 5 ítems) cuando sirva.
- No inventes sabores, tamaños ni disponibilidad fuera de los datos.
Contexto negocioInfo:
${JSON.stringify(negocioInfo || {}, null, 2)}
Productos relevantes:
${JSON.stringify(suggested || [], null, 2)}
Promos activas:
${JSON.stringify(promos || [], null, 2)}
`.trim();
}

async function runAsk({ messages = [], frontProducts = [] }) {
  ensureEnv();

  // último user y breve historial (máx 8 mensajes)
  const lastUser =
    messages.slice().reverse().find((m) => m.role === 'user')?.content?.slice(0, 2000) || '';
  const recent = messages.slice(-8)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 2000) }));

  const dbProducts =
    (frontProducts?.length ? frontProducts : await supaSelect(TB_PRODUCTOS, COLS_PRODUCTOS)) || [];
  const negocioInfoRows = await supaSelect(TB_INFO, '*');
  const negocioInfo = negocioInfoRows?.[0] || {};
  const promos = getActivePromos();
  const suggested = pickSuggestedProducts(dbProducts, lastUser, 5);

  // KB opcional
  let kbContext = '';
  try {
    const needKb =
      suggested.length < 1 ||
      /horario|direccion|dirección|telefono|teléfono|whats|ubicacion|ubicación|quien|quién|historia|info|informacion|información|servicio|catering/i.test(lastUser);
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
    console.warn('[ask] RAG warn:', e);
  }

  const sys = buildSystemPrompt(negocioInfo, promos, suggested);
  const msgs = [{ role: 'system', content: sys }];
  if (kbContext) msgs.push({ role: 'system', content: `KB verificada:\n${kbContext}` });
  msgs.push(...recent);

  try {
    const reply =
      (await openaiChat(msgs, 0.5, 'gpt-4o-mini')) ||
      'Ahora mismo no tengo ese dato. ¿Querés preguntarme de otra forma?';

    const rich = {};
    if (promos.length) rich.promos = promos;
    if (suggested.length) {
      rich.products = suggested.map((p) => ({
        id: p.id, nombre: p.nombre, precio: Number(p.precio || 0), imagen: p.imagen || null,
      }));
    }
    return { reply, rich };
  } catch (e) {
    // Fallback HUMANO en 200 para que el front no muestre error feo
    console.error('[/api/ask] ERROR LLM:', e);
    const fallback = `Estoy teniendo un problemita para responder con toda la info ahora mismo 🙈. \
¿Querés que te recomiende algo del menú o te paso precios de una categoría?`;
    return { reply: fallback, rich: { products: suggested.slice(0,3) } };
  }
}

export async function POST(req) {
  try {
    const { messages = [], products: frontProducts = [] } = await req.json().catch(() => ({}));
    const data = await runAsk({ messages, frontProducts });
    return json(data, 200);
  } catch (e) {
    console.error('[/api/ask] ERROR:', e);
    return json({ reply: 'Perdón, el asistente no está disponible.', rich: null }, 200);
  }
}

export async function GET(req) {
  try {
    const q = new URL(req.url).searchParams.get('question') || 'Hola';
    const data = await runAsk({ messages: [{ role: 'user', content: q }], frontProducts: [] });
    return json(data, 200);
  } catch (e) {
    console.error('[/api/ask][GET] ERROR:', e);
    return json({ reply: 'No pude procesar tu consulta.', rich: null }, 200);
  }
}
