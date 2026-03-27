/* SILBER GESTIÓN — ui.js */

function renderizarTablaPrecios() {
    if (typeof estado === 'undefined' || !estado) return;
    var container = document.getElementById('tabla-precios');
    if (!container) return;
    var sp = estado.stockProductos;
    if (!sp) return;
    container.innerHTML = '';
    const esV = cat => cat === 'Verde' || cat.includes('Brócoli');

    // Cabecera
    const header = document.createElement('div');
    header.style.cssText = 'display:grid;grid-template-columns:1fr 52px 52px 56px 36px;gap:4px;padding:4px 8px;margin-bottom:4px;';
    header.innerHTML = `
        <div style="font-size:10px;font-weight:700;color:var(--text-secondary);">PRODUCTO</div>
        <div style="font-size:10px;font-weight:700;color:var(--text-secondary);text-align:center;">€</div>
        <div style="font-size:10px;font-weight:700;color:var(--text-secondary);text-align:center;">G/U</div>
        <div style="font-size:10px;font-weight:700;color:var(--text-secondary);text-align:center;">STOCK</div>
        <div></div>
    `;
    container.appendChild(header);

    Object.keys(sp).forEach(cat => {
        const prod = sp[cat];
        const color = esV(cat) ? '#10B981' : '#3B82F6';
        const stockBajo = prod.stock <= 5;
        const row = document.createElement('div');
        row.style.cssText = `display:grid;grid-template-columns:1fr 52px 52px 56px 36px;gap:4px;align-items:center;padding:10px 8px;background:rgba(14,165,233,0.05);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;`;

        const lblCat = document.createElement('div');
        lblCat.style.cssText = `font-size:12px;font-weight:700;color:${color};`;
        lblCat.textContent = cat;

        const lblPrecio = document.createElement('div');
        lblPrecio.style.cssText = 'font-size:12px;font-weight:800;color:var(--text-primary);text-align:center;';
        lblPrecio.textContent = prod.precio + '€';

        const lblGramaje = document.createElement('div');
        lblGramaje.style.cssText = `font-size:12px;font-weight:800;color:${color};text-align:center;`;
        lblGramaje.textContent = prod.gramaje + 'g';

        const lblStock = document.createElement('div');
        lblStock.style.cssText = `font-size:12px;font-weight:900;color:${stockBajo ? '#EF4444' : '#10B981'};text-align:center;`;
        lblStock.textContent = (prod.stock || 0).toFixed(1) + 'g';

        const btnEdit = document.createElement('button');
        btnEdit.textContent = '✏️';
        btnEdit.style.cssText = 'background:rgba(14,165,233,0.15);border:1px solid var(--border);border-radius:8px;font-size:14px;width:30px;height:30px;cursor:pointer;flex-shrink:0;';
        btnEdit.dataset.cat = cat;
        btnEdit.addEventListener('click', function() {
            abrirEditarProducto(this.dataset.cat);
        });
        if (typeof esMaster === 'function' && !esMaster()) btnEdit.style.display = 'none';

        row.appendChild(lblCat);
        row.appendChild(lblPrecio);
        row.appendChild(lblGramaje);
        row.appendChild(lblStock);
        row.appendChild(btnEdit);
        container.appendChild(row);
    });
}

function abrirEditarProducto(cat) {
    const prod = estado.stockProductos[cat];
    if (!prod) return;
    document.getElementById('edit-producto-key').value = cat;
    document.getElementById('edit-producto-nombre').textContent = cat;
    document.getElementById('edit-precio').value = prod.precio;
    document.getElementById('edit-gramaje').value = prod.gramaje;
    document.getElementById('edit-stock').value = prod.stock || 0;
    document.getElementById('modalEditarProducto').classList.add('active');
}

function cerrarEditarProducto() {
    document.getElementById('modalEditarProducto').classList.remove('active');
}

function guardarEditarProducto() {
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo / Jefaza pueden modificar la tabla de precios.');
        return;
    }
    var doSave = function() {
        const cat = document.getElementById('edit-producto-key').value;
        const precio   = parseFloat(document.getElementById('edit-precio').value);
        const gramaje  = parseFloat(document.getElementById('edit-gramaje').value);
        const stock    = parseFloat(document.getElementById('edit-stock').value);
        if (!cat || isNaN(precio) || precio <= 0) { alert('Precio inválido'); return; }
        if (isNaN(gramaje) || gramaje <= 0)        { alert('Gramaje inválido'); return; }
        if (isNaN(stock)   || stock < 0)           { alert('Stock inválido'); return; }
        estado.stockProductos[cat] = { precio, gramaje, stock };
        const esV = n => n === 'Verde' || n.includes('Brócoli');
        estado.stockTotalB = Object.keys(estado.stockProductos)
            .filter(n => !esV(n))
            .reduce((s, n) => s + (estado.stockProductos[n].stock || 0), 0);
        estado.stockTotalV = Object.keys(estado.stockProductos)
            .filter(n => esV(n))
            .reduce((s, n) => s + (estado.stockProductos[n].stock || 0), 0);
        guardarEstado();
        cerrarEditarProducto();
        renderizarTablaPrecios();
        actualizarSaldos();
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'PRICE_TABLE_EDIT', details: 'Editó producto: ' + cat + ' (precio/gramaje/stock)' });
        if (typeof notifyOtherMaster === 'function') notifyOtherMaster('Cambió la tabla de precios');
    };
    // Sin bloqueo biométrico aquí: evita frenar ajustes rápidos de stock en operación diaria.
    doSave();
}

// Stubs legacy: no-op. La edición/borrado de precios se hace con abrirEditarProducto (modal).
function eliminarFilaPrecio() {}
function editarFilaPrecio() {}

function renderizarListaStock() {
    const container = document.getElementById('lista-stock');
    if (!container) return;
    if (!estado.listaStock || estado.listaStock.length === 0) {
        container.innerHTML = '<div class="empty-state-text" style="font-size:12px;color:var(--text-secondary);">Sin entradas de stock</div>';
        return;
    }
    container.innerHTML = '';
    [...estado.listaStock].reverse().forEach(entrada => {
        const div = document.createElement('div');
        div.className = 'historial-item';
        const color = entrada.tipo === 'recargaB' ? '#3B82F6' : '#10B981';
        div.innerHTML = `
            <div class="historial-header">
                <div class="historial-tipo" style="color:${color};">${entrada.nombre}</div>
                <div class="historial-fecha">${entrada.fecha}</div>
            </div>
            <div class="historial-monto" style="color:${color};">+${entrada.gramos}g (${entrada.monto}€)</div>
        `;
        container.appendChild(div);
    });
}

function cambiarPantalla(pantalla) {
    try {
        if (typeof estado === 'undefined') { estado = (typeof window !== 'undefined' && window.estado) ? window.estado : { historialPantallas: ['dashboard'] }; }
        if (!estado.historialPantallas || !estado.historialPantallas.length) estado.historialPantallas = ['dashboard'];
        if (estado.historialPantallas[estado.historialPantallas.length - 1] !== pantalla) {
            estado.historialPantallas.push(pantalla);
        }
        // Evita overlays "fantasma" que bloquean taps al navegar entre pantallas.
        var activeModals = document.querySelectorAll('.modal-overlay.active');
        if (activeModals && activeModals.length) {
            for (var m = 0; m < activeModals.length; m++) activeModals[m].classList.remove('active');
        }
        var resetModal = document.getElementById('modal-reset-confirm');
        if (resetModal && resetModal.style.display && resetModal.style.display !== 'none') resetModal.style.display = 'none';
        var screens = document.querySelectorAll('.screen');
        if (screens && screens.length) { for (var i = 0; i < screens.length; i++) { screens[i].classList.remove('active'); screens[i].style.display = 'none'; screens[i].style.visibility = 'hidden'; } }
        var target = document.getElementById('screen-' + pantalla);
        if (target) {
            target.classList.add('active');
            target.style.display = 'block';
            target.style.visibility = 'visible';
            if (typeof window._silberDebug === 'function') window._silberDebug('screen-visible', pantalla);
        } else {
            if (typeof console !== 'undefined' && console.warn) console.warn('[Silber] screen not found: screen-' + pantalla);
        }
        var navItems = document.querySelectorAll('.nav-item');
        if (navItems && navItems.length) { for (var j = 0; j < navItems.length; j++) { navItems[j].classList.remove('active'); } }
        var navItem = document.querySelector('.nav-item[data-screen="' + pantalla + '"]');
        if (navItem) navItem.classList.add('active');
        var backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.classList.toggle('visible', pantalla !== 'dashboard');
        var menuOverlay = document.getElementById('menuOverlay');
        if (menuOverlay) { menuOverlay.classList.remove('active'); menuOverlay.style.display = 'none'; }
        cerrarMenu();
        if (pantalla === 'oficina' && typeof actualizarEstadoBiometria === 'function') { try { actualizarEstadoBiometria(); } catch (e) {} }
        if (pantalla === 'gastos' && typeof renderizarDesgloseGastos === 'function') { try { renderizarDesgloseGastos(); } catch (e) {} }
        if (pantalla === 'ingresos' && typeof renderizarDesgloseIngresos === 'function') { try { renderizarDesgloseIngresos(); } catch (e) {} }
        if (pantalla === 'transferencias' && typeof renderizarHistorialTransferencias === 'function') { try { renderizarHistorialTransferencias(); } catch (e) {} }
        if (pantalla === 'stock') {
            try {
                var elB = document.getElementById('coste-gramo-b');
                var elV = document.getElementById('coste-gramo-v');
                if (elB && estado) elB.value = estado.costePorGramoB || 22;
                if (elV && estado) elV.value = estado.costePorGramoV || 1;
            } catch (e) {}
        }
        if (pantalla === 'metricas' && typeof renderizarMetricas === 'function') { try { renderizarMetricas(); } catch (e) {} }
        if (pantalla === 'timeline' && typeof renderBusinessTimeline === 'function') { try { renderBusinessTimeline(); } catch (e) {} }
        if (pantalla === 'productos' && typeof renderProductos === 'function') { try { renderProductos(); } catch (e) {} }
        if (pantalla === 'dashboard') {
            if (typeof window._silberDebug === 'function') window._silberDebug('dashboard-render-start');
            try {
                if (typeof renderDashboardProductosAlerta === 'function') renderDashboardProductosAlerta();
                if (typeof actualizarSaldos === 'function') actualizarSaldos();
                if (typeof renderizarRanking === 'function') renderizarRanking();
                if (typeof actualizarTimeMachine === 'function') actualizarTimeMachine();
            } catch (e) { if (typeof console !== 'undefined' && console.warn) console.warn('[Silber] dashboard render:', e); }
            setTimeout(function() {
                try {
                    if (typeof window.initDonutCanvas === 'function') window.initDonutCanvas();
                    else if (typeof dibujarDonut === 'function') dibujarDonut();
                    if (typeof actualizarSaldos === 'function') actualizarSaldos();
                    if (typeof window._silberDebug === 'function') window._silberDebug('dashboard-render-done');
                } catch (e) { if (typeof console !== 'undefined' && console.warn) console.warn('[Silber] dashboard setTimeout:', e); }
            }, 120);
        }
        if (navigator.vibrate) navigator.vibrate(30);
    } catch (e) {
        if (typeof console !== 'undefined' && console.error) console.error('[Silber] cambiarPantalla error:', e);
        var fallbackTarget = document.getElementById('screen-' + pantalla);
        if (fallbackTarget) { fallbackTarget.classList.add('active'); fallbackTarget.style.display = 'block'; fallbackTarget.style.visibility = 'visible'; }
    }
}

function volverAtras() {
    try {
        var loginEl = document.getElementById('screen-login');
        if (loginEl && loginEl.classList.contains('active')) return;
        if (typeof estado === 'undefined' || !estado.historialPantallas || estado.historialPantallas.length <= 1) return;
        estado.historialPantallas.pop();
        var anterior = estado.historialPantallas[estado.historialPantallas.length - 1];
        var screens = document.querySelectorAll('.screen');
        if (screens && screens.length) { for (var i = 0; i < screens.length; i++) { screens[i].classList.remove('active'); } }
        var prevScreen = document.getElementById('screen-' + anterior);
        if (prevScreen) { prevScreen.classList.add('active'); prevScreen.style.display = 'block'; prevScreen.style.visibility = 'visible'; }
        var navItems = document.querySelectorAll('.nav-item');
        if (navItems && navItems.length) { for (var j = 0; j < navItems.length; j++) { navItems[j].classList.remove('active'); } }
        var navItem = document.querySelector('.nav-item[data-screen="' + anterior + '"]');
        if (navItem) navItem.classList.add('active');
        var backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.classList.toggle('visible', anterior !== 'dashboard');
        cerrarMenu();
        if (navigator.vibrate) navigator.vibrate(30);
    } catch (e) { if (typeof console !== 'undefined' && console.warn) console.warn('[Silber] volverAtras:', e); }
}

function toggleMenu() {
    var o = document.getElementById('menuOverlay');
    if (!o) return;
    o.classList.toggle('active');
    o.style.display = o.classList.contains('active') ? '' : 'none';
}

function cerrarMenu() {
    var o = document.getElementById('menuOverlay');
    if (o) { o.classList.remove('active'); o.style.display = 'none'; }
}

function abrirOficinaView(viewId) {
    var oficinaScreen = document.getElementById('screen-oficina');
    if (!oficinaScreen) return;
    var views = oficinaScreen.querySelectorAll('.oficina-view');
    if (views && views.length) {
        for (var i = 0; i < views.length; i++) views[i].style.display = 'none';
    }
    var target = document.getElementById(viewId || 'oficina-main');
    if (target) target.style.display = (viewId === 'oficina-guia') ? 'flex' : 'block';

    var fab = document.getElementById('oficina-fab-add-cliente');
    if (fab) fab.style.display = (viewId === 'oficina-guia') ? 'none' : '';
}
if (typeof window !== 'undefined') window.abrirOficinaView = abrirOficinaView;

// ===== GESTIÓN BIOMETRÍA EN OFICINA =====
function actualizarEstadoBiometria() {
    const slots = [
        { idx: 1, key: 'silber_webauthn_id',   estadoEl: 'bio1-estado', btnEl: 'bio1-btn' },
        { idx: 2, key: 'silber_webauthn_id_2', estadoEl: 'bio2-estado', btnEl: 'bio2-btn' }
    ];
    slots.forEach(s => {
        const estadoEl = document.getElementById(s.estadoEl);
        const btnEl    = document.getElementById(s.btnEl);
        if (!estadoEl || !btnEl) return;
        const registrada = !!localStorage.getItem(s.key);
        if (registrada) {
            estadoEl.textContent = '✅ Registrada';
            estadoEl.style.color = '#10B981';
            btnEl.textContent    = 'Eliminar';
            btnEl.style.background = 'rgba(239,68,68,0.12)';
            btnEl.style.borderColor = 'rgba(239,68,68,0.4)';
            btnEl.style.color = '#EF4444';
        } else {
            estadoEl.textContent = '— No registrada';
            estadoEl.style.color = 'var(--text-secondary)';
            btnEl.textContent    = 'Registrar';
            btnEl.style.background = 'rgba(14,165,233,0.12)';
            btnEl.style.borderColor = 'rgba(14,165,233,0.4)';
            btnEl.style.color = '#00E5FF';
        }
    });
}

async function gestionarBiometria(num) {
    const key     = num === 1 ? 'silber_webauthn_id' : 'silber_webauthn_id_2';
    const titulo  = `Biometría ${num}`;
    const modal   = document.getElementById('modalBiometria');
    const tituloEl = document.getElementById('bio-modal-titulo');
    const msgEl    = document.getElementById('bio-modal-msg');
    const accsEl   = document.getElementById('bio-modal-acciones');

    tituloEl.textContent = titulo;
    accsEl.innerHTML = '';
    modal.classList.add('active');

    const registrada = !!localStorage.getItem(key);

    if (registrada) {
        // Opción: eliminar
        msgEl.textContent = `Esta biometría está registrada. Puedes eliminarla si quieres reemplazarla por otra.`;
        const btnEliminar = document.createElement('button');
        btnEliminar.className = 'btn btn-full';
        btnEliminar.style.cssText = 'background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.5);border-radius:10px;padding:12px;color:#EF4444;font-weight:700;cursor:pointer;';
        btnEliminar.textContent = '🗑️ Eliminar biometría';
        btnEliminar.onclick = () => {
            if (!confirm(`¿Eliminar ${titulo}? Tendrás que volver a registrarla para usarla.`)) return;
            localStorage.removeItem(key);
            cerrarModalBiometria();
            actualizarEstadoBiometria();
        };
        accsEl.appendChild(btnEliminar);
    } else {
        // Opción: registrar
        if (!window.PublicKeyCredential) {
            msgEl.textContent = 'Este dispositivo o navegador no soporta biometría (WebAuthn).';
            return;
        }
        const rpId = window.location.hostname;
        if (!rpId || rpId === 'localhost') {
            msgEl.textContent = 'El registro biométrico requiere HTTPS. Abre la app desde tu URL de Vercel.';
            return;
        }
        msgEl.textContent = `Pulsa el botón para registrar ${titulo} con Face ID o Huella en este dispositivo.`;
        const btnRegistrar = document.createElement('button');
        btnRegistrar.className = 'btn btn-primary btn-full';
        btnRegistrar.textContent = '🔒 Registrar ahora';
        btnRegistrar.onclick = async () => {
            btnRegistrar.disabled = true;
            btnRegistrar.textContent = 'Esperando biometría...';
            msgEl.textContent = 'Sigue las instrucciones del dispositivo para registrar tu huella o Face ID.';
            try {
                const sesion = JSON.parse(localStorage.getItem('silber_biometric_creds') || '{}');
                const userId = crypto.getRandomValues(new Uint8Array(16));
                const cred = await navigator.credentials.create({ publicKey: {
                    challenge: crypto.getRandomValues(new Uint8Array(32)),
                    rp: { name: 'Silber Gestión', id: rpId },
                    user: { id: userId, name: `${sesion.usuario || 'usuario'}_bio${num}`, displayName: `Bio ${num}` },
                    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
                    timeout: 60000
                }});
                const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
                localStorage.setItem(key, credId);
                msgEl.textContent = `✅ ${titulo} registrada correctamente.`;
                msgEl.style.color = '#10B981';
                accsEl.innerHTML = '';
                actualizarEstadoBiometria();
                setTimeout(() => cerrarModalBiometria(), 1200);
            } catch(e) {
                btnRegistrar.disabled = false;
                btnRegistrar.textContent = '🔒 Registrar ahora';
                msgEl.textContent = e.name === 'NotAllowedError'
                    ? '❌ Cancelado. Pulsa el botón para intentarlo de nuevo.'
                    : `❌ Error: ${e.message}`;
                msgEl.style.color = '#EF4444';
            }
        };
        accsEl.appendChild(btnRegistrar);
    }
}

function cerrarModalBiometria() {
    const modal = document.getElementById('modalBiometria');
    if (modal) modal.classList.remove('active');
    const msgEl = document.getElementById('bio-modal-msg');
    if (msgEl) msgEl.style.color = 'var(--text-secondary)';
}

function desactivarBiometriaSesionActual() {
    try {
        localStorage.removeItem('silber_biometric_creds');
        localStorage.removeItem('silber_webauthn_id');
        localStorage.removeItem('silber_webauthn_id_2');
        localStorage.setItem('silber_biometric_enabled', '0');
        if (typeof mostrarToast === 'function') mostrarToast('✅ PIN/biometría desactivado para esta sesión', 'info');
        else alert('PIN/biometría desactivado');
        if (typeof actualizarEstadoBiometria === 'function') actualizarEstadoBiometria();
        console.log('[BIO] desactivada manualmente por usuario');
    } catch (e) {
        console.warn('[BIO] no se pudo desactivar:', e);
    }
}
if (typeof window !== 'undefined') window.desactivarBiometriaSesionActual = desactivarBiometriaSesionActual;
document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('btn-disable-bio');
    if (!btn) return;
    btn.addEventListener('click', function() {
        if (!confirm('¿Desactivar PIN/biometría para esta cuenta en este dispositivo?')) return;
        desactivarBiometriaSesionActual();
    });
});

let _gestorTipo = 'gasto'; // 'gasto' | 'ingreso'
let _editCatIdx = null;

function abrirGestorCategorias(tipo) {
    _gestorTipo = tipo;
    document.getElementById('gestor-cat-titulo').textContent = tipo === 'gasto' ? '⚙️ Categorías de Gastos' : '⚙️ Categorías de Ingresos';
    document.getElementById('gestor-cat-sub').textContent = tipo === 'gasto' ? 'Gestiona tus botones de gasto' : 'Gestiona tus botones de ingreso';
    document.getElementById('nueva-cat-nombre').value = '';
    document.getElementById('nueva-cat-emoji').value = '';
    renderizarGestorLista();
    document.getElementById('modalGestorCategorias').classList.add('active');
    if (navigator.vibrate) navigator.vibrate(30);
}

function renderizarGestorLista() {
    const lista = document.getElementById('gestor-cat-lista');
    if (!lista) return;
    const cats = _gestorTipo === 'gasto' ? estado.categoriasGastos : estado.categoriasIngresos;
    if (cats.length === 0) {
        lista.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:8px 0;">Sin categorías</div>';
        return;
    }
    lista.innerHTML = '';
    cats.forEach((cat, idx) => {
        // Detectar si icono es SVG o emoji
        const esEmoji = !cat.icon.includes('<svg');
        const preview = esEmoji
            ? `<span style="font-size:26px;line-height:1;">${cat.icon}</span>`
            : `<span style="display:inline-flex;opacity:0.9;">${cat.icon}</span>`;
        const fila = document.createElement('div');
        fila.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;margin-bottom:5px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);';
        fila.innerHTML = `
            <div style="width:38px;height:38px;border-radius:10px;background:rgba(14,165,233,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">${preview}</div>
            <div style="flex:1;font-size:13px;font-weight:700;color:var(--text-primary);">${cat.nombre}</div>
            <button onclick="abrirEditCategoria(${idx})" style="background:rgba(14,165,233,0.15);border:1px solid rgba(14,165,233,0.4);border-radius:8px;padding:5px 8px;font-size:14px;cursor:pointer;color:#0EA5E9;">✏️</button>
            <button onclick="eliminarCategoria(${idx}, this)" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:5px 8px;cursor:pointer;color:#EF4444;display:flex;align-items:center;justify-content:center;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg></button>
        `;
        lista.appendChild(fila);
    });
}

function crearCategoria() {
    const nombre = document.getElementById('nueva-cat-nombre').value.trim();
    const emoji  = document.getElementById('nueva-cat-emoji').value.trim();
    if (!nombre) { alert('Escribe un nombre para la categoría'); return; }
    const icon = emoji || '📁';
    const nueva = { nombre, color: '#0EA5E9', icon, esRecarga: false };
    if (_gestorTipo === 'gasto') estado.categoriasGastos.push(nueva);
    else                          estado.categoriasIngresos.push(nueva);
    guardarEstado();
    renderizarGestorLista();
    if (_gestorTipo === 'gasto') renderizarCategoriasGastos();
    else                          renderizarCategoriasIngresos();
    document.getElementById('nueva-cat-nombre').value = '';
    document.getElementById('nueva-cat-emoji').value = '';
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function abrirEditCategoria(idx) {
    _editCatIdx = idx;
    const cats = _gestorTipo === 'gasto' ? estado.categoriasGastos : estado.categoriasIngresos;
    const cat = cats[idx];
    document.getElementById('edit-cat-nombre').value = cat.nombre;
    // Solo ponemos emoji si no es SVG
    document.getElementById('edit-cat-emoji').value = cat.icon.includes('<svg') ? '' : cat.icon;
    document.getElementById('modalEditCategoria').classList.add('active');
}

function guardarEditCategoria() {
    const nombre = document.getElementById('edit-cat-nombre').value.trim();
    const emoji  = document.getElementById('edit-cat-emoji').value.trim();
    if (!nombre) { alert('El nombre no puede estar vacío'); return; }
    const cats = _gestorTipo === 'gasto' ? estado.categoriasGastos : estado.categoriasIngresos;
    const cat = cats[_editCatIdx];
    cat.nombre = nombre;
    if (emoji) cat.icon = emoji; // solo sustituir si escribió emoji, si no conservar SVG
    guardarEstado();
    document.getElementById('modalEditCategoria').classList.remove('active');
    renderizarGestorLista();
    if (_gestorTipo === 'gasto') renderizarCategoriasGastos();
    else                          renderizarCategoriasIngresos();
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function eliminarCategoria(idx, btnEl) {
    const cats = _gestorTipo === 'gasto' ? estado.categoriasGastos : estado.categoriasIngresos;
    const nombre = cats[idx].nombre;
    _confirmarBorrado(btnEl, `¿Eliminar la categoría "${nombre}"?\n\nEsta acción no se puede deshacer.`, () => {
        cats.splice(idx, 1);
        guardarEstado();
        renderizarGestorLista();
        if (_gestorTipo === 'gasto') renderizarCategoriasGastos();
        else                          renderizarCategoriasIngresos();
        if (navigator.vibrate) navigator.vibrate([30,50,30]);
    });
}

// ===== BORRADO CON DOS CAPAS DE SEGURIDAD =====
// Capa 1: Dialog de confirmación UI
// Capa 2: Biometría (Face ID / Huella) si está disponible
// Feedback visual: el botón se deshabilita y cambia color mientras espera
// ===== BORRADO SEGURO — DOS CAPAS =====
// handleDelete(id, btnEl, label, onDeleteConfirmed)
// Capa 1: Modal propio con texto exacto + botones "Sí, eliminar" / "Cancelar"
// Capa 2: Biometría WebAuthn (Face ID / Huella) si disponible
// Cerrar modal al pulsar fuera → cancela automáticamente
let _deletePayload = null; // { btnEl, onConfirmado, restaurarBtn }

function handleDelete(btnEl, onConfirmado) {
    // Feedback inmediato — deshabilitar para evitar doble tap
    if (btnEl) {
        btnEl.disabled = true;
        btnEl._bg = btnEl.style.background;
        btnEl.style.background = 'rgba(239,68,68,0.35)';
        btnEl.style.opacity = '0.5';
    }
    const restaurarBtn = () => {
        if (btnEl) {
            btnEl.disabled = false;
            btnEl.style.background = btnEl._bg || 'rgba(239,68,68,0.12)';
            btnEl.style.opacity = '1';
        }
    };
    _deletePayload = { restaurarBtn, onConfirmado };

    // Mostrar modal de confirmación
    const bioMsg = document.getElementById('modal-delete-bio-msg');
    if (bioMsg) bioMsg.style.display = 'none';
    const confirmBtn = document.getElementById('btn-delete-confirm');
    if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; }
    document.getElementById('modalConfirmDelete').classList.add('active');
}

function _cancelarDelete() {
    document.getElementById('modalConfirmDelete').classList.remove('active');
    if (_deletePayload) { _deletePayload.restaurarBtn(); _deletePayload = null; }
}

async function _ejecutarDelete() {
    if (!_deletePayload) return;
    const { restaurarBtn, onConfirmado } = _deletePayload;

    const confirmBtn = document.getElementById('btn-delete-confirm');
    const cancelBtn  = document.getElementById('btn-delete-cancel');
    const bioMsg     = document.getElementById('modal-delete-bio-msg');

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.style.opacity = '0.5'; }
    if (cancelBtn)  { cancelBtn.disabled = true; }

    // Mostrar estado de espera
    if (bioMsg) {
        bioMsg.style.display = 'block';
        bioMsg.style.color = '#0EA5E9';
        bioMsg.style.borderColor = 'rgba(14,165,233,0.3)';
        bioMsg.style.background = 'rgba(14,165,233,0.08)';
        bioMsg.textContent = '🔐 Verifica tu identidad con Face ID o Huella...';
    }

    const credGuardadas = localStorage.getItem('silber_biometric_creds');
    var sesionActiva = null;
    var sesionBio = null;
    try { sesionActiva = JSON.parse(localStorage.getItem('silber_sesion_activa') || 'null'); } catch (_) {}
    try { sesionBio = credGuardadas ? JSON.parse(credGuardadas) : null; } catch (_) {}
    var sameUser = !!(sesionActiva && sesionBio && sesionActiva.usuario && sesionBio.usuario && String(sesionActiva.usuario) === String(sesionBio.usuario));

    // Solo pedir biometría si corresponde al usuario activo.
    var biometricEnabled = localStorage.getItem('silber_biometric_enabled') === '1';
    if (biometricEnabled && credGuardadas && sameUser && window.PublicKeyCredential) {
        const ok = await autenticarBiometria();
        if (!ok) {
            // Biometría fallida o cancelada — NO borrar
            if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; }
            if (cancelBtn)  { cancelBtn.disabled = false; }
            if (bioMsg) {
                bioMsg.style.color = '#EF4444';
                bioMsg.style.borderColor = 'rgba(239,68,68,0.4)';
                bioMsg.style.background = 'rgba(239,68,68,0.08)';
                bioMsg.textContent = '❌ Autenticación cancelada. No se eliminó nada.';
            }
            return;
        }
    }

    // Biometría OK (o no disponible) — ejecutar borrado
    document.getElementById('modalConfirmDelete').classList.remove('active');
    _deletePayload = null;
    restaurarBtn();
    onConfirmado();
    if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
}

// Alias — las funciones de borrado ya pasan (btnEl, _msg, onConfirmado)
function _confirmarBorrado(btnEl, _msg, onConfirmado) {
    handleDelete(btnEl, onConfirmado);
}

// ===== COSTE POR GRAMO (solo MASTER + biometría) =====
function guardarCosteB() {
    if (typeof esMaster === 'function' && !esMaster()) { alert('Solo Jefazo / Jefaza pueden cambiar esta configuración.'); return; }
    var doSave = function() {
        const val = parseFloat(document.getElementById('coste-gramo-b').value);
        if (!val || val <= 0) { alert('Introduce un valor válido'); return; }
        estado.costePorGramoB = val;
        guardarEstado();
        if (navigator.vibrate) navigator.vibrate([30,50,30]);
        alert('✅ Coste Recarga B guardado: ' + val + '€/g');
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'CONFIG_EDIT', details: 'Coste por gramo B: ' + val + '€/g' });
        if (typeof notifyOtherMaster === 'function') notifyOtherMaster('Cambió el coste por gramo B');
    };
    if (typeof requireMasterBiometric === 'function') {
        requireMasterBiometric(function(ok) { if (ok) doSave(); else alert('Verificación cancelada.'); });
    } else { doSave(); }
}

function guardarCosteV() {
    if (typeof esMaster === 'function' && !esMaster()) { alert('Solo Jefazo / Jefaza pueden cambiar esta configuración.'); return; }
    var doSave = function() {
        const val = parseFloat(document.getElementById('coste-gramo-v').value);
        if (!val || val <= 0) { alert('Introduce un valor válido'); return; }
        estado.costePorGramoV = val;
        guardarEstado();
        if (navigator.vibrate) navigator.vibrate([30,50,30]);
        alert('✅ Coste Recarga V guardado: ' + val + '€/g');
        if (typeof activityLogAdd === 'function') activityLogAdd({ action: 'CONFIG_EDIT', details: 'Coste por gramo V: ' + val + '€/g' });
        if (typeof notifyOtherMaster === 'function') notifyOtherMaster('Cambió el coste por gramo V');
    };
    if (typeof requireMasterBiometric === 'function') {
        requireMasterBiometric(function(ok) { if (ok) doSave(); else alert('Verificación cancelada.'); });
    } else { doSave(); }
}

function abrirCierreDia() {
    if (typeof esMaster === 'function' && !esMaster()) return;
    const hoy = new Date().toISOString().split('T')[0];
    const fechaLabel = new Date().toLocaleDateString('es-ES', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

    // EFECTIVO: ingresos efectivo - gastos efectivo = cierre de caja
    const ingEfectivo = (estado.ingresosRegistros || [])
        .filter(r => r.fecha === hoy && r.cuenta === 'efectivo')
        .reduce((s, r) => s + r.monto, 0);
    const gasEfectivo = (estado.gastosRegistros || [])
        .filter(r => r.fecha === hoy && r.cuenta === 'efectivo')
        .reduce((s, r) => s + r.monto, 0);

    // GUARDADO: solo se restan gastos (los ingresos en guardado no cuentan para el cierre)
    const gasGuardado = (estado.gastosRegistros || [])
        .filter(r => r.fecha === hoy && r.cuenta === 'caja')
        .reduce((s, r) => s + r.monto, 0);

    // BBVA: no entra en el cierre de caja
    const resultado = ingEfectivo - gasEfectivo;

    document.getElementById('cierre-fecha').textContent     = fechaLabel;
    document.getElementById('cierre-ing').textContent       = '+' + ingEfectivo.toFixed(2) + '€';
    document.getElementById('cierre-gas').textContent       = '-' + gasEfectivo.toFixed(2) + '€';
    document.getElementById('cierre-resultado').textContent = resultado.toFixed(2) + '€';
    document.getElementById('cierre-resultado').style.color = resultado >= 0 ? '#10B981' : '#EF4444';
    // Guardado: solo gastos
    document.getElementById('cierre-gas-caja').textContent  = gasGuardado > 0 ? '-' + gasGuardado.toFixed(2) + '€' : '—';
    const saldoGuardado = (estado.cuentas.caja || 0) - gasGuardado;
    const elRG = document.getElementById('cierre-resultado-guardado');
    if (elRG) { elRG.textContent = saldoGuardado.toFixed(2) + '€'; elRG.style.color = saldoGuardado >= 0 ? '#10B981' : '#EF4444'; }
    // Ocultar fila ing-caja si existe
    const elIC = document.getElementById('cierre-ing-caja');
    if (elIC) elIC.textContent = '';

    // Resetear nota y botón
    document.getElementById('cierre-nota-box').style.display         = 'none';
    document.getElementById('cierre-nota-descuadre').value           = '';
    document.getElementById('btn-confirmar-descuadre').style.display = 'none';
    document.getElementById('btn-descuadre').style.display           = '';

    // Historial
    const historial = estado.historialCierres || [];
    const hBox   = document.getElementById('cierre-historial-box');
    const hLista = document.getElementById('cierre-historial-lista');
    if (historial.length > 0) {
        hBox.style.display = 'block';
        hLista.innerHTML = '';
        [...historial].reverse().slice(0, 10).forEach(c => {
            const d = document.createElement('div');
            d.style.cssText = 'padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;';
            const icono = c.tipo === 'ok' ? '✅' : '⚠️';
            const color = c.tipo === 'ok' ? '#10B981' : '#F59E0B';
            const notaText = c.nota ? `<div style="color:var(--text-secondary);font-size:11px;margin-top:2px;">📝 ${c.nota}</div>` : '';
            d.innerHTML = `<div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-secondary);">${icono} ${c.fecha} ${c.hora} · ${c.registradoPor || '?'}</span>
                <span style="color:${color};font-weight:700;">${c.resultado >= 0 ? '+' : ''}${c.resultado.toFixed(2)}€${c.tipo === 'descuadre' ? ' · ⚠️' : ''}</span>
            </div>${notaText}`;
            hLista.appendChild(d);
        });
    } else {
        hBox.style.display = 'none';
    }

    const resEl = document.getElementById('cierre-resumen');
    if (resEl) resEl.textContent = `Cierre efectivo hoy: ${resultado.toFixed(2)}€`;

    // ── NETO: ingresos totales - coste del stock vendido hoy ──
    const totalIngresos = (estado.ingresosRegistros || [])
        .filter(r => r.fecha === hoy)
        .reduce((s, r) => s + r.monto, 0);

    // Gramos vendidos hoy de B y V según descuentos de stock
    const sp = estado.stockProductos || {};
    const catB = ['Bolsa','Piedra 28','Piedra 30','Piedra 32','Piedra 34'];
    const catV = ['Verde','Brócoli 3','Brócoli 3.5'];
    let gramosVendidosB = 0, gramosVendidosV = 0;
    (estado.ingresosRegistros || []).filter(r => r.fecha === hoy).forEach(r => {
        const prod = sp[r.categoria];
        if (!prod || !prod.precio || !prod.gramaje) return;
        const g = (r.monto / prod.precio) * prod.gramaje;
        if (catV.includes(r.categoria)) gramosVendidosV += g;
        else if (catB.includes(r.categoria)) gramosVendidosB += g;
    });

    const costeB = gramosVendidosB * (estado.costePorGramoB || 22);
    const costeV = gramosVendidosV * (estado.costePorGramoV || 1);
    const neto   = totalIngresos - costeB - costeV;

    const elCB   = document.getElementById('cierre-coste-b');
    const elCV   = document.getElementById('cierre-coste-v');
    const elNeto = document.getElementById('cierre-neto');
    if (elCB)   elCB.textContent   = gramosVendidosB > 0 ? `-${costeB.toFixed(2)}€ (${gramosVendidosB.toFixed(2)}g)` : '—';
    if (elCV)   elCV.textContent   = gramosVendidosV > 0 ? `-${costeV.toFixed(2)}€ (${gramosVendidosV.toFixed(2)}g)` : '—';
    if (elNeto) { elNeto.textContent = neto.toFixed(2) + '€'; elNeto.style.color = neto >= 0 ? '#F59E0B' : '#EF4444'; }

    // ── VENTAS RECARGA HOY ──
    // Sumar gramos vendidos: por productos del stockProductos + por categorías directas esRecarga
    let ventasB = 0, ventasV = 0;
    (estado.ingresosRegistros || []).filter(r => r.fecha === hoy).forEach(r => {
        // Descuento por producto (Bolsa, Piedra, etc.)
        const prod = sp[r.categoria];
        if (prod && prod.precio > 0 && prod.gramaje > 0) {
            const g = (r.monto / prod.precio) * prod.gramaje;
            if (catV.includes(r.categoria)) ventasV += g;
            else if (catB.includes(r.categoria)) ventasB += g;
        }
        // Descuento directo por Recarga B / Recarga V en ingresos
        if (r.esRecarga === 'recargaB' && r.gramos > 0) ventasB += r.gramos;
        if (r.esRecarga === 'recargaV' && r.gramos > 0) ventasV += r.gramos;
    });
    const elVB = document.getElementById('cierre-ventas-b');
    const elVV = document.getElementById('cierre-ventas-v');
    const elSB = document.getElementById('cierre-stock-b-rest');
    const elSV = document.getElementById('cierre-stock-v-rest');
    if (elVB) elVB.textContent = ventasB > 0 ? `${ventasB.toFixed(2)} g` : '— g';
    if (elVV) elVV.textContent = ventasV > 0 ? `${ventasV.toFixed(2)} g` : '— g';
    if (elSB) elSB.textContent = `${(estado.stockTotalB || 0).toFixed(2)} g`;
    if (elSV) elSV.textContent = `${(estado.stockTotalV || 0).toFixed(2)} g`;

    // Conciliación solo MASTER: ingresos tarjeta (bbva) hoy
    const ingCard = (estado.ingresosRegistros || []).filter(r => r.fecha === hoy && r.cuenta === 'bbva').reduce((s, r) => s + r.monto, 0);
    const concBox = document.getElementById('cierre-conciliacion-box');
    const histCompletosBtn = document.getElementById('cierre-historial-completos-btn');
    const isMaster = typeof esMaster === 'function' && esMaster();
    if (concBox) concBox.style.display = isMaster ? 'block' : 'none';
    if (histCompletosBtn) histCompletosBtn.style.display = isMaster ? 'block' : 'none';
    const elIngCard = document.getElementById('cierre-ing-card');
    if (elIngCard) elIngCard.textContent = ingCard > 0 ? '+' + ingCard.toFixed(2) + '€' : '—';
    const inpEf = document.getElementById('cierre-actual-efectivo');
    const inpCard = document.getElementById('cierre-actual-tarjeta');
    if (inpEf) inpEf.value = '';
    if (inpCard) inpCard.value = '';
    // Guardar esperados para confirmarCierre
    window._cierreExpectedCash = resultado;
    window._cierreExpectedCard = ingCard;
    window._cierreTotalIngresos = totalIngresos;
    window._cierreTotalGastos = (estado.gastosRegistros || []).filter(r => r.fecha === hoy).reduce((s, r) => s + r.monto, 0);
    function actualizarDiferenciaCierre() {
        const ef = parseFloat(document.getElementById('cierre-actual-efectivo').value) || 0;
        const card = parseFloat(document.getElementById('cierre-actual-tarjeta').value) || 0;
        const expectedTotal = (window._cierreExpectedCash || 0) + (window._cierreExpectedCard || 0);
        const actualTotal = ef + card;
        const diff = expectedTotal - actualTotal;
        const elD = document.getElementById('cierre-diferencia');
        if (elD) { elD.textContent = diff.toFixed(2) + '€'; elD.style.color = diff === 0 ? '#10B981' : (diff > 0 ? '#F59E0B' : '#EF4444'); }
    }
    if (inpEf) inpEf.oninput = actualizarDiferenciaCierre;
    if (inpCard) inpCard.oninput = actualizarDiferenciaCierre;
    actualizarDiferenciaCierre();

    document.getElementById('modalCierreDia').classList.add('active');
    if (navigator.vibrate) navigator.vibrate(30);
}

// ===== REVUELTA DIARIA =====
// Resetea los contadores visibles del día. Los registros históricos se conservan.
function revueltaDiaria(nuevaFecha) {
    try {
        // Guardar snapshot del día anterior en historialDias
        const diaAnterior = estado._ultimoDia;
        if (diaAnterior) {
            if (!estado.historialDias) estado.historialDias = {};
            const ingHoy = (estado.ingresosRegistros || []).filter(r => r.fecha === diaAnterior);
            const gasHoy = (estado.gastosRegistros   || []).filter(r => r.fecha === diaAnterior);
            const sp = estado.stockProductos || {};
            const catB = ['Bolsa','Piedra 28','Piedra 30','Piedra 32','Piedra 34'];
            const catV = ['Verde','Brócoli 3','Brócoli 3.5'];
            let vB = 0, vV = 0;
            ingHoy.forEach(r => {
                const prod = sp[r.categoria];
                if (prod && prod.precio > 0 && prod.gramaje > 0) {
                    const g = (r.monto / prod.precio) * prod.gramaje;
                    if (catV.includes(r.categoria)) vV += g;
                    else if (catB.includes(r.categoria)) vB += g;
                }
                if (r.esRecarga === 'recargaB' && r.gramos > 0) vB += r.gramos;
                if (r.esRecarga === 'recargaV' && r.gramos > 0) vV += r.gramos;
            });
            estado.historialDias[diaAnterior] = {
                ingresos:  ingHoy.reduce((s, r) => s + r.monto, 0),
                gastos:    gasHoy.reduce((s, r) => s + r.monto, 0),
                ventasB:   parseFloat(vB.toFixed(2)),
                ventasV:   parseFloat(vV.toFixed(2)),
                stockB:    parseFloat((estado.stockTotalB || 0).toFixed(2)),
                stockV:    parseFloat((estado.stockTotalV || 0).toFixed(2))
            };
        }
        // Resetear día
        estado.diaOffset  = 0;
        estado._ultimoDia = nuevaFecha;
        actualizarTimeMachine();
        actualizarSaldos();
        dibujarDonut();
        renderizarDesgloseGastos();
        renderizarDesgloseIngresos();
        guardarEstado();
        console.log('🔄 Revuelta diaria ejecutada para:', nuevaFecha);
    } catch(e) {
        // Si falla la revuelta, al menos actualizar la fecha para no quedar en bucle
        console.warn('Revuelta diaria con error:', e);
        estado._ultimoDia = nuevaFecha;
        estado.diaOffset  = 0;
        guardarEstado();
    }
}

function mostrarNotaDescuadre() {
    document.getElementById('cierre-nota-box').style.display         = 'block';
    document.getElementById('btn-confirmar-descuadre').style.display = '';
    document.getElementById('btn-descuadre').style.display           = 'none';
    document.getElementById('cierre-nota-descuadre').focus();
}

function cerrarCierreDia() {
    document.getElementById('modalCierreDia').classList.remove('active');
}

function _registrarEntradaCierre(tipo, nota) {
    const hoy  = new Date().toISOString().split('T')[0];
    const hora = new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    // Cierre = solo efectivo (ing - gas). BBVA y Guardado fuera.
    const ingEfectivo = (estado.ingresosRegistros || []).filter(r => r.fecha === hoy && r.cuenta === 'efectivo').reduce((s, r) => s + r.monto, 0);
    const gasEfectivo = (estado.gastosRegistros   || []).filter(r => r.fecha === hoy && r.cuenta === 'efectivo').reduce((s, r) => s + r.monto, 0);
    const resultado   = ingEfectivo - gasEfectivo;
    if (!estado.historialCierres) estado.historialCierres = [];
    estado.historialCierres.push({ fecha: hoy, hora, tipo, resultado, nota: nota || '', registradoPor: sesionActual ? sesionActual.usuario : '?' });
    guardarEstado();
}

function confirmarCierre() {
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo o Jefaza pueden confirmar el cierre del día.');
        return;
    }
    if (typeof esMaster === 'function' && esMaster() && typeof requireMasterBiometric === 'function') {
        requireMasterBiometric(function(ok) {
            if (!ok) { alert('Verificación cancelada. No se realizó el cierre.'); return; }
            _ejecutarConfirmarCierre('ok', '');
        });
        return;
    }
    _ejecutarConfirmarCierre('ok', '');
}

function _ejecutarConfirmarCierre(tipo, nota) {
    const hoy = new Date().toISOString().split('T')[0];
    const expectedCash = window._cierreExpectedCash != null ? window._cierreExpectedCash : 0;
    const expectedCard = window._cierreExpectedCard != null ? window._cierreExpectedCard : 0;
    const actualCash = parseFloat(document.getElementById('cierre-actual-efectivo').value) || 0;
    const actualCard = parseFloat(document.getElementById('cierre-actual-tarjeta').value) || 0;
    const totalIncome = window._cierreTotalIngresos != null ? window._cierreTotalIngresos : 0;
    const totalExpenses = window._cierreTotalGastos != null ? window._cierreTotalGastos : 0;
    const difference = (expectedCash + expectedCard) - (actualCash + actualCard);
    if (typeof saveCashClosing === 'function') {
        saveCashClosing({
            date: hoy,
            total_income: totalIncome,
            total_expenses: totalExpenses,
            expected_cash: expectedCash,
            card_payments: expectedCard,
            actual_cash: actualCash,
            actual_card: actualCard,
            difference: difference,
            tipo: tipo,
            nota: nota
        });
    }
    _registrarEntradaCierre(tipo, nota);
    if (typeof recordCashDifferenceAlert === 'function') recordCashDifferenceAlert(difference);
    if (typeof activityLogAdd === 'function') {
        activityLogAdd({ action: 'CASH_CLOSING', details: 'Cierre del día ' + hoy + (tipo === 'descuadre' ? ' (descuadre)' : '') + ' · Diferencia: ' + difference.toFixed(2) + '€' });
    }
    if (typeof notifyOtherMaster === 'function') notifyOtherMaster('Realizó el cierre del día (' + hoy + ')');
    if (typeof buildDailySummary === 'function') buildDailySummary(hoy);
    var whatsappCierre = '34643525906';
    var msgCierre = '🔐 Cierre Silber - ' + hoy + '\n' +
        'Ingresos: ' + totalIncome.toFixed(2) + '€ | Gastos: ' + totalExpenses.toFixed(2) + '€\n' +
        'Efectivo contado: ' + actualCash.toFixed(2) + '€ | Tarjeta: ' + actualCard.toFixed(2) + '€\n' +
        'Diferencia: ' + difference.toFixed(2) + '€\n' +
        (tipo === 'ok' ? '✅ Todo cuadra' : '⚠️ Descuadre' + (nota ? ': ' + nota : ''));
    try { window.open('https://wa.me/' + whatsappCierre + '?text=' + encodeURIComponent(msgCierre), '_blank'); } catch (e) {}
    if (typeof esJefaza === 'function' && esJefaza() && tipo === 'ok') {
        var btnCierre = document.querySelector('#modalCierreDia .modal-footer .btn-primary');
        var rect = btnCierre ? btnCierre.getBoundingClientRect() : null;
        if (typeof showLoveClosingEffect === 'function') showLoveClosingEffect(rect);
    }
    cerrarCierreDia();
    alert(tipo === 'ok' ? '✅ Cierre del día confirmado. Todo cuadra.' : '⚠️ Descuadre registrado con nota. Guardado en el historial.');
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function registrarDescuadre() {
    const nota = document.getElementById('cierre-nota-descuadre').value.trim();
    if (!nota) { alert('Por favor escribe el motivo del descuadre'); return; }
    if (typeof esMaster === 'function' && !esMaster()) {
        alert('Solo Jefazo o Jefaza pueden registrar un descuadre.');
        return;
    }
    if (typeof esMaster === 'function' && esMaster() && typeof requireMasterBiometric === 'function') {
        requireMasterBiometric(function(ok) {
            if (!ok) { alert('Verificación cancelada.'); return; }
            _ejecutarConfirmarCierre('descuadre', nota);
        });
        return;
    }
    _ejecutarConfirmarCierre('descuadre', nota);
}

function abrirHistorialCierresCompletos() {
    if (typeof getCashClosings !== 'function') return;
    const list = getCashClosings();
    const container = document.getElementById('historial-cierres-completos-lista');
    if (!container) return;
    container.innerHTML = '';
    if (list.length === 0) {
        container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:12px 0;">Sin cierres guardados</div>';
    } else {
        [...list].reverse().forEach(function(c) {
            const d = document.createElement('div');
            d.style.cssText = 'padding:10px 12px;border-radius:10px;margin-bottom:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:12px;';
            const diff = c.difference != null ? c.difference : 0;
            d.innerHTML = '<div style="font-weight:700;color:var(--text-primary);margin-bottom:4px;">' + (c.date || '') + ' · ' + (c.closed_by || '?') + '</div>' +
                '<div style="color:var(--text-secondary);">Ingresos: ' + (c.total_income != null ? c.total_income.toFixed(2) : '—') + '€ · Gastos: ' + (c.total_expenses != null ? c.total_expenses.toFixed(2) : '—') + '€</div>' +
                '<div style="color:var(--text-secondary);">Efectivo contado: ' + (c.actual_cash != null ? c.actual_cash.toFixed(2) : '—') + '€ · Tarjeta: ' + (c.actual_card != null ? c.actual_card.toFixed(2) : '—') + '€</div>' +
                '<div style="margin-top:4px;font-weight:700;color:' + (diff === 0 ? '#10B981' : (diff > 0 ? '#F59E0B' : '#EF4444')) + ';">Diferencia: ' + diff.toFixed(2) + '€' + (c.nota ? ' · ' + c.nota : '') + '</div>';
            container.appendChild(d);
        });
    }
    document.getElementById('modalHistorialCierresCompletos').classList.add('active');
}

function cerrarHistorialCierresCompletos() {
    document.getElementById('modalHistorialCierresCompletos').classList.remove('active');
}

function abrirAuditoria() {
    if (typeof esMaster !== 'function' || !esMaster()) return;
    if (typeof getAuditData !== 'function') return;
    var data = getAuditData();
    var container = document.getElementById('auditoria-content');
    if (!container) return;
    container.innerHTML = '';
    function section(title, items, color) {
        if (!items || items.length === 0) return;
        var wrap = document.createElement('div');
        wrap.style.cssText = 'margin-bottom:14px;';
        var h = document.createElement('div');
        h.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:1px;margin-bottom:6px;';
        h.textContent = title;
        wrap.appendChild(h);
        items.slice(0, 20).forEach(function(e) {
            var d = document.createElement('div');
            d.style.cssText = 'padding:8px 10px;border-radius:8px;margin-bottom:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:12px;';
            d.innerHTML = '<span style="color:var(--text-secondary);">' + (e.timestamp || '') + '</span> · ' + (e.user || '') + ' · <span style="color:' + (color || '#F59E0B') + ';">' + (e.details || e.action || '') + '</span>';
            wrap.appendChild(d);
        });
        container.appendChild(wrap);
    }
    section('⚠️ Actividad sospechosa', data.suspicious, '#EF4444');
    section('🗑️ Eliminaciones', data.deletions, '#EF4444');
    section('💰 Alto valor', data.highValue, '#F59E0B');
    section('🔐 Diferencia en cierre', data.cashDifference, '#F59E0B');
    if (data.dailySummaries && data.dailySummaries.length > 0) {
        var wrap = document.createElement('div');
        wrap.style.marginBottom = '14px';
        var h = document.createElement('div');
        h.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:1px;margin-bottom:6px;';
        h.textContent = '📊 Resumen diario';
        wrap.appendChild(h);
        data.dailySummaries.forEach(function(s) {
            var d = document.createElement('div');
            d.style.cssText = 'padding:8px 10px;border-radius:8px;margin-bottom:4px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);font-size:12px;';
            d.textContent = (s.date || '') + ' — Transacciones: ' + (s.total_transactions || 0) + ', Eliminadas: ' + (s.deleted_count || 0) + ', Editadas: ' + (s.edited_count || 0) + ', Sospechosas: ' + (s.suspicious_count || 0);
            wrap.appendChild(d);
        });
        container.appendChild(wrap);
    }
    if (!container.innerHTML) container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:12px 0;">Sin datos de auditoría aún</div>';
    document.getElementById('modalAuditoria').classList.add('active');
}

function cerrarAuditoria() {
    document.getElementById('modalAuditoria').classList.remove('active');
}


function abrirModalCambiarPasswordGorrion() {
    ['cpg-actual','cpg-nueva','cpg-repetir'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modalCambiarPassGorrion').classList.add('active');
}

function ejecutarCambioPassGorrion() {
    const actual  = document.getElementById('cpg-actual').value;
    const nueva   = document.getElementById('cpg-nueva').value;
    const repetir = document.getElementById('cpg-repetir').value;
    if (!sesionActual || !esGorrion()) return;
    const lista = cargarGorriones();
    const g = lista[sesionActual.gorrionIdx];
    if (!g || g.password !== actual) { alert('La contraseña actual es incorrecta'); return; }
    if (!nueva || nueva.length < 4)  { alert('La nueva contraseña debe tener al menos 4 caracteres'); return; }
    if (nueva !== repetir)            { alert('Las contraseñas no coinciden'); return; }
    g.password = nueva;
    guardarGorriones(lista);
    document.getElementById('modalCambiarPassGorrion').classList.remove('active');
    alert('✅ Contraseña actualizada correctamente');
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

// ===== LOVE EFFECT (JEFAZA — cierre enviado a Jefazo) =====
function showLoveClosingEffect(buttonRect) {
    var overlay = document.createElement('div');
    overlay.className = 'love-popup-overlay';
    overlay.innerHTML = '<div class="love-popup">Gracias por todo lo que haces.<br>Eres increíble. ❤️</div>';
    document.body.appendChild(overlay);
    setTimeout(function() {
        var popup = overlay.querySelector('.love-popup');
        if (popup) popup.classList.add('love-popup-out');
        setTimeout(function() { overlay.remove(); }, 380);
    }, 2200);

    var cx = buttonRect ? buttonRect.left + buttonRect.width / 2 : window.innerWidth / 2;
    var cy = buttonRect ? buttonRect.top + buttonRect.height / 2 : window.innerHeight / 2;
    var hearts = ['❤️', '💜', '💗'];
    for (var i = 0; i < 10; i++) {
        (function(j) {
            setTimeout(function() {
                var el = document.createElement('div');
                el.className = 'love-heart';
                el.textContent = hearts[j % hearts.length];
                var dx = (Math.random() - 0.5) * 80;
                el.style.left = (cx - 12) + 'px';
                el.style.top = (cy - 12) + 'px';
                el.style.setProperty('--dx', dx + 'px');
                document.body.appendChild(el);
                setTimeout(function() { el.remove(); }, 2100);
            }, j * 80);
        })(i);
    }
}

// ===== ALERTAS JEFES =====