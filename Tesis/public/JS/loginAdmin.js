// JS/loginAdmin.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return data;
}

// Si ya está logueado, validá rol
(async () => {
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    const prof = await getProfile();
    if (prof?.role === "admin") {
      window.location.href = "/indexAdmin.html";   // 👈 absoluto
    } else {
      await supabase.auth.signOut();
    }
  }
})();

document.getElementById("adminLoginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert("❌ Credenciales inválidas");
    return;
  }
  const prof = await getProfile();
  if (!prof || prof.role !== "admin") {
    await supabase.auth.signOut();
    alert("⚠️ Tu cuenta no tiene permisos de administrador.");
    return;
  }
  window.location.href = "/indexAdmin.html";       // 👈 absoluto
});
