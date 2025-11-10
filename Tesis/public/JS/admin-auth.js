// JS/admin-auth.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ==========================================
   CONFIGURACIÓN
   ========================================== */
const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

const CONFIG = {
  LOGIN_URL: "login.html",
  ADMIN_DASHBOARD: "admin-dashboard.html",
  SESSION_STORAGE_KEY: "pq_admin_email",
};

/* ==========================================
   UTILIDADES
   ========================================== */

function navigate(path) {
  window.location.href = new URL(path, window.location.href).href;
}

function showAlert(message, type = "info") {
  const container = document.getElementById("alertContainer");
  if (!container) return;

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert alert-${type}`;
  alertDiv.innerHTML = `
    <i class="bi bi-${type === "success" ? "check-circle" : type === "danger" ? "exclamation-circle" : "info-circle"}"></i>
    <span>${message}</span>
  `;

  container.innerHTML = "";
  container.appendChild(alertDiv);

  if (type !== "danger") {
    setTimeout(() => {
      alertDiv.style.animation = "slideIn 0.3s ease reverse";
      setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
  }
}

function clearAlert() {
  const container = document.getElementById("alertContainer");
  if (container) container.innerHTML = "";
}

function showFieldError(fieldId, message) {
  const errorEl = document.getElementById(fieldId);
  if (errorEl) {
    errorEl.innerHTML = message ? `<i class="bi bi-exclamation-circle"></i> ${message}` : "";
  }
}

function clearErrors() {
  showFieldError("adminEmailError", "");
  showFieldError("adminPasswordError", "");
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Verificando...`;
    button.dataset.originalText = originalText;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

/* ==========================================
   VALIDACIONES
   ========================================== */

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validateForm() {
  clearErrors();
  let isValid = true;

  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value;

  if (!email) {
    showFieldError("adminEmailError", "El correo es requerido");
    isValid = false;
  } else if (!validateEmail(email)) {
    showFieldError("adminEmailError", "Correo inválido");
    isValid = false;
  }

  if (!password) {
    showFieldError("adminPasswordError", "La contraseña es requerida");
    isValid = false;
  }

  return isValid;
}

/* ==========================================
   AUTENTICACIÓN
   ========================================== */

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
 * Verificar si el usuario es admin
 */
async function isUserAdmin() {
  const profile = await getAdminProfile();
  return profile?.role === "admin";
}

/**
 * Manejar login de admin
 */
async function handleAdminLogin(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const adminButton = document.getElementById("adminSubmit");
  setButtonLoading(adminButton, true);
  clearAlert();

  try {
    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;
    const rememberMe = document.getElementById("adminRememberMe").checked;

    // Intentar login
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        showAlert("❌ Correo o contraseña incorrectos", "danger");
      } else if (error.message.includes("Email not confirmed")) {
        showAlert("⚠️ Por favor confirma tu correo", "warning");
      } else {
        showAlert(`❌ ${error.message}`, "danger");
      }
      setButtonLoading(adminButton, false);
      return;
    }

    // Verificar rol
    const isAdmin = await isUserAdmin();

    if (!isAdmin) {
      // No es admin, cerrar sesión inmediatamente
      try {
        await supabase.auth.signOut();
      } catch {}

      showAlert(
        "⛔ Tu cuenta no tiene permisos de administrador. Si crees que esto es un error, contacta al soporte.",
        "danger"
      );
      setButtonLoading(adminButton, false);
      return;
    }

    // Es admin, guardar preferencia
    if (rememberMe) {
      try {
        localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, email);
      } catch {}
    }

    showAlert("✅ Acceso concedido. Cargando panel...", "success");
    setTimeout(() => {
      navigate(CONFIG.ADMIN_DASHBOARD);
    }, 1000);
  } catch (error) {
    console.error("[handleAdminLogin]", error);
    showAlert("❌ Error al procesar el login", "danger");
    setButtonLoading(adminButton, false);
  }
}

/* ==========================================
   UI INTERACTIONS
   ========================================== */

/**
 * Toggle password visibility
 */
function setupPasswordToggle() {
  const button = document.getElementById("adminTogglePassword");
  const input = document.getElementById("adminPassword");

  if (!button || !input) return;

  button.addEventListener("click", (e) => {
    e.preventDefault();
    const isPassword = input.type === "password";
    input.type = isPassword ? "text" : "password";
    button.innerHTML = `<i class="bi bi-${isPassword ? "eye-slash" : "eye"}"></i>`;
  });
}

/**
 * Pre-llenar "recuérdame"
 */
function setupRememberMe() {
  try {
    const savedEmail = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (savedEmail) {
      const emailInput = document.getElementById("adminEmail");
      const rememberCheckbox = document.getElementById("adminRememberMe");
      if (emailInput) emailInput.value = savedEmail;
      if (rememberCheckbox) rememberCheckbox.checked = true;
    }
  } catch {}
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

/**
 * Auto-init al cargar
 */
(async function init() {
  try {
    // Si ya hay sesión
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      // Verificar si es admin
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

    // Setup del formulario
    setupPasswordToggle();
    setupRememberMe();

    const form = document.getElementById("adminLoginForm");
    if (form) {
      form.addEventListener("submit", handleAdminLogin);
    }
  } catch (error) {
    console.error("[init]", error);
  }
})();

export { supabase, isUserAdmin, getAdminProfile };