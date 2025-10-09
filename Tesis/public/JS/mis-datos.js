// JS/mis-datos.js
import { supabase, requireAuth } from "./ScriptLogin.js";

// ---- util ----
const $ = (id) => document.getElementById(id);

const FIELD_IDS = [
  "ruc","razon","tel","mail","contacto",
  "ciudad","barrio","depto","postal",
  "calle1","calle2","nro"
];

const userField  = $("usuario");      // solo visual
const passField  = $("contrasenia");  // para cambiar clave si lo completan
const btnGuardar = document.querySelector('[data-accion="actualizar"]') || document.querySelector("button[type=submit]");

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

// ----- BD perfil -----
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

// ----- Auth updates -----
async function updateAuthEmailIfNeeded(currentEmail, newEmail) {
  if (!newEmail || newEmail === currentEmail) return { changed: false };
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw error;
  return { changed: true };
}
async function updateAuthPasswordIfProvided(pwd) {
  if (!pwd) return false;
  if (pwd.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const { error } = await supabase.auth.updateUser({ password: pwd });
  if (error) throw error;
  return true;
}

// ----- Flujo de RECOVERY desde email -----
async function handleRecoveryIfNeeded() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get("type") !== "recovery") return;

  // A esta altura Supabase ya tomó el access_token del hash y creó la sesión
  const newPwd = prompt("Ingresá tu nueva contraseña (mínimo 8 caracteres):");
  if (!newPwd) return;

  try {
    await updateAuthPasswordIfProvided(newPwd);
    alert("✅ Contraseña actualizada. Usala a partir de ahora.");
  } catch (e) {
    alert("No se pudo actualizar la contraseña: " + (e?.message || ""));
  } finally {
    // limpiamos el hash para que no quede feo
    history.replaceState({}, document.title, window.location.pathname);
  }
}

// ----- init -----
async function init() {
  try {
    await requireAuth();
    await handleRecoveryIfNeeded();

    const { data: { user } } = await supabase.auth.getUser();
    if (userField) userField.value = user.email ?? "";

    const perfil = await loadProfile(user.id);
    if (perfil) fillForm(perfil);

    btnGuardar?.addEventListener("click", async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const values = readFormValues();
        if (!values.mail) throw new Error("Ingresá un mail.");
        if (!values.razon) throw new Error("Ingresá la razón social / nombre.");

        // 1) Guardar/actualizar perfil
        await upsertProfile(user.id, values);

        // 2) Auth: email y/o password
        const emailChanged = await updateAuthEmailIfNeeded(user.email, values.mail);
        const newPwd = passField?.value?.trim() ?? "";
        const passChanged = newPwd ? await updateAuthPasswordIfProvided(newPwd) : false;

        // limpiar campo de contraseña si se usó
        if (passField) passField.value = "";

        if (emailChanged.changed) {
          alert("Email actualizado. Si tu proyecto lo requiere, revisá tu correo para confirmarlo.");
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
