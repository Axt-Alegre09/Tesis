import { supabase } from "./ScriptLogin.js";

const form = document.querySelector("form");   // tu formulario de datos
const btnActualizar = document.querySelector("button[type=submit], #btn-actualizar") || document.querySelector("button");

async function getUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    alert("Error al verificar sesión: " + error.message);
    throw error;
  }
  return data?.user?.id;
}

// Cargar datos actuales al abrir la página
async function cargarDatos() {
  const userId = await getUserId();
  if (!userId) {
    alert("No estás logueado");
    return;
  }

  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("No se pudieron cargar datos:", error.message);
    return;
  }

  // Volcar valores en los inputs
  Object.keys(data).forEach(key => {
    if (form.elements[key]) form.elements[key].value = data[key] ?? "";
  });
}

// Guardar cambios
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const userId = await getUserId();
  if (!userId) return;

  const payload = {
    ruc: form.ruc.value,
    razon: form.razon.value,
    tel: form.tel.value,
    mail: form.mail.value,
    contacto: form.contacto.value,
    ciudad: form.ciudad.value,
    barrio: form.barrio.value,
    depto: form.depto.value,
    postal: form.postal.value,
    calle1: form.calle1.value,
    calle2: form.calle2.value,
    nro: form.nro.value
  };

  const { error } = await supabase
    .from("perfiles")
    .update(payload)
    .eq("id", userId);

  if (error) {
    alert("Error al actualizar: " + error.message);
  } else {
    alert("✅ Datos actualizados con éxito");
  }
});

cargarDatos();
