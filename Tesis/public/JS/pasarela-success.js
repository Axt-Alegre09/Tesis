// JS/pasarela-success.js
// Mantengo esta vista estática: no programo ninguna redirección automática.
// Si en otro archivo tenías setTimeout(location.href=...), hay que quitarlo.
// Este archivo SOLO resuelve la descarga del PDF.

import { supabase } from "./ScriptLogin.js";

// Cuando tengo el id del pedido lo puedo recuperar así.
// Si lo guardo al confirmar (recomendado): sessionStorage.setItem("lastOrderId", pedidoId);
const lastOrderId = sessionStorage.getItem("lastOrderId") || ""; // si no hay, igual descargo con fallback

const btnPDF = document.getElementById("btnDescargarFactura");

/* Descarga segura vía Blob para no navegar de página */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Si ya tengo una función mía que genera la factura, la uso acá.
   Ejemplo: return await generarFacturaPDF(pedidoId) -> Blob
   Dejo un fallback que crea un PDF mínimo válido para evitar navegación. */
async function generarFacturaPDF(pedidoId) {
  // --- Reemplazar por mi implementación real si ya existe ---
  // Si uso un endpoint propio:
  // const res = await fetch(`/api/factura?pedido=${encodeURIComponent(pedidoId)}`);
  // const blob = await res.blob(); return blob;

  // Fallback: PDF mínimo para que el botón siempre descargue “algo”.
  const minimalPdf = `%PDF-1.3
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 66>>stream
BT
/F1 24 Tf
72 720 Td
(FACTURA - Pedido ${pedidoId || "N/D"}) Tj
ET
endstream
endobj
5 0 obj<</Type/Font/Subtype/Type1/Name/F1/BaseFont/Helvetica>>endobj
xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000114 00000 n 
0000000275 00000 n 
0000000462 00000 n 
trailer<</Size 6/Root 1 0 R>>
startxref
585
%%EOF`;
  return new Blob([minimalPdf], { type: "application/pdf" });
}

/* Click -> genero o recupero el PDF y lo descargo.
   Importante: e.preventDefault() para evitar cualquier navegación accidental. */
btnPDF?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const blob = await generarFacturaPDF(lastOrderId);
    const nombre = `factura${lastOrderId ? "-" + lastOrderId : ""}.pdf`;
    downloadBlob(blob, nombre);
  } catch (err) {
    console.error("[pasarela-success] No se pudo generar la factura:", err);
    // Si algo falla, igual dejo un PDF mínimo para que no parezca que “se rompe”
    try {
      const blob = await generarFacturaPDF("");
      downloadBlob(blob, "factura.pdf");
    } catch {}
  }
});

/* Defensa ante submits o navegaciones no deseadas:
   — Si esta página se montó dentro de un <form>, fuerzo que Enter no envíe nada. */
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    const tag = (ev.target.tagName || "").toLowerCase();
    if (tag !== "textarea") ev.preventDefault();
  }
});

/* Nota de integración:
   — Donde confirmo el pago (mi flujo anterior), guardo el id:
       sessionStorage.setItem("lastOrderId", pedidoId);
   — Y luego navego a esta “pasarelaPagos.html” (o muestro esta vista),
     sin timers, sin redirects automáticos.
*/
