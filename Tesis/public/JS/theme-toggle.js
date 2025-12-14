// ==================== THEME TOGGLE - MODO OSCURO/CLARO ====================
// Este script SOLO maneja el cambio de tema, sin tocar funcionalidad existente

(function() {
  'use strict';
  
  // Crear botón de toggle si no existe
  function createThemeToggle() {
    // Verificar si ya existe
    if (document.getElementById('themeToggle')) return;
    
    // Crear botón
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'themeToggle';
    toggleBtn.className = 'theme-toggle icon-btn';
    toggleBtn.setAttribute('aria-label', 'Cambiar tema');
    toggleBtn.innerHTML = '<i class="bi bi-moon-stars"></i>';
    
    // Insertar en topbar-right
    const topbarRight = document.querySelector('.topbar-right');
    if (topbarRight) {
      topbarRight.insertBefore(toggleBtn, topbarRight.firstChild);
    }
    
    return toggleBtn;
  }
  
  // Obtener tema actual
  function getCurrentTheme() {
    return localStorage.getItem('theme') || 'light';
  }
  
  // Aplicar tema
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    // Actualizar icono del botón
    const toggleBtn = document.getElementById('themeToggle');
    if (toggleBtn) {
      const icon = theme === 'dark' 
        ? '<i class="bi bi-sun"></i>' 
        : '<i class="bi bi-moon-stars"></i>';
      toggleBtn.innerHTML = icon;
    }
  }
  
  // Toggle entre temas
  function toggleTheme() {
    const currentTheme = getCurrentTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  }
  
  // Inicializar
  function init() {
    // Aplicar tema guardado
    applyTheme(getCurrentTheme());
    
    // Crear botón de toggle
    const toggleBtn = createThemeToggle();
    
    // Event listener
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleTheme);
    }
  }
  
  // Ejecutar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();