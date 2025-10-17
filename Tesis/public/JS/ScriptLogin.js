// JS/ScriptLogin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ========= Config ========= */
export const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

/* ========= Utilidades ========= */
const LOGIN_URL = "login.html";
const HOME_CLIENTE = "index.html";
const HOME_ADMIN = "indexAdmin.html";

function go(path) {
  window.location.href = new URL(path, window.location.href).href;
}
function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
}

/* ========= Perfil / Roles ========= */
export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, nombre, role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
}

export async function goByRole() {
  const p = await getProfile();
  if (!p) return;
  if (p.role === "admin") go(HOME_ADMIN);
  else go(HOME_CLIENTE);
}

export async function requireRole(roleNeeded = "cliente") {
  const { data } = await supabase.auth.getSession();
  if (!data.session) { go(LOGIN_URL); return; }
  const p = await getProfile();
  if (!p || p.role !== roleNeeded) {
    if (roleNeeded === "admin") go("loginAdmin.html");
    else go(LOGIN_URL);
  }
}

/* ========= Cuenta: chip / logout / datos ========= */
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
export async function logout(ev) {
  ev?.preventDefault?.();
  try { await supabase.auth.signOut(); } catch {}
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  go(LOGIN_URL);
}
export function autoWireAuthMenu() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  const upd = document.getElementById("updateProfileBtn");
  if (upd) upd.addEventListener("click", (ev) => {
    ev?.preventDefault?.();
    window.location.href = "misdatos.html";
  });
}

/* ========= Lógica específica de login.html ========= */
async function wireLoginPage() {
  const wrapper = document.getElementById("authWrapper");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.querySelector(".login-btn");
  const registerBtn = document.querySelector(".register-btn");
  const forgot = document.getElementById("forgotLink");

  // Toggle
  registerBtn?.addEventListener("click", () => wrapper?.classList.add("active"));
  loginBtn?.addEventListener("click", () => wrapper?.classList.remove("active"));

  // Si ya tiene sesión, redirigir según rol
  const { data } = await supabase.auth.getSession();
  if (data.session) return await goByRole();

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
    showMsg("✅ Bienvenido. Verificando rol…", "success");
    await goByRole();
  });

  // Registro
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
}

/* ========= Auto-init ========= */
(async function init() {
  try {
    paintUserChip();
    autoWireAuthMenu();

    // Si estamos en login.html
    if (document.getElementById("loginForm") || document.getElementById("registerForm")) {
      await wireLoginPage();
    }
  } catch (e) {
    console.warn("init:", e);
  }
})();
