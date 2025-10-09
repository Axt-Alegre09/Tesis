// JS/ScriptLogin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Config ========= */
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// rutas relativas (login.html e index.html están juntos)
const LOGIN_URL = "login.html";
const DASHBOARD_URL = "index.html";

/* ========= Utilidades ========= */
function go(path) {
  window.location.href = new URL(path, window.location.href).href;
}
function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
  // auto-ocultar a los 6s para no molestar
  setTimeout(() => {
    if (box.firstElementChild) box.firstElementChild.remove();
  }, 6000);
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}
export function setUserNameUI(nombre) {
  const el = document.querySelector(".user-name");
  if (el) el.textContent = nombre || "Cuenta";
}
export async function paintUserChip() {
  const user = await getUser();
  if (!user) return setUserNameUI("Cuenta");
  const nombre = user.user_metadata?.nombre || user.email || "Cuenta";
  setUserNameUI(nombre);
}

/* ========= Logout / Perfil ========= */
export async function logout(ev) {
  ev?.preventDefault?.();
  try { await supabase.auth.signOut(); } catch {}
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  go(LOGIN_URL);
}
export async function updateProfile(ev) {
  ev?.preventDefault?.();
  const user = await getUser();
  if (!user) return alert("Debes iniciar sesión para actualizar tus datos.");

  const actualNombre = user.user_metadata?.nombre || "";
  const actualAvatar = user.user_metadata?.avatar_url || "";

  const nuevoNombre = prompt("Ingresa tu nombre para mostrar:", actualNombre);
  if (nuevoNombre === null) return;
  const nuevoAvatar = prompt("URL de tu foto (opcional):", actualAvatar ?? "");

  const { error } = await supabase.auth.updateUser({
    data: {
      nombre: (nuevoNombre || actualNombre || "").trim(),
      avatar_url: (nuevoAvatar || "").trim(),
    },
  });

  if (error) {
    console.error("❌ Error al actualizar perfil:", error.message);
    alert("No se pudo actualizar el perfil.");
    return;
  }
  setUserNameUI(nuevoNombre || user.email || "Cuenta");
  alert("✅ Perfil actualizado.");
}
export function autoWireAuthMenu() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("updateProfileBtn")?.addEventListener("click", updateProfile);
}

/* ========= Helper: password segura (ajústalo a gusto) ========= */
function isStrongPassword(pwd) {
  if (typeof pwd !== "string") return false;
  if (pwd.length < 8) return false;                 // longitud mínima
  if (!/[A-Za-z]/.test(pwd)) return false;          // al menos una letra
  if (!/\d/.test(pwd)) return false;                // al menos un número
  return true;
}

/* ========= (Opcional) Chequear si email existe vía RPC ========= */
async function emailExists(email) {
  try {
    const { data, error } = await supabase.rpc("email_exists", { p_email: email });
    if (error) {
      // si no existe el RPC o no hay permisos, devolvemos null para no romper
      console.warn("email_exists RPC error:", error.message);
      return null;
    }
    return !!data;
  } catch (e) {
    console.warn("email_exists RPC fail:", e);
    return null;
  }
}

/* ========= Mapea errores comunes de Supabase a mensajes claros ========= */
function translateAuthError(action, error, context = {}) {
  // action: 'login' | 'register' | 'reset'
  const msg = (error?.message || "").toLowerCase();
  const status = error?.status;

  // LOGIN
  if (action === "login") {
    // No confirmado
    if (msg.includes("email not confirmed") || msg.includes("email not confirmed")) {
      return "Favor confirmar correo desde el email";
    }
    // Supabase suele devolver "Invalid login credentials"
    if (msg.includes("invalid login credentials")) {
      // Si no tenemos RPC, mostramos un genérico
      if (context.exists === null) return "Credenciales incorrectas";
      // Con RPC, diferenciamos
      return context.exists ? "Contraseña incorrecta" : "Correo no registrado o mal escrito";
    }
    // Otro error
    return "No se pudo iniciar sesión. Inténtalo de nuevo.";
  }

  // REGISTER
  if (action === "register") {
    if (msg.includes("user already registered") || msg.includes("already registered")) {
      return "Correo ya registrado, vaya al inicio de sesión";
    }
    if (msg.includes("password")) {
      return "Contraseña insegura, agrega más caracteres";
    }
    return "No se pudo registrar. Revisa el correo o la contraseña.";
  }

  // RESET
  if (action === "reset") {
    // Por seguridad, Supabase no siempre revela si existe o no el correo.
    // Mostramos mensaje genérico amable.
    return "No se pudo enviar el correo de recuperación.";
  }

  // Fallback
  return "Ocurrió un error. Inténtalo nuevamente.";
}

/* ========= Guardia para páginas privadas ========= */
export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) go(LOGIN_URL);
}

/* ========= Lógica específica de login.html ========= */
async function wireLoginPage() {
  const wrapper = document.getElementById("authWrapper");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.querySelector(".login-btn");
  const registerBtn = document.querySelector(".register-btn");
  const forgot = document.getElementById("forgotLink");

  // Toggle animado:
  registerBtn?.addEventListener("click", () => wrapper?.classList.add("active"));
  loginBtn?.addEventListener("click", () => wrapper?.classList.remove("active"));

  // Si ya hay sesión: al dashboard
  const { data } = await supabase.auth.getSession();
  if (data.session) return go(DASHBOARD_URL);

  // --- Login ---
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando...", "secondary");

    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const password = (document.getElementById("loginPassword")?.value || "").trim();

    if (!email || !password) {
      showMsg("Completa correo y contraseña.", "warning");
      return;
    }

    // Intento de login
    const { data: loginData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Si falla, intentamos distinguir (si existe el RPC)
      const exists = await emailExists(email); // true | false | null
      const msg = translateAuthError("login", error, { exists });
      showMsg(`❌ ${msg}`, "danger");
      return;
    }

    // Si tu proyecto exige confirmación, loginData.session podría ser null hasta confirmar
    if (!loginData?.session) {
      showMsg("Favor confirmar correo desde el email", "warning");
      return;
    }

    showMsg("✅ Bienvenido. Redirigiendo…", "success");
    go(DASHBOARD_URL);
  });

  // --- Registro ---
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando registro...", "secondary");

    const email = (document.getElementById("registerEmail")?.value || "").trim();
    const password = (document.getElementById("registerPassword")?.value || "").trim();

    if (!email) {
      showMsg("Ingresá un correo válido.", "warning");
      return;
    }
    if (!isStrongPassword(password)) {
      showMsg("Contraseña insegura, agrega más caracteres", "warning");
      return;
    }

    const { data: regData, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Guardamos un nombre “amigable” por defecto
        data: { nombre: email.split("@")[0] }
      },
    });

    if (error) {
      const msg = translateAuthError("register", error);
      showMsg(`❌ ${msg}`, "danger");
      return;
    }

    // Si tienes verificación por email activada en Supabase:
    showMsg("✅ Cuenta creada. Revisa tu correo para confirmar la cuenta.", "success");
    wrapper?.classList.remove("active"); // volver al login
  });

  // --- Recuperación de contraseña ---
  // --- Recuperación de contraseña ---
  forgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Ingresa tu correo para recuperar la contraseña:");
    if (!email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://tesis-ochre-iota.vercel.app/misdatos.html",
    });

    if (error) {
      showMsg("❌ No se pudo enviar el correo de recuperación.", "danger");
      return;
    }
    showMsg("📧 Te enviamos un correo con el enlace para cambiar la contraseña.", "info");
  });

}

/* ========= Auto-init ========= */
(async function init() {
  try {
    // Si hay UI de cuenta en otras páginas:
    paintUserChip();
    autoWireAuthMenu();

    // Si estamos en login.html, cablear flows y animación
    if (document.getElementById("loginForm") || document.getElementById("registerForm")) {
      await wireLoginPage();
    }
  } catch (e) {
    console.warn("init:", e);
  }
})();
