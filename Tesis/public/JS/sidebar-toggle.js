// ==================== SIDEBAR TOGGLE - FUNCIONALIDAD CORRECTA ====================
// Agregar AL FINAL del admin-dashboard.js o crear archivo separado

(function() {
  'use strict';
  
  // Elementos
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const body = document.body;
  
  // Detectar si es móvil o desktop
  function isMobile() {
    return window.innerWidth <= 768;
  }
  
  // Toggle en DESKTOP (colapsar/expandir)
  function toggleDesktop() {
    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      
      // Guardar estado en localStorage
      const isCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebarCollapsed', isCollapsed);
    }
  }
  
  // Toggle en MÓVIL (abrir/cerrar)
  function toggleMobile() {
    if (sidebar) {
      sidebar.classList.toggle('mobile-open');
      body.classList.toggle('sidebar-open');
    }
  }
  
  // Cerrar sidebar en móvil al hacer click fuera
  function closeMobileSidebar(event) {
    if (!isMobile()) return;
    
    const isClickOutside = !sidebar.contains(event.target) && 
                          event.target !== mobileMenuBtn &&
                          !mobileMenuBtn.contains(event.target);
    
    if (isClickOutside && sidebar.classList.contains('mobile-open')) {
      sidebar.classList.remove('mobile-open');
      body.classList.remove('sidebar-open');
    }
  }
  
  // Event listeners
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      if (isMobile()) {
        toggleMobile();
      } else {
        toggleDesktop();
      }
    });
  }
  
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobile);
  }
  
  // Click fuera del sidebar en móvil
  document.addEventListener('click', closeMobileSidebar);
  
  // Cerrar sidebar al hacer click en un nav-link (solo móvil)
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (isMobile() && sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
        body.classList.remove('sidebar-open');
      }
    });
  });
  
  // Restaurar estado del sidebar en desktop
  function restoreSidebarState() {
    if (!isMobile()) {
      const wasCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      if (wasCollapsed && sidebar) {
        sidebar.classList.add('collapsed');
      }
    }
  }
  
  // Manejar resize de ventana
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Si cambiamos a desktop, cerrar mobile-open y restaurar estado
      if (!isMobile()) {
        if (sidebar) {
          sidebar.classList.remove('mobile-open');
          body.classList.remove('sidebar-open');
        }
        restoreSidebarState();
      } else {
        // Si cambiamos a móvil, remover collapsed
        if (sidebar) {
          sidebar.classList.remove('collapsed');
        }
      }
    }, 250);
  });
  
  // Inicializar
  function init() {
    restoreSidebarState();
    
    // Si es móvil, asegurar que no esté collapsed
    if (isMobile() && sidebar) {
      sidebar.classList.remove('collapsed');
    }
  }
  
  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();