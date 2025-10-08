/* JS/chatbot.brain.js
   “Cerebro” del Paniquiños Bot para entender catálogo y carrito (NLU liviano).
   Cobertura: Bocaditos (combos), Confitería, Panificados, Rotisería/Empanadas.
*/
(() => {
  // ================ Utiles de lenguaje ================
  const NUM_PAL = { uno:1, una:1, un:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7,
    ocho:8, nueve:9, diez:10, once:11, doce:12, quince:15, veinte:20 };
  const normalize = (s="") =>
    s.toLowerCase()
     .normalize("NFD").replace(/\p{Diacritic}/gu,"")
     .replace(/[.,;:!¡¿?()"]/g," ")
     .replace(/\s+/g," ")
     .trim();
  const toNumber = (w) => (/^\d+$/.test(w) ? parseInt(w,10) : (NUM_PAL[w] ?? NaN));

  // ================ Conocimiento de dominio ================
  // Sinónimos de “tipos”/palabras clave de productos
  const SYN = {
    empanada: ["empanada","empanadas","empi","empas","saltena","salteña"],
    alfajor:  ["alfajor","alfajores"],
    bocadito: ["bocadito","bocaditos","combo","combos","aperitivo","aperitivos"],
    sandwich: ["sandwich","sándwich","sandwiches","sánguches","sandwichito","sandwichitos"],
    pan:      ["pan","panes","panificados","baguette","baguete","buguete","gallego","campo","casero","chip","chipa"],
    postre:   ["postre","postres","confiteria","confitería","dulces","reposteria","repostería","torta","tortas","tarteletas","pai","pay","flan","flanes","croissant","croisants","medialuna","medialunas","pastaflora","pasta flora","pasta floras"],
    bebida:   ["coca","coca cola","gaseosa","bebida"],
    sopa:     ["sopa","sopas"],
    mbeju:    ["mbeyu","mbeju","mbejú"],
    milanesa: ["milanesa","milanesas"],
    pajagua:  ["pajagua","pajaguas"],
    chipaguazu: ["chipa guazu","chipaguazu","chipa guazú"]
  };

  // Sabores/variantes (tags)
  const FLAVORS_GENERAL = [
    "carne","pollo","jamon","jamon y queso","queso","dulce","chocolate","personal","pareja","combo"
  ];
  const FLAVORS_EMPANADA = [
    "carne","pollo","jamon","jamon y queso","queso","huevo","mandioca","saltena","salteña"
  ];
  const FLAVORS_DESSERT = [
    "dulce de leche","chocolate","maicena","maizena","frutilla","fruta","membrillo",
    "vainilla","coco","nuez","manjar","glaseado","manzana"
  ];
  const FLAVORS_BREAD = [
    "baguette","buguete","gallego","campo","casero","chip","del campo"
  ];

  // Sinónimos por categoría (para “¿qué tienen en …?” y “sabores de …”)
  const CAT_SYNONYMS = {
    empanadas: SYN.empanada,
    bocaditos: SYN.bocadito,
    confiteria: ["confiteria","confitería","postres","dulces","reposteria","repostería","alfajores","tortas","flanes","pai","pastaflora","pasta flora"],
    panificados: ["pan","panes","panificados","baguette","gallego","campo","casero","chip"],
    rosticeria: ["rosticeria","rotiseria","rostiseria","sandwich","sándwich","milanesa","combo"]
  };

  // ====== Productos “extra” (por si aún no están en window.__PRODUCTS__) ======
  // Sirven para que el bot igual pueda reconocer y agregar (modo invitado/local).
  // Si ya los tienes en el catálogo real, el índice los fusiona y no duplica.
  const EXTRA_PRODUCTS = [
    // -------- BOCADITOS / COMBOS --------
    { nombre: "Bocaditos Combo 1", precio: 55000 },
    { nombre: "Bocaditos Combo 2", precio: 50000 },
    { nombre: "Bocaditos Combo 3", precio: 150000 },
    { nombre: "Bocaditos Combo 4", precio: 75000 },
    { nombre: "Bocadito Personal", precio: 35000 },
    { nombre: "Bocadito en Pareja", precio: 65000 },

    // -------- CONFITERÍA --------
    { nombre: "Alfajores de maicena y chocolate", precio: 25000 },
    { nombre: "Croissants", precio: 30000 },
    { nombre: "Caja de 20 Dulces", precio: 25000 },
    { nombre: "Flanes (2 unidades)", precio: 20000 },
    { nombre: "Pasta Floras (kilo)", precio: 20000 },
    { nombre: "Torta pequeña de dulce de leche (congelada)", precio: 45000 },
    { nombre: "Pai de manzana", precio: 35000 },

    // -------- PANIFICADOS --------
    { nombre: "Pan Baguette (1 u.)", precio: 15000 },
    { nombre: "Pan Casero de la casa (1 u.)", precio: 20000 },
    { nombre: "Pan Chip (pack x10)", precio: 15000 },
    { nombre: "Pan del Campo (1 u.)", precio: 22000 },
    { nombre: "Pan del Campo (kilo)", precio: 22000 },
    { nombre: "Pan Gallego (kilo)", precio: 19000 },

    // -------- ROSTISERÍA / EMPANADAS & COMBOS --------
    { nombre: "Empanada de carne", precio: 19000 },
    { nombre: "Empanada de huevo", precio: 17000 },
    { nombre: "Empanada de mandioca", precio: 10000 },
    { nombre: "Empanada de jamón y queso", precio: 17000 },

    { nombre: "Combo Empanada + Coca 250 ml", precio: 24000 },
    { nombre: "Combo Empanada Salteña + salsa", precio: 26000 },
    { nombre: "Combo Sándwich de milanesa + papas + Coca 350 ml", precio: 25000 },

    { nombre: "Mbeju (1 u.)", precio: 14000 }
  ];

  // ================ Índice de productos (usa tu catálogo + extra) ================
  function getProductIndex() {
    if (window.__PRODUCT_INDEX__?.byToken) return window.__PRODUCT_INDEX__;

    const base = (window.__PRODUCTS__ || []).map(p => ({
      id: String(p.id ?? p.productoId ?? p.uuid ?? p.ID ?? p.Id ?? p.slug ?? p.nombre),
      nombre: String(p.nombre ?? p.titulo ?? p.title ?? "").trim(),
      precio: Number(p.precio || 0),
      imagen: p.imagen || p.image || null
    }));

    // Merge con EXTRA (evita duplicados por nombre normalizado)
    const seen = new Set(base.map(p => normalize(p.nombre)));
    for (const ex of EXTRA_PRODUCTS) {
      const key = normalize(ex.nombre);
      if (!seen.has(key)) base.push({
        id: ex.id ? String(ex.id) : ex.nombre, // id “amigable” si no hay UUID
        nombre: ex.nombre,
        precio: Number(ex.precio || 0),
        imagen: ex.imagen || null
      });
      seen.add(key);
    }

    const byToken = new Map();
    const all = base;

    for (const p of all) {
      const baseName = normalize(p.nombre);
      const tokens = new Set(baseName.split(" ").filter(Boolean));

      // sinónimos por “tipo”
      for (const [canon, arr] of Object.entries(SYN)) {
        if (baseName.includes(canon) || arr.some(a => baseName.includes(a))) {
          tokens.add(canon); arr.forEach(a => tokens.add(a));
        }
      }
      // sabores
      [...FLAVORS_GENERAL, ...FLAVORS_EMPANADA, ...FLAVORS_DESSERT, ...FLAVORS_BREAD]
        .forEach(f => { if (baseName.includes(normalize(f))) tokens.add(normalize(f)); });

      // multi-palabra -> generar también token junto
      const multipal = ["dulce de leche","jamon y queso","pan del campo"];
      multipal.forEach(mp => { if (baseName.includes(normalize(mp))) tokens.add(normalize(mp)); });

      for (const t of tokens) {
        if (!byToken.has(t)) byToken.set(t, []);
        byToken.get(t).push(p);
      }
    }
    return (window.__PRODUCT_INDEX__ = { all, byToken });
  }

  const candidatesFor = (token) => getProductIndex().byToken.get(token) || [];

  // ================ Búsqueda de producto por texto + (opcional) sabor ================
  function findProduct(text, flavor) {
    const t = normalize(text);
    const fav = flavor ? normalize(flavor) : null;

    let cands = candidatesFor(t);
    if (!cands.length) {
      for (const [canon, arr] of Object.entries(SYN)) {
        if (t.includes(canon) || arr.includes(t)) { cands = candidatesFor(canon); break; }
      }
    }
    if (!cands.length) {
      const all = getProductIndex().all;
      cands = all.filter(p => normalize(p.nombre).includes(t));
    }
    if (!cands.length) return null;
    if (!fav) return cands[0];

    // prioriza coincidencias por sabor/variante
    const favMatch = cands.find(p => normalize(p.nombre).includes(fav));
    return favMatch || cands[0];
  }

  // ================ Detección de categorías + resumen dinámico ================
  function detectCategory(msgNorm) {
    for (const [cat, syns] of Object.entries(CAT_SYNONYMS)) {
      if (syns.some(s => msgNorm.includes(normalize(s)))) return cat;
    }
    return null;
  }

  function getCategorySummary(cat) {
    const idx = getProductIndex();
    const inCat = idx.all.filter(p => {
      const n = normalize(p.nombre);
      if (cat === "empanadas")   return SYN.empanada.some(s => n.includes(s));
      if (cat === "bocaditos")   return n.includes("combo") || SYN.bocadito.some(s => n.includes(s));
      if (cat === "confiteria")  return CAT_SYNONYMS.confiteria.some(s => n.includes(normalize(s))) || SYN.alfajor.some(s => n.includes(s));
      if (cat === "panificados") return CAT_SYNONYMS.panificados.some(s => n.includes(normalize(s)));
      if (cat === "rosticeria")  return ["empanada","sandwich","milanesa","combo","mbeju","sopa"].some(k => n.includes(k));
      return false;
    });

    const names = inCat.map(p => p.nombre);
    const flavors = new Set();
    const scan = (arr, src) => arr.forEach(f => { if (normalize(src).includes(normalize(f))) flavors.add(f); });

    for (const n of names) {
      scan(FLAVORS_GENERAL, n);
      scan(FLAVORS_EMPANADA, n);
      scan(FLAVORS_DESSERT, n);
      scan(FLAVORS_BREAD, n);
    }

    return {
      count: inCat.length,
      names: names.slice(0, 10),
      flavors: Array.from(flavors)
    };
  }

  // ================ Parser de intención ================
  function parseMessage(msgRaw="") {
    const msg = normalize(msgRaw);

    // rápidas
    if (/vaciar (el )?carrito|limpiar carrito|vaciar todo/.test(msg)) return { intent:"empty_cart" };
    if (/ver (mi )?carrito|mostrar carrito|que (hay|tengo) en el carrito/.test(msg)) return { intent:"show_cart" };
    if (/total|cuanto (es|sale|debo)/.test(msg)) return { intent:"show_total" };
    if (/ayuda|que puedes hacer|como funciona/.test(msg)) return { intent:"help" };

    // setear cantidad (p. ej. “poné 5 empanadas”)
    if (/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/.test(msg)) {
      const m = msg.match(/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.*)/);
      if (m) {
        const qty = toNumber(m[2]);
        const rest = (m[3]||"").trim();
        const flavor =
          [...FLAVORS_EMPANADA, ...FLAVORS_DESSERT, ...FLAVORS_BREAD, ...FLAVORS_GENERAL]
            .find(f => rest.includes(normalize(f))) || null;
        return { intent:"set_qty", qty, prodTxt: rest, flavor };
      }
    }

    // preguntas por categoría
    const cat = detectCategory(msg);
    if (cat) {
      if (/sabor|sabores|variedad|gusto|gustos/.test(msg)) {
        return { intent:"category_info", cat, topic:"sabores" };
      }
      if (/que tienen|que hay|lista|catalogo|catálogo|mostrar|ofrecen/.test(msg)) {
        return { intent:"category_info", cat, topic:"lista" };
      }
    }

    // quitar
    if (/quita|saca|elimina|borra|remueve/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent:"remove", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"remove", items:[{ cantidad:1, prodTxt }] };
    }

    // agregar
    if (/agrega|agregame|agrega?me|sum(a|ar)|pone|pon|quiero|dame|añade|anadi|anadir/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent:"add", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent:"add", items:[{ cantidad:1, prodTxt }] };
    }

    return { intent:"none" };
  }

  // extrae cantidad + producto + (opcional) sabor
  function extractItems(msg) {
    const items = [];
    // “2 empanadas de carne”, “1 alfajor”, “3 pan baguette”, “… y 2 de jamon y queso”
    const r1 = /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)*)?(?:\s+de\s+([a-záéíóúñ\s]+))?/g;
    let m;
    while ((m = r1.exec(msg)) !== null) {
      const qty = toNumber(m[1]);
      let prodTxt = (m[2]||"").trim() || guessProductText(msg);
      if (!prodTxt) continue;
      const flavorRaw = (m[3]||"").trim();
      const flavor = flavorRaw || null;
      items.push({ cantidad: qty || 1, prodTxt, flavor });
    }

    // “… y 1 de jamon y queso”
    if (!items.length) {
      const r2 = /(?:y|mas)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+de\s+([a-záéíóúñ\s]+)/g;
      while ((m = r2.exec(msg)) !== null) {
        const qty = toNumber(m[1]);
        const flavor = m[2].trim();
        const prodTxt = guessProductText(msg) || "empanadas";
        items.push({ cantidad: qty || 1, prodTxt, flavor });
      }
    }
    return items;
  }

  function guessProductText(msg) {
    const tokens = msg.split(" ");
    for (const [canon, arr] of Object.entries(SYN)) {
      if (arr.some(a => tokens.includes(a))) return canon;
    }
    const idx = getProductIndex();
    for (const t of tokens) if (idx.byToken?.has(t)) return t;
    return null;
  }

  // ================ Acciones de categoría ================
  async function actCategoryInfo({ cat, topic }) {
    const sum = getCategorySummary(cat);
    if (sum.count === 0) return { text: "Aún no tengo productos en esa categoría." };

    if (topic === "sabores") {
      const has = sum.flavors.length > 0;
      const label = (cat === "confiteria") ? "postres/confitería" : cat;
      return { text: has
        ? `En ${label} tenemos sabores/variantes como: ${sum.flavors.join(", ")}.`
        : `Tenemos varias opciones en ${label}. ¿Querés que te muestre algunos?`
      };
    }
    const listado = sum.names.map(n => `• ${n}`).join("\n");
    const extra = sum.count > sum.names.length ? `\n…y ${sum.count - sum.names.length} más.` : "";
    const label = (cat === "confiteria") ? "postres/confitería" : cat;
    return { text: `En ${label} tenemos:\n${listado}${extra}` };
  }

  // ================ Ejecutores de intents ================
  async function actAdd(items) {
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
      } catch (e) {
        console.warn("[ChatBrain] add error:", e);
        missing.push(it);
      }
    }
    const parts = done.map(d => `${d.cantidad} ${pluralize(d.producto || d.prodTxt)}${d.flavor ? " de " + d.flavor : ""}`);
    let text = "";
    if (parts.length) {
      const snap = window.CartAPI.getSnapshot?.();
      const total = snap?.total ?? null;
      text += `✅ Agregué ${list(parts)} al carrito.` + (total!=null ? ` Total: ${fmtGs(total)}.` : "");
    }
    if (missing.length) {
      text += (text ? "\n" : "") +
        "No pude identificar: " + list(missing.map(m => `${m.cantidad} ${pluralize(m.prodTxt)}${m.flavor?` de ${m.flavor}`:""}`)) +
        ". Decime el nombre como aparece en el catálogo.";
    }
    return { text };
  }

  async function actRemove(items) {
    const snap = window.CartAPI.getSnapshot?.();
    const isRemote = snap?.mode === "remote";
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };

    let removed = [];
    for (const it of (items?.length ? items : [{ cantidad:1, prodTxt: guessProductText("") }])) {
      const prod = findProduct(it.prodTxt, it.flavor);
      if (!prod) continue;

      const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre)));
      if (!row) continue;

      if (isRemote) {
        return { text: "Para quitar ítems del carrito remoto usá el icono de papelera del producto. 😉" };
      } else {
        const newQty = Math.max(0, Number(row.cantidad || 1) - (it.cantidad || 1));
        if (newQty === 0) await window.CartAPI.remove({ id: row.id });
        else await window.CartAPI.setQty({ id: row.id }, newQty);
        removed.push(`${it.cantidad} ${pluralize(prod.nombre)}`);
      }
    }
    const after = window.CartAPI.getSnapshot?.();
    return { text: removed.length ? `🗑️ Saqué ${list(removed)}. Total: ${fmtGs(after?.total || 0)}.` : "No encontré ese producto en tu carrito." };
  }

  async function actSetQty({ prodTxt, flavor, qty }) {
    if (!qty || qty < 1) return { text: "Decime la cantidad (1 o más)." };
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };
    const prod = findProduct(prodTxt, flavor);
    if (!prod) return { text: "No identifiqué el producto. Decímelo como en el catálogo." };

    const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre)));
    if (!row) return { text: "Ese producto no está en tu carrito." };

    if (snap.mode === "remote") {
      return { text: "Por ahora solo puedo cambiar cantidades desde la vista del carrito (remoto). Usá los botones +/− 😊" };
    } else {
      await window.CartAPI.setQty({ id: row.id }, qty);
      const after = window.CartAPI.getSnapshot?.();
      return { text: `Listo: dejé ${qty} ${pluralize(prod.nombre, qty)}. Total: ${fmtGs(after?.total || 0)}.` };
    }
  }

  async function actShowTotal() {
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };
    return { text: `🧾 Total actual: ${fmtGs(snap.total)} (${snap.items.length} ítems).` };
  }
  async function actShowCart() {
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };
    const lines = snap.items.slice(0,8).map(it => `• ${it.cantidad} × ${it.titulo}`);
    const extra = snap.items.length > 8 ? `\n…y ${snap.items.length - 8} más.` : "";
    return { text: `En tu carrito:\n${lines.join("\n")}${extra}\nTotal: ${fmtGs(snap.total)}.` };
  }
  async function actEmpty() {
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito ya está vacío." };
    if (snap.mode === "remote") return { text: "Para vaciar el carrito remoto, usá el botón “Vaciar carrito”. 😉" };
    for (const it of (snap.items || [])) await window.CartAPI.remove({ id: it.id });
    return { text: "Listo, vacié tu carrito." };
  }

  function actHelp() {
    return { text:
`Puedo ayudarte con el carrito:
• “agregá 2 empanadas de carne y 1 de jamón”
• “quitá 1 alfajor”
• “poné 5 empanadas”
• “ver carrito”, “total”, “vaciar carrito”

También respondo:
• “qué sabores de empanadas/postres tienen”
• “qué hay en bocaditos / panificados / rotisería”` };
  }

  // ================ Helpers UI ================
  const fmtGs = n => new Intl.NumberFormat("es-PY").format(Math.max(0, Number(n)||0)) + " Gs";
  const pluralize = (s, n=2) => {
    const base = String(s||"");
    if (n === 1) return base;
    if (base.endsWith("a")) return base + "s";      // empanada → empanadas
    if (base.endsWith("or")) return base + "es";    // alfajor → alfajores
    return base + "s";
  };
  const list = (arr=[]) => arr.length<=1 ? (arr[0]||"") :
    arr.slice(0,-1).join(", ") + " y " + arr.slice(-1);

  // ================ API pública ================
  window.ChatBrain = {
    async handleMessage(userText) {
      try {
        const parsed = parseMessage(userText || "");
        switch (parsed.intent) {
          case "add":           return await actAdd(parsed.items);
          case "remove":        return await actRemove(parsed.items);
          case "set_qty":       return await actSetQty(parsed);
          case "show_total":    return await actShowTotal();
          case "show_cart":     return await actShowCart();
          case "empty_cart":    return await actEmpty();
          case "help":          return actHelp();
          case "category_info": return await actCategoryInfo(parsed);
          default:              return null; // que siga el backend (reservas)
        }
      } catch (e) {
        console.error("[ChatBrain] handleMessage error:", e);
        return { text: "Algo salió mal al interpretar tu pedido. Probá de nuevo 😅" };
      }
    }
  };
})();
