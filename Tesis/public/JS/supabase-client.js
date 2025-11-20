// ==================== CLIENTE SUPABASE CENTRALIZADO ====================
// Este archivo crea una única instancia del cliente de Supabase
// que será reutilizada en toda la aplicación

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Configuración de Supabase
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

// Crear una única instancia del cliente
let supabaseInstance = null;

export function getSupabaseClient() {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log(' Cliente Supabase inicializado (instancia única)');
  }
  return supabaseInstance;
}

// Exportar el cliente directamente para compatibilidad
export const supa = getSupabaseClient();

// También exportar la configuración para casos especiales
export const SUPABASE_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY
};