/* public/JS/chatbot.brain.js
   Módulo de entendimiento local para el chatbot Paniquiños */
(() => {
  const normalize = (s = "") =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, "")
      .trim();

  const NUM_PAL = {
    uno: 1,
    una: 1,
    un: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
  };

  const toNumber = (w) => (/^\d+$/.test(w) ? parseInt(w) : NUM_PAL[w] || 1);
  const fmtGs = (n) =>
    new Intl.NumberFormat("es-PY").format(Number(n) || 0) + " Gs";
  const list = (arr = []) =>
    arr.length <= 1
      ? arr[0] || ""
      : arr.slice(0, -1).join(", ") + " y " + arr[arr.length - 1];

  const pluralize = (s, n = 2) =>
    n === 1 ? s : s.endsWith("a") ? s + "s" : s + "es";

  /* ===== Índice de productos ===== */
  function getProductIndex() {
    const productos = window.__PRODUCTS__ || [];
    const byToken = new Map();
    for (const p of productos) {
      const base = normalize(p.nombre);
      const tokens = base.split(" ").filter(Boolean);
      for (const t of tokens) {
        if (!byToken.has(t)) byToken.set(t, []);
        byToken.get(t).push(p);
      }
    }
    return { all: productos, byToken };
  }

  const findProduct = (text) => {
    const t = normalize(text);
    const { byToken, all } = getProductIndex();
    if (byToken.has(t)) return byToken.get(t)[0];
    return all.find((p) => normalize(p.nombre).includes(t));
  };

  const extractItems = (msg) => {
    const parts = msg.match(
      /(\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+([a-záéíóúñ\s]+)/gi
    );
    if (!parts) return [];
    return parts.map((p) => {
      const [_, num, prod] = p.split(/\s+(.+)/);
      return { cantidad: toNumber(num), prodTxt: prod };
    });
  };

  /* ===== Acciones del carrito ===== */
  async function actAdd(items) {
    const done = [];
    for (const it of items) {
      const prod = findProduct(it.prodTxt);
      if (!prod) continue;
      await window.CartAPI.addProduct(
        {
          id: prod.id,
          titulo: prod.nombre,
          precio: prod.precio,
          imagen: prod.imagen,
        },
        it.cantidad
      );
      done.push(`${it.cantidad} ${pluralize(prod.nombre, it.cantidad)}`);
    }
    return {
      text:
        done.length > 0
          ? `¡Listo! Agregué ${list(done)} al carrito 🛒`
          : "No encontré esos productos. Probá con el nombre exacto del catálogo.",
    };
  }

  async function actRemove(items) {
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito está vacío." };
    const removed = [];
    for (const it of items) {
      const prod = findProduct(it.prodTxt);
      const row = snap.items.find((r) =>
        normalize(r.titulo).includes(normalize(prod?.nombre))
      );
      if (row) {
        await window.CartAPI.remove({ id: row.id });
        removed.push(prod.nombre);
      }
    }
    return {
      text:
        removed.length > 0
          ? `Eliminé ${list(removed)} del carrito.`
          : "No encontré ese producto en tu carrito.",
    };
  }

  async function actShowCart() {
    const snap = window.CartAPI.getSnapshot?.();
    if (!snap?.items?.length) return { text: "Tu carrito está vacío 😅" };
    const lines = snap.items.map(
      (it) => `• ${it.cantidad} × ${it.titulo} — ${fmtGs(it.precio)}`
    );
    return {
      text: `Tenés en tu carrito:\n${lines.join(
        "\n"
      )}\nTotal: ${fmtGs(snap.total)}.`,
    };
  }

  /* ===== Dispatcher ===== */
  window.ChatBrain = {
    async handleMessage(msg) {
      const m = normalize(msg);
      if (/vaciar|limpiar carrito/.test(m))
        return await actRemove(window.CartAPI.getSnapshot()?.items || []);
      if (/mostrar|ver carrito/.test(m)) return await actShowCart();
      if (/agrega|agregame|pone|pon|sum(a|ar)|quiero/.test(m))
        return await actAdd(extractItems(m));
      if (/quita|saca|elimina|borra/.test(m))
        return await actRemove(extractItems(m));
      return null; // que lo maneje el backend
    },
  };
})();
