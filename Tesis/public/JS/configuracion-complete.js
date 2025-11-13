// ==================== MÓDULO DE CONFIGURACIÓN (TEMPORAL) ====================
// Versión básica para evitar errores de importación

export const configuracionView = `
  <div style="margin-bottom: 2rem;">
    <h2 style="font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem;">Configuración</h2>
    <p style="color: var(--text-secondary);">Panel de configuración del sistema</p>
  </div>
  
  <div class="card" style="padding: 3rem; text-align: center;">
    <i class="bi bi-gear" style="font-size: 4rem; color: var(--text-muted); opacity: 0.3; display: block; margin-bottom: 1rem;"></i>
    <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">Panel de Configuración</p>
    <p style="color: var(--text-secondary);">Esta sección está en desarrollo</p>
  </div>
`;

export function initConfiguracion() {
  console.log('📋 Módulo de configuración cargado (versión temporal)');
}