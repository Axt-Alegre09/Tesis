// JS/ScriptLogin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

const DASHBOARD_URL = "/index.html";
const LOGIN_URL = "/login.html";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// … (tu código de login/registro/recovery puede quedarse igual) …

// Cerrar sesión robusto + limpiar storage + redirigir a login
export async function logout(ev) {
  ev?.preventDefault?.();
  try { await supabase.auth.signOut(); } catch {}
  try {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith("sb-") || /supabase/i.test(k)) localStorage.removeItem(k);
    });
  } catch {}
  ["authUser","user","usuario","token","accessToken","refreshToken","session"].forEach(k => {
    try { localStorage.removeItem(k); } catch {}
  });
  try { sessionStorage.clear(); } catch {}
  window.location.replace(LOGIN_URL);
}

// Auto-vincular el botón si existe
export function autoWireLogout() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
}
