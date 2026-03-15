/* SILBER GESTIÓN — app.js */


function intentarLogin() {
    const u = document.getElementById('login-usuario').value.trim();
    const p = document.getElementById('login-password').value;

    // Comprobar usuarios con rol (JEFAZO, JEFAZA) o Worker (gorriones)
    const user = USUARIOS.find(x => x.username === u && x.password === p);
    if (user) {
        sesionActual = { usuario: u, rol: user.role };
        entrarApp();
        return;
    }

    // Comprobar gorriones → WORKER (compatibilidad)
    const gorriones = cargarGorriones();
    const gIdx = gorriones.findIndex(g => g.usuario === u && g.password === p);
    if (gIdx !== -1) {
        const g = gorriones[gIdx];
        sesionActual = { usuario: u, rol: 'WORKER', gorrionIdx: gIdx, nombre: g.nombre, numero: g.numero };
        entrarApp();
        return;
    }

    document.getElementById('login-error').style.display = 'block';
    document.getElementById('login-password').value = '';
    if (navigator.vibrate) navigator.vibrate([100,50,100]);
}

function entrarApp() {
    document.getElementById('screen-login').classList.remove('active');
    const nav = document.getElementById('bottom-nav');
    if (nav) nav.style.display = 'flex';
    aplicarModoSesion();
    // Persistir sesión en localStorage para que sobreviva recargas
    if (sesionActual) {
        localStorage.setItem('silber_sesion_activa', JSON.stringify(sesionActual));
        activarBiometria(sesionActual);
    }
    cambiarPantalla('dashboard');
    if (navigator.geolocation && sesionActual && typeof saveWorkerLocation === 'function') {
        navigator.geolocation.getCurrentPosition(function(pos) {
            saveWorkerLocation(sesionActual.usuario, sesionActual.rol, pos.coords.latitude, pos.coords.longitude);
        }, function() {});
    }
    if (typeof syncClientsToSupabase === 'function') syncClientsToSupabase();
    if (navigator.vibrate) navigator.vibrate([30,50,30]);
}

function esJefazo() { return sesionActual && sesionActual.rol === 'JEFAZO'; }
function esJefaza() { return sesionActual && sesionActual.rol === 'JEFAZA'; }
function esMaster() { return esJefazo() || esJefaza(); }
function esWorker() { return sesionActual && sesionActual.rol === 'WORKER'; }
function esJefe() { return esMaster(); }
function esGorrion() { return esWorker(); }

function aplicarModoSesion() {
    var elCierre = document.getElementById('oficina-cierre-card');
    if (elCierre) elCierre.style.display = esMaster() ? 'block' : 'none';
    var elAuditoria = document.getElementById('oficina-menu-auditoria');
    if (elAuditoria) elAuditoria.style.display = esJefazo() ? 'block' : 'none';
    var elMetricas = document.getElementById('oficina-menu-metricas');
    if (elMetricas) elMetricas.style.display = esMaster() ? 'block' : 'none';
    var elRuta = document.getElementById('oficina-menu-ruta');
    if (elRuta) elRuta.style.display = (esMaster() || esWorker()) ? 'block' : 'none';
    var elTimeline = document.getElementById('oficina-menu-timeline');
    if (elTimeline) elTimeline.style.display = esMaster() ? 'block' : 'none';
    var elProductos = document.getElementById('oficina-menu-productos');
    if (elProductos) elProductos.style.display = esMaster() ? 'block' : 'none';
    var elConfig = document.getElementById('oficina-menu-config');
    if (elConfig) elConfig.style.display = esJefazo() ? 'block' : 'none';
    if (esWorker()) {
        [ 'oficina-menu-cuentas', 'oficina-menu-transferencias', 'oficina-menu-stock', 'oficina-menu-productos', 'oficina-menu-auditoria', 'oficina-menu-metricas', 'oficina-menu-timeline', 'oficina-menu-config' ].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        var elRutaW = document.getElementById('oficina-menu-ruta');
        if (elRutaW) elRutaW.style.display = 'block';
        renderizarCategoriasGastos();
        renderizarCategoriasIngresos();
        mostrarBotonCambiarPassword();
    }
    if (esMaster() && typeof startMasterNotificationPoll === 'function') startMasterNotificationPoll();
}

function mostrarBotonCambiarPassword() {
    if (!document.getElementById('btn-cambiar-pass-gorrion')) {
        const btn = document.createElement('button');
        btn.id = 'btn-cambiar-pass-gorrion';
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'position:fixed;bottom:80px;right:16px;z-index:100;font-size:11px;padding:8px 12px;';
        btn.textContent = '🔑 Mi contraseña';
        btn.onclick = abrirModalCambiarPasswordGorrion;
        document.body.appendChild(btn);
    }
}

// ===== MÁQUINA DEL TIEMPO =====
function cambiarDia(delta) {
    const nuevo = estado.diaOffset + delta;
    if (nuevo > 0) return;
    estado.diaOffset = nuevo;
    actualizarTimeMachine();
    actualizarSaldos();
    dibujarDonut();
    guardarEstado();
    if (navigator.vibrate) navigator.vibrate(20);
}

function actualizarTimeMachine() {
    const label = document.getElementById('time-label');
    const nextBtn = document.getElementById('time-next');
    if (label) label.textContent = labelDia(estado.diaOffset);
    if (nextBtn) nextBtn.disabled = estado.diaOffset >= 0;
}

// ===== DONUT =====
function dibujarDonut() {
    const canvas = document.getElementById('donutCanvas');
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 100;
    const lineWidth = 24;

    const diaData = getDiaData(estado.diaOffset);
    const objetivo = 500;
    const porcentaje = Math.min((diaData.ingresos / objetivo) * 100, 100);
    const angulo = (porcentaje / 100) * 360;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (angulo > 0) {
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#0EA5E9');
        gradient.addColorStop(0.5, '#38BDF8');
        gradient.addColorStop(1, '#0284C7');
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, (-Math.PI / 2) + (angulo * Math.PI / 180));
        ctx.strokeStyle = gradient;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(14, 165, 233, 0.5)';
        ctx.stroke();
    }
}

function cambiarPeriodo(periodo, event) {
    estado.periodo = periodo;
    document.querySelectorAll('.period-btn').forEach(btn => btn.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
    // En periodo agregado, nav dia no aplica — forzar offset 0
    if (periodo !== 'day') estado.diaOffset = 0;
    actualizarTimeMachine();
    dibujarDonut();
    actualizarSaldos();
    guardarEstado();
    if (navigator.vibrate) navigator.vibrate(30);
}

function renderizarRanking() {
    const container = document.getElementById('ranking-list');
    container.innerHTML = '';
    const ranking = [...estado.trabajadores].sort((a, b) => b.ventas - a.ventas);
    ranking.forEach((trabajador, index) => {
        const div = document.createElement('div');
        div.className = 'ranking-item' + (index === 0 ? ' first' : '');
        div.innerHTML = `
            <div class="ranking-position">${index + 1}</div>
            <div class="ranking-avatar">${trabajador.avatar}</div>
            <div class="ranking-info">
                <div class="ranking-name">${trabajador.nombre}</div>
                <div class="ranking-role">${trabajador.role}</div>
            </div>
            <div class="ranking-amount">${trabajador.ventas}€</div>
        `;
        container.appendChild(div);
    });
}

function renderizarCategoriasGastos() {
    const container = document.getElementById('gastos-grid');
    container.innerHTML = '';
    let cats = estado.categoriasGastos;
    if (esGorrion()) cats = cats.filter(c => !c.esRecarga);
    cats.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-btn';
        div.onclick = () => abrirModalTransaccion('gasto', cat);
        div.innerHTML = `<div class="category-icon">${cat.icon}</div><div class="category-label">${cat.nombre}</div>`;
        container.appendChild(div);
    });
}

function renderizarCategoriasIngresos() {
    const container = document.getElementById('ingresos-grid');
    container.innerHTML = '';
    estado.categoriasIngresos.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-btn';
        div.onclick = () => abrirModalTransaccion('ingreso', cat);
        div.innerHTML = `<div class="category-icon">${cat.icon}</div><div class="category-label">${cat.nombre}</div>`;
        container.appendChild(div);
    });
    // Gorrión: ocultar botón pago de deuda
    const btnPago = document.getElementById('btn-pago-deuda-ingresos');
    if (btnPago) btnPago.style.display = esGorrion() ? 'none' : '';
}

function procesarFoto(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxW = 800;
            const ratio = Math.min(maxW / img.width, maxW / img.height, 1);
            canvas.width = img.width * ratio;
            canvas.height = img.height * ratio;
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            estado.fotoActual = dataUrl;
            const preview = document.getElementById('foto-preview');
            preview.src = dataUrl;
            preview.style.display = 'block';
        };
        img.src = e.target.result;


// ===== FACE ID / BIOMETRÍA =====
// Función central de autenticación biométrica (WebAuthn)
async function autenticarBiometria() {
    if (!window.PublicKeyCredential) {
        alert('Este dispositivo no soporta biometría.');
        return false;
    }
    try {
        await navigator.credentials.get({
            publicKey: {
                challenge: new Uint8Array(32),
                timeout: 60000,
                userVerification: 'required'
            }
        });
        return true;
    } catch (error) {
        return false;
    }
}

async function loginFaceID() {
    const credGuardadas = localStorage.getItem('silber_biometric_creds');
    if (!credGuardadas) {
        alert('Primero entra con usuario y contraseña una vez para activar Face ID / Huella');
        return;
    }
    const ok = await autenticarBiometria();
    if (!ok) return;
    _entrarConCreds(credGuardadas);
}

function _entrarConCreds(credGuardadas) {
    try {
        sesionActual = JSON.parse(credGuardadas);
        aplicarModoSesion();
        entrarApp();
    } catch(e) {
        alert('Error al recuperar sesión. Entra con usuario y contraseña.');
    }
}

// Guardar credenciales biométricas tras login exitoso y registrar WebAuthn
function activarBiometria(sesion) {
    localStorage.setItem('silber_last_user', sesion.usuario);
    localStorage.setItem('silber_biometric_creds', JSON.stringify(sesion));
    // Solo registrar WebAuthn si estamos en HTTPS (Vercel) y aún no está registrado
    const rpId = window.location.hostname;
    if (!rpId || rpId === 'localhost' || rpId === '') return; // WebAuthn no funciona en local
    if (!window.PublicKeyCredential) return;
    if (localStorage.getItem('silber_webauthn_id')) return; // ya registrado
    window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(ok => {
            if (!ok) return;
            const userId = crypto.getRandomValues(new Uint8Array(16));
            navigator.credentials.create({ publicKey: {
                challenge: crypto.getRandomValues(new Uint8Array(32)),
                rp: { name: 'Silber Gestión', id: rpId },
                user: { id: userId, name: sesion.usuario, displayName: sesion.usuario },
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
                authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
                timeout: 60000
            }}).then(cred => {
                const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
                localStorage.setItem('silber_webauthn_id', credId);
            }).catch(() => {}); // silencioso — user puede cancelar o ya existe
        }).catch(() => {});
}

// Mostrar botón Face ID siempre si hay sesión guardada (el SO decide si hay biometría)
(function() {
    const cred = localStorage.getItem('silber_biometric_creds');
    const btn = document.getElementById('btn-faceid');
    if (btn) {
        btn.style.display = 'flex';
        if (!cred) {
            btn.style.opacity = '0.4';
            btn.title = 'Entra primero con usuario y contraseña para activar';
        }

function chequearRecordatorios() {
    const ahora = new Date();
    const diaHoy = ahora.getDate();
    const hora   = ahora.getHours();
    const min    = ahora.getMinutes();
    // Solo lanzar entre 10:00 y 10:05 (ventana de 5 min para no repetir en cada check)
    if (hora !== 10 || min > 5) return;
    // Evitar lanzar dos veces el mismo día
    const keyHoy = 'waSent_' + ahora.toISOString().split('T')[0];
    if (localStorage.getItem(keyHoy)) return;
    const db = cargarDbDeudas();
    const pendientes = db.deudas.filter(d => !d.pagada && parseInt(d.dia_pago) === diaHoy);
    if (!pendientes.length) return;
    localStorage.setItem(keyHoy, '1');
    pendientes.forEach(deuda => {
        const cliente = db.clientes.find(c => c.id === deuda.cliente_id);
        if (!cliente || !cliente.telefono) return;
        const tel = cliente.telefono.replace(/\D/g, ''); // solo dígitos
        const msg = encodeURIComponent(`Hola ${cliente.nombre} 👋, hoy es tu día de liquidación. Deuda pendiente: ${deuda.cantidad}€ (${deuda.producto}). Pasa por tienda cuando puedas. ¡Gracias!`);
        // Abre WhatsApp con el mensaje prellenado para cada cliente
        setTimeout(() => {
            window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
        }, 800);
    });
}

// Chequear al arrancar y cada 3 minutos
setTimeout(chequearRecordatorios, 3000);

}

window.addEventListener('resize', () => {
    const canvas = document.getElementById('donutCanvas');
    canvas.width = canvas.parentElement.offsetWidth;
    canvas.height = canvas.parentElement.offsetHeight;
    dibujarDonut();
});

// ===== LOGIN =====


const manifest = {
    name: 'SILBER GESTIÓN',
    short_name: 'SILBER',
    description: 'Gestión financiera y de stock',
    start_url: '.',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0F172A',
    theme_color: '#0F172A',
    icons: [
        { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="%230F172A"/><text x="50%25" y="55%25" font-size="110" text-anchor="middle" dominant-baseline="middle" fill="%230EA5E9" font-family="Arial Black,sans-serif">N</text></svg>', sizes: '192x192', type: 'image/svg+xml' },
        { src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="%230F172A"/><text x="50%25" y="55%25" font-size="300" text-anchor="middle" dominant-baseline="middle" fill="%230EA5E9" font-family="Arial Black,sans-serif">N</text></svg>', sizes: '512x512', type: 'image/svg+xml' }
    ]
};
const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
const manifestURL = URL.createObjectURL(blob);
const linkManifest = document.createElement('link');
linkManifest.rel = 'manifest';
linkManifest.href = manifestURL;
document.head.appendChild(linkManifest);

// Favicon SVG inline
const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/svg+xml';
favicon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%230F172A"/><text x="50%25" y="56%25" font-size="40" text-anchor="middle" dominant-baseline="middle" fill="%230EA5E9" font-family="Arial Black,sans-serif">N</text></svg>';
document.head.appendChild(favicon);

// Apple touch icon inline
const appleIcon = document.createElement('link');
appleIcon.rel = 'apple-touch-icon';
appleIcon.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" rx="40" fill="%230F172A"/><text x="50%25" y="55%25" font-size="110" text-anchor="middle" dominant-baseline="middle" fill="%230EA5E9" font-family="Arial Black,sans-serif">N</text></svg>';
document.head.appendChild(appleIcon);

// ===== Service Worker (cache offline) =====
if ('serviceWorker' in navigator) {
    const swCode = `
const CACHE = 'silber-gestion-v1';
self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(['/'])));
    self.skipWaiting();
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
    self.clients.claim();
});
self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).catch(() => new Response('Offline', {status: 503}))));
});
    `;
    const swBlob = new Blob([swCode], { type: 'application/javascript' });
    const swURL = URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swURL).catch(() => {});
}