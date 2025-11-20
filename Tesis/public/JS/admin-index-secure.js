// Cliente que ya exportás en /admin/reportes/js/reports-core.js
import { supa } from "/JS/reports-core.js";

/* 1) Asegura overlay oculto al iniciar (si alguien lo dejó visible) */
document.getElementById("logoutOverlay")?.setAttribute("hidden", "");

/* Helpers */
const $  = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>[...r.querySelectorAll(s)];
const REPORT_BASE = "../loginAdmin.html";
function buildReportUrl(route) {
  const r = (route || "").replace(/^[./\\]+/, "").trim();
  if (!/^[\w-]+\.html$/i.test(r)) return null;
  return `${REPORT_BASE}${r}`;
}

/* 2) Guard de sesión + admin: NO cierra sesión, solo redirige a login admin si no corresponde */
async function assertAdmin() {
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) {
    window.location.href = "loginAdmin.html";
    throw new Error("No session");
  }
  // muestra email en el chip si existe
  const chip = document.getElementById("adminEmail");
  if (chip) chip.textContent = user.email || "admin";

  // usa DEFAULT auth.uid() en la función SQL
  const { data, error: rpcErr } = await supa.rpc("is_admin", {});
  if (rpcErr || !data) {
    window.location.href = "loginAdmin.html";
    throw new Error("Not admin");
  }
}

/* 3) Menú y logout (solo aquí mostramos overlay y hacemos signOut) */
function wireNav() {
  $$(".user-dropdown [data-route]").forEach(btn => {
    btn.addEventListener("click", () => {
      const url = buildReportUrl(btn.getAttribute("data-route"));
      if (!url) return alert("Ruta inválida.");
      window.location.href = `/${url}`;
    });
  });

  $("#logoutBtn")?.addEventListener("click", async () => {
    document.getElementById("logoutOverlay")?.removeAttribute("hidden");
    try {
      await supa.auth.signOut();
    } finally {
      window.location.href = "loginAdmin.html";
    }
  });
}

/* 4) Aside móvil (opcional, igual a tu lógica) */
function wireAside() {
  const aside  = $("#mobileAside");
  const toggle = $("#menuToggle");
  const closeBtn = $("#menuClose");
  const bd = $("#backdrop");

  const open  = () => { aside?.classList.add("open"); bd?.classList.add("show"); toggle?.setAttribute("aria-expanded","true"); };
  const close = () => { aside?.classList.remove("open"); bd?.classList.remove("show"); toggle?.setAttribute("aria-expanded","false"); };

  toggle?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  bd?.addEventListener("click", close);
  window.addEventListener("keydown", e => e.key === "Escape" && close());
}

/* 5) Búsqueda (delegá a  main.js si corresponde) */
function wireSearch() {
  $("#searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = $("#searchInput")?.value?.trim() || "";
    window.dispatchEvent(new CustomEvent("admin:search", { detail: { q } }));
  });
}

/* Init */
(async () => {
  try {
    await assertAdmin();   // valida sesión y rol
    wireNav();
    wireAside();
    wireSearch();
  } catch (err) {
    console.error(err);
  }
})();
