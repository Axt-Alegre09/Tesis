// JS/ScriptLogin.js - CON SOPORTE DE MODO INVITADO
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Config ========= */
export const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

/* ========= Utilidades ========= */
const LOGIN_URL = "login.html";
const HOME_CLIENTE = "index.html";
const HOME_ADMIN = "admin-dashboard.html";

let isRedirecting = false;

function go(path) {
  if (isRedirecting) return;
  isRedirecting = true;
  window.location.replace(new URL(path, window.location.href).href);
}

function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
}

/* ========= Modo Invitado ========= */
export function isGuestMode() {
  return localStorage.getItem('is-guest-mode') === 'true';
}

export function enableGuestMode() {
  localStorage.setItem('is-guest-mode', 'true');
  console.log('👤 Modo invitado habilitado');
}

export function disableGuestMode() {
  localStorage.removeItem('is-guest-mode');
  console.log('🔐 Modo invitado deshabilitado');
}

/* ========= Sesión ========= */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/* ========= Perfiles ========= */
export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from("profiles")  
    .select("id, email, nombre, role")  
    .eq("id", user.id)  
    .maybeSingle();
    
  if (error) { 
    console.error("[profiles]", error); 
    return null; 
  }
  return data;
}

export async function getClientePerfil() {
  const user = await getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from("clientes_perfil")
    .select("user_id, razon, ruc, tel, mail")
    .eq("user_id", user.id)
    .maybeSingle();
    
  if (error) { 
    console.error("[clientes_perfil]", error); 
    return null; 
  }
  return data;
}

/* ========= Nombre visible en el chip ========= */
async function getDisplayName() {
  const user = await getUser();
  if (!user) {
    // Si está en modo invitado, mostrar "Invitado"
    if (isGuestMode()) {
      return "Invitado";
    }
    return "";
  }

  const cp = await getClientePerfil();
  const razon = cp?.razon?.trim();
  if (razon) return razon;

  const p = await getProfile();
  const nomPerfil = p?.nombre?.trim();
  if (nomPerfil) return nomPerfil;

  const nomMeta = user.user_metadata?.nombre?.trim();
  if (nomMeta) return nomMeta;

  return "";
}

/* ========= Navegación por rol ========= */
export async function goByRole() {
  if (isRedirecting) return;
  
  const p = await getProfile();
  if (!p) {
    console.log('⚠️ No se encontró perfil de usuario');
    return;
  }
  
  console.log('🔄 Redirigiendo según rol:', p.role);
  
  if (p.role === "admin") {
    go(HOME_ADMIN);
  } else {
    go(HOME_CLIENTE);
  }
}

export async function requireRole(roleNeeded = "cliente") {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) { 
    go(LOGIN_URL); 
    return; 
  }
  
  const p = await getProfile();
  if (!p || p.role !== roleNeeded) {
    if (roleNeeded === "admin") {
      go("loginAdmin.html");
    } else {
      go(LOGIN_URL);
    }
  }
}

/* ========= Menú de cuenta / Chip ========= */
export function setUserNameUI(nombre) {
  const el = document.querySelector(".user-name");
  if (el) el.textContent = nombre || "Cuenta";
}

export async function paintUserChip() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    // Verificar si está en modo invitado
    if (isGuestMode()) {
      setUserNameUI("Invitado");
      return;
    }
    setUserNameUI("Cuenta");
    return;
  }
  
  const display = await getDisplayName();
  setUserNameUI(display || "Cuenta");
}

export async function logout(ev) {
  ev?.preventDefault?.();
  
  try { 
    await supabase.auth.signOut(); 
  } catch (e) {
    console.error('Error al cerrar sesión:', e);
  }
  
  // Limpiar TODO incluyendo modo invitado
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  
  window.location.replace(LOGIN_URL);
}

export async function autoWireAuthMenu() {
  const authBtn = document.getElementById("logoutBtn");
  const upd = document.getElementById("updateProfileBtn");
  const metodosBtn = document.getElementById("metodosBtn");
  const historialBtn = document.getElementById("historialBtn");

  if (upd) {
    upd.addEventListener("click", (ev) => {
      ev?.preventDefault?.();
      
      // Si es invitado, pedir login
      if (isGuestMode()) {
        alert('Necesitas iniciar sesión para acceder a esta función');
        window.location.href = LOGIN_URL;
        return;
      }
      
      window.location.href = "misdatos.html";
    });
  }

  // Deshabilitar funciones que requieren auth para invitados
  if (isGuestMode()) {
    if (metodosBtn) {
      metodosBtn.addEventListener("click", (ev) => {
        ev?.preventDefault?.();
        alert('Necesitas iniciar sesión para acceder a esta función');
        window.location.href = LOGIN_URL;
      });
    }

    if (historialBtn) {
      historialBtn.addEventListener("click", (ev) => {
        ev?.preventDefault?.();
        alert('Necesitas iniciar sesión para acceder a esta función');
        window.location.href = LOGIN_URL;
      });
    }
  }

  if (authBtn) {
    const { data } = await supabase.auth.getSession();
    const hasSession = !!data?.session;

    if (hasSession) {
      authBtn.innerHTML = `<i class="bi bi-box-arrow-right"></i> Cerrar sesión`;
      authBtn.onclick = (e) => logout(e);
    } else if (isGuestMode()) {
      authBtn.innerHTML = `<i class="bi bi-box-arrow-in-right"></i> Iniciar sesión`;
      authBtn.onclick = () => {
        // Limpiar modo invitado al ir a login
        disableGuestMode();
        go(LOGIN_URL);
      };
    } else {
      authBtn.innerHTML = `<i class="bi bi-box-arrow-in-right"></i> Iniciar sesión`;
      authBtn.onclick = () => go(LOGIN_URL);
    }
  }

  await paintUserChip();
}

/* ========= Lógica específica de login.html ========= */
async function wireLoginPage() {
  const wrapper = document.getElementById("authWrapper");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.querySelector(".login-btn");
  const registerBtn = document.querySelector(".register-btn");
  const forgot = document.getElementById("forgotLink");

  registerBtn?.addEventListener("click", () => wrapper?.classList.add("active"));
  loginBtn?.addEventListener("click", () => wrapper?.classList.remove("active"));

  // Verificar sesión con timeout
  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );
    
    const sessionPromise = supabase.auth.getSession();
    
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (data?.session) {
      console.log('✅ Sesión existente detectada, redirigiendo...');
      await goByRole();
      return;
    }
  } catch (error) {
    console.log('⚠️ Error verificando sesión:', error.message);
  }

  // Login
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando...", "secondary");

    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const password = (document.getElementById("loginPassword")?.value || "").trim();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error(error);
      showMsg("❌ Credenciales incorrectas.", "danger");
      return;
    }
    
    // Limpiar modo invitado al hacer login exitoso
    disableGuestMode();
    
    showMsg("✅ Bienvenido. Verificando rol…", "success");
    await new Promise(resolve => setTimeout(resolve, 500));
    await goByRole();
  });

  // Registro
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando registro...", "secondary");

    const email = (document.getElementById("registerEmail")?.value || "").trim();
    const password = (document.getElementById("registerPassword")?.value || "").trim();

    const { error } = await supabase.auth.signUp({
      email, 
      password,
      options: { data: { nombre: email.split("@")[0] } },
    });

    if (error) {
      console.error(error);
      showMsg("❌ No se pudo registrar. Revisa el correo o la contraseña.", "danger");
      return;
    }
    
    showMsg("✅ Cuenta creada. Revisa tu correo si se requiere verificación.", "success");
    wrapper?.classList.remove("active");
  });

  // Recuperación
  forgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Ingresa tu correo para recuperar la contraseña:");
    if (!email) return;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/" + LOGIN_URL,
    });
    
    if (error) {
      console.error(error);
      showMsg("❌ No se pudo enviar el correo de recuperación.", "danger");
      return;
    }
    
    showMsg("📧 Te enviamos un correo con las instrucciones.", "info");
  });

  // ========= BOTÓN INVITADO =========
  const guestBtn = document.getElementById("guestBtn");
  const guestBtnRegister = document.getElementById("guestBtnRegister");

  function continueAsGuest() {
    console.log('👤 Continuando como invitado...');
    
    // Habilitar modo invitado
    enableGuestMode();
    
    // Redirigir a index
    window.location.href = HOME_CLIENTE;
  }

  guestBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    continueAsGuest();
  });

  guestBtnRegister?.addEventListener("click", (e) => {
    e.preventDefault();
    continueAsGuest();
  });
}

/* ========= Auto-init ========= */
(async function init() {
  try {
    const isLoginPage = document.getElementById("loginForm") || document.getElementById("registerForm");
    
    if (!isLoginPage) {
      await autoWireAuthMenu();
    }

    if (isLoginPage) {
      console.log('🔑 Inicializando página de login...');
      await wireLoginPage();
    }
  } catch (e) {
    console.warn("Error en init:", e);
  }
})();

export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.replace("login.html");
    throw new Error("Auth requerida");
  }
  return data.session.user;
}

window.supabase = supabase;

console.log('✅ ScriptLogin.js cargado con soporte de modo invitado');