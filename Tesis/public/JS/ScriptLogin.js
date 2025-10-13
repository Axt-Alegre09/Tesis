// JS/ScriptLogin.js
// ÚNICO lugar donde se crea el cliente de Supabase.
// ❗️No importes este archivo dentro de sí mismo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Pone tus credenciales aquí (o léelas de window.__ENV si ya las guardaste allí)
const SUPABASE_URL  = window.__ENV?.SUPABASE_URL  ?? "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON = window.__ENV?.SUPABASE_ANON ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

/* ========= Helpers básicos de sesión ========= */

export async function requireAuth() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) window.location.assign("login.html");
}

export async function logout() {
  try {
    await supabase.auth.signOut();
  } finally {
    window.location.reload();
  }
}

/* ========= Menú de usuario en topbar ========= */

export async function autoWireAuthMenu() {
  const btn = document.getElementById("userMenuBtn");
  if (!btn) return;

  const nameEl = btn.querySelector(".user-name");
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    nameEl.textContent = user.email || "Mi cuenta";
    document.getElementById("logoutBtn")?.classList.remove("disabled");
    document.getElementById("updateProfileLink")?.classList.remove("disabled");
  } else {
    nameEl.textContent = "Cuenta";
    document.getElementById("logoutBtn")?.classList.add("disabled");
    document.getElementById("updateProfileLink")?.classList.add("disabled");
  }
}
