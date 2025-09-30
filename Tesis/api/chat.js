// api/chat.js
// Bot de reservas Paniquiños — Vercel Serverless (Node runtime)
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  // --- CORS / preflight ---
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Access-Control-Allow-Origin", "*");

  // --- ENV ---
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: "Faltan variables de entorno" });
  }

  // --- Supabase ---
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  // --- Config ---
  const TZ_OFFSET = "-03:00";                 // Asunción
  const HOURS_OPEN = { min: "10:00", max: "22:00" };

  const SYSTEM = `
Eres "Paniquiños Bot", asistente de reservas de catering.
— Hablas en español (Paraguay).
— Aceptas fechas y horas en lenguaje natural (ej: "3 de octubre", "10 de la mañana", "7/10 a las 15", "5pm").
— Cuando el usuario te da varios datos en una sola frase, transformalos a: fecha AAAA-MM-DD y hora HH:MM (24h).
— Datos necesarios (en una sola pregunta si faltan): nombre, teléfono, dirección, email (opcional), tipo_servicio, menú/pedido (texto libre), invitados (>0), fecha y hora.
— Validar: fecha futura; hora entre ${HOURS_OPEN.min} y ${HOURS_OPEN.max}; invitados > 0.
— Si están todos los datos, usá "crear_reserva". Si piden disponibilidad, usá "ver_disponibilidad".
— Confirmá SOLO con el resultado real de la herramienta. Formato:
"✅ Reserva confirmada: {fecha} {hora}, {invitados} invitados, {tipo_servicio}. Nº: {id}".
`.trim();

  const tools = [
    {
      type: "function",
      function: {
        name: "ver_disponibilidad",
        description: "Devuelve si hay disponibilidad para fecha/hora e invitados",
        parameters: {
          type: "object",
          properties: {
            fecha: { type: "string", description: "AAAA-MM-DD" },
            hora:  { type: "string", description: "HH:MM" },
            invitados: { type: "number" }
          },
          required: ["fecha", "hora", "invitados"]
        }
      }
    },
    {
      type: "function",
      function: {
        name: "crear_reserva",
        description: "Crea la reserva en la base de datos",
        parameters: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            telefono: { type: "string" },
            email: { type: "string" },
            fecha: { type: "string" },   // AAAA-MM-DD
            hora: { type: "string" },    // HH:MM
            invitados: { type: "number" },
            tipo_servicio: { type: "string" },
            menu: { type: "string" },
            direccion: { type: "string" },
            notas: { type: "string" }
          },
          required: ["nombre","telefono","fecha","hora","invitados"]
        }
      }
    }
  ];

  // ---------- Utilidades de fecha/hora y parsing en español ----------
  const pad2 = n => String(n).padStart(2, "0");
  const meses = {
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
    julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12
  };

  function clampHourStr(hhmm) {
    const [h, m] = (hhmm || "").split(":").map(x => parseInt(x, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return `${pad2(h)}:${pad2(m)}`;
  }

  function toFechaReservaISO(fecha, hora) {
    const hhmm = clampHourStr(hora);
    if (!hhmm) return null;
    const isoLocal = `${fecha}T${hhmm}:00${TZ_OFFSET}`; // local -03:00
    const d = new Date(isoLocal);
    if (isNaN(d.getTime())) return null;
    return d.toISOString(); // timestamptz
  }

  const isFuture = isoUtc => new Date(isoUtc).getTime() > Date.now();
  const isWithinHours = hhmm => hhmm >= HOURS_OPEN.min && hhmm <= HOURS_OPEN.max;

  function parseFechaHoraNatural(text) {
    const now = new Date();
    const thisYear = now.getFullYear();

    let dd, mm, yyyy, hh = 0, mi = 0, gotTime = false;

    const t = text.toLowerCase();

    // dd/mm[/yyyy] o dd-mm
    let m = t.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
    if (m) {
      dd = parseInt(m[1], 10); mm = parseInt(m[2], 10);
      yyyy = m[3] ? ((m[3].length === 2) ? (2000 + parseInt(m[3],10)) : parseInt(m[3],10)) : thisYear;
    }

    // "3 de octubre [de 2025]"
    if (!dd) {
      const r = t.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+de\s+(\d{4}))?/i);
      if (r) {
        dd = parseInt(r[1], 10);
        const mesTxt = r[2].normalize("NFD").replace(/\p{Diacritic}/gu,"");
        mm = meses[mesTxt] || null;
        yyyy = r[3] ? parseInt(r[3],10) : thisYear;
      }
    }

    // hora: "a las 3", "15:30", "3pm", "10 de la mañana", "9 hs"
    let h = t.match(/(?:a\s+las\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|hs|h|horas|de\s+la\s+mañana|de\s+la\s+tarde|de\s+la\s+noche)?/i);
    if (h) {
      hh = parseInt(h[1],10); mi = h[2] ? parseInt(h[2],10) : 0;
      const suf = h[3] || "";
      const sufNorm = suf.normalize("NFD").replace(/\p{Diacritic}/gu,"");
      if (/pm|p\.m\.|tarde|noche/.test(sufNorm)) { if (hh < 12) hh += 12; }
      if (/am|a\.m\.|manana/.test(sufNorm))      { if (hh === 12) hh = 0;  }
      gotTime = true;
    }

    if (!dd || !mm || !yyyy) return null;
    // Si no viene año y la fecha ya pasó, poner año siguiente
    const candidate = new Date(`${yyyy}-${pad2(mm)}-${pad2(dd)}T00:00:00${TZ_OFFSET}`);
    if (!gotTime) { hh = 12; mi = 0; } // por seguridad si no detectamos hora, fijamos 12:00
    let F = { fecha: `${candidate.getFullYear()}-${pad2(candidate.getMonth()+1)}-${pad2(candidate.getDate())}`, hora: `${pad2(hh)}:${pad2(mi)}` };

    // Si año omitido y la fecha “este año” ya pasó, pasa al siguiente
    if (!m?.[3] && !t.includes("de 20")) {
      const cmpISO = toFechaReservaISO(F.fecha, F.hora);
      if (cmpISO && !isFuture(cmpISO)) {
        const nextYear = candidate.getFullYear() + 1;
        F.fecha = `${nextYear}-${pad2(candidate.getMonth()+1)}-${pad2(candidate.getDate())}`;
      }
    }
    return F;
  }

  function parseNaturalES(userText) {
    const text = (userText || "").trim();
    if (!text) return {};

    // email
    const email = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0];

    // teléfono (toma dígitos de +595…, 0999…, etc.)
    const telMatch = text.match(/(\+?\d[\d\s\-]{6,}\d)/);
    const telefono = telMatch ? telMatch[1].replace(/[^\d+]/g,"") : undefined;

    // invitados: "20 personas", "15 invitados"
    const inv = text.match(/(\d{1,3})\s*(personas?|invitad[oa]s?)/i);
    const invitados = inv ? parseInt(inv[1], 10) : undefined;

    // nombre: "me llamo …" / "mi nombre es …"
    let nombre;
    const n1 = text.match(/me\s+llamo\s+([^,\.]+)/i);
    const n2 = text.match(/mi\s+nombre\s+es\s+([^,\.]+)/i);
    if (n1) nombre = n1[1].trim();
    if (!nombre && n2) nombre = n2[1].trim();

    // tipo/pedido
    let tipo_servicio;
    if (/bocad/i.test(text)) tipo_servicio = "bocaditos";
    else if (/cater/i.test(text)) tipo_servicio = "catering";

    // dirección
    let direccion;
    const d1 = text.match(/(estoy\s+en|direccion(?:\s+es)?|dirección(?:\s+es)?)\s+([^\.]+)/i);
    if (d1) direccion = d1[2].trim();

    // fecha/hora naturales
    const fh = parseFechaHoraNatural(text);

    return {
      nombre, telefono, email,
      invitados, tipo_servicio, direccion,
      fecha: fh?.fecha, hora: fh?.hora
    };
  }

  // ---------- Lógica DB ----------
  async function verDisponibilidad({ fecha, hora, invitados }) {
    const hhmm = clampHourStr(hora);
    const fechaISO = toFechaReservaISO(fecha, hhmm);
    if (!fechaISO) return { disponible:false, motivo:"Fecha u hora inválidas" };
    if (!isFuture(fechaISO)) return { disponible:false, motivo:"Fecha pasada" };
    if (!isWithinHours(hhmm)) return { disponible:false, motivo:`Horario fuera de franja ${HOURS_OPEN.min}-${HOURS_OPEN.max}` };

    const { data, error } = await supabase
      .from("reservas")
      .select("id, estado")
      .eq("fecha_reserva", fechaISO)
      .neq("estado", "cancelada")
      .limit(1);

    if (error) return { disponible:false, motivo:error.message };
    const disponible = (data?.length || 0) === 0;
    return { disponible, motivo: disponible ? null : "Horario ya reservado" };
  }

  async function crearReserva(args) {
    const hhmm = clampHourStr(args.hora);
    const fechaISO = toFechaReservaISO(args.fecha, hhmm);
    if (!args.nombre || !args.telefono) return { ok:false, error:"Faltan nombre o teléfono" };
    if (!fechaISO) return { ok:false, error:"Fecha u hora inválidas" };
    if (!isFuture(fechaISO)) return { ok:false, error:"La fecha/hora debe ser futura" };
    if (!isWithinHours(hhmm)) return { ok:false, error:`Horario fuera de franja ${HOURS_OPEN.min}-${HOURS_OPEN.max}` };
    if (!args.invitados || args.invitados <= 0) return { ok:false, error:"Invitados debe ser > 0" };

    const { data: clash, error: errClash } = await supabase
      .from("reservas")
      .select("id")
      .eq("fecha_reserva", fechaISO)
      .neq("estado", "cancelada")
      .limit(1);
    if (errClash) return { ok:false, error: errClash.message };
    if (clash?.length) return { ok:false, error:"Ese horario ya está reservado." };

    const payload = {
      nombre: args.nombre,
      telefono: args.telefono,
      email: args.email ?? null,
      tipo_servicio: args.tipo_servicio ?? null,
      menu: args.menu ?? null,
      invitados: args.invitados ?? null,
      direccion: args.direccion ?? null,
      notas: args.notas ?? null,
      fecha_reserva: fechaISO,
      estado: "pendiente"
    };

    const { data, error } = await supabase
      .from("reservas")
      .insert(payload)
      .select()
      .single();

    if (error) return { ok:false, error: error.message };
    return {
      ok:true,
      reserva: { id: data.id, fecha_reserva: data.fecha_reserva, invitados: data.invitados, tipo_servicio: data.tipo_servicio }
    };
  }

  try {
    const { messages = [] } = req.body || {};
    const rawMsgs = Array.isArray(messages) ? messages : [];
    const safeMsgs = rawMsgs.slice(-20).map(m => ({
      role: m?.role === "assistant" ? "assistant" : "user",
      content: typeof m?.content === "string" ? m.content.slice(0, 4000) : ""
    }));

    // ==================  MODO EXPRÉS (parseo local)  ==================
    const lastUserText = [...safeMsgs].reverse().find(m => m.role === "user")?.content || "";
    const parsed = parseNaturalES(lastUserText);

    const tieneBasicos =
      parsed.nombre && parsed.telefono && parsed.invitados &&
      parsed.fecha && parsed.hora;

    if (tieneBasicos) {
      const fast = await crearReserva({
        nombre: parsed.nombre,
        telefono: parsed.telefono,
        email: parsed.email,
        fecha: parsed.fecha,
        hora: parsed.hora,
        invitados: parsed.invitados,
        tipo_servicio: parsed.tipo_servicio,
        menu: parsed.menu,
        direccion: parsed.direccion,
        notas: parsed.notas
      });

      if (fast.ok) {
        const d = new Date(fast.reserva.fecha_reserva);
        const fechaStr = d.toLocaleDateString("es-PY", { timeZone: "America/Asuncion" });
        const horaStr = d.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Asuncion" });
        const reply = `✅ Reserva confirmada: ${fechaStr} ${horaStr}, ${fast.reserva.invitados} invitados, ${fast.reserva.tipo_servicio ?? "servicio"}. Nº: ${fast.reserva.id}`;
        return res.status(200).json({ reply, toolResult: fast, mode: "fast" });
      } else {
        // Si falló el insert, seguimos con el flujo "normal" para explicar/recabar lo que falte
        safeMsgs.push({ role:"assistant", content:`Nota del sistema: el intento exprés falló (${fast.error}). Continuemos por pasos:` });
      }
    }

    // ==================  FLUJO NORMAL (OpenAI + tools)  ==================
    const r1 = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: SYSTEM }, ...safeMsgs],
        tools,
        tool_choice: "auto",
        temperature: 0.2
      })
    });
    if (!r1.ok) {
      const txt = await r1.text();
      return res.status(r1.status).json({ error: `OpenAI-1: ${txt}` });
    }
    const j1 = await r1.json();
    const assistantMsg = j1?.choices?.[0]?.message;
    const toolCall = assistantMsg?.tool_calls?.[0];

    if (!toolCall) {
      return res.status(200).json({ reply: assistantMsg?.content ?? "No pude responder." });
    }

    const { name, arguments: argsStr } = toolCall.function;
    let toolResult;
    try {
      const args = JSON.parse(argsStr || "{}");
      if (name === "ver_disponibilidad") {
        toolResult = await verDisponibilidad(args);
      } else if (name === "crear_reserva") {
        toolResult = await crearReserva(args);
      } else {
        toolResult = { error: "tool_desconocida" };
      }
    } catch (e) {
      toolResult = { error: "args_invalidos", detail: String(e) };
    }

    const r2 = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM },
          ...safeMsgs,
          assistantMsg,
          {
            role: "tool",
            tool_call_id: toolCall.id,
            name,
            content: JSON.stringify(toolResult)
          }
        ],
        temperature: 0.2
      })
    });
    if (!r2.ok) {
      const txt = await r2.text();
      return res.status(r2.status).json({ error: `OpenAI-2: ${txt}`, toolResult });
    }
    const j2 = await r2.json();
    const reply = j2?.choices?.[0]?.message?.content ?? "No pude responder.";
    return res.status(200).json({ reply, toolResult, mode: "normal" });

  } catch (e) {
    console.error("[chat] error:", e);
    return res.status(500).json({ error: "server-error" });
  }
}
