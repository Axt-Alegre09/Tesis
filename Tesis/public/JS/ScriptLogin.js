// JS/ScriptLogin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const LOGIN_URL = "login.html";
const DASHBOARD_URL = "index.html";

function go(path) {
  window.location.href = new URL(path, window.location.href).href;
}
function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  const cls = type === "danger" ? "alert-danger"
            : type === "warning" ? "alert-warning"
            : type === "success" ? "alert-success"
            : "alert-secondary";
  box.innerHTML = `<div class="alert ${cls}" role="alert">${text}</div>`;
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

  if (error) return alert("No se pudo actualizar el perfil.");
  setUserNameUI(nuevoNombre || user.email || "Cuenta");
  alert("✅ Perfil actualizado.");
}
export function autoWireAuthMenu() {
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("updateProfileBtn")?.addEventListener("click", updateProfile);
}

export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) go(LOGIN_URL);
}

/* ======= Lógica de login.html ======= */
async function wireLoginPage() {
  const wrapper = document.getElementById("authWrapper");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.querySelector(".login-btn");
  const registerBtn = document.querySelector(".register-btn");
  const forgot = document.getElementById("forgotLink");

  // Toggle UI
  registerBtn?.addEventListener("click", () => wrapper?.classList.add("active"));
  loginBtn?.addEventListener("click", () => wrapper?.classList.remove("active"));

  // Si hay sesión activa => dashboard
  const { data } = await supabase.auth.getSession();
  if (data.session) return go(DASHBOARD_URL);

  // --- LOGIN ---
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando…", "secondary");

    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const password = (document.getElementById("loginPassword")?.value || "").trim();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // 1) ¿Falta confirmación?
      if (/Email not confirmed/i.test(error.message)) {
        showMsg("Favor confirmar correo desde el email.", "warning");
        return;
      }

      // 2) Heurística para diferenciar correo inexistente vs contraseña incorrecta.
      //    Consultamos tu tabla pública de perfiles por el mail.
      try {
        const { data: perfil, error: qErr, status } = await supabase
          .from("clientes_perfil")
          .select("user_id")
          .eq("mail", email)
          .maybeSingle();

        if (!qErr && perfil) {
          showMsg("Contraseña incorrecta.", "danger");
        } else {
          // si tabla no tiene fila o RLS impide leer, mostramos esta
          showMsg("Correo no registrado o mal escrito.", "danger");
        }
      } catch {
        showMsg("Correo o contraseña inválidos.", "danger");
      }
      return;
    }

    showMsg("✅ Bienvenido. Redirigiendo…", "success");
    go(DASHBOARD_URL);
  });

  // --- REGISTRO ---
  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando registro…", "secondary");

    const email = (document.getElementById("registerEmail")?.value || "").trim();
    const password = (document.getElementById("registerPassword")?.value || "").trim();

    // Validación simple de contraseña
    if (password.length < 8) {
      showMsg("Contraseña insegura, agrega más caracteres (mínimo 8).", "warning");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { nombre: email.split("@")[0] } },
    });

    if (error) {
      if (/already registered/i.test(error.message)) {
        showMsg("Correo ya registrado, vaya al inicio de sesión.", "warning");
      } else {
        showMsg("No se pudo registrar. Revisa el correo o la contraseña.", "danger");
      }
      return;
    }

    showMsg("✅ Cuenta creada. Revisá tu correo para confirmar.", "success");
    wrapper?.classList.remove("active");
  });

  // --- OLVIDÉ MI CONTRASEÑA ---
  forgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = (document.getElementById("loginEmail")?.value || "").trim()
               || prompt("Ingresá tu correo:");
    if (!email) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Te trae a MIS DATOS para que cambies la clave ahí (no pasamos email/clave en URL)
      redirectTo: `${window.location.origin}/misdatos.html#type=recovery`,
    });
    if (error) {
      showMsg("No se pudo enviar el correo de recuperación.", "danger");
      return;
    }
    showMsg("📧 Te enviamos un enlace para cambiar tu contraseña.", "info");
  });
}

/* ======= Auto-init ======= */
(async function init() {
  try {
    paintUserChip();
    autoWireAuthMenu();
    if (document.getElementById("loginForm") || document.getElementById("registerForm")) {
      await wireLoginPage();
    }
  } catch (e) {
    console.warn("init:", e);
  }
})();
