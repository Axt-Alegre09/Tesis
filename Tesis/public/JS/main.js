// JS/main.js - ESPERA A QUE SUPABASE ESTÉ DISPONIBLE
(function() {
  function esperarSupabase(callback) {
    if (window.supabase) {
      callback(window.supabase);
    } else {
      setTimeout(() => esperarSupabase(callback), 50);
    }
  }

  esperarSupabase(function(supabase) {
    console.log('✅ Supabase disponible, iniciando main.js');

    const contenedorProductos = document.querySelector("#contenedor-productos");
    const botonesCategorias = document.querySelectorAll(".boton-categoria");
    const tituloPrincipal = document.querySelector("#titulo-principal");

    let CATALOGO = [];
    let FAVORITOS_IDS = new Set();

    const IMG_FALLBACK = "https://placehold.co/512x512?text=Imagen";
    const STORAGE_BASE = "https://jyygevitfnbwrvxrjexp.supabase.co/storage/v1/object/public/productos/";

    const fmtGs = (n) =>
      new Intl.NumberFormat("es-PY").format(Number(n || 0)) + " Gs";

    const slug = (s) =>
      String(s || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/\s+/g, "-");

    const toImg = (v) => {
      if (!v) return IMG_FALLBACK;
      let s = String(v).trim();
      if (/^https?:\/\//i.test(s)) return s;
      if (s.toLowerCase().startsWith("productos/")) {
        s = s.slice("productos/".length);
      }
      return STORAGE_BASE + encodeURIComponent(s);
    };

    async function loadFavoritosIds() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc("get_favoritos");
        if (error) throw error;

        FAVORITOS_IDS = new Set((data || []).map((f) => f.producto_id));
      } catch (error) {
        console.error("Error cargar favoritos:", error);
      }
    }

    async function toggleFavorito(productoId, btn) {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          showToast("Debes iniciar sesión para guardar favoritos", "warning");
          setTimeout(() => (window.location.href = "login.html"), 1500);
          return;
        }

        btn.disabled = true;

        const { data, error } = await supabase.rpc("toggle_favorito", {
          p_producto_id: productoId,
        });

        if (error) throw error;

        const result = data[0];
        const esFavorito = result.es_favorito;

        if (esFavorito) {
          FAVORITOS_IDS.add(productoId);
        } else {
          FAVORITOS_IDS.delete(productoId);
        }

        updateFavoritoButton(btn, esFavorito);
        showToast(result.mensaje, "success");
      } catch (error) {
        console.error("Error toggle favorito:", error);
        showToast("Error al actualizar favorito", "error");
      } finally {
        btn.disabled = false;
      }
    }

    function updateFavoritoButton(btn, esFavorito) {
      const icon = btn.querySelector("i");
      if (!icon) return;

      if (esFavorito) {
        icon.classList.remove("bi-heart");
        icon.classList.add("bi-heart-fill");
        btn.classList.add("active");
      } else {
        icon.classList.remove("bi-heart-fill");
        icon.classList.add("bi-heart");
        btn.classList.remove("active");
      }

      btn.classList.add("animate");
      setTimeout(() => btn.classList.remove("animate"), 400);
    }

    function showToast(message, type = "success") {
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: ${
          type === "error" ? "#e74c3c" : type === "warning" ? "#f39c12" : "#27ae60"
        };
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10001;
        animation: slideInToast 0.3s ease;
        font-family: inherit;
      `;

      const style = document.createElement("style");
      style.textContent = `
        @keyframes slideInToast {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes slideOutToast {
          from { transform: translateX(0);   opacity: 1; }
          to   { transform: translateX(100%); opacity: 0; }
        }
      `;
      if (!document.querySelector("style[data-toast]")) {
        style.setAttribute("data-toast", "");
        document.head.appendChild(style);
      }

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.animation = "slideOutToast 0.3s ease";
        setTimeout(() => toast.remove(), 300);
      }, 3000);
    }

    async function fetchProductosCatalogo() {
      const { data, error } = await supabase
        .from("productos_con_promos")
        .select("*")
        .order("nombre");

      if (error) {
        console.error("Carga catálogo:", error);
        return [];
      }

      console.log('Productos cargados:', data?.length || 0);
      console.log('Con promo:', data?.filter(p => p.tiene_promo).length || 0);

      return (data || []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        titulo: p.nombre,
        imagen: toImg(p.imagen),
        precio: parseFloat(p.precio_original),
        precioConPromo: parseFloat(p.precio_con_promo),
        tienePromo: p.tiene_promo,
        descuentoPorcentaje: parseFloat(p.descuento_porcentaje || 0),
        ahorroGs: parseFloat(p.ahorro_gs || 0),
        promoNombre: p.promo_nombre,
        promoFin: p.promo_fin,
        categoria: { id: slug(p.categoria_nombre || ""), nombre: p.categoria_nombre },
      }));
    }

    async function fetchPopularesPortada(limit = 12) {
      const { data, error } = await supabase
        .from("productos_con_promos")
        .select("*")
        .limit(limit);

      if (error) {
        console.error("Populares:", error);
        return [];
      }

      return (data || []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        titulo: p.nombre,
        imagen: toImg(p.imagen),
        precio: parseFloat(p.precio_original),
        precioConPromo: parseFloat(p.precio_con_promo),
        tienePromo: p.tiene_promo,
        descuentoPorcentaje: parseFloat(p.descuento_porcentaje || 0),
        ahorroGs: parseFloat(p.ahorro_gs || 0),
        promoNombre: p.promo_nombre,
        promoFin: p.promo_fin,
        categoria: { id: slug(p.categoria_nombre || ""), nombre: p.categoria_nombre },
      }));
    }

    async function fetchFavoritos() {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          return { error: "not_authenticated", productos: [] };
        }

        const { data, error } = await supabase.rpc("get_favoritos");

        if (error) throw error;

        return {
          error: null,
          productos: (data || []).map((f) => ({
            id: f.producto_id,
            nombre: f.nombre,
            titulo: f.nombre,
            imagen: toImg(f.imagen),
            precio: f.precio,
            categoria: { nombre: f.categoria_nombre },
          })),
        };
      } catch (error) {
        console.error("Error cargar favoritos:", error);
        return { error: error.message, productos: [] };
      }
    }

    function montar(productos, esFavoritos = false) {
      contenedorProductos.innerHTML = "";

      if (!productos.length) {
        if (esFavoritos) {
          contenedorProductos.innerHTML = `
            <div class="empty-state">
              <i class="bi bi-heart" style="font-size: 4rem; opacity: 0.3;"></i>
              <p>Aún no tienes productos favoritos</p>
              <a href="index.html" class="btn-primary">Explorar productos</a>
            </div>
          `;
        } else {
          contenedorProductos.innerHTML =
            '<div class="alerta-vacia">No hay productos para mostrar.</div>';
        }
        return;
      }

      for (const producto of productos) {
        const div = document.createElement("div");
        div.className = "producto";
        div.dataset.id = producto.id;

        const esFav = FAVORITOS_IDS.has(producto.id);
        const tienePromo = producto.tienePromo;
        const descuento = Math.round(producto.descuentoPorcentaje || 0);
        
        const badgePromo = tienePromo ? `
          <div class="promo-badge">
            <i class="bi bi-tag-fill"></i>
            ${descuento}% OFF
          </div>
        ` : '';
        
        const preciosHTML = tienePromo ? `
          <div class="precios-con-promo">
            <span class="precio-original">${fmtGs(producto.precio)}</span>
            <b><p class="producto-precio">${fmtGs(producto.precioConPromo)}</p></b>
            <small class="ahorro-promo">¡Ahorrás ${fmtGs(producto.ahorroGs)}!</small>
          </div>
        ` : `
          <b><p class="producto-precio">${fmtGs(producto.precio)}</p></b>
        `;

        div.innerHTML = `
          ${badgePromo}
          <img class="producto-imagen" src="${
            producto.imagen || IMG_FALLBACK
          }" alt="${producto.titulo}">
          <button class="btn-favorito ${esFav ? "active" : ""}"
                  data-producto-id="${producto.id}"
                  aria-label="Favorito">
            <i class="bi ${esFav ? "bi-heart-fill" : "bi-heart"}"></i>
          </button>
          <div class="producto-detalles">
            <h3 class="producto-titulo">${producto.titulo}</h3>
            ${preciosHTML}
            <button class="producto-agregar" data-id="${producto.id}">Agregar</button>
          </div>
        `;

        div
          .querySelector(".producto-imagen")
          ?.addEventListener("error", (e) => (e.currentTarget.src = IMG_FALLBACK));

        contenedorProductos.appendChild(div);
      }

      document.querySelectorAll(".btn-favorito").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = e.currentTarget.dataset.productoId;
          toggleFavorito(id, e.currentTarget);
        });
      });

      document.querySelectorAll(".producto-agregar").forEach((btn) => {
        btn.addEventListener("click", async (e) => {
          const id = e.currentTarget.dataset.id;
          const prod =
            [...productos, ...CATALOGO].find(
              (p) => String(p.id) === String(id)
            ) || null;

          const fallbackProd =
            prod ||
            (() => {
              const card = e.currentTarget.closest(".producto");
              const nombre =
                card?.querySelector(".producto-titulo")?.textContent?.trim() ||
                "Producto";
              const precioText =
                card?.querySelector(".producto-precio")?.textContent || "0";
              const precioNum = Number(precioText.replace(/[^\d]/g, "") || 0);
              return {
                id,
                nombre,
                titulo: nombre,
                precio: precioNum,
                imagen: card?.querySelector("img")?.src || IMG_FALLBACK,
              };
            })();

          try {
            const precioFinal = prod?.tienePromo ? prod.precioConPromo : prod?.precio || fallbackProd.precio;
            
            await window.CartAPI.addProduct({
              ...fallbackProd,
              precio: precioFinal,
              precioOriginal: prod?.precio || fallbackProd.precio,
              tienePromo: prod?.tienePromo || false,
              descuentoPorcentaje: prod?.descuentoPorcentaje || 0
            }, 1);
            
            await window.CartAPI.refreshBadge();
            showToast("Producto agregado al carrito", "success");
          } catch (err) {
            console.error("addProduct:", err);
            showToast("No se pudo agregar. Intenta de nuevo.", "error");
          }
        });
      });
    }

    function wireCategorias() {
      botonesCategorias.forEach((boton) => {
        boton.addEventListener("click", () => {
          botonesCategorias.forEach((b) => b.classList.remove("active"));
          boton.classList.add("active");
          const filtro = slug(boton.id);
          if (filtro && filtro !== "todos") {
            const alguno = CATALOGO.find((p) => p.categoria.id === filtro);
            tituloPrincipal.textContent =
              alguno?.categoria?.nombre || "Productos";
            montar(CATALOGO.filter((p) => p.categoria.id === filtro));
          } else {
            tituloPrincipal.textContent = "Todos los productos";
            montar(CATALOGO);
          }
        });
      });
    }

    async function buscar(q) {
      const s = (q || "").trim();
      if (!s) {
        tituloPrincipal.textContent = "Todos los productos";
        montar(CATALOGO);
        return;
      }

      const { data, error } = await supabase
        .from("productos_con_promos")
        .select("*")
        .or(
          `nombre.ilike.%${s}%, descripcion.ilike.%${s}%, categoria_nombre.ilike.%${s}%`
        )
        .order("nombre");

      if (error) {
        console.error("buscar:", error);
        return;
      }

      const resultados = (data || []).map((p) => ({
        id: p.id,
        nombre: p.nombre,
        titulo: p.nombre,
        imagen: toImg(p.imagen),
        precio: parseFloat(p.precio_original),
        precioConPromo: parseFloat(p.precio_con_promo),
        tienePromo: p.tiene_promo,
        descuentoPorcentaje: parseFloat(p.descuento_porcentaje || 0),
        ahorroGs: parseFloat(p.ahorro_gs || 0),
        promoNombre: p.promo_nombre,
        promoFin: p.promo_fin,
        categoria: { id: slug(p.categoria_nombre || ""), nombre: p.categoria_nombre },
      }));

      tituloPrincipal.textContent = `Resultados para "${s}" (${resultados.length})`;
      montar(resultados);
    }

    async function init() {
      console.log('🚀 Ejecutando init()...');
      
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const categoria = urlParams.get("categoria");

      if (categoria === "favoritos") {
        tituloPrincipal.textContent = "Mis Favoritos";
        const { error, productos } = await fetchFavoritos();

        if (error === "not_authenticated") {
          contenedorProductos.innerHTML = `
            <div class="empty-state">
              <i class="bi bi-heart" style="font-size: 4rem; opacity: 0.3;"></i>
              <p>Debes iniciar sesión para ver tus favoritos</p>
              <a href="login.html" class="btn-primary">Iniciar sesión</a>
            </div>
          `;
          return;
        }

        await loadFavoritosIds();
        montar(productos, true);
        return;
      }

      CATALOGO = await fetchProductosCatalogo();
      await loadFavoritosIds();

      window.__PRODUCTS__ = CATALOGO.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        titulo: p.titulo,
        precio: p.tienePromo ? p.precioConPromo : p.precio,
        precioOriginal: p.precio,
        imagen: p.imagen,
        tienePromo: p.tienePromo,
        descuentoPorcentaje: p.descuentoPorcentaje
      }));

      let itemsHome = [];
      try {
        const pop = await fetchPopularesPortada(12);
        if (pop.length) {
          tituloPrincipal.textContent = "Populares";
          itemsHome = pop;
        }
        if (!itemsHome.length) {
          tituloPrincipal.textContent = "Todos los productos";
          itemsHome = CATALOGO;
        }
      } catch (e) {
        console.warn("Home feed:", e);
        tituloPrincipal.textContent = "Todos los productos";
        itemsHome = CATALOGO;
      }

      montar(itemsHome);
      wireCategorias();
      await window.CartAPI.refreshBadge();

      const form = document.getElementById("searchForm");
      const input = document.getElementById("searchInput");
      form?.addEventListener("submit", (e) => {
        e.preventDefault();
        buscar(input.value);
      });
      input?.addEventListener("keyup", (e) => {
        if (e.key === "Enter") buscar(input.value);
        if (!input.value) {
          tituloPrincipal.textContent = "Todos los productos";
          montar(CATALOGO);
        }
      });
      
      console.log('✅ init() completado');
      
      } catch (error) {
        console.error('❌ ERROR EN INIT:', error);
        console.error('Stack:', error.stack);
        contenedorProductos.innerHTML = `
          <div class="alerta-vacia">
            <h3>Error al cargar productos</h3>
            <p>${error.message}</p>
            <button onclick="location.reload()">Recargar página</button>
          </div>
        `;
      }
    }

    // User Menu Dropdown
    (() => {
      const menuWrap = document.querySelector(".user-menu");
      const btn = document.getElementById("userMenuBtn");
      const dd = document.getElementById("userDropdown");

      if (!menuWrap || !btn || !dd) return;

      if (
        !getComputedStyle(menuWrap).position ||
        getComputedStyle(menuWrap).position === "static"
      ) {
        menuWrap.style.position = "relative";
      }

      btn.setAttribute("aria-haspopup", "true");
      btn.setAttribute("aria-expanded", "false");

      const open = () => {
        dd.classList.add("open");
        btn.classList.add("active");
        btn.setAttribute("aria-expanded", "true");
      };
      const close = () => {
        dd.classList.remove("open");
        btn.classList.remove("active");
        btn.setAttribute("aria-expanded", "false");
      };
      const toggle = () =>
        dd.classList.contains("open") ? close() : open();

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      });

      document.addEventListener("click", (e) => {
        if (!menuWrap.contains(e.target)) close();
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") close();
      });
    })();

    // Mobile aside toggle
    (() => {
      const body = document.body;
      const aside = document.getElementById("mobileAside");
      const toggleBtn = document.getElementById("menuToggle");
      const closeBtn = document.getElementById("menuClose");

      if (!aside || !toggleBtn) return;

      let backdrop = document.querySelector(".backdrop");
      if (!backdrop) {
        backdrop = document.createElement("div");
        backdrop.className = "backdrop";
        body.appendChild(backdrop);
      }

      const mq = window.matchMedia("(max-width: 900px)");

      const openAside = () => {
        if (!mq.matches) return;
        body.classList.add("aside-open");
        toggleBtn.setAttribute("aria-expanded", "true");
      };

      const closeAside = () => {
        body.classList.remove("aside-open");
        toggleBtn.setAttribute("aria-expanded", "false");
      };

      const toggleAside = () => {
        if (body.classList.contains("aside-open")) {
          closeAside();
        } else {
          openAside();
        }
      };

      toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleAside();
      });

      closeBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        closeAside();
      });

      backdrop.addEventListener("click", () => {
        closeAside();
      });

      window.addEventListener("resize", () => {
        if (!mq.matches) {
          closeAside();
        }
      });

      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && body.classList.contains("aside-open")) {
          closeAside();
        }
      });
    })();

    // Event listeners del menú
    document.getElementById("favoritosBtn")?.addEventListener("click", () => {
      window.location.href = "index.html?categoria=favoritos";
    });

    document.getElementById("metodosBtn")?.addEventListener("click", () => {
      window.location.href = "metodos-pago.html";
    });

    document.getElementById("soporteBtn")?.addEventListener("click", async () => {
      const { data: { user } } = await supabase.auth.getUser();

      let nombre = "Cliente";
      if (user) {
        const { data: perfil } = await supabase
          .from("clientes_perfil")
          .select("razon")
          .eq("user_id", user.id)
          .maybeSingle();

        if (perfil?.razon) {
          nombre = perfil.razon;
        } else if (user.user_metadata?.nombre) {
          nombre = user.user_metadata.nombre;
        } else if (user.email) {
          nombre = user.email.split("@")[0];
        }
      }

      const mensaje = encodeURIComponent(
        `Hola, soy ${nombre}, vengo de Paniquiños por un problema!`
      );
      const whatsappURL = `https://wa.me/595992544305?text=${mensaje}`;
      window.open(whatsappURL, "_blank");
    });

    document.getElementById("historialBtn")?.addEventListener("click", () => {
      window.location.href = "historial.html";
    });

    // EJECUTAR INIT
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  });
})();