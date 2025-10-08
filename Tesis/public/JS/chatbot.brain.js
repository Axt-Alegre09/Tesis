/* JS/chatbot.brain.js
   NLU liviano para catálogo + carrito + respuestas naturales.
   - Disponibilidad: “tienes/ hay / venden ... ?”
   - Sabores: “qué sabores de empanadas/milanesas ... ?”
   - Precio por cantidad: “cuánto me alcanzan 2 empanadas?”
   - Agregados compuestos: “agregame 5 empanadas de carne con 2 sándwiches”
   - Mantiene: add/remove/set_qty/total/ver/vaciar/ayuda
*/
(() => {
  // ===== Utils lenguaje =====
  const NUM_PAL = { uno:1, una:1, un:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9, diez:10, once:11, doce:12 };
  const normalize = (s="") => String(s).toLowerCase()
      .normalize("NFD").replace(/\p{Diacritic}/gu,"")
      .replace(/[.,;:!¡¿?()"]/g," ")
      .replace(/\s+/g," ").trim();
  const toNumber = (w) => /^\d+$/.test(w||"") ? parseInt(w,10) : (NUM_PAL[w] ?? NaN);
  const fmtGs = n => new Intl.NumberFormat("es-PY").format(Math.max(0, Number(n)||0)) + " Gs";
  const pluralize = (s, n=2) => (n===1? s: s.endsWith("a")? s+"s": s.endsWith("or")? s+"es": s+"s");
  const list = (arr=[]) => arr.length<=1 ? (arr[0]||"") : arr.slice(0,-1).join(", ") + " y " + arr.slice(-1);

  // ===== Dominio: sinónimos + sabores/categorías =====
  const SYN = {
    empanada: ["empanada","empanadas","empi","empas"],
    alfajor:  ["alfajor","alfajores"],
    bocadito: ["bocadito","bocaditos","combo","combos"],
    pan:      ["pan","panificados","baguette","gallego","campo","chip"],
    milanesa: ["milanesa","milanesas","sandwich milanesa","sándwich milanesa","sandwiches","sándwiches","sanguche","sanguches"],
    sandwich: ["sandwich","sandwiches","sándwich","sándwiches"]
  };

  // sabores (con multi-palabra)
  const FLAVORS = [
    "carne","pollo","huevo","mandioca","queso","jamon","jamon y queso","saltena","salteña",
    "dulce de leche","chocolate","maicena","vainilla","coco","membrillo","frutilla"
  ];

  // categorías para consultas libres
  const CAT_SYNONYMS = {
    empanadas: SYN.empanada,
    confiteria: ["confiteria","confitería","postres","dulces","reposteria","repostería","tortas","flanes","alfajores"],
    bocaditos: SYN.bocadito,
    alfajores: SYN.alfajor,
    panificados: SYN.pan,
    milanesas: SYN.milanesa,
    sandwiches: SYN.sandwich
  };

  // ===== KB (lo que pasaste) — ayuda cuando el catálogo no alcanza =====
  const KB = {
    // Bocaditos
    "bocaditos combo 1": { precio: 55000, incluye: "2 empanadas (a elección), 2 sándwiches y 4 chipas" },
    "bocaditos combo 2": { precio: 50000, incluye: "3 empanadas, 3 sandwichitos, 2 pajagua, 2 chipaguazú, 4 chipas y 4 mbejú" },
    "bocaditos combo 3": { precio: 150000, incluye: "4 empanadas, 3 chipas, 3 chipaguazú, 3 sopas, 10 aperitivos, 5 pajagua, 4 milanesas y 5 mbejú" },
    "bocaditos combo 4": { precio: 75000, incluye: "9 sándwiches variados de milanesa (pollo y carne)" },
    "bocadito personal": { precio: 35000, incluye: "5 empanadas + 2 salsas (kétchup y lactonesa)" },
    "bocadito en pareja": { precio: 65000, incluye: "11 empanadas + 2 salsas" },

    // Confitería
    "alfajores": { precio: 25000, incluye: "Maicena y maicena bañada en chocolate" },
    "croissants": { precio: 30000 }, "croisant": { precio: 30000 },
    "dulces (caja 20)": { precio: 25000, incluye: "1 caja con 20 dulces" },
    "flanes (2)": { precio: 20000, incluye: "2 flanes a elegir" },
    "pasta floras (kilo)": { precio: 20000 },
    "torta dulce de leche (pequena congelada)": { precio: 45000 },
    "pai de manzana": { precio: 35000 }, "pai de allana": { precio: 35000 },

    // Panificados
    "pan baguette (1)": { precio: 15000 },
    "pan casero de la casa (1)": { precio: 20000 },
    "pan chip (pack 10)": { precio: 15000 },
    "pan del campo (1)": { precio: 22000 },
    "pan del campo (kilo)": { precio: 22000 },
    "pan gallego (kilo)": { precio: 19000 },

    // Rosticería
    "empanada de carne": { precio: 19000 },
    "empanada de huevo": { precio: 17000 },
    "empanada de mandioca": { precio: 10000 },
    "empanada de jamon y queso": { precio: 17000 },
    "mbeju (1)": { precio: 14000 },
    "combo empanada + coca 250 ml": { precio: 24000, incluye: "1 empanada de carne, 1 pan y 1 Coca 250 ml" },
    "combo empanada saltena + salsa": { precio: 26000, incluye: "1 empanada salteña + salsa (kétchup o lactonesa)" },
    "combo sandwich milanesa + papas + coca 350 ml": { precio: 25000, incluye: "Sándwich milanesa (carne), papas pequeñas y Coca 350 ml" }
  };

  // Aliases -> claves KB
  const ALIAS = new Map([
    ["combo 1","bocaditos combo 1"],["bocaditos 1","bocaditos combo 1"],
    ["combo 2","bocaditos combo 2"],["bocaditos 2","bocaditos combo 2"],
    ["combo 3","bocaditos combo 3"],["bocaditos 3","bocaditos combo 3"],
    ["combo 4","bocaditos combo 4"],["bocaditos 4","bocaditos combo 4"],
    ["en pareja","bocadito en pareja"],["bocadito pareja","bocadito en pareja"],
    ["caja de dulces","dulces (caja 20)"],["dulces","dulces (caja 20)"],
    ["flanes","flanes (2)"],["flan","flanes (2)"],
    ["pasta flora","pasta floras (kilo)"],["pasta floras","pasta floras (kilo)"],
    ["torta dulce de leche","torta dulce de leche (pequena congelada)"],
    ["baguette","pan baguette (1)"],["pan buguete","pan baguette (1)"],
    ["pan casero","pan casero de la casa (1)"],
    ["pan chip","pan chip (pack 10)"],
    ["campo 1","pan del campo (1)"],["campo kilo","pan del campo (kilo)"],
    ["gallego kilo","pan gallego (kilo)"],
    ["empanada carne","empanada de carne"],["empanada huevo","empanada de huevo"],
    ["empanada mandioca","empanada de mandioca"],["empanada jamon y queso","empanada de jamon y queso"],
    ["combo empanada coca","combo empanada + coca 250 ml"],["combo saltena","combo empanada saltena + salsa"],
    ["combo sandwich milanesa","combo sandwich milanesa + papas + coca 350 ml"]
  ]);

  // ===== Índice de catálogo =====
  function getProductIndex(){
    if (window.__PRODUCT_INDEX__?.byToken) return window.__PRODUCT_INDEX__;
    const productos = window.__PRODUCTS__ || [];
    const byToken = new Map();
    const all = productos.map(p => ({
      id: String(p.id ?? p.productoId ?? p.uuid ?? p.ID ?? p.Id ?? p.slug ?? p.nombre),
      nombre: String(p.nombre ?? p.titulo ?? p.title ?? "").trim(),
      precio: Number(p.precio || 0),
      imagen: p.imagen || p.image || null
    }));

    for (const p of all) {
      const base = normalize(p.nombre);
      const tokens = new Set(base.split(" ").filter(Boolean));
      for (const [canon, arr] of Object.entries(SYN)) {
        if (base.includes(canon) || arr.some(a => base.includes(a))) {
          arr.forEach(a => tokens.add(a)); tokens.add(canon);
        }
      }
      FLAVORS.forEach(f => { if (base.includes(normalize(f))) tokens.add(normalize(f)); });
      for (const [alias, target] of ALIAS.entries()) {
        if (base.includes(alias)) tokens.add(alias);
        if (base.includes(target)) tokens.add(target);
      }
      for (const t of tokens) {
        if (!byToken.has(t)) byToken.set(t, []); byToken.get(t).push(p);
      }
      if (!byToken.has(base)) byToken.set(base, []); byToken.get(base).push(p);
    }
    return (window.__PRODUCT_INDEX__ = { all, byToken });
  }
  const candidatesFor = (token) => getProductIndex().byToken.get(token) || [];

  // ===== KB lookup =====
  function kbLookup(text){
    const t = normalize(text);
    if (KB[t]) return { key:t, data:KB[t] };
    const alias = ALIAS.get(t);
    if (alias && KB[alias]) return { key:alias, data:KB[alias] };
    const k = Object.keys(KB).find(k => t.includes(k) || k.includes(t));
    if (k) return { key:k, data:KB[k] };
    return null;
  }

  // ===== Catálogo: match por texto + sabor =====
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

  // ===== Detección categoría y resúmenes =====
  function detectCategory(msgNorm){
    for (const [cat, syns] of Object.entries(CAT_SYNONYMS))
      if (syns.some(s => msgNorm.includes(s))) return cat;
    return null;
  }
  function getCategorySummary(cat){
    const idx = getProductIndex();
    const inCat = idx.all.filter(p => {
      const n = normalize(p.nombre);
      if (cat === "empanadas")  return SYN.empanada.some(s => n.includes(s)) || n.includes("empanada");
      if (cat === "alfajores")  return SYN.alfajor.some(s => n.includes(s))  || n.includes("alfajor");
      if (cat === "bocaditos")  return SYN.bocadito.some(s => n.includes(s)) || n.includes("combo");
      if (cat === "confiteria") return ["alfajor","torta","flan","croissant","pasta flora","dulce","pai"].some(s=>n.includes(s));
      if (cat === "panificados")return ["pan","baguette","gallego","campo","chip"].some(s=>n.includes(s));
      if (cat === "milanesas")  return ["milanesa","sándwich milanesa","sandwich milanesa"].some(s=>n.includes(s));
      if (cat === "sandwiches") return ["sandwich","sándwich"].some(s=>n.includes(s));
      return false;
    });

    const names = inCat.map(p => p.nombre);
    const flavors = new Set();
    const scan = (arr, src) => arr.forEach(f => { if (normalize(src).includes(normalize(f))) flavors.add(f); });
    for (const n of names){ scan(FLAVORS, n); }
    // sabores por milanesa típicos:
    if (cat === "milanesas") { ["pollo","carne"].forEach(f=>flavors.add(f)); }

    return { count: inCat.length, names: names.slice(0,10), flavors: Array.from(flavors) };
  }

  // ===== Parsers =====
  function extractFlavor(fragment){
    const multi = /(jamon y queso|dulce de leche|papa frita|milanesa|chipaguazu|pan del campo|sopa paraguaya)/i;
    const m = (fragment||"").match(multi);
    if (m) return normalize(m[1]);
    for (const f of FLAVORS) if (normalize(fragment).includes(normalize(f))) return normalize(f);
    return null;
  }

  // Divide por conectores: "y", "e", ",", "con"
  function splitSegments(msg) {
    const parts = normalize(msg).split(/\s+(?:y|e|,|con)\s+/g);
    return parts.filter(Boolean);
  }

  // Extrae “2 empanadas de carne”, “… 2 sandwiches”
  function extractItems(msg){
    const items = [];
    const segs = splitSegments(msg);
    let lastProd = null;

    const r = /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*)?(?:\s+de\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+)?(?:\s+de\s+[a-záéíóúñ]+)?))?/i;

    for (const seg of segs) {
      const m = seg.match(r);
      if (!m) continue;
      const qty = toNumber(m[1]);
      const prodTxt = (m[2] && normalize(m[2])) || lastProd || guessProductText(msg) || "empanadas";
      const flavor = m[3] ? normalize(m[3]) : extractFlavor(seg);
      lastProd = prodTxt;
      if (qty) items.push({ cantidad: qty, prodTxt, flavor });
    }

    // fallback: “... y 1 de jamon”
    if (!items.length) {
      const r2 = /(?:y|,|mas|con)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+de\s+([a-záéíóúñ]+(?:\s+y\s+[a-záéíóúñ]+)?)/gi;
      let m2;
      while ((m2 = r2.exec(msg)) !== null) {
        const qty = toNumber(m2[1]);
        const flavor = normalize(m2[2]);
        const prodTxt = lastProd || guessProductText(msg) || "empanadas";
        items.push({ cantidad: qty || 1, prodTxt, flavor });
      }
    }

    return items;
  }

  function guessProductText(msg){
    const n = normalize(msg);
    for (const [alias] of ALIAS.entries()) if (n.includes(alias)) return alias;
    const tokens = n.split(" ");
    for (const [canon, arr] of Object.entries(SYN)) if (arr.some(a => tokens.includes(a))) return canon;
    const idx = getProductIndex();
    for (const t of tokens) if (idx.byToken?.has(t)) return t;
    const kb = kbLookup(n); if (kb) return kb.key;
    return null;
  }

  // ===== Intents =====
  function parseMessage(msgRaw=""){
    const msg = normalize(msgRaw);

    // Rápidas carrito/ayuda
    if (/vaciar (el )?carrito|limpiar carrito|vaciar todo/.test(msg)) return { intent:"empty_cart" };
    if (/ver (mi )?carrito|mostrar carrito|que (hay|tengo) en el carrito/.test(msg)) return { intent:"show_cart" };
    if (/\btotal\b|cuanto (es|sale|debo|vale)/.test(msg)) return { intent:"show_total" };
    if (/ayuda|que puedes hacer|como funciona/.test(msg)) return { intent:"help" };

    // Disponibilidad: “tienes/hay/venden/disponen/manejan ... ?”
    if (/(tienes|tenes|hay|venden|disponen|manejan|ofrecen|tienen)\b/.test(msg)) {
      const cat = detectCategory(msg);
      if (cat) return { intent:"availability", cat };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"availability", prodTxt };
    }

    // Sabores: “qué sabores de empanadas/milanesas ... ?”
    if (/(sabor|sabores|variedad).*(empanada|empanadas|milanesa|milanesas|alfajor|alfajores|sandwich|sándwich)/.test(msg)) {
      const cat = detectCategory(msg) || "empanadas";
      return { intent:"flavors_of", cat };
    }

    // Precio por cantidad: “cuanto me alcanzan/alcanzarian 2 empanadas”
    if (/cuanto (me )?(alcanza(n|rian)?|sal(e|dria)(n)?)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent:"price_for_qty", items };
      // si no extrajo producto, asumir empanadas
      const m = msg.match(/(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)/);
      if (m) return { intent:"price_for_qty", items:[{ cantidad: toNumber(m[1]), prodTxt:"empanadas" }] };
    }

    // Info de producto (incluye/precio suelto)
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

    // Set qty directo: “pone 5 empanadas …”
    if (/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/.test(msg)) {
      const m = msg.match(/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.*)/);
      if (m) {
        const qty = toNumber(m[2]);
        const rest = (m[3]||"").trim();
        const flavor = extractFlavor(rest);
        return { intent:"set_qty", qty, prodTxt: rest, flavor };
      }
    }

    // Category info general (lista o sabores)
    const cat = detectCategory(msg);
    if (cat) {
      if (/sabor|sabores|variedad/.test(msg)) return { intent:"category_info", cat, topic:"sabores" };
      if (/que tienen|que hay|lista|catalogo|catálogo|mostrar/.test(msg)) return { intent:"category_info", cat, topic:"lista" };
    }

    // Quitar
    if (/(quita|saca|elimina|borra)\b/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent:"remove", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"remove", items:[{ cantidad:1, prodTxt }] };
    }

    // Agregar (incluye compuestos con “con”)
    if (/(agrega(me)?|sum(a|ar)|pone|pon|quiero|dame|añade|anadi)\b/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent:"add", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"add", items:[{ cantidad:1, prodTxt }] };
    }

    return { intent:"none" };
  }

  // ===== Ejecutores =====
  async function actAvailability({ cat, prodTxt }) {
    const idx = getProductIndex();
    if (cat) {
      const sum = getCategorySummary(cat);
      if (!sum.count) return { text:`Por ahora no tengo ${cat}.` };
      const extras = sum.flavors.length ? ` Sabores/variantes: ${sum.flavors.join(", ")}.` : "";
      return { text:`Sí, tenemos ${cat} (${sum.count} productos).${extras}` };
    }
    if (prodTxt) {
      const prod = findProduct(prodTxt);
      if (prod) return { text:`Sí, tenemos ${prod.nombre}. Precio: ${fmtGs(prod.precio)}.` };
      // intentar KB
      const kb = kbLookup(prodTxt);
      if (kb) {
        const p = kb.data;
        return { text:`Sí, tenemos ${kb.key}. ${p.precio? "Precio: " + fmtGs(p.precio) + ".": ""} ${p.incluye? "Incluye: " + p.incluye + ".": ""}`.trim() };
      }
      return { text:"No encontré ese producto en el catálogo." };
    }
    return { text:"¿Qué producto te interesa?" };
  }

  async function actFlavorsOf({ cat }) {
    const sum = getCategorySummary(cat);
    if (!sum.count) return { text:`Por ahora no tengo ${cat}.` };
    if (sum.flavors.length) return { text:`Sabores de ${cat}: ${sum.flavors.join(", ")}.` };
    return { text:`Tenemos varias opciones en ${cat}. ¿Querés que te muestre algunos?` };
  }

  async function actPriceForQty({ items }) {
    const lines = [];
    let totalAll = 0;

    for (const it of items) {
      const prod = findProduct(it.prodTxt, it.flavor) || (kbLookup(it.prodTxt)?.data ? { nombre: it.prodTxt, precio: kbLookup(it.prodTxt).data.precio } : null);
      if (!prod || !Number(prod.precio)) { lines.push(`• ${it.cantidad} ${pluralize(it.prodTxt, it.cantidad)}: sin precio.`); continue; }
      const subtotal = Number(prod.precio) * Number(it.cantidad || 1);
      totalAll += subtotal;
      lines.push(`• ${it.cantidad} × ${prod.nombre}: ${fmtGs(subtotal)}`);
    }
    if (!lines.length) return { text:"No pude calcular. Decime el producto como aparece en el catálogo." };
    return { text: `Te alcanzaría:\n${lines.join("\n")}\nTOTAL: ${fmtGs(totalAll)}.` };
  }

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
    const snap = window.CartAPI.getSnapshot?.(); const isRemote = snap?.mode === "remote";
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };

    let removed = [];
    for (const it of (items?.length ? items : [{ cantidad:1, prodTxt: guessProductText("") }])) {
      const prod = findProduct(it.prodTxt, it.flavor); if (!prod) continue;
      const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre))); if (!row) continue;

      if (isRemote) return { text:"Por ahora quito por ítem desde la página del carrito (remoto). Tocá la papelera 😉" };
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
    if (snap.mode === "remote") return { text:"Cambiá cantidades desde la vista del carrito (remoto). Usá +/− 😊" };
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
    if (snap.mode === "remote") return { text:"Para vaciar el carrito remoto, usá el botón “Vaciar carrito”. 😉" };
    for (const it of (snap.items||[])) await window.CartAPI.remove({ id: it.id });
    return { text:"Listo, vacié tu carrito." };
  }

  function actHelp(){
    return { text:
`Puedo ayudarte con frases naturales, por ejemplo:
• “¿tienen empanadas?” / “sabores de empanadas”
• “¿tienen milanesas? ¿qué sabores?”
• “¿cuánto me alcanzan 2 empanadas?”
• “agregame 5 empanadas de carne con 2 sándwiches”
• “ver carrito”, “total”, “vaciar carrito”

Probá libre y te entiendo 🙂` };
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
      if (cat==="milanesas" && k.includes("milanesa")) lines.push(`• ${titulo(k)} — ${v.precio? fmtGs(v.precio): "s/ precio"}`);
    }
    if (!lines.length) return { text:"No tengo precios cargados para esa categoría." };
    return { text:`Precios en ${cat}:\n` + lines.join("\n") };
  }

  const titulo = (k) => k.split(" ").map(w => w[0].toUpperCase()+w.slice(1)).join(" ");

  // ===== API pública =====
  window.ChatBrain = {
    // opcional: permitir construir índice si main lo llama
    buildIndex(productos) {
      window.__PRODUCTS__ = Array.isArray(productos) ? productos : [];
      window.__PRODUCT_INDEX__ = null;
      return true;
    },
    async handleMessage(userText){
      try{
        const p = parseMessage(userText||"");
        switch(p.intent){
          case "availability":      return await actAvailability(p);
          case "flavors_of":        return await actFlavorsOf(p);
          case "price_for_qty":     return await actPriceForQty(p);
          case "add":               return await actAdd(p.items);
          case "remove":            return await actRemove(p.items);
          case "set_qty":           return await actSetQty(p);
          case "show_total":        return await actShowTotal();
          case "show_cart":         return await actShowCart();
          case "empty_cart":        return await actEmpty();
          case "help":              return actHelp();
          case "category_info":     return await actCategoryInfo(p);
          case "product_info":      return await actProductInfo(p);
          case "category_prices":   return await actCategoryPrices(p);
          default:                  return null;
        }
      }catch(e){
        console.error("[ChatBrain] handleMessage error:", e);
        return { text:"Algo salió mal al interpretar tu pedido. Probá de nuevo 😅" };
      }
    }
  };
})();
