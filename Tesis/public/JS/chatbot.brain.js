// JS/chatbot.brain.js
(function(){
  const words = {
    add: /(agreg(a|ame|á)|sum(a|á|ame)|pon(e|é)|añad(e|í)|carg(a|á))/i,
    rm:  /(sac(a|á|ame)|quit(a|á|ame)|remov(e|é))/i,
    qty: /(\d+)\s*(u|unidades|uni|x)?/i,
  };
  const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu,"").trim();
  const qtyFrom = t => { const m=t.match(words.qty); return m? Math.max(1,parseInt(m[1],10)) : 1; };

  // índice del catálogo — lo completa main.js:
  window.ProductIndex ||= {};
  window.buildProductIndex ||= (productos=[])=>{
    const idx = {};
    for (const p of productos) {
      const names = new Set([p.titulo, ...(p.sinonimos||[])]
        .filter(Boolean).map(x=>norm(x)));
      names.forEach(k => idx[k]=p);
    }
    window.ProductIndex = idx;
  };

  const guess = text=>{
    const t = norm(text);
    for (const k of Object.keys(window.ProductIndex)) if (t.includes(k)) return window.ProductIndex[k];
    return null;
  };

  async function handleMessage(text){
    // agregar
    if (words.add.test(text)) {
      const p = guess(text);
      if (!p) return {text:'¿Qué producto querés? Ej: "agregame 3 empanadas".'};
      const q = qtyFrom(text);
      window.CartAPI?.add(p,q);
      return {text:`Listo. Agregué ${q} × ${p.titulo} al carrito 🧺`};
    }
    // quitar
    if (words.rm.test(text)) {
      const p = guess(text);
      if (!p) return {text:'¿Qué producto querés quitar?'};
      const q = qtyFrom(text);
      window.CartAPI?.removeById(p.id,q);
      return {text:`Hecho. Quité ${q} × ${p.titulo}.`};
    }
    // precio / disponibilidad básica
    if (/precio|cu(a|á)nto|hay|dispon/i.test(text)) {
      const p = guess(text);
      if (p) return {text:`${p.titulo} cuesta ${new Intl.NumberFormat('es-PY').format(p.precio)} Gs. ¿Te agrego alguno?`};
    }
    // FAQs mínimas
    if (/horario|abren|cierran/i.test(text)) return {text:'Lun–Sáb 8:00–20:00. Dom 9:00–13:00.'};
    if (/direcci(o|ó)n|donde/i.test(text))   return {text:'Av. Sabor 123, Asunción. Hacemos envíos.'};
    if (/envio|delivery/i.test(text))        return {text:'En Asunción y Gran Asunción, costo según zona.'};

    return null; // dejar que responda el backend de reservas
  }

  window.ChatBrain = { handleMessage };
})();
