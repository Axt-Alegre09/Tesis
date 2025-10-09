// JS/mis-datos.js
import { supabase, requireAuth } from "./ScriptLogin.js";

// ---------- util dom ----------
const $ = (id) => document.getElementById(id);

// Campos de perfil (deben existir en el HTML)
const FIELD_IDS = [
  "ruc","razon","tel","mail","contacto",
  "ciudad","barrio","depto","postal",
  "calle1","calle2","nro"
];

// Campos de “usuario” (auth)
const userField  = $("usuario");      // opcional (solo display)
const passField  = $("contrasenia");  // si lo llenan, se actualiza clave
const btnGuardar = document.querySelector('[data-accion="actualizar"]') || document.querySelector("button[type=submit]");

// ---------- helpers ----------
function readFormValues() {
  const v = {};
  FIELD_IDS.forEach(k => v[k] = $(k)?.value?.trim() ?? "");
  return v;
}

function fillForm(data = {}) {
  FIELD_IDS.forEach(k => {
    if ($(k) && typeof data[k] !== "undefined" && data[k] !== null) {
      $(k).value = String(data[k]);
    }
  });
}

function setLoading(on) {
  if (!btnGuardar) return;
  btnGuardar.disabled = !!on;
  btnGuardar.textContent = on ? "Guardando…" : "Actualizar";
}

function toast(msg) { alert(msg); }

// Asegura sesión de recuperación si viniste desde el mail (hash con tokens)
async function ensureRecoverySession() {
  // Si ya hay sesión, nada que hacer
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session;

  // Forzar sesión de recovery desde la URL
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const access_token  = hash.get("access_token");
  const refresh_token = hash.get("refresh_token");

  if (access_token && refresh_token) {
    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw error;

    // Limpia el hash visualmente
    history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return data.session;
  }
  return null; // no hay sesión ni tokens
}

// ---------- flujo principal ----------
async function getUserOrRedirect() {
  // Si no hay sesión, redirige a login
  await requireAuth();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function loadProfile(uid) {
  const { data, error } = await supabase
    .from("clientes_perfil")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function upsertProfile(uid, values) {
  const payload = { user_id: uid, ...values };
  const { error } = await supabase
    .from("clientes_perfil")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

// Actualiza email de Auth si cambió
async function updateAuthEmailIfNeeded(currentEmail, newEmail) {
  if (!newEmail || newEmail === currentEmail) return;

  const { data, error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;

  // Si tu proyecto requiere confirmación de email, Supabase enviará correo.
  // Podés avisar:
  toast("Email actualizado. Si tu proyecto lo requiere, revisá tu correo para confirmarlo.");
}

// Actualiza contraseña (requiere sesión válida o sesión de recuperación)
async function updateAuthPasswordIfProvided(pwd) {
  if (!pwd) return;
  if (pwd.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  // Garantizar que hay sesión (normal o de recovery)
  const session = await ensureRecoverySession();
  if (!session) {
    throw new Error("No se encontró una sesión válida para cambiar la contraseña. Volvé a abrir el enlace 'Olvidé mi contraseña' desde tu correo.");
  }

  const { error } = await supabase.auth.updateUser({ password: pwd });
  if (error) throw error;

  toast("Contraseña actualizada. Por seguridad, iniciá sesión nuevamente.");
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

async function init() {
  try {
    // (por si viniste desde el mail, activamos sesión de recovery antes de leer user)
    await ensureRecoverySession();

    const user = await getUserOrRedirect();

    // mostrar email actual en el campo “usuario” si existe
    if (userField) userField.value = user.email ?? "";

    // 1) cargar perfil de la BD y completar formulario
    const perfil = await loadProfile(user.id);
    if (perfil) fillForm(perfil);

    // 2) Guardar
    btnGuardar?.addEventListener("click", async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const values = readFormValues();
        if (!values.mail)  throw new Error("Ingresá un mail.");
        if (!values.razon) throw new Error("Ingresá la razón social / nombre.");

        await upsertProfile(user.id, values);
        await updateAuthEmailIfNeeded(user.email, values.mail);

        const newPwd = passField?.value?.trim() ?? "";
        if (newPwd) {
          await updateAuthPasswordIfProvided(newPwd);
          return; // updateAuthPasswordIfProvided ya redirige al login
        }

        toast("Datos actualizados correctamente ✔️");
      } catch (err) {
        console.error(err);
        toast("No se pudieron guardar los datos. " + (err?.message ?? ""));
      } finally {
        setLoading(false);
      }
    });

  } catch (err) {
    console.error("init mis-datos:", err);
    toast("Necesitás estar logueado para ver tus datos.");
  }
}

init();
