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
  // navega respecto a la carpeta actual (evita /public/public/)
  window.location.href = new URL(path, window.location.href).href;
}
function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
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
  // Botón de cerrar sesión
  document.getElementById("logoutBtn")?.addEventListener("click", logout);

  // Botón de "Actualizar datos" → ir a misdatos.html
  const upd = document.getElementById("updateProfileBtn");
  if (upd) {
    upd.addEventListener("click", (ev) => {
      ev?.preventDefault?.();
      window.location.href = "misdatos.html";
    });
  }
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

  // Toggle animado (usa .active según tu CSS):
  registerBtn?.addEventListener("click", () => wrapper?.classList.add("active"));
  loginBtn?.addEventListener("click", () => wrapper?.classList.remove("active"));

  // Si el usuario ya tiene sesión válida, ir al dashboard
  const { data } = await supabase.auth.getSession();
  if (data.session) return go(DASHBOARD_URL);

  // --- Login ---
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
    showMsg("✅ Bienvenido. Redirigiendo…", "success");
    go(DASHBOARD_URL);
  });

  // --- Registro ---
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando registro...", "secondary");

    const email = (document.getElementById("registerEmail")?.value || "").trim();
    const password = (document.getElementById("registerPassword")?.value || "").trim();

    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre: email.split("@")[0] } },
    });

    if (error) {
      console.error(error);
      showMsg("❌ No se pudo registrar. Revisa el correo o la contraseña.", "danger");
      return;
    }
    showMsg("✅ Cuenta creada. Revisa tu correo si se requiere verificación.", "success");
    // Volvemos al panel de login
    wrapper?.classList.remove("active");
  });

  // --- Recuperación de contraseña ---
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
