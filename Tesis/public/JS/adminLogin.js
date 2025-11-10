// JS/adminLogin.js - VERSIÓN MEJORADA

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

const CONFIG = {
  LOGIN_URL: "login.html",
  ADMIN_DASHBOARD: "admin-dashboard.html",
};

/* ========= UTILIDADES ========= */

function navigate(path) {
  window.location.href = new URL(path, window.location.href).href;
}

function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  
  const icons = {
    info: "info-circle",
    success: "check-circle",
    danger: "exclamation-circle",
    warning: "exclamation-triangle"
  };
  
  box.innerHTML = `
    <div class="alert alert-${type}" role="alert">
      <i class="bi bi-${icons[type] || icons.info}"></i>
      <span>${text}</span>
    </div>
  `;
}

function clearMsg() {
  const box = document.getElementById("msg");
  if (box) box.innerHTML = "";
}

function setButtonLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Verificando...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

/* ========= AUTENTICACIÓN ========= */

/**
 * Obtener perfil del usuario autenticado
 */
async function getAdminProfile() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, nombre, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[getAdminProfile]", error);
    return null;
  }
}

/**
 * Verificar si es admin
 */
async function isUserAdmin() {
  const profile = await getAdminProfile();
  return profile?.role === "admin";
}

/**
 * Validar email
 */
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Manejar login de admin
 */
async function handleAdminLogin(e) {
  e.preventDefault();
  clearMsg();

  const email = (document.getElementById("adminEmail")?.value || "").trim();
  const password = document.getElementById("adminPassword")?.value || "";

  // Validar campos
  if (!email) {
    showMsg("❌ Por favor ingresa tu correo", "danger");
    return;
  }

  if (!validateEmail(email)) {
    showMsg("❌ Correo inválido", "danger");
    return;
  }

  if (!password) {
    showMsg("❌ Por favor ingresa tu contraseña", "danger");
    return;
  }

  setButtonLoading("adminSubmit", true);

  try {
    // Intentar login
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[admin login error]", error);
      
      if (error.message.includes("Invalid login credentials")) {
        showMsg("❌ Correo o contraseña incorrectos", "danger");
      } else if (error.message.includes("Email not confirmed")) {
        showMsg("⚠️ Por favor confirma tu correo", "warning");
      } else {
        showMsg(`❌ ${error.message}`, "danger");
      }
      setButtonLoading("adminSubmit", false);
      return;
    }

    // Verificar rol
    const isAdmin = await isUserAdmin();

    if (!isAdmin) {
      // No es admin, cerrar sesión
      try {
        await supabase.auth.signOut();
      } catch {}

      showMsg("⛔ Tu cuenta no tiene permisos de administrador", "danger");
      setButtonLoading("adminSubmit", false);
      return;
    }

    showMsg("✅ Acceso concedido. Cargando panel...", "success");
    setTimeout(() => {
      navigate(CONFIG.ADMIN_DASHBOARD);
    }, 1500);
  } catch (error) {
    console.error("[handleAdminLogin]", error);
    showMsg("❌ Error al procesar el login", "danger");
    setButtonLoading("adminSubmit", false);
  }
}

/**
 * Setup de toggle para mostrar/ocultar contraseña
 */
function setupPasswordToggle() {
  const input = document.getElementById("adminPassword");
  if (!input) return;

  const container = input.parentElement;
  if (!container.querySelector(".password-toggle")) {
    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "password-toggle";
    toggleBtn.innerHTML = '<i class="bi bi-eye"></i>';
    
    container.style.position = "relative";
    container.appendChild(toggleBtn);
    
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      toggleBtn.innerHTML = `<i class="bi bi-${isPassword ? "eye-slash" : "eye"}"></i>`;
    });
  }
}

/* ========= INICIALIZACIÓN ========= */

(async function init() {
  try {
    // Si ya hay sesión
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      const isAdmin = await isUserAdmin();
      
      if (isAdmin) {
        // Es admin, ir al dashboard
        return navigate(CONFIG.ADMIN_DASHBOARD);
      } else {
        // No es admin, cerrar sesión
        try {
          await supabase.auth.signOut();
        } catch {}
      }
    }

    // Setup
    setupPasswordToggle();

    // Listener del formulario
    const form = document.getElementById("adminLoginForm");
    if (form) {
      form.addEventListener("submit", handleAdminLogin);
    }
  } catch (error) {
    console.error("[init]", error);
  }
})();

export { supabase, isUserAdmin, getAdminProfile };