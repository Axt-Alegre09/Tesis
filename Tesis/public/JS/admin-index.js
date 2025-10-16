(function () {
  // -------- utilidades ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  // -------- menú usuario (admin) ----------
  const userBtn = $('#userMenuBtn');
  const userDropdown = $('#userDropdown');
  function closeMenu(e) {
    if (!userDropdown.contains(e.target) && !userBtn.contains(e.target)) {
      userDropdown.classList.remove('open');
      userBtn.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', closeMenu);
    }
  }
  userBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle('open');
    userBtn.setAttribute('aria-expanded', userDropdown.classList.contains('open') ? 'true' : 'false');
    if (userDropdown.classList.contains('open')) setTimeout(() => document.addEventListener('click', closeMenu), 0);
  });
  userDropdown?.querySelectorAll('[data-route]').forEach(btn => {
    btn.addEventListener('click', () => location.href = btn.getAttribute('data-route'));
  });

  // -------- aside móvil ----------
  const body = document.body;
  const toggle = $('#menuToggle');
  const closeBtn = $('#menuClose');
  const backdrop = $('#backdrop');
  const menuList = $('#menuList');
  const openAside  = () => { body.classList.add('aside-open');  toggle?.setAttribute('aria-expanded','true');  backdrop?.setAttribute('aria-hidden','false'); };
  const closeAside = () => { body.classList.remove('aside-open'); toggle?.setAttribute('aria-expanded','false'); backdrop?.setAttribute('aria-hidden','true'); };
  toggle?.addEventListener('click', openAside);
  closeBtn?.addEventListener('click', closeAside);
  backdrop?.addEventListener('click', closeAside);
  menuList?.querySelectorAll('a,button').forEach(el => el.addEventListener('click', closeAside));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAside(); });

  // -------- edición inline (lápices) ----------
  function findTarget(trigger) {
    const sel = trigger.getAttribute('data-target');
    if (!sel) return null;
    const scope = trigger.closest('.editable-wrap, .editable-card, main, aside') || document;
    return scope.querySelector(sel);
  }
  function toggleEdit(trigger) {
    const target = findTarget(trigger);
    if (!target) return;
    const editing = target.getAttribute('contenteditable') === 'true';
    if (editing) {
      target.setAttribute('contenteditable', 'false');
      target.classList.remove('is-editing');
      trigger.classList.remove('active');
      // TODO: persistir (Supabase)
    } else {
      target.setAttribute('contenteditable', 'true');
      target.classList.add('is-editing');
      trigger.classList.add('active');
      target.focus();
      const sel = window.getSelection();
      sel?.selectAllChildren(target);
      sel?.collapseToEnd();
    }
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-btn');
    if (btn && !btn.matches('.edit-logo')) {
      e.preventDefault();
      toggleEdit(btn);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target?.hasAttribute?.('contenteditable')) {
      e.preventDefault();
      e.target.blur();
      e.target.setAttribute('contenteditable', 'false');
      e.target.classList.remove('is-editing');
      // TODO: persistir
    }
  });

  // -------- edición de logo ----------
  const editLogoBtn = $('[data-action="edit-logo"]');
  const fileLogo = $('#fileLogo');
  const logoImg = $('#logoPrincipal');
  function changeLogoByUrl() {
    const url = prompt('Pegá la URL de la nueva imagen de logo:');
    if (url) logoImg.src = url;
  }
  editLogoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const useFile = confirm('¿Cargar imagen desde tu computadora?\n(Cancelar para pegar URL)');
    if (useFile) fileLogo?.click(); else changeLogoByUrl();
  });
  fileLogo?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    logoImg.src = url;
  });

  // -------- catálogo: mejora de cards + card “Agregar” ----------
  const grid = $('#contenedor-productos');
  const ADD_CLASS = 'producto--add';
  let isUpdating = false;
  let rafId = 0;

  function ensureAddCard() {
    if (!grid) return;
    // ¿existe?
    let add = grid.querySelector('.' + ADD_CLASS);
    if (!add) {
      add = document.createElement('article');
      add.className = 'producto ' + ADD_CLASS;
      add.innerHTML = `
        <button class="add-box" type="button" data-action="add-product">
          <span>Agregar<br>Producto</span>
          <i class="bi bi-plus-lg"></i>
        </button>`;
      grid.appendChild(add);          // <- una sola inserción
    } else if (grid.lastElementChild !== add) {
      grid.appendChild(add);          // <- solo mueve si NO es el último
    }
  }

  function enhanceCard(card) {
    if (!card || card.classList.contains('enhanced') || card.classList.contains(ADD_CLASS)) return;
    const title = card.querySelector('.producto-titulo');
    const price = card.querySelector('.producto-precio');
    const details = card.querySelector('.producto-detalles');
    if (!details) return;

    if (title && !title.closest('.editable-row')) {
      const row = document.createElement('div');
      row.className = 'editable-row';
      title.replaceWith(row);
      row.appendChild(title);
      const btn = document.createElement('button');
      btn.className = 'edit-btn small';
      btn.title = 'Editar nombre';
      btn.setAttribute('data-target', '.producto-titulo');
      btn.innerHTML = '<i class="bi bi-pencil"></i>';
      row.appendChild(btn);
    }
    if (price && !price.closest('.editable-row')) {
      const row = document.createElement('div');
      row.className = 'editable-row';
      price.replaceWith(row);
      row.appendChild(price);
      const btn = document.createElement('button');
      btn.className = 'edit-btn small';
      btn.title = 'Editar precio';
      btn.setAttribute('data-target', '.producto-precio');
      btn.innerHTML = '<i class="bi bi-pencil"></i>';
      row.appendChild(btn);
    }
    card.classList.add('editable-card', 'enhanced');
  }

  function processGrid() {
    if (!grid) return;
    isUpdating = true;
    grid.querySelectorAll('.producto').forEach(c => enhanceCard(c));
    ensureAddCard();
    // pequeña pausa para que el observer ignore nuestras mutaciones
    setTimeout(() => { isUpdating = false; }, 0);
  }

  // Primer procesado cuando DOM ya pintó algo (si main.js carga luego, igual el observer lo verá)
  document.addEventListener('DOMContentLoaded', processGrid);

  // Observer con debounced callback (evita loops)
  if (grid) {
    const observer = new MutationObserver(() => {
      if (isUpdating) return;               // ignorar cambios que nosotros mismos disparamos
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(processGrid);
    });
    observer.observe(grid, { childList: true, subtree: true });
  }

  // acción “agregar producto”
  document.addEventListener('click', (e) => {
    const add = e.target.closest('[data-action="add-product"]');
    if (!add) return;
    alert('Abrir formulario para crear un nuevo producto'); // <-- coloca tu modal/ruta aquí
  });
})();
