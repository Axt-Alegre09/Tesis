// ==================== SUPABASE CONFIG Y UTILIDADES ====================
// Este archivo contiene la configuración y funciones auxiliares para Supabase

import { supa } from './supabase-client.js';

// Re-exportar supabase para compatibilidad
export const supabase = supa;

// ==================== FUNCIONES DE IMÁGENES ====================

/**
 * Obtener URL completa de imagen
 * @param {string} imagePath - Ruta de la imagen
 * @returns {string} URL completa de la imagen
 */
export function getImageUrl(imagePath) {
  if (!imagePath) {
    return 'https://via.placeholder.com/300x200?text=Sin+Imagen';
  }
  
  // Si ya es una URL completa, devolverla tal cual
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  
  // Construir URL del storage de Supabase
  return `https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/${imagePath}`;
}

/**
 * Subir imagen al storage
 * @param {File} file - Archivo a subir
 * @returns {Promise<string>} Nombre del archivo subido
 */
export async function uploadImage(file) {
  try {
    // Generar nombre único
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    // Subir al bucket 'productos'
    const { data, error } = await supa.storage
      .from('productos')
      .upload(fileName, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });
    
    if (error) throw error;
    
    console.log('✅ Imagen subida:', fileName);
    return fileName;
    
  } catch (error) {
    console.error('Error subiendo imagen:', error);
    throw error;
  }
}

/**
 * Eliminar imagen del storage
 * @param {string} fileName - Nombre del archivo a eliminar
 */
export async function deleteImage(fileName) {
  if (!fileName) return;
  
  try {
    // No eliminar si es URL externa
    if (fileName.startsWith('http://') || fileName.startsWith('https://')) {
      return;
    }
    
    const { error } = await supa.storage
      .from('productos')
      .remove([fileName]);
    
    if (error) throw error;
    console.log('✅ Imagen eliminada:', fileName);
    
  } catch (error) {
    console.error('Error eliminando imagen:', error);
  }
}

// ==================== FUNCIONES DE FORMATO ====================

/**
 * Formatear precio en Guaraníes
 * @param {number} precio - Precio a formatear
 * @returns {string} Precio formateado
 */
export function formatPrice(precio) {
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(precio);
}

// ==================== FUNCIONES DE UI ====================

/**
 * Mostrar notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: success, error, warning, info
 */
export function showToast(message, type = 'info') {
  // Crear toast si no existe
  let toastContainer = document.getElementById('toastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;
    document.body.appendChild(toastContainer);
  }
  
  // Crear toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };
  
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  toast.style.cssText = `
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 300px;
    max-width: 500px;
    animation: slideIn 0.3s ease;
    border-left: 4px solid ${colors[type]};
  `;
  
  toast.innerHTML = `
    <span style="
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: ${colors[type]}15;
      color: ${colors[type]};
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      flex-shrink: 0;
    ">${icons[type]}</span>
    <span style="flex: 1; color: #1f2937;">${message}</span>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto eliminar después de 5 segundos
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 5000);
}

/**
 * Manejar errores de forma consistente
 * @param {Error} error - Error a manejar
 * @param {string} context - Contexto del error
 */
export function handleError(error, context = 'Error') {
  console.error(`${context}:`, error);
  showToast(`${context}: ${error.message || 'Error desconocido'}`, 'error');
}

// ==================== ESTILOS GLOBALES ====================

// Agregar estilos para animaciones si no existen
if (!document.getElementById('toastStyles')) {
  const style = document.createElement('style');
  style.id = 'toastStyles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
    
    .spinner {
      width: 3rem;
      height: 3rem;
      border: 4px solid var(--border);
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);
}