// JS/reset-password.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ==========================================
   CONFIGURACIÓN
   ========================================== */
const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

const CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  LOGIN_URL: "login.html",
};

/* ==========================================
   UTILIDADES
   ========================================== */

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

  if (type !== "danger" && type !== "warning") {
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
  showFieldError("newPasswordError", "");
  showFieldError("confirmPasswordError", "");
}

function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Actualizando...`;
    button.dataset.originalText = originalText;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

function navigate(path) {
  window.location.href = new URL(path, window.location.href).href;
}

function showLoading(show = true) {
  const loading = document.getElementById("loadingState");
  const form = document.getElementById("resetPasswordForm");
  
  if (show) {
    loading?.classList.remove("hidden");
    form?.classList.add("hidden");
  } else {
    loading?.classList.add("hidden");
    form?.classList.remove("hidden");
  }
}

/* ==========================================
   VALIDACIONES
   ========================================== */

function validatePassword(password) {
  return password.length >= CONFIG.PASSWORD_MIN_LENGTH;
}

function validatePasswordMatch(password, confirmPassword) {
  return password === confirmPassword;
}

function validateForm() {
  clearErrors();
  let isValid = true;

  const password = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!password) {
    showFieldError("newPasswordError", "La contraseña es requerida");
    isValid = false;
  } else if (!validatePassword(password)) {
    showFieldError("newPasswordError", `Mínimo ${CONFIG.PASSWORD_MIN_LENGTH} caracteres`);
    isValid = false;
  }

  if (!confirmPassword) {
    showFieldError("confirmPasswordError", "Confirma tu contraseña");
    isValid = false;
  } else if (!validatePasswordMatch(password, confirmPassword)) {
    showFieldError("confirmPasswordError", "Las contraseñas no coinciden");
    isValid = false;
  }

  return isValid;
}

/* ==========================================
   AUTENTICACIÓN
   ========================================== */

/**
 * Obtener token de reset desde URL
 */
function getResetToken() {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get("access_token");
}

/**
 * Verificar si la sesión es de reset
 */
async function verifyResetSession() {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error || !data?.session) {
      throw new Error("Sesión inválida o expirada");
    }

    return true;
  } catch (error) {
    console.error("[verifyResetSession]", error);
    return false;
  }
}

/**
 * Actualizar contraseña
 */
async function updatePassword(newPassword) {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("[updatePassword]", error);
    throw error;
  }
}

/**
 * Manejar submit del formulario
 */
async function handleResetPassword(e) {
  e.preventDefault();

  if (!validateForm()) return;

  const resetButton = document.getElementById("resetSubmit");
  setButtonLoading(resetButton, true);
  clearAlert();

  try {
    const newPassword = document.getElementById("newPassword").value;

    const success = await updatePassword(newPassword);

    if (!success) {
      showAlert(
        "❌ No se pudo actualizar la contraseña",
        "danger"
      );
      setButtonLoading(resetButton, false);
      return;
    }

    showAlert(
      "✅ ¡Contraseña actualizada! Redirigiendo al login...",
      "success"
    );

    // Cerrar sesión y redirigir
    setTimeout(() => {
      supabase.auth.signOut().then(() => {
        navigate(CONFIG.LOGIN_URL);
      });
    }, 2000);
  } catch (error) {
    console.error("[handleResetPassword]", error);
    
    if (error.message.includes("token")) {
      showAlert(
        "⚠️ El enlace de recuperación ha expirado. Solicita uno nuevo.",
        "danger"
      );
    } else {
      showAlert(
        `❌ ${error.message || "Error al actualizar la contraseña"}`,
        "danger"
      );
    }

    setButtonLoading(resetButton, false);
  }
}

/* ==========================================
   UI INTERACTIONS
   ========================================== */

/**
 * Toggle password visibility
 */
function setupPasswordToggles() {
  const toggles = [
    {
      buttonId: "toggleNewPassword",
      inputId: "newPassword",
    },
    {
      buttonId: "toggleConfirmPassword",
      inputId: "confirmPassword",
    },
  ];

  toggles.forEach(({ buttonId, inputId }) => {
    const button = document.getElementById(buttonId);
    const input = document.getElementById(inputId);

    if (!button || !input) return;

    button.addEventListener("click", (e) => {
      e.preventDefault();
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";
      button.innerHTML = `<i class="bi bi-${isPassword ? "eye-slash" : "eye"}"></i>`;
    });
  });
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

/**
 * Auto-init
 */
(async function init() {
  try {
    // Verificar sesión de reset
    const isValid = await verifyResetSession();

    if (!isValid) {
      showLoading(false);
      showAlert(
        "⚠️ El enlace de recuperación no es válido o ha expirado. Por favor, solicita uno nuevo.",
        "warning"
      );

      // Mostrar botón para volver
      const form = document.getElementById("resetPasswordForm");
      if (form) {
        form.innerHTML = `
          <a href="${CONFIG.LOGIN_URL}" class="btn btn-primary" style="text-decoration: none; display: flex; justify-content: center;">
            <i class="bi bi-arrow-left"></i> Volver al Login
          </a>
        `;
      }
      return;
    }

    // Mostrar formulario
    showLoading(false);

    // Setup
    setupPasswordToggles();

    const form = document.getElementById("resetPasswordForm");
    if (form) {
      form.addEventListener("submit", handleResetPassword);
    }
  } catch (error) {
    console.error("[init]", error);
    showLoading(false);
    showAlert("❌ Error al cargar la página", "danger");
  }
})();

export { supabase };