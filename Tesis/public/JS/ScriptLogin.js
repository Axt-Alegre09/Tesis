// JS/ScriptLogin.js - CON SOPORTE PARA MODO INVITADO Y MIGRACIÓN + LOGS
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const supabase = createClient(
  "https://jyygevitfnbwrvxrjexp.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo"
);

const LOGIN_URL = "login.html";
const HOME_CLIENTE = "index.html";
const HOME_ADMIN = "admin-dashboard.html";

let isRedirecting = false;

function go(path) {
  if (isRedirecting) return;
  isRedirecting = true;
  window.location.replace(new URL(path, window.location.href).href);
}

function showMsg(text, type = "info") {
  const box = document.getElementById("msg");
  if (!box) return;
  box.innerHTML = `<div class="alert alert-${type}" role="alert">${text}</div>`;
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from("profiles")  
    .select("id, email, nombre, role")  
    .eq("id", user.id)  
    .maybeSingle();
    
  if (error) { 
    console.error("[profiles]", error); 
    return null; 
  }
  return data;
}

export async function getClientePerfil() {
  const user = await getUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from("clientes_perfil")
    .select("user_id, razon, ruc, tel, mail")
    .eq("user_id", user.id)
    .maybeSingle();
    
  if (error) { 
    console.error("[clientes_perfil]", error); 
    return null; 
  }
  return data;
}

async function getDisplayName() {
  const user = await getUser();
  if (!user) return "";

  const cp = await getClientePerfil();
  const razon = cp?.razon?.trim();
  if (razon) return razon;

  const p = await getProfile();
  const nomPerfil = p?.nombre?.trim();
  if (nomPerfil) return nomPerfil;

  const nomMeta = user.user_metadata?.nombre?.trim();
  if (nomMeta) return nomMeta;

  return "";
}

export async function goByRole() {
  if (isRedirecting) return;
  
  const p = await getProfile();
  if (!p) {
    console.log('⚠️ No se encontró perfil de usuario');
    return;
  }
  
  console.log('🔀 Redirigiendo según rol:', p.role);
  
  if (p.role === "admin") {
    go(HOME_ADMIN);
  } else {
    go(HOME_CLIENTE);
  }
}

export async function requireRole(roleNeeded = "cliente") {
  const { data } = await supabase.auth.getSession();
  if (!data.session) { 
    go(LOGIN_URL); 
    return; 
  }
  
  const p = await getProfile();
  if (!p || p.role !== roleNeeded) {
    if (roleNeeded === "admin") {
      go("loginAdmin.html");
    } else {
      go(LOGIN_URL);
    }
  }
}

export function setUserNameUI(nombre) {
  const el = document.querySelector(".user-name");
  if (el) el.textContent = nombre || "Cuenta";
}

export async function paintUserChip() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) return setUserNameUI("Cuenta");
  
  const display = await getDisplayName();
  setUserNameUI(display || "Cuenta");
}

export async function logout(ev) {
  ev?.preventDefault?.();
  
  try { 
    await supabase.auth.signOut(); 
  } catch (e) {
    console.error('Error al cerrar sesión:', e);
  }
  
  try { localStorage.clear(); } catch {}
  try { sessionStorage.clear(); } catch {}
  
  window.location.replace(LOGIN_URL);
}

export async function autoWireAuthMenu() {
  const authBtn = document.getElementById("logoutBtn");
  const upd = document.getElementById("updateProfileBtn");

  if (upd) {
    upd.addEventListener("click", (ev) => {
      ev?.preventDefault?.();
      window.location.href = "misdatos.html";
    });
  }

  if (authBtn) {
    const { data } = await supabase.auth.getSession();
    const hasSession = !!data?.session;

    if (hasSession) {
      authBtn.innerHTML = `<i class="bi bi-box-arrow-right"></i> Cerrar sesión`;
      authBtn.onclick = (e) => logout(e);
    } else {
      authBtn.innerHTML = `<i class="bi bi-box-arrow-in-right"></i> Iniciar sesión`;
      authBtn.onclick = () => go(LOGIN_URL);
    }
  }

  await paintUserChip();
}

async function wireLoginPage() {
  const wrapper = document.getElementById("authWrapper");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const loginBtn = document.querySelector(".login-btn");
  const registerBtn = document.querySelector(".register-btn");
  const forgot = document.getElementById("forgotLink");

  registerBtn?.addEventListener("click", () => wrapper?.classList.add("active"));
  loginBtn?.addEventListener("click", () => wrapper?.classList.remove("active"));

  try {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 3000)
    );
    
    const sessionPromise = supabase.auth.getSession();
    
    const { data } = await Promise.race([sessionPromise, timeoutPromise]);
    
    if (data?.session) {
      console.log('✓ Sesión existente detectada, redirigiendo...');
      await goByRole();
      return;
    }
  } catch (error) {
    console.log('⚠️ Error verificando sesión:', error.message);
  }

  // ⭐ LOGIN CON LOGS
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    console.log("═══════════════════════════════════════");
    console.log("🔐 INTENTANDO LOGIN");
    console.log("═══════════════════════════════════════");
    
    showMsg("Procesando...", "secondary");

    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const password = (document.getElementById("loginPassword")?.value || "").trim();

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      console.error("❌ Error de autenticación:", error);
      showMsg("❌ Credenciales incorrectas.", "danger");
      return;
    }
    
    console.log("✅ Autenticación exitosa - Email:", email);
    
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get("return");
    
    console.log("📋 Parámetros URL:", {
      return: returnTo,
      urlCompleta: window.location.href
    });
    
    if (returnTo === "carrito") {
      console.log("🛒 FLUJO DE CARRITO INVITADO DETECTADO");
      showMsg("✅ Bienvenido. Sincronizando tu carrito…", "success");
      
      const carritoLocal = localStorage.getItem("productos-en-carrito");
      console.log("📦 Carrito local encontrado:", carritoLocal ? "SÍ" : "NO");
      
      if (carritoLocal) {
        try {
          const items = JSON.parse(carritoLocal);
          console.log("📊 Items a migrar:", items.length);
          console.log("📋 Productos:");
          items.forEach((i, idx) => {
            console.log(`   ${idx+1}. ${i.titulo} - ${i.cantidad}x`);
          });
        } catch (e) {
          console.error("❌ Error parseando carrito:", e);
        }
      } else {
        console.warn("⚠️ No se encontró carrito en localStorage");
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      try {
        console.log("⏳ Esperando CartAPI...");
        
        let intentos = 0;
        while (!window.CartAPI && intentos < 20) {
          await new Promise(resolve => setTimeout(resolve, 100));
          intentos++;
          if (intentos % 5 === 0) {
            console.log(`   Intento ${intentos}/20...`);
          }
        }
        
        if (!window.CartAPI) {
          throw new Error("CartAPI no disponible después de 2 segundos");
        }
        
        console.log("✓ CartAPI disponible");
        
        if (typeof window.CartAPI.migrateToRemote !== "function") {
          throw new Error("CartAPI.migrateToRemote no es una función");
        }
        
        console.log("✓ Función migrateToRemote encontrada");
        
        console.log("🔄 EJECUTANDO MIGRACIÓN...");
        const resultado = await window.CartAPI.migrateToRemote();
        
        console.log("📊 Resultado de migración:", resultado);
        
        if (resultado.success) {
          console.log("✅ MIGRACIÓN EXITOSA:");
          console.log(`   • Productos procesados: ${resultado.itemsMigrados}`);
          console.log(`   • Productos fusionados: ${resultado.itemsFusionados}`);
          console.log(`   • Errores: ${resultado.errores}`);
          
          showMsg(`✅ Carrito sincronizado (${resultado.itemsMigrados} productos)`, "success");
        } else {
          console.warn("⚠️ Migración retornó success=false:", resultado);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        console.log("🔀 Redirigiendo a carrito...");
        console.log("═══════════════════════════════════════");
        
        window.location.href = "carrito.html";
        
      } catch (err) {
        console.error("═══════════════════════════════════════");
        console.error("❌ ERROR EN MIGRACIÓN:");
        console.error("   Mensaje:", err.message);
        console.error("   Stack:", err.stack);
        console.error("═══════════════════════════════════════");
        
        showMsg("⚠️ Login exitoso. Redirigiendo...", "warning");
        
        setTimeout(() => {
          window.location.href = "carrito.html";
        }, 1500);
      }
      
      return;
    }
    
    console.log("🏠 Flujo normal - redirigiendo según rol");
    console.log("═══════════════════════════════════════");
    
    showMsg("✅ Bienvenido. Verificando rol…", "success");
    await new Promise(resolve => setTimeout(resolve, 500));
    await goByRole();
  });

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMsg("Procesando registro...", "secondary");

    const email = (document.getElementById("registerEmail")?.value || "").trim();
    const password = (document.getElementById("registerPassword")?.value || "").trim();

    const { error } = await supabase.auth.signUp({
      email, 
      password,
      options: { data: { nombre: email.split("@")[0] } },
    });

    if (error) {
      console.error(error);
      showMsg("❌ No se pudo registrar. Revisa el correo o la contraseña.", "danger");
      return;
    }
    
    showMsg("✅ Cuenta creada. Revisa tu correo si se requiere verificación.", "success");
    wrapper?.classList.remove("active");
  });

  forgot?.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = prompt("Ingresa tu correo para recuperar la contraseña:");
    if (!email) return;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/" + LOGIN_URL,
    });
    
    if (error) {
      console.error(error);
      showMsg("❌ No se pudo enviar el correo de recuperación.", "danger");
      return;
    }
    
    showMsg("📧 Te enviamos un correo con las instrucciones.", "info");
  });
}

(async function init() {
  try {
    const isLoginPage = document.getElementById("loginForm") || document.getElementById("registerForm");
    
    if (!isLoginPage) {
      await autoWireAuthMenu();
    }

    if (isLoginPage) {
      console.log('🔐 Inicializando página de login con soporte de modo invitado...');
      await wireLoginPage();
    }
  } catch (e) {
    console.warn("Error en init:", e);
  }
})();

export async function requireAuth() {
  const { data } = await supabase.auth.getSession();
  if (!data?.session) {
    window.location.replace("login.html");
    throw new Error("Auth requerida");
  }
  return data.session.user;
}

window.supabase = supabase;

console.log('✅ ScriptLogin.js cargado con soporte de modo invitado (fusión de carritos)');