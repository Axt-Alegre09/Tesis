// usa el cliente que ya tenés exportado en reports-core.js
import { supa } from "../admin/reportes/js/reports-core.js";

async function assertAdmin() {
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) {
    window.location.href = "loginAdmin.html";
    throw new Error("No session");
  }

  // muestra el email
  const emailEl = document.getElementById("adminEmail");
  if (emailEl) emailEl.textContent = user.email || "admin";

  // ✅ ahora podés llamar sin parámetros: u usa DEFAULT auth.uid()
  const { data, error: rpcErr } = await supa.rpc("is_admin", {});
  if (rpcErr || !data) {
    alert("No tenés permisos de administrador.");
    await supa.auth.signOut();
    window.location.href = "loginAdmin.html";
    throw new Error("Not admin");
  }
}

(async () => {
  try {
    await assertAdmin();
    // ...el resto de tu wiring (aside, navegación, etc.)
  } catch (e) {
    console.error(e);
  }
})();

