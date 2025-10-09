// JS/mis-datos.js
// Requiere ScriptLogin.js que exporta `supabase`, y asume que el HTML
// tiene los mismos IDs de inputs que pasarelaPagos (ruc, razon, tel, mail, etc.)

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
const userField  = $("usuario");      // opcional (sólo visual)
const passField  = $("contrasenia");  // opcional: si lo llenan, actualiza clave
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

function toast(msg, type="ok") {
  // muy simple
  alert(msg);
}

// ---------- flujo principal ----------
async function getUserOrRedirect() {
  await requireAuth(); // si no hay sesión, redirige
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

async function updateAuthEmailIfNeeded(currentEmail, newEmail) {
  // si cambiaron el mail y es distinto del actual de auth, intenta actualizarlo
  if (newEmail && newEmail !== currentEmail) {
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }
}

async function updateAuthPasswordIfProvided(pwd) {
  if (pwd && pwd.length >= 6) {
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) throw error;
  }
}

async function init() {
  try {
    const user = await getUserOrRedirect();

    // mostrar email actual en el campo “usuario” si existe
    if (userField) userField.value = user.email ?? "";

    // 1) cargar perfil de la BD y completar formulario
    const perfil = await loadProfile(user.id);
    if (perfil) fillForm(perfil);

    // 2) wire botón guardar
    btnGuardar?.addEventListener("click", async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const values = readFormValues();
        // validaciones mínimas
        if (!values.mail) throw new Error("Ingresá un mail.");
        if (!values.razon) throw new Error("Ingresá la razón social / nombre.");

        // upsert perfil
        await upsertProfile(user.id, values);

        // auth: email y/o password (opcionales)
        await updateAuthEmailIfNeeded(user.email, values.mail);
        const newPwd = passField?.value?.trim() ?? "";
        if (newPwd) await updateAuthPasswordIfProvided(newPwd);

        toast("Datos actualizados correctamente ✔️");
      } catch (err) {
        console.error(err);
        toast("No se pudieron guardar los datos. " + (err?.message ?? ""), "error");
      } finally {
        setLoading(false);
      }
    });

  } catch (err) {
    console.error("init mis-datos:", err);
    toast("Necesitás estar logueado para ver tus datos.", "error");
  }
}

init();
