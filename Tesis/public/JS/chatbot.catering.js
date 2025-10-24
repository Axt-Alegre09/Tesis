// JS/chatbot.catering.js
// Permite crear reservas de catering desde el chat (front-only, con Supabase + RLS).
import { supabase, getUser, getProfile, getClientePerfil } from "./ScriptLogin.js";

(() => {
  const MESES = {
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,
    julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12
  };
  const z2 = n => String(n).padStart(2,"0");
  const norm = (s="") => String(s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g," ").trim();

  function detectFecha(str){
    const s = norm(str);

    // 1) yyyy-mm-dd
    let m = s.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
    if (m) return `${m[1]}-${z2(m[2])}-${z2(m[3])}`;

    // 2) dd/mm/yyyy o dd-mm-yyyy
    m = s.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](20\d{2})\b/);
    if (m) return `${m[3]}-${z2(m[2])}-${z2(m[1])}`;

    // 3) "10 de noviembre" (año actual)
    m = s.match(/\b(0?[1-9]|[12]\d|3[01])\s+de\s+([a-zñ]+)\b/);
    if (m && MESES[m[2]]) {
      const y = new Date().getFullYear();
      return `${y}-${z2(MESES[m[2]])}-${z2(m[1])}`;
    }

    return null;
  }

  function detectHora(str){
    const s = norm(str);

    // 1) HH:mm
    let m = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
    if (m) return `${z2(m[1])}:${z2(m[2])}`;

    // 2) "a las 20", "a las 8 hs", "20 hs", "8h"
    m = s.match(/\b(?:a las\s+)?([01]?\d|2[0-3])(?:\s*h(?:s)?)?\b/);
    if (m) return `${z2(m[1])}:00`;

    return null;
  }

  function detectInvitados(str){
    const m = String(str).match(/\b(\d{1,4})\s*(?:personas|invitados?)\b/i);
    return m ? Number(m[1]) : null;
  }

  function detectTipoComida(str){
    const s = norm(str);
    if (/\bbocaditos?\b/.test(s)) return "Bocaditos";
    if (/\bempanad/.test(s)) return "empanadas";
    if (/\bmilanesa/.test(s)) return "milanesas";
    if (/\bconfiteria|postre|torta|alfajor|flan|dulce/.test(s)) return "confitería";
    return "catering"; // genérico
  }

  function detectLugar(str){
    // "en <lugar>"
    const m = str.match(/\ben\s+([a-zA-Z0-9 .#º°\-_,]+)\b/i);
    return m ? m[1].trim() : "-";
  }

  function detectTelefono(str){
    const m = str.match(/\b(09\d{7,9})\b/);
    return m ? m[1] : null;
  }

  function detectEmail(str){
    const m = str.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    return m ? m[0] : null;
  }

  async function getDisplayName(){
    const cp = await getClientePerfil();           // razon comercial (si existe)
    if (cp?.razon?.trim()) return cp.razon.trim();
    const p  = await getProfile();                 // profiles.nombre
    if (p?.nombre?.trim()) return p.nombre.trim();
    const u  = await getUser();                    // fallback: email
    return u?.email || "Cliente";
  }

  async function crearReservaDesdeMensaje(raw){
    const user = await getUser();
    if (!user) {
      return { ok:false, text:"Necesitas iniciar sesión para agendar un catering. Inicia sesión y probá de nuevo 🙏" };
    }

    const fecha   = detectFecha(raw);
    const hora    = detectHora(raw);
    const inv     = detectInvitados(raw);
    const tipo    = detectTipoComida(raw);
    const lugar   = detectLugar(raw);
    const telefono= detectTelefono(raw);
    const email   = detectEmail(raw);

    // Campos obligatorios de tu tabla: ruc, razonsocial, tipoevento, fecha, hora, tipocomida, lugar
    const razonsocial = await getDisplayName();
    const payload = {
      ruc: "", // puedes capturarlo en pasos posteriores si lo necesitas
      razonsocial,
      tipoevento: "catering",
      fecha: fecha || null,
      hora:  hora  || null,
      tipocomida: tipo || "catering",
      lugar: lugar || "-",
      observaciones: "",
      telefono: telefono || null,
      email: email || user.email || null,
      invitados: inv ?? null
    };

    // Validación mínima
    if (!payload.fecha || !payload.hora) {
      return { ok:false, text:"Para agendar necesito **fecha** y **hora**. Ej.: “reservar catering el 12/11 a las 20:00 para 40 personas en Centro”." };
    }

    // Inserta (RLS validará que estés autenticado). created_por se llena con default auth.uid()
    const { data, error } = await supabase
      .from("reservas_catering")
      .insert(payload)
      .select("id, fecha, hora, tipocomida, lugar, invitados, estado")
      .single();

    if (error) {
      console.error("[chat-catering] insert error", error);
      return { ok:false, text:"No pude registrar la reserva ahora. Probá de nuevo en un momento." };
    }

    const personas = data.invitados ? ` para ${data.invitados} personas` : "";
    return {
      ok:true,
      text:`✅ ¡Reserva creada! ID #${data.id}. ${data.tipocomida} el **${data.fecha} ${data.hora}** en **${data.lugar}**${personas}. Estado: ${data.estado}.`
    };
  }

  // Intención sencilla: detectar si el mensaje es “reservar/agendar” catering
  function matchesReserva(msg){
    const s = norm(msg);
    return /\b(reserv(ar|a|ame)|agend(ar|a|ame)|quiero reservar|hacer una reserva)\b/.test(s)
           && /\b(catering|bocadito|empanad|evento|servicio)\b/.test(s);
  }

  // API pública para el script del chat
  window.ChatCatering = {
    async handle(userText){
      if (!matchesReserva(userText)) return null; // no es intención de reserva
      return await crearReservaDesdeMensaje(userText);
    }
  };
})();
