// JS/mis-datos.js
import { supabase, requireAuth } from "./ScriptLogin.js";

// ---- util ----
const $ = (id) => document.getElementById(id);

// ids mapeados 1:1 con columnas de clientes_perfil
const FIELD_IDS = [
  "ruc","razon","tel","mail","contacto",
  "ciudad","barrio","depto","postal",
  "calle1","calle2","nro"
];

const userField  = $("usuario");        // visual
const passField  = $("password");       // <-- antes "contrasenia"
const form       = document.getElementById("perfil-form");
const btnGuardar = document.getElementById("btn-guardar-datos");

// mensajes sin alert()
function showMsg(text, type = "ok") {
  const box = document.getElementById("perfil-msg");
  const h3  = document.getElementById("perfil-msg-text");
  if (!box || !h3) return alert(text);  // fallback
  h3.textContent = text;
  box.classList.remove("disabled");
  box.classList.toggle("checkout-error", type === "error");
  box.classList.toggle("checkout-success", type !== "error");
}
function hideMsg(){ document.getElementById("perfil-msg")?.classList.add("disabled"); }

function readFormValues() {
  const v = {};
  FIELD_IDS.forEach(k => v[k] = $(k)?.value?.trim() ?? "");
  return v;
}
function fillForm(data = {}) {
  FIELD_IDS.forEach(k => {
    if ($(k) && data[k] !== undefined && data[k] !== null) {
      $(k).value = String(data[k] ?? "");
    }
  });
}
function setLoading(on) {
  if (!btnGuardar) return;
  btnGuardar.disabled = !!on;
  btnGuardar.textContent = on ? "Guardando…" : "Actualizar";
}

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
  const next = (newEmail || "").trim();
  if (!next || next === currentEmail) return { changed: false };
  const { error } = await supabase.auth.updateUser({ email: next });
  if (error) throw error;
  return { changed: true };
}
async function updateAuthPasswordIfProvided(pwd) {
  const p = (pwd || "").trim();
  if (!p) return false;
  if (p.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  const { error } = await supabase.auth.updateUser({ password: p });
  if (error) throw error;
  return true;
}

// ----- Flujo de RECOVERY desde email -----
async function handleRecoveryIfNeeded() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (hash.get("type") !== "recovery") return;

  const newPwd = prompt("Ingresá tu nueva contraseña (mínimo 8 caracteres):");
  if (!newPwd) return;

  try {
    await updateAuthPasswordIfProvided(newPwd);
    showMsg("Contraseña actualizada. Usala a partir de ahora.", "ok");
  } catch (e) {
    showMsg("No se pudo actualizar la contraseña: " + (e?.message || ""), "error");
  } finally {
    history.replaceState({}, document.title, window.location.pathname);
  }
}

// ----- init -----
async function init() {
  try {
    await requireAuth();               // ahora existe
    await handleRecoveryIfNeeded();

    const { data: { user } } = await supabase.auth.getUser();
    if (userField) userField.value = user?.email ?? "";

    const perfil = await loadProfile(user.id);
    if (perfil) fillForm(perfil);
    hideMsg();

    form?.addEventListener("submit", async (e) => {
      e.preventDefault();
      setLoading(true);
      hideMsg();
      try {
        const values = readFormValues();
        if (!values.mail)  throw new Error("Ingresá un mail.");
        if (!values.razon) throw new Error("Ingresá la razón social / nombre.");

        // 1) Upsert de perfil
        await upsertProfile(user.id, values);

        // 2) Email y password en Auth
        const emailChanged = await updateAuthEmailIfNeeded(user.email, values.mail);
        const newPwd = passField?.value?.trim() ?? "";
        const passChanged = await updateAuthPasswordIfProvided(newPwd);

        if (passField) passField.value = "";

        let extra = [];
        if (emailChanged.changed) extra.push("email");
        if (passChanged)          extra.push("contraseña");
        const suf = extra.length ? ` (actualizado: ${extra.join(", ")})` : "";

        alert("Datos actualizados correctamente ✔️" + suf, "ok");
      } catch (err) {
        console.error(err);
        showMsg("No se pudieron guardar los datos. " + (err?.message ?? ""), "error");
      } finally {
        setLoading(false);
      }
    });

  } catch (err) {
    console.error("init mis-datos:", err);
    showMsg("Necesitás estar logueado para ver tus datos.", "error");
  }
}

init();
