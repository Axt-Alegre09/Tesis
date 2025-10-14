// ====== CONFIGURACIÓN ======
const SUPABASE_URL = "https://jyygevitfnbwrvxrjexp.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5eWdldml0Zm5id3J2eHJqZXhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2OTQ2OTYsImV4cCI6MjA3MTI3MDY5Nn0.St0IiSZSeELESshctneazCJHXCDBi9wrZ28UkiEDXYo";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);


// ====== DOM ======
const app = document.querySelector('#app');
const vistaAuth = document.querySelector('#vistaAuth');
const btnIniciarSesion = document.querySelector('#btnIniciarSesion');
const btnCerrarSesion = document.querySelector('#btnCerrarSesion');
const msgLogin = document.querySelector('#msgLogin');


const secciones = {
    dashboard: document.querySelector('#sec-dashboard'),
    productos: document.querySelector('#sec-productos'),
    pedidos: document.querySelector('#sec-pedidos'),
    cms: document.querySelector('#sec-cms'),
    ajustes: document.querySelector('#sec-ajustes'),
};


// Navegación lateral
for (const link of document.querySelectorAll('[data-section]')) {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        for (const l of document.querySelectorAll('[data-section]')) l.classList.remove('active');
        link.classList.add('active');
        const sec = link.getAttribute('data-section');
        for (const k in secciones) secciones[k].hidden = (k !== sec);
        if (sec === 'productos') cargarProductos();
        if (sec === 'pedidos') cargarPedidos();
        if (sec === 'cms') cargarCMS();
        if (sec === 'dashboard') cargarDashboard();
    });
}

// ====== AUTENTICACIÓN ======
btnIniciarSesion?.addEventListener('click', async () => {
    const email = document.querySelector('#campoEmail').value.trim();
    const password = document.querySelector('#campoPassword').value;
    msgLogin.textContent = '';
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { msgLogin.textContent = error.message; return; }
    await exigirAdmin();
});


btnCerrarSesion?.addEventListener('click', async (e) => {
    e.preventDefault();
    await supabase.auth.signOut();
    app.hidden = true; vistaAuth.hidden = false;
});


async function exigirAdmin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { app.hidden = true; vistaAuth.hidden = false; return; }
    const { data: p, error } = await supabase.from('perfiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
    if (error) { msgLogin.textContent = error.message; return; }
    if (!p || !['owner', 'admin', 'manager'].includes(p.role)) {
        msgLogin.textContent = 'No tienes permisos de administrador.';
        await supabase.auth.signOut();
        return;
    }
    vistaAuth.hidden = true; app.hidden = false;
    document.querySelector('[data-section="dashboard"]').click();
}


supabase.auth.onAuthStateChange((_event, _session) => { exigirAdmin(); });




// ====== DASHBOARD ======
async function cargarDashboard() {
    const { data: ped } = await supabase.rpc('dashboard_resumen_30d');
    if (ped) {
        document.querySelector('#statVentas').textContent = formatoGs(ped.total_ventas || 0);
        document.querySelector('#statPedidos').textContent = ped.total_pedidos || 0;
        document.querySelector('#statClientes').textContent = ped.clientes_unicos || 0;
    }
    const { data: low } = await supabase.from('v_stock_bajo').select('*');
    document.querySelector('#statStockBajo').textContent = low ? low.length : '0';
}


function formatoGs(n) { return new Intl.NumberFormat('es-PY').format(Number(n || 0)) + ' Gs'; }


// ====== PRODUCTOS ======
const tablaProductos = document.querySelector('#tablaProductos');
const buscarProducto = document.querySelector('#buscarProducto');
const btnNuevoProducto = document.querySelector('#btnNuevoProducto');
const modalProducto = new bootstrap.Modal(document.querySelector('#modalProducto'));


let idEditando = null;


btnNuevoProducto.addEventListener('click', () => {
    idEditando = null; limpiarFormularioProducto();
    document.querySelector('#mpTitulo').textContent = 'Nuevo producto';
    modalProducto.show();
});


buscarProducto.addEventListener('input', cargarProductos);


document.querySelector('#btnGuardarProducto').addEventListener('click', guardarProducto);


function limpiarFormularioProducto() {
    document.querySelector('#pNombre').value = '';
    document.querySelector('#pPrecio').value = '';
    document.querySelector('#pStock').value = '';
    document.querySelector('#pCategoria').value = '';
    document.querySelector('#pSinonimos').value = '';
    document.querySelector('#pDescripcion').value = '';
    document.querySelector('#pImagen').value = '';
}


async function cargarProductos() {
    const term = buscarProducto.value?.trim();
    let q = supabase.from('productos').select('*').order('creado_en', { ascending: false }).limit(200);
    if (term) q = q.ilike('nombre', `%${term}%`);
    const { data, error } = await q;
    if (error) { alert('Error cargando productos: ' + error.message); return; }
    tablaProductos.innerHTML = (data || []).map(row => {
        const url = row.imagen_url || '';
        return `<tr>
<td><img src="${url}" class="img-miniatura" onerror="this.src='https://placehold.co/92'"/></td>
<td>${row.nombre || ''}</td>
<td>${formatoGs(row.precio || 0)}</td>
<td>${row.stock ?? ''}</td>
<td>${row.categoria || ''}</td>
<td class="text-end">
<button class="btn btn-sm btn-outline-primary" onclick="editarProducto('${row.id}')">Editar</button>
<button class="btn btn-sm btn-outline-danger ms-1" onclick="eliminarProducto('${row.id}')">Eliminar</button>
</td>
</tr>`;
    }).join('');
}

window.editarProducto = async (id) => {
    const { data, error } = await supabase.from('productos').select('*').eq('id', id).maybeSingle();
    if (error) { return alert(error.message); }
    idEditando = id;
    document.querySelector('#mpTitulo').textContent = 'Editar producto';
    document.querySelector('#pNombre').value = data?.nombre || '';
    document.querySelector('#pPrecio').value = data?.precio || '';
    document.querySelector('#pStock').value = data?.stock || '';
    document.querySelector('#pCategoria').value = data?.categoria || '';
    document.querySelector('#pSinonimos').value = (data?.sinonimos || []).join(', ');
    document.querySelector('#pDescripcion').value = data?.descripcion || '';
    modalProducto.show();
}


async function guardarProducto() {
    const nombre = document.querySelector('#pNombre').value.trim();
    const precio = Number(document.querySelector('#pPrecio').value || 0);
    const stock = Number(document.querySelector('#pStock').value || 0);
    const categoria = document.querySelector('#pCategoria').value.trim();
    const sinonimos = document.querySelector('#pSinonimos').value.split(',').map(s => s.trim()).filter(Boolean);
    const descripcion = document.querySelector('#pDescripcion').value.trim();


    let imagen_url = null;
    const file = document.querySelector('#pImagen').files[0];
    if (file) {
        const path = `productos/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: false });
        if (upErr) return alert('Error subiendo imagen: ' + upErr.message);
        const { data: pub } = supabase.storage.from('productos').getPublicUrl(path);
        imagen_url = pub?.publicUrl || null;
    }

    let payload = { nombre, precio, stock, categoria, sinonimos, descripcion };
    if (imagen_url) payload.imagen_url = imagen_url;


    let resp;
    if (!idEditando) resp = await supabase.from('productos').insert(payload).select('id').maybeSingle();
    else resp = await supabase.from('productos').update(payload).eq('id', idEditando);


    if (resp.error) return alert(resp.error.message);
    modalProducto.hide();
    cargarProductos();
}


window.eliminarProducto = async (id) => {
    if (!confirm('¿Eliminar producto?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', id);
    if (error) return alert(error.message);
    cargarProductos();
}

// ====== PEDIDOS ======
const tablaPedidos = document.querySelector('#tablaPedidos');
const filtroEstado = document.querySelector('#filtroEstado');
filtroEstado.addEventListener('change', cargarPedidos);


window.cambiarEstado = async (id, estado) => {
    const { error } = await supabase.from('pedidos').update({ estado }).eq('id', id);
    if (error) alert(error.message); else cargarPedidos();
};


async function cargarPedidos() {
    let q = supabase.from('pedidos').select('id, creado_en, estado, total, cliente_nombre').order('creado_en', { ascending: false }).limit(200);
    const f = filtroEstado.value;
    if (f) q = q.eq('estado', f);
    const { data, error } = await q;
    if (error) { alert('Error cargando pedidos: ' + error.message); return; }
    tablaPedidos.innerHTML = (data || []).map(row => {
        const fecha = new Date(row.creado_en).toLocaleString('es-PY');
        return `<tr>
<td>${fecha}</td>
<td>${row.cliente_nombre || ''}</td>
<td>
<select onchange="cambiarEstado('${row.id}', this.value)" class="form-select form-select-sm">
${['nuevo', 'confirmado', 'preparando', 'entregado', 'cancelado'].map(s => `<option ${s === row.estado ? 'selected' : ''}>${s}</option>`).join('')}
</select>
</td>
<td>${formatoGs(row.total || 0)}</td>
<td class="text-end"><a class="btn btn-sm btn-outline-secondary" href="pedido.html?id=${row.id}">Ver</a></td>
</tr>`;
    }).join('');
}

// ====== CMS ======
const listaCMS = document.querySelector('#listaCMS');
const btnNuevoCMS = document.querySelector('#btnNuevoCMS');


btnNuevoCMS.addEventListener('click', async () => {
    const slug = prompt('Slug (ej: banner-semana)');
    if (!slug) return;
    const { error } = await supabase.from('cms_blocks').insert({ slug, title: slug, content: { html: '<h3>Nuevo banner</h3>' } });
    if (error) alert(error.message); else cargarCMS();
});


async function cargarCMS() {
    const { data, error } = await supabase.from('cms_blocks').select('*').order('actualizado_en', { ascending: false });
    if (error) { alert(error.message); return; }
    listaCMS.innerHTML = (data || []).map(b => `
            <div class="col-12 col-md-6 col-xl-4">
            <div class="card h-100">
            <div class="card-body">
            <div class="d-flex align-items-start justify-content-between">
            <div>
            <div class="small text-muted">${b.slug}</div>
            <h6>${b.title || ''}</h6>
            </div>
            <div class="form-check form-switch">
            <input class="form-check-input" type="checkbox" ${b.activo ? 'checked' : ''} onchange="alternarCMS('${b.id}', this.checked)">
            </div>
            </div>
            <textarea class="form-control mt-2" rows="5" onchange="guardarCMS('${b.id}', this.value)">${JSON.stringify(b.content, null, 2)}</textarea>
            </div>
            <div class="card-footer d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-danger" onclick="eliminarCMS('${b.id}')">Eliminar</button>
            </div>
            </div>
            </div>
`).join('');
}
window.guardarCMS = async (id, raw) => {
    try {
        const content = JSON.parse(raw);
        const { error } = await supabase.from('cms_blocks').update({ content, actualizado_en: new Date().toISOString() }).eq('id', id);
        if (error) alert(error.message);
    } catch { alert('JSON inválido'); }
};


window.alternarCMS = async (id, activo) => {
    const { error } = await supabase.from('cms_blocks').update({ activo }).eq('id', id);
    if (error) alert(error.message);
};


window.eliminarCMS = async (id) => {
    if (!confirm('¿Eliminar bloque?')) return;
    const { error } = await supabase.from('cms_blocks').delete().eq('id', id);
    if (error) alert(error.message); else cargarCMS();
};