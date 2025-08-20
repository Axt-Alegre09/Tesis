// ScriptLogin.js
import { supabase } from "./supabaseClient.js";

/* -------------------------- Toggle (manteniendo clases) -------------------------- */
const wrapper = document.querySelector(".wrapper");
const registerBtn = document.querySelector(".register-btn");
const loginBtn = document.querySelector(".login-btn");

if (registerBtn) registerBtn.addEventListener("click", () => wrapper.classList.add("active"));
if (loginBtn)    loginBtn.addEventListener("click",    () => wrapper.classList.remove("active"));

/* ------------------------------- Registro ------------------------------- */
// Selecciona el form de registro según tu HTML:
const registerForm = document.querySelector(".form-box.register form");

if (registerForm) {
  const registerBtnEl = registerForm.querySelector("button[type='submit']");
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = registerForm.querySelector("input[type='email']").value.trim();
    const password = registerForm.querySelector("input[type='password']").value;

    if (!email || !password) return alert("Completá email y contraseña.");

    try {
      registerBtnEl?.setAttribute("disabled", true);
      registerBtnEl && (registerBtnEl.dataset.txt = registerBtnEl.textContent);
      if (registerBtnEl) registerBtnEl.textContent = "Procesando...";

      const { data, error } = await supabase.auth.signUp({ email, password });

      registerBtnEl?.removeAttribute("disabled");
      if (registerBtnEl?.dataset.txt) registerBtnEl.textContent = registerBtnEl.dataset.txt;

      if (error) {
        return alert("❌ Error al registrarse: " + error.message);
      }

      // Si la confirmación por email está activada, el usuario debe verificar su correo
      alert("✅ Usuario creado. Revisá tu correo para confirmar la cuenta.");
      // Volvemos al panel de login
      wrapper?.classList.remove("active");
    } catch (err) {
      console.error(err);
      alert("❌ Ocurrió un error inesperado.");
    }
  });
}

/* -------------------------------- Login -------------------------------- */
const loginForm = document.querySelector(".form-box.login form");

if (loginForm) {
  const loginBtnEl = loginForm.querySelector("button[type='submit']");
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // En tu login.html el input de usuario es type="email"
    const email = loginForm.querySelector("input[type='email']").value.trim();
    const password = loginForm.querySelector("input[type='password']").value;

    if (!email || !password) return alert("Completá email y contraseña.");

    try {
      loginBtnEl?.setAttribute("disabled", true);
      loginBtnEl && (loginBtnEl.dataset.txt = loginBtnEl.textContent);
      if (loginBtnEl) loginBtnEl.textContent = "Procesando...";

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      loginBtnEl?.removeAttribute("disabled");
      if (loginBtnEl?.dataset.txt) loginBtnEl.textContent = loginBtnEl.dataset.txt;

      if (error) {
        return alert("❌ Error al iniciar sesión: " + error.message);
      }

      // Login OK → redirigir a página principal
      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("❌ Ocurrió un error inesperado.");
    }
  });
}

/* -------- (Opcional) si ya hay sesión activa en login.html, redirigir -------- */
(async () => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user) {
      // Si querés que no pueda ver el login estando logueado, descomenta:
      // window.location.href = "index.html";
    }
  } catch {}
})();

/* ------------------------------- Logout -------------------------------- */
// En tu index.html, podés usar: <button onclick="logout()">Cerrar sesión</button>
export async function logout() {
  await supabase.auth.signOut();
  alert("👋 Sesión cerrada");
  window.location.href = "login.html";
}
