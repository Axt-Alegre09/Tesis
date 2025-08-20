// JS/ScriptLogin.js
// Integra tu UI con Supabase Auth (registro con confirmación por correo, login y recuperación)
// Reemplaza SUPABASE_URL y SUPABASE_ANON_KEY por los de tu proyecto (Settings → API)


import { createClient } from "https://esm.sh/@supabase/supabase-js@2";


// === CONFIG ===
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const DASHBOARD_URL = "/index.html";


// Crear cliente
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// ====== utilidades UI ======
const $ = (sel) => document.querySelector(sel);
const msgBox = $("#msg");


function showMsg(text, type = "info") {
if (!msgBox) return;
msgBox.innerHTML = `
<div class="alert alert-${type} alert-dismissible fade show" role="alert">
${text}
<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
</div>`;
}

function setLoading(btn, loading) {
if (!btn) return;
if (loading) {
btn.dataset.txt = btn.textContent;
btn.textContent = "Procesando...";
btn.setAttribute("disabled", "true");
} else {
btn.removeAttribute("disabled");
if (btn.dataset.txt) btn.textContent = btn.dataset.txt;
}
}


// ====== toggle entre login/registro ======
const wrapper = document.querySelector('.wrapper');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');
registerBtn?.addEventListener('click', () => wrapper?.classList.add('active'));
loginBtn?.addEventListener('click', () => wrapper?.classList.remove('active'));


// ====== refs formularios ======
const loginForm = $("#loginForm");
const registerForm = $("#registerForm");
const forgotLink = $("#forgotLink");


// ====== manejo de sesión al cargar ======
(async function init() {
try {
// si ya hay sesión activa → redirige
const { data: sess } = await supabase.auth.getSession();
if (sess?.session) {
window.location.replace(DASHBOARD_URL);
return;
}


// si vuelve del mail de confirmación (hash con access_token)
if (location.hash.includes('access_token')) {
const { data: userData, error } = await supabase.auth.getUser();
if (!error && userData?.user) {
showMsg('✅ Tu cuenta fue confirmada. Ya podés iniciar sesión.', 'success');
}
// limpiar hash
history.replaceState({}, document.title, location.pathname);
}
// si viene del enlace de recuperación
if (location.hash.includes('type=recovery')) {
const newPass = prompt('Ingresá tu nueva contraseña (mínimo 6):');
if (newPass && newPass.length >= 6) {
const { error } = await supabase.auth.updateUser({ password: newPass });
if (error) return showMsg('❌ Error actualizando contraseña: ' + error.message, 'danger');
showMsg('✅ Contraseña actualizada. Iniciá sesión con tu nueva contraseña.', 'success');
await supabase.auth.signOut();
} else {
showMsg('La contraseña debe tener al menos 6 caracteres.', 'warning');
}
history.replaceState({}, document.title, location.pathname);
}
} catch (e) {
console.error(e);
}
})();



// ====== registro (con confirmación por email) ======
registerForm?.addEventListener('submit', async (e) => {
e.preventDefault();
const email = (document.getElementById('registerEmail')?.value || '').trim();
const password = (document.getElementById('registerPassword')?.value || '').trim();
const btn = document.getElementById('registerSubmit');


if (!email || !password) return showMsg('Completá correo y contraseña.', 'warning');


setLoading(btn, true);
try {
// vuelve a esta misma página para manejar el hash
const redirectTo = `${window.location.origin}${window.location.pathname}`;
const { error } = await supabase.auth.signUp({
email,
password,
options: { emailRedirectTo: redirectTo }
});

if (error) return showMsg('❌ Error al registrarse: ' + error.message, 'danger');


showMsg('✅ Usuario creado. Revisá tu correo para confirmar la cuenta.', 'success');
wrapper?.classList.remove('active'); // ir al panel de login
} catch (err) {
showMsg('❌ Ocurrió un error: ' + (err?.message || err), 'danger');
} finally {
setLoading(btn, false);
}
});


// ====== login ======
loginForm?.addEventListener('submit', async (e) => {
e.preventDefault();
const email = (document.getElementById('loginEmail')?.value || '').trim();
const password = (document.getElementById('loginPassword')?.value || '').trim();
const btn = document.getElementById('loginSubmit');


if (!email || !password) return showMsg('Completá correo y contraseña.', 'warning');


setLoading(btn, true);
try {
const { data, error } = await supabase.auth.signInWithPassword({ email, password });
if (error) return showMsg('❌ No se pudo iniciar sesión: ' + error.message, 'danger');


if (data?.user) {
showMsg('✅ Sesión iniciada. Redirigiendo...', 'success');
setTimeout(() => window.location.replace(DASHBOARD_URL), 600);
}
} catch (err) {
showMsg('❌ Ocurrió un error: ' + (err?.message || err), 'danger');
} finally {
setLoading(btn, false);
}
});

// ====== recuperar contraseña ======
forgotLink?.addEventListener('click', async (e) => {
e.preventDefault();
const email = (document.getElementById('loginEmail')?.value || '').trim();
if (!email) return showMsg('Escribí tu correo en el campo de email para enviarte el enlace de recuperación.', 'warning');


try {
const redirectTo = `${window.location.origin}${window.location.pathname}#type=recovery`;
const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
if (error) return showMsg('❌ Error al enviar correo de recuperación: ' + error.message, 'danger');
showMsg('📩 Te enviamos un correo con el enlace para restablecer tu contraseña.', 'info');
} catch (err) {
showMsg('❌ Ocurrió un error: ' + (err?.message || err), 'danger');
}
});