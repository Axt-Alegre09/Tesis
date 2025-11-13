// ==================== MÓDULO CONFIGURACIÓN TEMPORAL ====================
// Versión temporal mientras se implementa la configuración completa

import { supa } from '../supabase-client.js';

// Vista temporal de configuración
export const configuracionView = `
  <div class="card" style="padding: 3rem; text-align: center;">
    <i class="bi bi-tools" style="font-size: 4rem; color: var(--warning); opacity: 0.5;"></i>
    <h2 style="margin-top: 1.5rem; font-size: 1.5rem; font-weight: 700;">Sección en Mantenimiento</h2>
    <p style="color: var(--text-secondary); margin-top: 1rem;">La página de configuración está siendo actualizada. Volverá pronto.</p>
    <p style="color: var(--text-muted); margin-top: 2rem; font-size: 0.9rem;">
      Mientras tanto, puedes gestionar las configuraciones básicas desde la base de datos directamente.
    </p>
  </div>
`;

// Función de inicialización temporal
export function initConfiguracion() {
  console.log('🔧 Módulo de configuración en desarrollo...');
  console.log('📝 Esta sección estará disponible pronto con:');
  console.log('  - Configuración general del sistema');
  console.log('  - Gestión de usuarios y permisos');
  console.log('  - Configuración de pagos y envíos');
  console.log('  - Personalización de la tienda');
  console.log('  - Respaldos y seguridad');
}

console.log('📦 Módulo de Configuración Temporal cargado');