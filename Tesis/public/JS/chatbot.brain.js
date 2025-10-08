/* JS/chatbot.brain.js
   “Cerebro” del Paniquiños Bot para entender acciones del catálogo y carrito.
   No llama a OpenAI: es NLU liviano en el frontend.
*/
(() => {
  // ---------- Utiles de lenguaje ----------
  const NUM_PAL = {
    uno:1, una:1, un:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7,
    ocho:8, nueve:9, diez:10, once:11, doce:12
  };
  const normalize = (s="") =>
    s.toLowerCase()
     .normalize("NFD").replace(/\p{Diacritic}/gu, "")
     .replace(/[.,;:!¡¿?()"]/g, " ")
     .replace(/\s+/g, " ")
     .trim();

  const toNumber = (w) => {
    if (!w) return NaN;
    if (/^\d+$/.test(w)) return parseInt(w,10);
    return NUM_PAL[w] ?? NaN;
  };

  // ---------- Conocimiento de dominio ----------
  // Sinónimos de categorías / productos
  const SYN = {
    empanada: ["empanada","empanadas","empi","empas"],
    alfajor:  ["alfajor","alfajores"],
    bocadito: ["bocadito","bocaditos"],
    pan:      ["pan","panificados"],
  };
  // Sabores/variantes comunes (se usan como “tags” para match)
  const FLAVORS = ["carne","pollo","jamon","jamón","queso","dulce","chocolate","personal","pareja","combo"];

  // Arma/obtiene índice de productos
  function getProductIndex() {
    // Preferí el índice creado por tu catálogo si existe
    if (window.__PRODUCT_INDEX__?.byToken) return window.__PRODUCT_INDEX__;

    const productos = window.__PRODUCTS__ || [];
    const byToken = new Map();
    const all = productos.map(p => ({
      id: String(p.id ?? p.productoId ?? p.uuid ?? p.ID ?? p.Id ?? p.slug ?? p.nombre),
      nombre: String(p.nombre ?? p.titulo ?? p.title ?? "").trim(),
      precio: Number(p.precio || 0),
      imagen: p.imagen || p.image || null,
    }));

    for (const p of all) {
      const base = normalize(p.nombre);
      const tokens = new Set(base.split(" ").filter(Boolean));
      // agrega sinónimos básicos por tipo
      for (const [canon, arr] of Object.entries(SYN)) {
        if (base.includes(canon) || arr.some(a => base.includes(a))) {
          arr.forEach(a => tokens.add(a));
          tokens.add(canon);
        }
      }
      // agrega sabores que aparezcan en el nombre
      FLAVORS.forEach(f => { if (base.includes(f)) tokens.add(f); });

      for (const t of tokens) {
        if (!byToken.has(t)) byToken.set(t, []);
        byToken.get(t).push(p);
      }
    }
    return (window.__PRODUCT_INDEX__ = { all, byToken });
  }

  function candidatesFor(token) {
    const idx = getProductIndex();
    return idx.byToken.get(token) || [];
  }

  // Match por texto + sabor (si hay)
  function findProduct(text, flavor) {
    const t = normalize(text);
    const fav = flavor ? normalize(flavor) : null;

    // 1) Si el texto es muy claro, trae por token directo
    let cands = candidatesFor(t);
    // 2) Si no, probar por sinónimos
    if (!cands.length) {
      for (const [canon, arr] of Object.entries(SYN)) {
        if (arr.includes(t) || t.includes(canon)) { cands = candidatesFor(canon); break; }
      }
    }
    // 3) Si aún nada, búsqueda floja en nombres
    if (!cands.length) {
      const all = getProductIndex().all;
      cands = all.filter(p => normalize(p.nombre).includes(t));
    }

    if (!cands.length) return null;
    if (!fav) return cands[0];

    // Si hay sabor, prioriza coincidencias que contengan el sabor
    const favMatch = cands.find(p => normalize(p.nombre).includes(fav));
    return favMatch || cands[0];
  }

  // ---------- Parser de intención ----------
  // Devuelve: { intent, items:[{cantidad,prodTxt,flavor,product}], qty, ... }
  function parseMessage(msgRaw="") {
    const msg = normalize(msgRaw);

    // Intenciones rápidas
    if (/vaciar (el )?carrito|limpiar carrito|vaciar todo/.test(msg)) {
      return { intent: "empty_cart" };
    }
    if (/ver (mi )?carrito|mostrar carrito|que (hay|tengo) en el carrito/.test(msg)) {
      return { intent: "show_cart" };
    }
    if (/total|cuanto (es|sale|debo)/.test(msg)) {
      return { intent: "show_total" };
    }
    if (/ayuda|que puedes hacer|como funciona/.test(msg)) {
      return { intent: "help" };
    }

    // ¿Setear cantidad de algo existente? “poné 5 empanadas”
    if (/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+/.test(msg)) {
      const m = msg.match(/(pone|pon|coloca|ajusta|setea|deja)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(.*)/);
      if (m) {
        const qty = toNumber(m[2]);
        const rest = (m[3]||"").trim();
        const flavor = FLAVORS.find(f => rest.includes(f)) || null;
        return { intent:"set_qty", qty, prodTxt: rest, flavor };
      }
    }

    // Quitar…
    if (/quita|saca|elimina|borra/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent: "remove", items };
      // Si no hay cantidades, al menos identificar el producto
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent: "remove", items: [{ cantidad:1, prodTxt }] };
    }

    // Agregar…
    if (/agrega|agrega?me|sum(a|ar)|pone|pon|quiero|dame|agregame|añade|anadi/.test(msg)) {
      const items = extractItems(msg);
      if (items.length) return { intent: "add", items };
      const prodTxt = guessProductText(msg);
      if (prodTxt) return { intent: "add", items: [{ cantidad:1, prodTxt }] };
    }

    // Si nada calzó, no hay intención
    return { intent: "none" };
  }

  // Extrae pares cantidad + producto [+ sabor] del texto
  function extractItems(msg) {
    const items = [];
    // Patrones tipo: "2 empanadas de carne", "1 alfajor", "... y 3 de jamon"
    // 1) bloques con cantidad y sustantivo
    const r1 = /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([a-záéíóúñ]+[a-záéíóúñ]*)?(?:\s+de\s+([a-záéíóúñ]+))?/g;
    let m;
    while ((m = r1.exec(msg)) !== null) {
      const qty = toNumber(m[1]);
      // si no hay sustantivo, mirar antes/después el token producto más cercano
      let prodTxt = m[2] || guessProductText(msg);
      if (!prodTxt) continue;
      const flavor = m[3] || FLAVORS.find(f => msg.includes(f)) || null;
      items.push({ cantidad: qty || 1, prodTxt, flavor });
    }

    // 2) fragmento “… y 1 de jamon” (sin sustantivo explícito)
    if (!items.length) {
      const r2 = /(?:y|mas)\s+(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+de\s+([a-záéíóúñ]+)/g;
      while ((m = r2.exec(msg)) !== null) {
        const qty = toNumber(m[1]);
        const flavor = m[2];
        const prodTxt = guessProductText(msg) || "empanadas";
        items.push({ cantidad: qty || 1, prodTxt, flavor });
      }
    }

    return items;
  }

  // Intenta deducir el sustantivo “producto” dominante del mensaje
  function guessProductText(msg) {
    const tokens = msg.split(" ");
    // Busca en orden por sinónimos/categorías
    for (const [canon, arr] of Object.entries(SYN)) {
      if (arr.some(a => tokens.includes(a))) return canon;
    }
    // Si no, alguna palabra que exista como token de producto
    const idx = getProductIndex();
    for (const t of tokens) {
      if (idx.byToken?.has(t)) return t;
    }
    return null;
  }

  // ---------- Ejecutores de intent ----------
  async function actAdd(items) {
    const done = [];
    const missing = [];

    for (const it of items) {
      const prod = findProduct(it.prodTxt, it.flavor);
      if (!prod) { missing.push(it); continue; }

      try {
        // Si el ID parece UUID, usamos addById (remoto si hay sesión)
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(prod.id)) {
          await window.CartAPI.addById(prod.id, it.cantidad);
        } else {
          await window.CartAPI.addProduct({
            id: prod.id, titulo: prod.nombre, precio: prod.precio, imagen: prod.imagen
          }, it.cantidad);
        }
        done.push({ ...it, producto: prod.nombre });
      } catch (e) {
        console.warn("[ChatBrain] add error:", e);
        missing.push(it);
      }
    }

    // Respuesta
    const parts = done.map(d =>
      `${d.cantidad} ${pluralize(d.producto || d.prodTxt)}${d.flavor ? " de " + d.flavor : ""}`
    );
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
    // Si dieron producto, intentamos disminuir 1 (o la cantidad indicada) en local;
    // en remoto requeriríamos el itemId de carrito_items, así que damos soporte básico:
    // estrategia: si es local → bajar; si es remoto → avisar que por nombre no puedo borrar exacto.
    const snap = window.CartAPI.getSnapshot?.();
    const isRemote = snap?.mode === "remote";
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };

    let removed = [];
    for (const it of (items?.length ? items : [{ cantidad:1, prodTxt: guessProductText("") }])) {
      const prod = findProduct(it.prodTxt, it.flavor);
      if (!prod) continue;

      // Busca una fila equivalente
      const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre)));
      if (!row) continue;

      if (isRemote) {
        // En remoto necesitas itemId; informamos cómo proceder
        return { text: "En este momento puedo quitar por item en el carrito (remoto). Abrí el carrito y tocá el icono de papelera del producto a eliminar. 😉" };
      } else {
        const newQty = Math.max(0, Number(row.cantidad || 1) - (it.cantidad || 1));
        if (newQty === 0) {
          await window.CartAPI.remove({ id: row.id });
        } else {
          await window.CartAPI.setQty({ id: row.id }, newQty);
        }
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

    // Busca fila equivalente
    const row = snap.items.find(r => normalize(r.titulo).includes(normalize(prod.nombre)));
    if (!row) return { text: "Ese producto no está en tu carrito." };

    if (snap.mode === "remote") {
      // Necesita itemId (remoto). Si tu render guardó _itemId en snapshot, úsalo aquí.
      // En nuestra snapshot remota no guardamos _itemId, así que damos feedback amigable:
      return { text: "Por ahora solo puedo cambiar cantidades desde la vista del carrito (remoto). Abrí el carrito y usá los botones +/− del producto 😊" };
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
    // Mejor pedir confirmación textual, pero lo dejamos directo por simplicidad:
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito ya está vacío." };
    if (snap.mode === "remote") {
      // Necesitamos la acción remota -> botón "Vaciar" ya la hace; aquí orientamos.
      return { text: "Para vaciar el carrito remoto, usá el botón “Vaciar carrito” en la página del carrito. 😉" };
    } else {
      for (const it of (snap.items || [])) await window.CartAPI.remove({ id: it.id });
      return { text: "Listo, vacié tu carrito." };
    }
  }

  function actHelp() {
    return {
      text:
`Puedo ayudarte con el carrito:
• “agregá 2 empanadas de carne y 1 de jamón”
• “quitá 1 alfajor”
• “poné 5 empanadas”
• “ver carrito”, “total”, “vaciar carrito”

También respondo dudas simples de los productos.`
    };
  }

  // ---------- Helpers UI ----------
  const fmtGs = n => new Intl.NumberFormat("es-PY").format(Math.max(0, Number(n)||0)) + " Gs";
  const pluralize = (s, n=2) => {
    const base = String(s || "");
    if (n === 1) return base;
    if (base.endsWith("a")) return base + "s";         // empanada → empanadas
    if (base.endsWith("or")) return base + "es";       // alfajor → alfajores
    return base + "s";
  };
  const list = (arr=[]) => arr.length<=1 ? (arr[0]||"") :
    arr.slice(0,-1).join(", ") + " y " + arr.slice(-1);

  // ---------- API pública para script-chatbot.js ----------
  window.ChatBrain = {
    /**
     * Maneja un mensaje y devuelve { text } si resuelve localmente.
     * Si no reconoce intención, retorna null para que el frontend
     * envíe el mensaje al backend (reservas).
     */
    async handleMessage(userText) {
      try {
        const parsed = parseMessage(userText || "");
        switch (parsed.intent) {
          case "add":        return await actAdd(parsed.items);
          case "remove":     return await actRemove(parsed.items);
          case "set_qty":    return await actSetQty(parsed);
          case "show_total": return await actShowTotal();
          case "show_cart":  return await actShowCart();
          case "empty_cart": return await actEmpty();
          case "help":       return actHelp();
          default:           return null; // que siga el backend (reservas)
        }
      } catch (e) {
        console.error("[ChatBrain] handleMessage error:", e);
        return { text: "Algo salió mal al interpretar tu pedido. Probá de nuevo 😅" };
      }
    }
  };
})();

