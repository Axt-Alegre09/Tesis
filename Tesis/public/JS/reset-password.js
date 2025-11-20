// JS/resetPassword.js - VERSIÓN MEJORADA

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

const CONFIG = {
  PASSWORD_MIN_LENGTH: 8,
  LOGIN_URL: "login.html",
};

/* ========= UTILIDADES ========= */

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

function setButtonLoading(isLoading) {
  const btn = document.getElementById("submitBtn");
  if (!btn) return;
  
  if (isLoading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Actualizando...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

function showLoading(show = true) {
  const loading = document.getElementById("loadingState");
  const form = document.getElementById("resetForm");
  
  if (show) {
    loading?.classList.remove("hidden");
    form?.classList.add("hidden");
  } else {
    loading?.classList.add("hidden");
    form?.classList.remove("hidden");
  }
}

function navigate(path) {
  window.location.href = new URL(path, window.location.href).href;
}

/* ========= VALIDACIONES ========= */

function validatePassword(password) {
  return password.length >= CONFIG.PASSWORD_MIN_LENGTH;
}

function validatePasswordMatch(password, confirmPassword) {
  return password === confirmPassword;
}

function validateForm() {
  clearMsg();
  
  const newPassword = document.getElementById("newPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;
  
  // Validar primera contraseña
  if (!newPassword) {
    showMsg(" Por favor ingresa una contraseña", "danger");
    return false;
  }
  
  if (!validatePassword(newPassword)) {
    showMsg(` La contraseña debe tener mínimo ${CONFIG.PASSWORD_MIN_LENGTH} caracteres`, "danger");
    return false;
  }
  
  // Validar confirmación
  if (!confirmPassword) {
    showMsg(" Por favor confirma tu contraseña", "danger");
    return false;
  }
  
  if (!validatePasswordMatch(newPassword, confirmPassword)) {
    showMsg(" Las contraseñas no coinciden", "danger");
    return false;
  }
  
  return true;
}

/* ========= AUTENTICACIÓN ========= */

/**
 * Verificar sesión de reset
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
 * Manejar submit del reset
 */
async function handleResetSubmit(e) {
  e.preventDefault();
  
  if (!validateForm()) return;

  setButtonLoading(true);

  try {
    const newPassword = document.getElementById("newPassword").value;
    
    const success = await updatePassword(newPassword);

    if (!success) {
      showMsg("No se pudo actualizar la contraseña", "danger");
      setButtonLoading(false);
      return;
    }

    showMsg("¡Contraseña actualizada! Redirigiendo al login...", "success");

    // Cerrar sesión y redirigir
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate(CONFIG.LOGIN_URL);
    }, 2000);
  } catch (error) {
    console.error("[handleResetSubmit]", error);
    
    if (error.message.includes("token")) {
      showMsg("El enlace de recuperación ha expirado", "danger");
    } else {
      showMsg(`${error.message || "Error al actualizar la contraseña"}`, "danger");
    }

    setButtonLoading(false);
  }
}

/* ========= TOGGLE DE CONTRASEÑA ========= */

/**
 * Setup de toggles
 */
function setupPasswordToggles() {
  const inputs = document.querySelectorAll('input[type="password"]');
  
  inputs.forEach((input) => {
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
  });
}

/* ========= INICIALIZACIÓN ========= */

(async function init() {
  try {
    showLoading(true);

    // Verificar sesión de reset
    const isValid = await verifyResetSession();

    if (!isValid) {
      showLoading(false);
      showMsg("⚠️ El enlace de recuperación no es válido o ha expirado", "warning");

      // Mostrar botón para volver
      const form = document.getElementById("resetForm");
      if (form) {
        form.innerHTML = `
          <div>
            <h1>Enlace Expirado</h1>
            <p>Por favor, solicita un nuevo enlace de recuperación</p>
          </div>
          <a href="${CONFIG.LOGIN_URL}" style="
            padding: 12px 16px;
            background: linear-gradient(135deg, #3c2e1a 0%, #2a1f12 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 15px;
            font-weight: 600;
            text-decoration: none;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          ">
            <i class="bi bi-arrow-left"></i> Volver al Login
          </a>
        `;
        form.classList.remove("hidden");
      }
      return;
    }

    // Mostrar formulario
    showLoading(false);

    // Setup
    setupPasswordToggles();

    // Listener del formulario
    const form = document.getElementById("resetForm");
    if (form) {
      form.addEventListener("submit", handleResetSubmit);
    }
  } catch (error) {
    console.error("[init]", error);
    showLoading(false);
    showMsg("Error al cargar la página", "danger");
  }
})();

export { supabase };