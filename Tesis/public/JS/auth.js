// JS/auth.js
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
  HOME_CLIENTE: "index.html",
  HOME_ADMIN: "admin-dashboard.html",
  PASSWORD_MIN_LENGTH: 8,
  SESSION_STORAGE_KEY: "pq_session_user",
};

/* ==========================================
   UTILIDADES
   ========================================== */

/**
 * Navegar a una URL relativa
 */
function navigate(path) {
  window.location.href = new URL(path, window.location.href).href;
}

/**
 * Mostrar alerta
 */
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

  // Auto-remover después de 5 segundos
  if (type !== "danger") {
    setTimeout(() => {
      alertDiv.style.animation = "slideIn 0.3s ease reverse";
      setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
  }
}

/**
 * Limpiar alerta
 */
function clearAlert() {
  const container = document.getElementById("alertContainer");
  if (container) container.innerHTML = "";
}

/**
 * Mostrar error en campo
 */
function showFieldError(fieldId, message) {
  const errorEl = document.getElementById(`${fieldId}Error`);
  if (errorEl) {
    errorEl.innerHTML = message ? `<i class="bi bi-exclamation-circle"></i> ${message}` : "";
  }
}

/**
 * Limpiar errores de todos los campos
 */
function clearErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll(".text-error").forEach(el => el.innerHTML = "");
}

/**
 * Toggle botón loading
 */
function setButtonLoading(button, isLoading) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    const originalText = button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Procesando...`;
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

function validatePassword(password) {
  return password.length >= CONFIG.PASSWORD_MIN_LENGTH;
}

function validatePasswordMatch(password, confirmPassword) {
  return password === confirmPassword;
}

function validateLoginForm() {
  clearErrors("loginForm");
  let isValid = true;

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  if (!email) {
    showFieldError("loginEmail", "El correo es requerido");
    isValid = false;
  } else if (!validateEmail(email)) {
    showFieldError("loginEmail", "Correo inválido");
    isValid = false;
  }

  if (!password) {
    showFieldError("loginPassword", "La contraseña es requerida");
    isValid = false;
  }

  return isValid;
}

function validateRegisterForm() {
  clearErrors("registerForm");
  let isValid = true;

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("registerConfirmPassword").value;
  const acceptTerms = document.getElementById("acceptTerms").checked;

  if (!name) {
    showFieldError("registerName", "El nombre es requerido");
    isValid = false;
  } else if (name.length < 3) {
    showFieldError("registerName", "El nombre debe tener al menos 3 caracteres");
    isValid = false;
  }

  if (!email) {
    showFieldError("registerEmail", "El correo es requerido");
    isValid = false;
  } else if (!validateEmail(email)) {
    showFieldError("registerEmail", "Correo inválido");
    isValid = false;
  }

  if (!password) {
    showFieldError("registerPassword", "La contraseña es requerida");
    isValid = false;
  } else if (!validatePassword(password)) {
    showFieldError("registerPassword", `Mínimo ${CONFIG.PASSWORD_MIN_LENGTH} caracteres`);
    isValid = false;
  }

  if (!confirmPassword) {
    showFieldError("registerConfirmPassword", "Confirma tu contraseña");
    isValid = false;
  } else if (!validatePasswordMatch(password, confirmPassword)) {
    showFieldError("registerConfirmPassword", "Las contraseñas no coinciden");
    isValid = false;
  }

  if (!acceptTerms) {
    showAlert("Debes aceptar los términos y condiciones", "danger");
    isValid = false;
  }

  return isValid;
}

function validateResetForm() {
  clearErrors("resetPasswordForm");
  const email = document.getElementById("resetEmail").value.trim();

  if (!email) {
    showFieldError("resetEmail", "El correo es requerido");
    return false;
  }

  if (!validateEmail(email)) {
    showFieldError("resetEmail", "Correo inválido");
    return false;
  }

  return true;
}

/* ==========================================
   AUTENTICACIÓN
   ========================================== */

/**
 * Obtener usuario actual
 */
async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

/**
 * Obtener perfil del usuario
 */
async function getProfile() {
  const user = await getUser();
  if (!user) return null;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, nombre, role")
      .eq("id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("[getProfile]", error);
    return null;
  }
}

/**
 * Obtener nombre para mostrar
 */
async function getDisplayName() {
  const user = await getUser();
  if (!user) return "Cuenta";

  try {
    // Intenta obtener nombre de profiles
    const profile = await getProfile();
    if (profile?.nombre?.trim()) return profile.nombre.trim();

    // Si no, usa metadata
    const nombre = user.user_metadata?.nombre?.trim();
    if (nombre) return nombre;

    // Si nada, usa parte del email
    return user.email?.split("@")[0] || "Cuenta";
  } catch (error) {
    console.error("[getDisplayName]", error);
    return "Cuenta";
  }
}

/**
 * Navegar según rol
 */
async function navigateByRole() {
  const profile = await getProfile();
  if (!profile) return navigate(CONFIG.LOGIN_URL);

  if (profile.role === "admin") {
    navigate(CONFIG.HOME_ADMIN);
  } else {
    navigate(CONFIG.HOME_CLIENTE);
  }
}

/**
 * Requerir autenticación
 */
async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    navigate(CONFIG.LOGIN_URL);
    throw new Error("Auth requerida");
  }
  return data.session.user;
}

/**
 * Requerir rol específico
 */
async function requireRole(roleNeeded = "cliente") {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    navigate(CONFIG.LOGIN_URL);
    return false;
  }

  const profile = await getProfile();
  if (!profile || profile.role !== roleNeeded) {
    if (roleNeeded === "admin") {
      navigate("login.html");
    } else {
      navigate(CONFIG.LOGIN_URL);
    }
    return false;
  }

  return true;
}

/**
 * Cerrar sesión
 */
async function logout() {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[logout]", error);
  }

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}

  navigate(CONFIG.LOGIN_URL);
}

/* ==========================================
   HANDLERS DE FORMULARIOS
   ========================================== */

/**
 * Manejar login
 */
async function handleLogin(e) {
  e.preventDefault();

  if (!validateLoginForm()) return;

  const loginButton = document.getElementById("loginSubmit");
  setButtonLoading(loginButton, true);
  clearAlert();

  try {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const rememberMe = document.getElementById("rememberMe").checked;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        showAlert("❌ Correo o contraseña incorrectos", "danger");
      } else if (error.message.includes("Email not confirmed")) {
        showAlert("⚠️ Por favor confirma tu correo", "warning");
      } else {
        showAlert(`❌ ${error.message}`, "danger");
      }
      setButtonLoading(loginButton, false);
      return;
    }

    // Guardar preferencia "recuérdame"
    if (rememberMe) {
      try {
        localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, email);
      } catch {}
    }

    showAlert("✅ Iniciando sesión...", "success");
    setTimeout(() => navigateByRole(), 1000);
  } catch (error) {
    console.error("[handleLogin]", error);
    showAlert("❌ Error al iniciar sesión", "danger");
    setButtonLoading(loginButton, false);
  }
}

/**
 * Manejar registro
 */
async function handleRegister(e) {
  e.preventDefault();

  if (!validateRegisterForm()) return;

  const registerButton = document.getElementById("registerSubmit");
  setButtonLoading(registerButton, true);
  clearAlert();

  try {
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre: name },
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        showAlert("❌ Este correo ya está registrado", "danger");
      } else {
        showAlert(`❌ ${error.message}`, "danger");
      }
      setButtonLoading(registerButton, false);
      return;
    }

    showAlert(
      "✅ ¡Cuenta creada! Revisa tu correo para verificar tu cuenta.",
      "success"
    );

    // Limpiar formulario
    document.getElementById("registerForm").reset();

    // Volver a login después de 2 segundos
    setTimeout(() => {
      document.getElementById("registerSection").classList.add("hidden");
      document.getElementById("loginSection").classList.remove("hidden");
      setButtonLoading(registerButton, false);
    }, 2000);
  } catch (error) {
    console.error("[handleRegister]", error);
    showAlert("❌ Error al crear la cuenta", "danger");
    setButtonLoading(registerButton, false);
  }
}

/**
 * Manejar recuperación de contraseña
 */
async function handleResetPassword(e) {
  e.preventDefault();

  if (!validateResetForm()) return;

  const resetButton = document.getElementById("resetSubmit");
  setButtonLoading(resetButton, true);
  clearAlert();

  try {
    const email = document.getElementById("resetEmail").value.trim();

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password.html`,
    });

    if (error) {
      showAlert(`❌ ${error.message}`, "danger");
      setButtonLoading(resetButton, false);
      return;
    }

    showAlert(
      "📧 Te hemos enviado un correo con instrucciones para resetear tu contraseña",
      "success"
    );

    setTimeout(() => {
      closeResetPasswordModal();
      setButtonLoading(resetButton, false);
    }, 2000);
  } catch (error) {
    console.error("[handleResetPassword]", error);
    showAlert("❌ Error al enviar el correo", "danger");
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
      buttonId: "loginTogglePassword",
      inputId: "loginPassword",
    },
    {
      buttonId: "registerTogglePassword",
      inputId: "registerPassword",
    },
    {
      buttonId: "registerToggleConfirmPassword",
      inputId: "registerConfirmPassword",
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

/**
 * Toggle login/register
 */
function setupFormToggle() {
  const loginSection = document.getElementById("loginSection");
  const registerSection = document.getElementById("registerSection");
  const showRegisterLink = document.getElementById("showRegisterLink");
  const showLoginLink = document.getElementById("showLoginLink");

  showRegisterLink?.addEventListener("click", (e) => {
    e.preventDefault();
    loginSection.classList.add("hidden");
    registerSection.classList.remove("hidden");
    clearAlert();
    clearErrors("registerForm");
  });

  showLoginLink?.addEventListener("click", (e) => {
    e.preventDefault();
    registerSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
    clearAlert();
    clearErrors("loginForm");
  });
}

/**
 * Modal de recuperación de contraseña
 */
function setupResetPasswordModal() {
  const modal = document.getElementById("resetPasswordModal");
  const forgotLink = document.getElementById("forgotLink");
  const closeButton = document.getElementById("closeResetModal");
  const resetForm = document.getElementById("resetPasswordForm");

  forgotLink?.addEventListener("click", (e) => {
    e.preventDefault();
    modal.classList.add("active");
    clearAlert();
  });

  closeButton?.addEventListener("click", () => {
    closeResetPasswordModal();
  });

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeResetPasswordModal();
    }
  });

  resetForm?.addEventListener("submit", handleResetPassword);
}

function closeResetPasswordModal() {
  const modal = document.getElementById("resetPasswordModal");
  if (modal) {
    modal.classList.remove("active");
    document.getElementById("resetPasswordForm").reset();
    clearErrors("resetPasswordForm");
  }
}

/**
 * Pre-llenar "recuérdame"
 */
function setupRememberMe() {
  try {
    const savedEmail = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (savedEmail) {
      const emailInput = document.getElementById("loginEmail");
      const rememberCheckbox = document.getElementById("rememberMe");
      if (emailInput) emailInput.value = savedEmail;
      if (rememberCheckbox) rememberCheckbox.checked = true;
    }
  } catch {}
}

/* ==========================================
   INICIALIZACIÓN
   ========================================== */

/**
 * Auto-init al cargar la página
 */
(async function init() {
  try {
    // Si ya hay sesión, redirigir según rol
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      return navigateByRole();
    }

    // Setup formularios solo si estamos en login.html
    if (document.getElementById("loginForm")) {
      setupPasswordToggles();
      setupFormToggle();
      setupResetPasswordModal();
      setupRememberMe();

      document.getElementById("loginForm").addEventListener("submit", handleLogin);
      document.getElementById("registerForm").addEventListener("submit", handleRegister);
    }
  } catch (error) {
    console.error("[init]", error);
  }
})();

/* ==========================================
   EXPORTAR PARA OTROS MÓDULOS
   ========================================== */
export {
  supabase,
  getUser,
  getProfile,
  getDisplayName,
  requireAuth,
  requireRole,
  navigateByRole,
  logout,
  navigate,
};