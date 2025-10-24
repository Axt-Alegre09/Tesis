/* JS/chatbot.brain.js
   NLU liviano para catálogo + carrito + respuestas de producto + reservas catering (multi-turno).
   (sin OpenAI, todo frontend)
*/
(() => {
  // =============== Utiles de lenguaje ===============
  const NUM_PAL = { uno:1, una:1, un:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7,
    ocho:8, nueve:9, diez:10, once:11, doce:12 };

  const normalize = (s="") =>
    String(s)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"") // compatible total
      .replace(/[.,;:!¡¿?()"]/g," ")
      .replace(/\s+/g," ")
      .trim();

  const preclean = (s="") =>
    s
      .replace(/\b(al|a|en)\s+mi?\s+carrito\b/gi, "")
      .replace(/\bcarrito(s)?\b/gi, "")
      .replace(/\bpor\s+favor\b/gi, "")
      .replace(/\bgracias\b/gi, "")
      .trim();

  const toNumber = (w) => /^\d+$/.test(w||"") ? parseInt(w,10) : (NUM_PAL[w] ?? NaN);
  const fmtGs = n => new Intl.NumberFormat("es-PY").format(Math.max(0, Number(n)||0)) + " Gs";
  const pluralize = (s, n=2) => (n===1? s: s.endsWith("a")? s+"s": s.endsWith("or")? s+"es": s+"s");
  const list = (arr=[]) => arr.length<=1 ? (arr[0]||"") : arr.slice(0,-1).join(", ") + " y " + arr.slice(-1);

  // =============== Dominio: sinónimos + sabores ===============
  const SYN = {
    empanada: ["empanada","empanadas","empi","empas"],
    alfajor:  ["alfajor","alfajores"],
    bocadito: ["bocadito","bocaditos","combo","combos","combo bocaditos","combo bocadito"],
    pan:      ["pan","panes","panificados","baguette","baguet","buguete","gallego","campo","chip","pan del campo","pan gallego","pan casero"],
    milanesa: ["milanesa","milanesas","sandwich milanesa","sándwich milanesa","sanguche de milanesa","sandwich de milanesa"],
    croissant:["croissant","croissants","cruasan","cruasán","croisant"],
    mbeju:    ["mbeju","mbejú"],
    chipaG:   ["chipaguazu","chipaguazú","chipa guasu","chipa guasú"],
    sopa:     ["sopa paraguaya","sopa"],
    dulces:   ["dulce","dulces","caja de dulces","caja 20 dulces","caja veinte dulces"],
  };

  const FLAVORS = [
    // salados
    "carne","pollo","huevo","mandioca","queso","jamon","jamón","jamon y queso","jamón y queso",
    "saltena","salteña","milanesa",
    // confitería
    "dulce de leche","chocolate","maicena","vainilla","coco","membrillo","frutilla","guayaba",
    // panes
    "baguette","gallego","campo","chip",
    // otros
    "anana","ananá","pina","piña","manzana"
  ];

  const CAT_SYNONYMS = {
    empanadas: SYN.empanada,
    confiteria: ["confiteria","confitería","postres","dulces","reposteria","repostería","tortas","flanes","pastaflora","pasta flora","alfajores", ...SYN.croissant, ...SYN.dulces],
    bocaditos: SYN.bocadito,
    alfajores: SYN.alfajor,
    panificados: [...SYN.pan],
    milanesas: SYN.milanesa
  };

  // =============== KB (precios / incluye) breve ===============
  const KB = {
    // -- BOCADITOS
    "bocaditos combo 1": { precio: 55000,  incluye: "2 empanadas (a elegir), 2 sándwiches y 4 chipas" },
    "bocaditos combo 2": { precio: 50000,  incluye: "3 empanadas, 3 sandwichitos, 2 payagua/pajagua, 2 chipa guasú, 4 chipas y 4 mbejú" },
    "bocaditos combo 3": { precio: 150000, incluye: "4 empanadas, 3 chipas, 3 chipa guasú, 3 sopas, 10 aperitivos, 5 payagua, 4 milanesas y 5 mbejú" },
    "bocaditos combo 4": { precio: 75000,  incluye: "9 sándwiches de milanesa (pollo y carne)" },
    "bocadito personal": { precio: 35000,  incluye: "5 empanadas + 2 salsas (kétchup y lactonesa)" },
    "bocadito en pareja":{ precio: 65000,  incluye: "11 empanadas + 2 salsas (kétchup y lactonesa)" },

    // -- CONFITERÍA
    "alfajores": { precio: 25000, incluye: "Maicena y maicena bañada en chocolate" },
    "croissants": { precio: 30000, incluye: "Crujientes de manteca (unidad)" },
    "dulces (caja 20)": { precio: 25000, incluye: "1 caja con 20 dulces surtidos" },
    "flanes (2)": { precio: 20000, incluye: "2 flanes a elegir" },
    "pasta floras (kilo)": { precio: 20000, incluye: "Sabores: dulce de leche y dulce de guayaba" },
    "torta dulce de leche (pequena congelada)": { precio: 45000, incluye: "Torta pequeña congelada de dulce de leche" },
    "pai de manzana": { precio: 35000 },
    "pai de anana": { precio: 35000, incluye: "También conocido como pai de piña/ananá" },

    // -- PANIFICADOS
    "pan baguette (1)": { precio: 15000 },
    "pan casero (1)": { precio: 20000 },
    "pan chip (pack 10)": { precio: 15000 },
    "pan del campo (1)": { precio: 22000 },
    "pan del campo (kilo)": { precio: 22000 },
    "pan gallego (kilo)": { precio: 19000 },

    // -- ROSTISERÍA / SALADOS
    "empanada de carne": { precio: 19000 },
    "empanada de huevo": { precio: 17000 },
    "empanada de mandioca": { precio: 10000 },
    "empanada de jamon y queso": { precio: 17000 },

    "mbeju (1)": { precio: 14000 },
    "combo empanada + coca 250 ml": { precio: 24000, incluye: "1 empanada de carne, 1 pan y 1 Coca 250 ml" },
    "combo empanada saltena + salsa": { precio: 26000, incluye: "1 empanada salteña + salsa (kétchup o lactonesa)" },
    "combo sandwich milanesa + papas + coca 350 ml": { precio: 25000, incluye: "1 sándwich de milanesa, papas pequeñas y 1 Coca 350 ml" }
  };

  const ALIAS = new Map([
    // Bocaditos
    ["combo 1","bocaditos combo 1"],["bocaditos 1","bocaditos combo 1"],
    ["combo 2","bocaditos combo 2"],["bocaditos 2","bocaditos combo 2"],
    ["combo 3","bocaditos combo 3"],["bocaditos 3","bocaditos combo 3"],
    ["combo 4","bocaditos combo 4"],["bocaditos 4","bocaditos combo 4"],
    ["en pareja","bocadito en pareja"],["bocadito pareja","bocadito en pareja"],

    // Confitería
    ["croissants","croissants"],["croissant","croissants"],["cruasan","croissants"],["cruasán","croissants"],["croisant","croissants"],
    ["caja de dulces","dulces (caja 20)"],["dulces","dulces (caja 20)"],
    ["flanes","flanes (2)"],["flan","flanes (2)"],
    ["pasta flora","pasta floras (kilo)"],["pastaflora","pasta floras (kilo)"],
    ["torta dulce de leche","torta dulce de leche (pequena congelada)"],
    ["pai de piña","pai de anana"],["pai de anana","pai de anana"],["pai de ananá","pai de anana"],["pai de allana","pai de anana"],

    // Panificados
    ["baguette","pan baguette (1)"],["pan buguete","pan baguette (1)"],["baguet","pan baguette (1)"],
    ["pan casero","pan casero (1)"],
    ["pan chip","pan chip (pack 10)"],["pack de chip","pan chip (pack 10)"],
    ["pan del campo unidad","pan del campo (1)"],["pan del campo","pan del campo (1)"],
    ["pan del campo kilo","pan del campo (kilo)"],
    ["pan gallego","pan gallego (kilo)"],["pan gallego kilo","pan gallego (kilo)"],

    // Combos salados
    ["combo empanada coca","combo empanada + coca 250 ml"],
    ["combo saltena","combo empanada saltena + salsa"],["combo salteña","combo empanada saltena + salsa"],
    ["combo sandwich milanesa","combo sandwich milanesa + papas + coca 350 ml"]
  ]);

  // =============== Índice del catálogo ===============
  function getProductIndex(){
    if (window.__PRODUCT_INDEX__?.byToken) return window.__PRODUCT_INDEX__;
    const productos = window.__PRODUCTS__ || [];
    const byToken = new Map();
    const all = productos.map(p => ({
      id: String(p.id ?? p.productoId ?? p.uuid ?? p.ID ?? p.Id ?? p.slug ?? p.nombre),
      nombre: String(p.nombre ?? p.titulo ?? p.title ?? p.titulo ?? "").trim(),
      precio: Number(p.precio || 0),
      imagen: p.imagen || p.image || null
    }));

    for (const p of all) {
      const base = normalize(p.nombre);
      const tokens = new Set(base.split(" ").filter(Boolean));

      for (const [canon, arr] of Object.entries(SYN)) {
        if (base.includes(canon) || arr.some(a => base.includes(a))) {
          arr.forEach(a => tokens.add(a));
          tokens.add(canon);
        }
      }
      FLAVORS.forEach(f => { if (base.includes(normalize(f))) tokens.add(normalize(f)); });

      for (const [alias, target] of ALIAS.entries()) {
        if (base.includes(alias)) tokens.add(alias);
        if (base.includes(target)) tokens.add(target);
      }

      for (const t of tokens) {
        if (!byToken.has(t)) byToken.set(t, []);
        byToken.get(t).push(p);
      }
      if (!byToken.has(base)) byToken.set(base, []);
      byToken.get(base).push(p);
    }
    return (window.__PRODUCT_INDEX__ = { all, byToken });
  }
  const candidatesFor = (token) => getProductIndex().byToken.get(token) || [];

  // =============== KB lookup ===============
  function kbLookup(text){
    const t = normalize(text);
    if (KB[t]) return { key:t, data:KB[t] };
    const alias = ALIAS.get(t);
    if (alias && KB[alias]) return { key:alias, data:KB[alias] };
    const k = Object.keys(KB).find(k => t.includes(k) || k.includes(t));
    if (k) return { key:k, data:KB[k] };
    return null;
  }

  // =============== Matching producto ===============
  function findProduct(text, flavor){
    const t = normalize(text);
    const fav = flavor ? normalize(flavor) : null;

    let cands = candidatesFor(t);
    if (!cands.length) {
      for (const [canon, arr] of Object.entries(SYN)) {
        if (arr.includes(t) || t.includes(canon)) { cands = candidatesFor(canon); break; }
      }
    }
    if (!cands.length) {
      const all = getProductIndex().all;
      cands = all.filter(p => normalize(p.nombre).includes(t));
    }
    if (!cands.length) {
      const kb = kbLookup(t);
      if (kb) {
        const all = getProductIndex().all;
        const m = all.find(p => normalize(p.nombre).includes(kb.key));
        if (m) return m;
      }
      return null;
    }
    if (!fav) return cands[0];
    const favMatch = cands.find(p => normalize(p.nombre).includes(fav));
    return favMatch || cands[0];
  }

  // =============== Resumen por categoría ===============
  function detectCategory(msgNorm){
    for (const [cat, syns] of Object.entries(CAT_SYNONYMS)) {
      if (syns.some(s => msgNorm.includes(s))) return cat;
    }
    return null;
  }
  function getCategorySummary(cat){
    const idx = getProductIndex();
    const inCat = idx.all.filter(p => {
      const n = normalize(p.nombre);
      if (cat === "empanadas") return SYN.empanada.some(s => n.includes(s));
      if (cat === "alfajores") return SYN.alfajor.some(s => n.includes(s));
      if (cat === "bocaditos") return SYN.bocadito.some(s => n.includes(s)) || n.includes("combo");
      if (cat === "confiteria") return ["alfajor","torta","flan","croissant","pasta flora","dulce","pai"].some(s=>n.includes(s));
      if (cat === "panificados") return ["pan","baguette","gallego","campo","chip"].some(s=>n.includes(s));
      if (cat === "milanesas") return n.includes("milanesa");
      return false;
    });

    const names = inCat.map(p => p.nombre);
    const flavors = new Set();
    const scan = (arr, src) => arr.forEach(f => { if (normalize(src).includes(normalize(f))) flavors.add(f); });
    for (const n of names){ scan(FLAVORS, n); }

    return { count: inCat.length, names: names.slice(0,10), flavors: Array.from(flavors) };
  }

  // =============== Parser de intención (carrito + info) ===============
  function extractFlavor(fragment){
    const multi = /(jamon y queso|dulce de leche|papa frita|milanesa|chipaguazu|pan del campo|sopa paraguaya)/;
    const m = (fragment||"").match(multi);
    if (m) return normalize(m[1]);
    for (const f of FLAVORS) if ((fragment||"").includes(f)) return normalize(f);
    return null;
  }

  function extractItems(raw){
    const msg = normalize(preclean(raw));
    const items = [];
    let lastProd = null;

    const r1 = /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*)?(?:\s+de\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+)?(?:\s+de\s+[a-záéíóúñ]+)?))?/gi;
    let m;
    while ((m = r1.exec(msg)) !== null) {
      const qty = toNumber(m[1]);
      let prodTxt = (m[2] && normalize(m[2])) || guessProductText(msg) || lastProd || "empanada";
      if (/\bcarrito(s)?\b/.test(prodTxt)) prodTxt = "empanada";
      const flavor = m[3] ? normalize(m[3]) : extractFlavor(msg);
      lastProd = prodTxt;
      items.push({ cantidad: qty || 1, prodTxt, flavor });
    }

    const r2 = /(?:y|,|mas)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+de\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+)?)/gi;
    while ((m = r2.exec(msg)) !== null) {
      const qty = toNumber(m[1]);
      const flavor = normalize(m[2]);
      let prodTxt = lastProd || guessProductText(msg) || "empanada";
      if (/\bcarrito(s)?\b/.test(prodTxt)) prodTxt = "empanada";
      items.push({ cantidad: qty || 1, prodTxt, flavor });
    }
    return items;
  }

  function guessProductText(msgRaw){
    const msg = normalize(msgRaw);
    for (const [alias] of ALIAS.entries()) if (msg.includes(alias)) return alias;
    if (/\bmilanesa(s)?\b/.test(msg)) return "milanesa";
    if (/\bempanad(a|as)\b/.test(msg)) return "empanada";
    const hasFlavor = FLAVORS.some(f => msg.includes(normalize(f)));
    if (hasFlavor) return "empanada";
    const idx = getProductIndex();
    for (const t of msg.split(" ")) if (idx.byToken?.has(t)) return t;
    const kb = kbLookup(msg);
    if (kb) return kb.key;
    return null;
  }

  // =============== --- CATERING: helpers + flujo --- ===============
  const CATERING_FIELDS = [
    { key:"razonsocial", prompt:"¿A nombre de quién es el servicio? (empresa o nombre)", required:true },
    { key:"telefono",    prompt:"¿Cuál es el teléfono de contacto?", required:true },
    { key:"email",       prompt:"Correo de contacto (opcional, podés decir 'no tengo')", required:false },
    { key:"tipoevento",  prompt:"¿Qué tipo de servicio/evento? (p.ej. Catering, Evento)", required:true },
    { key:"tipocomida",  prompt:"¿Qué menú/preferencia? (p.ej. bocaditos)", required:true },
    { key:"lugar",       prompt:"¿Dónde es (dirección o ciudad)?", required:true },
    { key:"invitados",   prompt:"¿Para cuántos invitados?", required:true },
    { key:"fecha",       prompt:"¿Fecha del evento? (dd/mm/aaaa o aaaa-mm-dd)", required:true },
    { key:"hora",        prompt:"¿Hora de inicio? (HH:MM)", required:true },
  ];
  const DRAFT_KEY = "CATERING_DRAFT";

  function parseFecha(s) {
    if (!s) return null;
    const t = String(s).trim();
    const m1 = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m1) return `${m1[3]}-${String(m1[2]).padStart(2,"0")}-${String(m1[1]).padStart(2,"0")}`;
    const m2 = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return t;
    return null;
  }
  function parseHora(s) {
    const m = String(s||"").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = String(m[1]).padStart(2,"0"), mm = m[2];
    if (Number(hh)>23 || Number(mm)>59) return null;
    return `${hh}:${mm}`;
  }

  function tryFillDraftFromText(draft, text){
    const msg = normalize(text);

    // nombre / empresa
    const mNom = msg.match(/(a\s*nombre\s*de|empresa|razon|razón)\s+([a-z0-9 áéíóúñ\.-]+)/i);
    if (mNom && !draft.razonsocial) draft.razonsocial = mNom[2].trim();

    const tel = msg.match(/(\+?\d[\d\s\-]{6,}\d)/);
    if (tel && !draft.telefono) draft.telefono = tel[1].replace(/\s+/g,"");

    const em = msg.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    if (em && !draft.email) draft.email = em[0];

    if (!draft.invitados){
      const inv = msg.match(/(\d+)\s*(invitado|persona|personas|pers|pax)/);
      if (inv) draft.invitados = Number(inv[1]);
    }

    if (!draft.fecha){
      const f1 = msg.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/);
      if (f1) draft.fecha = parseFecha(f1[1]);
    }

    if (!draft.hora){
      const h1 = msg.match(/(\d{1,2}:\d{2})/);
      if (h1) draft.hora = parseHora(h1[1]);
    }

    if (!draft.tipoevento){
      if (msg.includes("evento")) draft.tipoevento = "evento";
      else if (msg.includes("catering")) draft.tipoevento = "catering";
    }
    if (!draft.tipocomida){
      if (msg.includes("bocadito")) draft.tipocomida = "bocaditos";
    }
    if (!draft.lugar){
      const mLug = msg.match(/\ben\s+([a-záéíóúñ0-9\.\- ]{4,})$/i);
      if (mLug) draft.lugar = mLug[1].trim();
    }
  }

  function getNextMissing(draft){
    for (const f of CATERING_FIELDS){
      if (f.required && (draft[f.key]==null || String(draft[f.key]).trim()==="")){
        return f;
      }
    }
    return null;
  }

  async function checkCupo(fecha){
    try{
      const d = new Date(`${fecha}T00:00:00`);
      const weekend = [0,6].includes(d.getDay());
      const lim = weekend ? 3 : 2;
      const { data, error } = await window.supabase
        .from("reservas_catering")
        .select("id,estado")
        .eq("fecha", fecha);
      if (error) throw error;
      const usados = (data||[]).filter(r=>r.estado!=="cancelado").length;
      return { ok: usados < lim, usados, lim };
    }catch(e){
      console.warn("checkCupo:", e);
      return { ok:false, usados:0, lim:0, error:e };
    }
  }

  async function actCatering(userText){
    // sesión requerida
    try {
      const { data } = await window.supabase.auth.getSession();
      if (!data?.session) {
        return { text: "Para agendar necesito que inicies sesión (botón “Cuenta” → Iniciar sesión)." };
      }
    } catch {}

    // Recupero/actualizo borrador
    let draft = {};
    try{ draft = JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}"); }catch{}
    tryFillDraftFromText(draft, userText);

    // Normalizaciones
    if (draft.fecha && !parseFecha(draft.fecha)) draft.fecha = null;
    if (draft.hora  && !parseHora(draft.hora))   draft.hora  = null;
    if (draft.invitados && isNaN(Number(draft.invitados))) draft.invitados = null;

    // Preguntar lo que falta
    const missing = getNextMissing(draft);
    if (missing){
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      return { text: missing.prompt };
    }

    // Validar cupo
    const cupo = await checkCupo(draft.fecha);
    if (!cupo.ok){
      return { text:`⚠️ Cupo lleno para ${draft.fecha}. Capacidad: ${cupo.lim}. Probá con otra fecha.` };
    }

    // Ejecutar RPC
    try{
      const payload = {
        p_razonsocial: draft.razonsocial,
        p_ruc:         "",
        p_tipoevento:  draft.tipoevento,
        p_fecha:       draft.fecha,
        p_hora:        draft.hora,
        p_tipocomida:  draft.tipocomida,
        p_lugar:       draft.lugar,
        p_observaciones: "",
        p_invitados:   Number(draft.invitados) || null,
        p_telefono:    draft.telefono || "",
        p_email:       draft.email || ""
      };
      const { data, error } = await window.supabase.rpc("catering_agendar", payload);
      if (error) throw error;

      localStorage.removeItem(DRAFT_KEY);

      const resumen = `✅ Reserva creada:
• Cliente: ${data.razonsocial}
• Fecha: ${data.fecha}  Hora: ${data.hora}
• Tipo: ${data.tipoevento}  • Menú: ${data.tipocomida}
• Invitados: ${data.invitados ?? "-"}
• Lugar: ${data.lugar}`;
      return { text: resumen };
    }catch(e){
      console.error("RPC catering_agendar:", e);
      return { text: "❌ No pude registrar la reserva ahora. Revisá los datos o intentá de nuevo." };
    }
  }
  // =============== FIN helpers CATERING ===============

  function parseMessage(msgRaw=""){
    const msg = normalize(preclean(msgRaw));

    if (/vaciar (el )?carrito|limpiar carrito|vaciar todo/.test(msg)) return { intent:"empty_cart" };
    if (/ver (mi )?carrito|mostrar carrito|que (hay|tengo) en el carrito/.test(msg)) return { intent:"show_cart" };
    if (/total|cuanto (es|sale|debo|vale)/.test(msg)) return { intent:"show_total" };
    if (/ayuda|que puedes hacer|como funciona/.test(msg)) return { intent:"help" };

    if (/(que incluye|que trae|que tiene|incluye)/.test(msg)) {
      const prodTxt = guessProductText(msg) || msg;
      return { intent:"product_info", topic:"incluye", prodTxt };
    }
    if (/(precio|precios|cuanto sale|cuanto vale|valor)/.test(msg)) {
      const prodTxt = guessProductText(msg);
      const cat = detectCategory(msg);
      if (!prodTxt && cat) return { intent:"category_prices", cat };
      return { intent:"product_info", topic:"precio", prodTxt: prodTxt || msg };
    }

    if (/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/.test(msg)) {
      const m = msg.match(/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.*)/);
      if (m) {
        const qty = toNumber(m[2]);
        const rest = (m[3]||"").trim();
        const flavor = extractFlavor(rest);
        return { intent:"set_qty", qty, prodTxt: rest, flavor };
      }
    }

    const cat = detectCategory(msg);
    if (cat) {
      if (/sabor|sabores|variedad/.test(msg)) return { intent:"category_info", cat, topic:"sabores" };
      if (/que tienen|que hay|lista|catalogo|catálogo|mostrar|tienes|tenes|que productos/.test(msg)) return { intent:"category_info", cat, topic:"lista" };
    }

    if (/(quita|saca|elimina|borra)\b/.test(msg)) {
      const items = extractItems(msgRaw);
      if (items.length) return { intent:"remove", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"remove", items:[{ cantidad:1, prodTxt }] };
    }

    if (/(agrega(me)?|sum(a|ar)|pone|pon|quiero|dame|añade|anadi|agregame|agrega al)/.test(msg)) {
      const items = extractItems(msgRaw);
      if (items.length) return { intent:"add", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"add", items:[{ cantidad:1, prodTxt }] };
    }

    // --- NUEVO: intención de reservas catering ---
    if (/\b(catering|reserva(r)?|agendar)\b/.test(msg)) {
      return { intent:"catering_book", raw: msgRaw };
    }

    return { intent:"none" };
  }

  // =============== Acciones (carrito + info + catering) ===============
  async function actAdd(items){
    const done = [], missing = [];
    for (const it of items) {
      const prod = findProduct(it.prodTxt, it.flavor);
      if (!prod) { missing.push(it); continue; }
      try {
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(prod.id)) {
          await window.CartAPI.addById(prod.id, it.cantidad);
        } else {
          await window.CartAPI.addProduct({ id: prod.id, titulo: prod.nombre, precio: prod.precio, imagen: prod.imagen }, it.cantidad);
        }
        done.push({ ...it, producto: prod.nombre });
      } catch(e){ console.warn("[ChatBrain] add error:", e); missing.push(it); }
    }
    let text = "";
    if (done.length) {
      const parts = done.map(d => `${d.cantidad} ${pluralize(d.producto||d.prodTxt)}${d.flavor? " de " + d.flavor : ""}`);
      const snap = window.CartAPI.getSnapshot?.(); const total = snap?.total ?? null;
      text += `✅ Agregué ${list(parts)} al carrito.` + (total!=null? ` Total: ${fmtGs(total)}.`:"");
    }
    if (missing.length) {
      text += (text? "\n":"") + "No pude identificar: " +
        list(missing.map(m => `${m.cantidad} ${pluralize(m.prodTxt)}${m.flavor?` de ${m.flavor}`:""}`)) +
        ". Decime el nombre como aparece en el catálogo.";
    }
    return { text };
  }

  async function actRemove(items){
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };

    let removed = [];
    for (const it of (items?.length ? items : [{ cantidad:1, prodTxt: guessProductText("") }])) {
      const prod = findProduct(it.prodTxt, it.flavor); if (!prod) continue;
      const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre))); if (!row) continue;

      const newQty = Math.max(0, Number(row.cantidad||1) - (it.cantidad||1));
      if (newQty === 0) await window.CartAPI.remove({ id: row.id });
      else await window.CartAPI.setQty({ id: row.id }, newQty);
      removed.push(`${it.cantidad} ${pluralize(prod.nombre)}`);
    }
    const after = window.CartAPI.getSnapshot?.();
    return { text: removed.length ? `🗑️ Saqué ${list(removed)}. Total: ${fmtGs(after?.total||0)}.` : "No encontré ese producto en tu carrito." };
  }

  async function actSetQty({ prodTxt, flavor, qty }){
    if (!qty || qty<1) return { text:"Decime la cantidad (1 o más)." };
    const snap = window.CartAPI.getSnapshot?.(); if (!snap?.items?.length) return { text:"Tu carrito está vacío." };
    const prod = findProduct(prodTxt, flavor); if (!prod) return { text:"No identifiqué el producto. Decímelo como en el catálogo." };
    const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre)));
    if (!row) return { text:"Ese producto no está en tu carrito." };
    await window.CartAPI.setQty({ id: row.id }, qty);
    const after = window.CartAPI.getSnapshot?.();
    return { text:`Listo: dejé ${qty} ${pluralize(prod.nombre, qty)}. Total: ${fmtGs(after?.total||0)}.` };
  }

  async function actShowTotal(){
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text:"Tu carrito está vacío." };
    return { text:`🧾 Total actual: ${fmtGs(snap.total)} (${snap.items.length} ítems).` };
  }
  async function actShowCart(){
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text:"Tu carrito está vacío." };
    const lines = snap.items.slice(0,8).map(it => `• ${it.cantidad} × ${it.titulo}`);
    const extra = snap.items.length>8 ? `\n…y ${snap.items.length-8} más.` : "";
    return { text:`En tu carrito:\n${lines.join("\n")}${extra}\nTotal: ${fmtGs(snap.total)}.` };
  }
  async function actEmpty(){
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text:"Tu carrito ya está vacío." };
    for (const it of (snap.items||[])) await window.CartAPI.remove({ id: it.id });
    return { text:"Listo, vacié tu carrito." };
  }

  function actHelp(){
    return { text:
`Puedo ayudarte con el carrito:
• “agregá 3 empanadas de carne y 1 de jamón y queso”
• “quitá 1 alfajor”
• “poné 5 empanadas”
• “ver carrito”, “total”, “vaciar carrito”

También puedo agendar tu catering:
• “quiero reservar catering para el 20/11 a las 10:00 en Villa Elisa para 30 personas”` };
  }

  async function actCategoryInfo({ cat, topic }){
    const sum = getCategorySummary(cat);
    if (sum.count === 0) return { text:"Aún no tengo productos en esa categoría." };

    if (topic === "sabores") {
      if (sum.flavors.length) return { text:`En ${cat} tenemos sabores/variantes como: ${sum.flavors.join(", ")}.` };
      return { text:`Tenemos varias opciones en ${cat}. ¿Querés que te muestre algunos?` };
    }
    const listado = sum.names.map(n => `• ${n}`).join("\n");
    const extra = sum.count > sum.names.length ? `\n…y ${sum.count - sum.names.length} más.` : "";
    return { text:`En ${cat} tenemos:\n${listado}${extra}` };
  }

  async function actProductInfo({ topic, prodTxt }){
    const kb = kbLookup(prodTxt);
    if (!kb) {
      const prod = findProduct(prodTxt);
      if (prod && topic === "precio") return { text:`${prod.nombre}: ${fmtGs(prod.precio)}.` };
      return { text:"No tengo ese producto en mi lista. Decime el nombre como en el catálogo." };
    }
    const { key, data } = kb;
    if (topic === "precio" && data.precio) return { text:`${titulo(key)}: ${fmtGs(data.precio)}.` };
    if (topic === "incluye" && data.incluye) return { text:`${titulo(key)} incluye: ${data.incluye}.` };
    if (data.precio) return { text:`${titulo(key)} cuesta ${fmtGs(data.precio)}.` };
    if (data.incluye) return { text:`${titulo(key)} incluye: ${data.incluye}.` };
    return { text:`De ${titulo(key)} no tengo más detalles.` };
  }

  async function actCategoryPrices({ cat }){
    const lines = [];
    for (const [k,v] of Object.entries(KB)) {
      if (cat==="bocaditos" && k.includes("bocadit")) lines.push(`• ${titulo(k)} — ${v.precio? fmtGs(v.precio): "s/ precio"}`);
      if (cat==="confiteria" && (k.includes("alfajor")||k.includes("torta")||k.includes("flan")||k.includes("dulces")||k.includes("pasta flora")||k.includes("pai")))
        lines.push(`• ${titulo(k)} — ${v.precio? fmtGs(v.precio): "s/ precio"}`);
      if (cat==="empanadas" && k.startsWith("empanada")) lines.push(`• ${titulo(k)} — ${v.precio? fmtGs(v.precio): "s/ precio"}`);
      if (cat==="panificados" && k.startsWith("pan ")) lines.push(`• ${titulo(k)} — ${v.precio? fmtGs(v.precio): "s/ precio"}`);
    }
    if (!lines.length) return { text:"No tengo precios cargados para esa categoría." };
    return { text:`Precios en ${cat}:\n` + lines.join("\n") };
  }

  const titulo = (k) => k.split(" ").map(w => w[0].toUpperCase()+w.slice(1)).join(" ");

  // =============== API pública ===============
  window.ChatBrain = window.ChatBrain || {};
  window.ChatBrain.handleMessage = async function(userText){
    try{
      const parsed = parseMessage(userText||"");
      switch(parsed.intent){
        case "add":            return await actAdd(parsed.items);
        case "remove":         return await actRemove(parsed.items);
        case "set_qty":        return await actSetQty(parsed);
        case "show_total":     return await actShowTotal();
        case "show_cart":      return await actShowCart();
        case "empty_cart":     return await actEmpty();
        case "help":           return actHelp();
        case "category_info":  return await actCategoryInfo(parsed);
        case "product_info":   return await actProductInfo(parsed);
        case "category_prices":return await actCategoryPrices(parsed);
        case "catering_book":  return await actCatering(parsed.raw);
        default:               return null; // sin match -> backend
      }
    }catch(e){
      console.error("[ChatBrain] handleMessage error:", e);
      return { text:"Algo salió mal al interpretar tu pedido. Probá de nuevo 😅" };
    }
  };
})();
