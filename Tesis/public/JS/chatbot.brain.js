// /public/JS/chatbot.brain.js

// === CHATBRAIN LOCAL ===
// Este módulo maneja respuestas básicas sin depender de OpenAI.
// Sirve como primer filtro antes de enviar al backend /api/ask.

window.ChatBrain = {
  async handleMessage(text) {
    if (!text) return null;
    const msg = text.toLowerCase().trim();

    // =======================
    // 1️⃣ SALUDOS
    // =======================
    if (["hola", "buenas", "hey", "qué tal", "como estas"].some(w => msg.includes(w))) {
      return {
        text: "¡Hola! 😊 Soy *Paniquiños Bot*. ¿Querés saber sobre algún producto o precio?",
      };
    }

    // =======================
    // 2️⃣ AGRADECIMIENTOS
    // =======================
    if (msg.includes("gracias") || msg.includes("graci")) {
      return {
        text: "¡De nada! 🧁 Siempre es un placer ayudarte 💛",
      };
    }

    // =======================
    // 3️⃣ HORARIOS Y UBICACIÓN
    // =======================
    if (
      msg.includes("abierto") ||
      msg.includes("hora") ||
      msg.includes("cierran") ||
      msg.includes("abren") ||
      msg.includes("abierto hoy")
    ) {
      return {
        text: "Estamos abiertos 🕓 *de lunes a sábado de 08:00 a 19:00 hs* en *Villa Elisa, Paraguay*. ¡Te esperamos con algo rico! 🍪",
      };
    }

    if (msg.includes("donde") && msg.includes("ubic")) {
      return {
        text: "📍 Estamos en *Villa Elisa, Paraguay*. Podés visitarnos en nuestro local o hacer tu pedido online. 💛",
      };
    }

    // =======================
    // 4️⃣ PRODUCTOS COMUNES
    // =======================
    const productos = [
      { nombre: "torta", precio: 45000, tipo: "dulce" },
      { nombre: "alfajor", precio: 25000, tipo: "dulce" },
      { nombre: "empanada de carne", precio: 19000, tipo: "salado" },
      { nombre: "empanada de huevo", precio: 17000, tipo: "salado" },
      { nombre: "empanada jamón y queso", precio: 17000, tipo: "salado" },
      { nombre: "combo empanada + coca", precio: 24000, tipo: "salado" },
      { nombre: "sandwich de milanesa", precio: 25000, tipo: "salado" },
      { nombre: "bocadito", precio: 10000, tipo: "dulce" },
      { nombre: "pan casero", precio: 12000, tipo: "salado" },
    ];

    const encontrado = productos.find((p) => msg.includes(p.nombre));
    if (encontrado) {
      return {
        text: `Sí 😊 tenemos *${encontrado.nombre}* por *${encontrado.precio.toLocaleString()} Gs*. ¿Querés que te recomiende algo parecido o agregarlo al carrito? 🍰`,
      };
    }

    // =======================
    // 5️⃣ INTENCIONES
    // =======================
    if (msg.includes("salado") || msg.includes("empanada")) {
      return {
        text: `Para algo salado, te recomiendo:
- 🥟 *Empanada de Carne* — 19.000 Gs
- 🧀 *Empanada Jamón y Queso* — 17.000 Gs
- 🥪 *Sandwich de Milanesa* — 25.000 Gs
- 🥤 *Combo Empanada + Coca* — 24.000 Gs

¡Cualquiera es deliciosa! 😋`,
      };
    }

    if (msg.includes("dulce") || msg.includes("postre") || msg.includes("pastel")) {
      return {
        text: `Si querés algo dulce 🍰 te recomiendo:
- 🎂 *Torta* — 45.000 Gs
- 🍪 *Alfajores* — 25.000 Gs
- 🧁 *Bocaditos surtidos* — 10.000 Gs

¡Son perfectos para compartir! 💕`,
      };
    }

    if (msg.includes("especial") || msg.includes("recomendas") || msg.includes("popular")) {
      return {
        text: "Nuestra especialidad 🍽️ es el *Combo Empanada + Coca*, ¡ideal para algo salado rápido! También la *Torta de la Casa* es un clásico dulce. 😋",
      };
    }

    // =======================
    // 6️⃣ CARRITO (simulación)
    // =======================
    if (msg.includes("carrito") || msg.includes("comprar") || msg.includes("agreg")) {
      return {
        text: "Puedo ayudarte a elegir productos 🧺, pero la compra se realiza desde el carrito principal del sitio web. ¡Te guío si querés! 😉",
      };
    }

    // =======================
    // 7️⃣ RESPUESTA POR DEFECTO
    // =======================
    return null; // Deja que /api/ask maneje el resto
  },
};
