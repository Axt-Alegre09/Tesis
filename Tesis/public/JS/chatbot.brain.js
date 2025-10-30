/* JS/chatbot.brain.js
   NLU liviano (solo carrito/categorías/promos). Sin textos fijos.
   Todo lo demás se delega al backend /api/ask para respuestas naturales.
*/
(() => {
  // ===== Utiles =====
  const NUM_PAL = { uno:1, una:1, un:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7,
    ocho:8, nueve:9, diez:10, once:11, doce:12 };

  const normalize = (s="") =>
    String(s).toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/[.,;:!¡¿?()"]/g," ")
      .replace(/\s+/g," ")
      .trim();

  const preclean = (s="") =>
    s.replace(/\b(al|a|en)\s+mi?\s+carrito\b/gi,"")
     .replace(/\bcarrito(s)?\b/gi,"")
     .replace(/\bpor\s+favor\b/gi,"")
     .replace(/\bgracias\b/gi,"")
     .trim();

  const toNumber = (w) => /^\d+$/.test(w||"") ? parseInt(w,10) : (NUM_PAL[w] ?? NaN);
  const fmtGs = n => new Intl.NumberFormat("es-PY").format(Math.max(0, Number(n)||0)) + " Gs";
  const pluralize = (s,n=2)=> (n===1? s: s.endsWith("a")? s+"s": s.endsWith("or")? s+"es": s+"s");
  const list = (arr=[]) => arr.length<=1 ? (arr[0]||"") : arr.slice(0,-1).join(", ") + " y " + arr.slice(-1);

  // ===== Dominio (sin KB fijo) =====
  const SYN = {
    empanada:["empanada","empanadas","empi","empas"],
    alfajor:["alfajor","alfajores"],
    bocadito:["bocadito","bocaditos","combo","combos","combo bocaditos","combo bocadito"],
    pan:["pan","panes","panificados","baguette","baguet","buguete","gallego","campo","chip","pan del campo","pan gallego","pan casero"],
    milanesa:["milanesa","milanesas","sandwich milanesa","sándwich milanesa","sanguche de milanesa","sandwich de milanesa"],
    croissant:["croissant","croissants","cruasan","cruasán","croisant"],
    mbeju:["mbeju","mbejú"],
    chipaG:["chipaguazu","chipaguazú","chipa guasu","chipa guasú"],
    sopa:["sopa paraguaya","sopa"],
    dulces:["dulce","dulces","caja de dulces","caja 20 dulces","caja veinte dulces"],
  };
  const FLAVORS = ["carne","pollo","huevo","mandioca","queso","jamon","jamón","jamon y queso","jamón y queso",
    "saltena","salteña","milanesa","dulce de leche","chocolate","maicena","vainilla","coco","membrillo","frutilla","guayaba",
    "baguette","gallego","campo","chip","anana","ananá","pina","piña","manzana"];

  const CAT_SYNONYMS = {
    empanadas: SYN.empanada,
    confiteria: ["confiteria","confitería","postres","dulces","reposteria","repostería","tortas","flanes","pastaflora","pasta flora","alfajores", ...SYN.croissant, ...SYN.dulces],
    bocaditos: SYN.bocadito,
    alfajores: SYN.alfajor,
    panificados: [...SYN.pan],
    milanesas: SYN.milanesa
  };

  // ===== Índice dinámico de productos (desde window.__PRODUCTS__) =====
  function getProductIndex(){
    if (window.__PRODUCT_INDEX__?.byToken) return window.__PRODUCT_INDEX__;
    const productos = window.__PRODUCTS__ || []; // <-- lo llena tu main.js desde Supabase
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

  // ===== Helpers de parsing =====
  function detectCategory(msgNorm){
    for (const [cat, syns] of Object.entries(CAT_SYNONYMS)) {
      if (syns.some(s => msgNorm.includes(s))) return cat;
    }
    return null;
  }

  function extractFlavor(fragment){
    const multi = /(jamon y queso|dulce de leche|papa frita|milanesa|chipaguazu|pan del campo|sopa paraguaya)/;
    const m = (fragment||"").match(multi);
    if (m) return normalize(m[1]);
    for (const f of FLAVORS) if ((fragment||"").includes(f)) return normalize(f);
    return null;
  }

  function guessProductText(msgRaw){
    const msg = normalize(msgRaw);
    // pista: primer token que exista en el índice
    const idx = getProductIndex();
    for (const t of msg.split(" ")) if (idx.byToken?.has(t)) return t;
    if (/\bmilanesa(s)?\b/.test(msg)) return "milanesa";
    if (/\bempanad(a|as)\b/.test(msg)) return "empanada";
    if (FLAVORS.some(f => msg.includes(normalize(f)))) return "empanada";
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
      const flavor = m[3] ? normalize(m[3]) : extractFlavor(msg);
      lastProd = prodTxt;
      items.push({ cantidad: qty || 1, prodTxt, flavor });
    }
    const r2 = /(?:y|,|mas)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+de\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+)?)/gi;
    while ((m = r2.exec(msg)) !== null) {
      const qty = toNumber(m[1]);
      const flavor = normalize(m[2]);
      let prodTxt = lastProd || guessProductText(msg) || "empanada";
      items.push({ cantidad: qty || 1, prodTxt, flavor });
    }
    return items;
  }

  function findProduct(text, flavor){
    const t = normalize(text);
    const fav = flavor ? normalize(flavor) : null;
    let cands = candidatesFor(t);
    if (!cands.length) {
      const all = getProductIndex().all;
      cands = all.filter(p => normalize(p.nombre).includes(t));
    }
    if (!cands.length) return null;
    if (!fav) return cands[0];
    const favMatch = cands.find(p => normalize(p.nombre).includes(fav));
    return favMatch || cands[0];
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
    return inCat;
  }

  // ===== Parser de intención =====
  function parseMessage(msgRaw=""){
    const msg = normalize(preclean(msgRaw));
    if (/vaciar (el )?carrito|limpiar carrito|vaciar todo/.test(msg)) return { intent:"empty_cart" };
    if (/ver (mi )?carrito|mostrar carrito|que (hay|tengo) en el carrito/.test(msg)) return { intent:"show_cart" };
    if (/total|cuanto (es|sale|debo|vale)/.test(msg)) return { intent:"show_total" };
    if (/ayuda|que puedes hacer|como funciona|menu|menú/.test(msg)) return { intent:"help" };

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

    // Reserva catering – si aparece, lo maneja el submódulo
    if (/\b(catering|reserva(r)?|agendar)\b/.test(msg)) {
      return { intent:"catering_book", raw: msgRaw };
    }

    return { intent:"none" };
  }

  // ===== Acciones (carrito + catálogo dinámico + promos) =====
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
`Puedo ayudarte con tu compra:
• “agregá 3 empanadas de carne y 1 de jamón y queso”
• “quitá 1 alfajor”
• “poné 5 empanadas”
• “ver carrito”, “total”, “vaciar carrito”

Si querés info del local, horarios o dudas generales, preguntame directamente 😉` };
  }

  // dentro de chatbot.brain.js, reemplaza actCategoryInfo por:
    async function actCategoryInfo({ cat, topic }){
      const inCat = getCategorySummary(cat);
      if (!inCat.length) return { text:"Por ahora no tengo productos cargados en esa categoría." };

      if (topic === "sabores") {
        const flavors = new Set();
        for (const p of inCat) {
          const n = normalize(p.nombre);
          FLAVORS.forEach(f => { if (n.includes(normalize(f))) flavors.add(f); });
        }
        if (flavors.size) {
          return { text:`Mirá, en ${cat} solemos tener: ${Array.from(flavors).slice(0,8).join(", ")}. ¿Querés que te recomiende algo?` };
        }
        return { text:`Tenemos varias opciones en ${cat}. ¿Querés que te muestre algunas?` };
      }

      const top = inCat.slice(0,6).map(p => `• ${p.nombre} — ${fmtGs(p.precio)}`).join("\n");
      const extra = inCat.length > 6 ? `\n…y ${inCat.length - 6} más.` : "";
      return { text:`Claro, en ${cat} tenemos:\n${top}${extra}\n¿Te agrego alguno al carrito o querés saber el total?` };
    }


  async function actProductInfo({ topic, prodTxt }){
    // Si coincide con producto del índice → respuesta natural con datos reales
    const prod = findProduct(prodTxt);
    if (prod) {
      if (topic === "precio") return { text:`${prod.nombre} está a ${fmtGs(prod.precio)}.` };
      return { text:`De ${prod.nombre} tenemos opciones frescas. ¿Querés que lo agregue al carrito o te cuento el precio?` };
    }
    // Devuelvo null → que lo atienda el backend /api/ask (horarios, dirección, etc.)
    return null;
  }

  async function actCategoryPrices({ cat }){
    const inCat = getCategorySummary(cat);
    if (!inCat.length) return { text:"No tengo precios cargados para esa categoría." };
    const lines = inCat.map(p => `• ${p.nombre} — ${fmtGs(p.precio)}`).join("\n");
    return { text:`Precios en ${cat}:\n${lines}` };
  }

  // ===== Ventana de promociones (viernes 17:00–19:00 America/Asuncion) =====
  function isPromoWindowNow() {
    try {
      const now = new Date();
      const day = now.getDay(); // 5 = viernes
      const hh = now.getHours();
      const mm = now.getMinutes();
      return (day === 5) && (hh > 16 && (hh < 19 || (hh === 19 && mm === 0)));
    } catch { return false; }
  }
  function getActivePromos() {
    const promos = [];
    if (isPromoWindowNow()) {
      promos.push({
        id: "emp-2x1",
        title: "2x1 en Empanadas",
        detail: "Válido hoy de 17:00 a 19:00. ¡Aprovechá! 🥟✨",
        cta: { text: "Ver empanadas", payload: "ver empanadas" }
      });
    }
    return promos;
  }

  // ===== API pública =====
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
        case "product_info":   return await actProductInfo(parsed) || null; // si null → backend
        case "category_prices":return await actCategoryPrices(parsed);
        case "catering_book":  return { text:null }; // deja que lo maneje ChatCatering o backend
        default:               return null;
      }
    }catch(e){
      console.error("[ChatBrain] handleMessage error:", e);
      return { text:"Algo salió mal al interpretar tu pedido. Probá de nuevo 😅" };
    }
  };

  // Exponemos promos por si el backend quiere mostrarlas también
  window.ChatBrain.getActivePromos = getActivePromos;
})();
