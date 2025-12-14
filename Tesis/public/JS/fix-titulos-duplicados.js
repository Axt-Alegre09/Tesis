// ==================== FIX TÍTULOS DUPLICADOS - DINÁMICO ====================
// Agregar este código AL FINAL de admin-dashboard.js o crear archivo separado

/**
 * Elimina títulos duplicados que aparecen fuera de los iframes
 * Se ejecuta cada vez que se carga una nueva vista
 */
function eliminarTitulosDuplicados() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  // Esperar un momento para que el contenido se cargue
  setTimeout(() => {
    // Buscar todos los h1 y h2 que están directamente en contentArea
    const titulosDuplicados = contentArea.querySelectorAll(':scope > h1, :scope > h2, :scope > div > h1:first-child, :scope > div > h2:first-child');
    
    titulosDuplicados.forEach(titulo => {
      // Verificar que NO sea un título dentro de una card o modal
      const dentroDeCard = titulo.closest('.card, .modal-content, .chart-container, .welcome-section');
      
      if (!dentroDeCard) {
        // Ocultar el título duplicado
        titulo.style.display = 'none';
        console.log('Título duplicado ocultado:', titulo.textContent);
      }
    });
  }, 100);
}

// Ejecutar cuando cambia la vista
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      eliminarTitulosDuplicados();
    }
  });
});

// Observar cambios en el content-area
const contentArea = document.getElementById('contentArea');
if (contentArea) {
  observer.observe(contentArea, {
    childList: true,
    subtree: false
  });
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  eliminarTitulosDuplicados();
});

// También ejecutar cuando se cambia de vista (click en nav-link)
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    setTimeout(eliminarTitulosDuplicados, 150);
  });
});

// Exportar la función por si se necesita llamar manualmente
if (typeof window !== 'undefined') {
  window.eliminarTitulosDuplicados = eliminarTitulosDuplicados;
}// ==================== FIX TÍTULOS DUPLICADOS - DINÁMICO ====================
// Agregar este código AL FINAL de admin-dashboard.js o crear archivo separado

/**
 * Elimina títulos duplicados que aparecen fuera de los iframes
 * Se ejecuta cada vez que se carga una nueva vista
 */
function eliminarTitulosDuplicados() {
  const contentArea = document.getElementById('contentArea');
  if (!contentArea) return;

  // Esperar un momento para que el contenido se cargue
  setTimeout(() => {
    // Buscar todos los h1 y h2 que están directamente en contentArea
    const titulosDuplicados = contentArea.querySelectorAll(':scope > h1, :scope > h2, :scope > div > h1:first-child, :scope > div > h2:first-child');
    
    titulosDuplicados.forEach(titulo => {
      // Verificar que NO sea un título dentro de una card o modal
      const dentroDeCard = titulo.closest('.card, .modal-content, .chart-container, .welcome-section');
      
      if (!dentroDeCard) {
        // Ocultar el título duplicado
        titulo.style.display = 'none';
        console.log('Título duplicado ocultado:', titulo.textContent);
      }
    });
  }, 100);
}

// Ejecutar cuando cambia la vista
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      eliminarTitulosDuplicados();
    }
  });
});

// Observar cambios en el content-area
const contentArea = document.getElementById('contentArea');
if (contentArea) {
  observer.observe(contentArea, {
    childList: true,
    subtree: false
  });
}

// Ejecutar al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  eliminarTitulosDuplicados();
});

// También ejecutar cuando se cambia de vista (click en nav-link)
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    setTimeout(eliminarTitulosDuplicados, 150);
  });
});

// Exportar la función por si se necesita llamar manualmente
if (typeof window !== 'undefined') {
  window.eliminarTitulosDuplicados = eliminarTitulosDuplicados;
}