// JS/mis-datos.js
// Carga/guarda el perfil del usuario manteniendo el MISMO layout que pasarela.
// Guarda en Supabase (tabla sugerida: clientes_perfil) y actualiza email/contraseña vía auth.
// Tiene fallback a localStorage si no hay sesión o falla la BD.

import { supabase } from "./ScriptLogin.js";

const $ = (id) => document.getElementById(id);

// --- UI helpers (mismo look que tus avisos) ---
function showMsg(text, type = "ok") {
  const box = document.getElementById("perfil-msg");
  const h3  = document.getElementById("perfil-msg-text");
  h3.textContent = text;
  box.classList.remove("disabled");
  box.style.border = "2px solid #6f5c38";
  box.style.background = "#fff";
  box.style.borderRadius = "12px";
  box.style.padding = "14px";
  if (type !== "ok") h3.textContent = "Atención: " + text;
  setTimeout(() => box.classList.add("disabled"), 3500);
}

// --- Local fallback ---
const LOCAL_KEY = "perfil_cliente_local";
function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; }
}
function saveLocal(obj) {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(obj || {})); } catch {}
}

// --- Mapear campos del form ---
function readForm() {
  return {
    ruc:       $("ruc").value.trim(),
    razon:     $("razon").value.trim(),
    tel:       $("tel").value.trim(),
    mail:      $("mail").value.trim(),
    contacto:  $("contacto").value.trim(),
    ciudad:    $("ciudad").value.trim(),
    barrio:    $("barrio").value.trim(),
    depto:     $("depto").value.trim(),
    postal:    $("postal").value.trim(),
    calle1:    $("calle1").value.trim(),
    calle2:    $("calle2").value.trim(),
    nro:       $("nro").value.trim(),
    usuario:   $("usuario").value.trim(),
    password:  $("password").value // intencionalmente sin trim
  };
}
function fillForm(d = {}) {
  $("ruc").value      = d.ruc      || "";
  $("razon").value    = d.razon    || "";
  $("tel").value      = d.tel      || "";
  $("mail").value     = d.mail     || "";
  $("contacto").value = d.contacto || "";
  $("ciudad").value   = d.ciudad   || "";
  $("barrio").value   = d.barrio   || "";
  $("depto").value    = d.depto    || "";
  $("postal").value   = d.postal   || "";
  $("calle1").value   = d.calle1   || "";
  $("calle2").value   = d.calle2   || "";
  $("nro").value      = d.nro      || "";
  $("usuario").value  = d.usuario  || d.mail || "";
  $("password").value = "";
}

// --- Cargar perfil (DB o local) ---
async function loadProfile() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;

  if (!uid) {
    // invitado: solo local
    fillForm(readLocal());
    return;
  }

  // intenta leer desde la tabla "clientes_perfil"
  const { data, error } = await supabase
    .from("clientes_perfil")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) {
    console.warn("[perfil] error leyendo DB, uso local:", error);
    fillForm(readLocal());
    return;
  }

  // fusiona email actual de auth como usuario por defecto
  const base = data || {};
  const email = auth.user.email || base.mail || "";
  fillForm({ ...base, usuario: email });
}

// --- Guardar perfil (DB + auth) ---
async function saveProfile(e) {
  e.preventDefault();
  const payload = readForm();

  // guarda en local SIEMPRE como respaldo
  saveLocal({ ...payload, password: undefined });

  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;

  if (!uid) {
    showMsg("Datos guardados localmente. Inicia sesión para sincronizar con tu cuenta.", "warn");
    return;
  }

  // 1) upsert del perfil en la tabla
  const row = {
    user_id: uid,
    ruc: payload.ruc,
    razon: payload.razon,
    tel: payload.tel,
    mail: payload.mail,
    contacto: payload.contacto,
    ciudad: payload.ciudad,
    barrio: payload.barrio,
    depto: payload.depto,
    postal: payload.postal,
    calle1: payload.calle1,
    calle2: payload.calle2,
    nro: payload.nro,
    updated_at: new Date().toISOString()
  };

  const { error: upErr } = await supabase
    .from("clientes_perfil")
    .upsert(row, { onConflict: "user_id" });

  if (upErr) {
    console.error("[perfil] upsert error", upErr);
    showMsg("No se pudo guardar en la cuenta. Guardado local OK.", "warn");
    return;
  }

  // 2) actualizar email/contraseña (si cambiaron)
  const updates = {};
  if (payload.usuario && payload.usuario !== auth.user.email) {
    updates.email = payload.usuario;
  }
  if (payload.password && payload.password.length >= 6) {
    updates.password = payload.password;
  }

  if (Object.keys(updates).length) {
    const { error: updAuthErr } = await supabase.auth.updateUser(updates);
    if (updAuthErr) {
      console.warn("[perfil] auth update error", updAuthErr);
      showMsg("Perfil guardado. No se pudo actualizar email/contraseña.", "warn");
      return;
    }
  }

  showMsg("Datos actualizados correctamente ✅", "ok");
}

// --- Wire ---
document.getElementById("perfil-form")?.addEventListener("submit", saveProfile);
loadProfile();
