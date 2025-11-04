// ==================== SUPABASE CONFIG ====================
// Configuración centralizada de Supabase para todo el dashboard

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Credenciales
const SUPABASE_URL = 'https://jyygevitfnbwrvxrjexp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjUzNjM4OTksImV4cCI6MjA0MDkzOTg5OX0.4y9aWfHMLHUGZ_2y9Yy5Lmc0sqVMIHaHRc5eGMwYCg8';

// Crear cliente de Supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== HELPERS ====================

/**
 * Construir URL completa de imagen desde Storage
 * @param {string} imagenNombre - Nombre del archivo en storage o URL completa
 * @returns {string} URL completa de la imagen
 */
export function getImageUrl(imagenNombre) {
  if (!imagenNombre) {
    return 'https://via.placeholder.com/300x300?text=Sin+Imagen';
  }
  
  // Si ya es una URL completa, retornarla
  if (imagenNombre.startsWith('http')) {
    return imagenNombre;
  }
  
  // Construir URL del storage
  return `${SUPABASE_URL}/storage/v1/object/public/productos/${imagenNombre}`;
}

/**
 * Formatear precio en guaraníes
 * @param {number|string} precio - Precio a formatear
 * @returns {string} Precio formateado
 */
export function formatPrice(precio) {
  const precioNumerico = parseFloat(precio);
  
  if (isNaN(precioNumerico)) return '0';
  
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(precioNumerico);
}

/**
 * Formatear fecha/hora
 * @param {string} fecha - Fecha en formato ISO
 * @returns {string} Fecha formateada
 */
export function formatDate(fecha) {
  if (!fecha) return '-';
  
  return new Date(fecha).toLocaleDateString('es-PY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Mostrar notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo: 'success', 'error', 'info', 'warning'
 */
export function showToast(message, type = 'info') {
  // Crear elemento toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideIn 0.3s ease-out;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 400px;
  `;
  
  const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
  toast.innerHTML = `<span style="font-size: 1.25rem;">${icon}</span> ${message}`;
  
  document.body.appendChild(toast);
  
  // Agregar animación
  const style = document.createElement('style');
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
  `;
  document.head.appendChild(style);
  
  // Remover después de 3 segundos
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Manejar errores de forma consistente
 * @param {Error} error - Error capturado
 * @param {string} contexto - Contexto donde ocurrió el error
 */
export function handleError(error, contexto = 'Operación') {
  console.error(`❌ Error en ${contexto}:`, error);
  
  let mensaje = error.message || 'Error desconocido';
  
  // Mensajes específicos para errores comunes
  if (error.code === 'PGRST301') {
    mensaje = 'No tienes permisos para realizar esta acción';
  } else if (error.message?.includes('JWT')) {
    mensaje = 'Error de autenticación. Por favor, recarga la página';
  } else if (error.message?.includes('policies')) {
    mensaje = 'Error de permisos. Verifica las políticas RLS en Supabase';
  }
  
  showToast(`${contexto}: ${mensaje}`, 'error');
}

/**
 * Validar archivo de imagen
 * @param {File} file - Archivo a validar
 * @returns {Object} { valid: boolean, error: string }
 */
export function validateImageFile(file) {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo' };
  }
  
  if (file.size > maxSize) {
    return { valid: false, error: 'La imagen es muy grande. Máximo 5MB' };
  }
  
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Formato no permitido. Usa JPG, PNG o WEBP' };
  }
  
  return { valid: true };
}

/**
 * Subir imagen a Supabase Storage
 * @param {File} file - Archivo a subir
 * @param {string} bucket - Nombre del bucket (default: 'productos')
 * @returns {Promise<string>} Nombre del archivo subido
 */
export async function uploadImage(file, bucket = 'productos') {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) throw error;
  
  return fileName;
}

/**
 * Eliminar imagen de Supabase Storage
 * @param {string} fileName - Nombre del archivo a eliminar
 * @param {string} bucket - Nombre del bucket (default: 'productos')
 */
export async function deleteImage(fileName, bucket = 'productos') {
  if (!fileName || fileName.startsWith('http')) return;
  
  const { error } = await supabase.storage
    .from(bucket)
    .remove([fileName]);
  
  if (error) {
    console.warn('⚠️ No se pudo eliminar la imagen:', error);
  }
}

console.log('✅ Supabase config cargado');