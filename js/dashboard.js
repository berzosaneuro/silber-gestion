/* SILBER GESTIÓN — dashboard.js */
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
    if (typeof estado === 'undefined' || !estado) return;
    var label = document.getElementById('time-label');
    var nextBtn = document.getElementById('time-next');
    if (label) label.textContent = typeof labelDia === 'function' ? labelDia(estado.diaOffset) : 'HOY';
    if (nextBtn) nextBtn.disabled = estado.diaOffset >= 0;
}

// ===== DONUT =====
function initDonutCanvas() {
    var canvas = document.getElementById('donutCanvas');
    if (!canvas) return;
    var parent = canvas.parentElement;
    var w = (parent && parent.offsetWidth > 0) ? parent.offsetWidth : 220;
    var h = (parent && parent.offsetHeight > 0) ? parent.offsetHeight : 220;
    canvas.width = w;
    canvas.height = h;
    if (typeof dibujarDonut === 'function') dibujarDonut();
}
function dibujarDonut() {
    var canvas = document.getElementById('donutCanvas');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var w = canvas.width || 220;
    var h = canvas.height || 220;
    if (w <= 0 || h <= 0) return;
    var centerX = w / 2;
    var centerY = h / 2;
    var radius = Math.min(w, h) / 2 - 14;
    var lineWidth = 24;

    if (typeof estado === 'undefined' || !estado) return;
    var diaData = typeof getDiaData === 'function' && estado ? getDiaData(estado.diaOffset) : { ingresos: 0, gastos: 0 };
    const objetivo = 500;
    const porcentaje = Math.min((diaData.ingresos / objetivo) * 100, 100);
    const angulo = (porcentaje / 100) * 360;

    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.1)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (angulo > 0) {
        var gradient = ctx.createLinearGradient(0, 0, w, h);
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
if (typeof window !== 'undefined') window.initDonutCanvas = initDonutCanvas;

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

function getRankingVendedores() {
    var ingresos = estado.ingresosRegistros || [];
    var porUsuario = {};
    ingresos.forEach(function(r) {
        var u = r.registradoPor || '?';
        if (!porUsuario[u]) porUsuario[u] = { usuario: u, ventas: 0, numTransacciones: 0 };
        porUsuario[u].ventas += r.monto || 0;
        porUsuario[u].numTransacciones += 1;
    });
    var list = Object.keys(porUsuario).map(function(u) {
        var o = porUsuario[u];
        o.ticketMedio = o.numTransacciones > 0 ? o.ventas / o.numTransacciones : 0;
        return o;
    });
    list.sort(function(a, b) { return b.ventas - a.ventas; });
    return list;
}

function renderizarRanking() {
    if (typeof estado === 'undefined' || !estado) return;
    var container = document.getElementById('ranking-list');
    if (!container) return;
    container.innerHTML = '';
    var ranking = typeof getRankingVendedores === 'function' ? getRankingVendedores() : [];
    if (ranking.length === 0) {
        ranking = (estado.trabajadores || []).map(function(t) { return { usuario: t.nombre, ventas: t.ventas || 0, numTransacciones: 0, ticketMedio: 0 }; });
    }
    ranking.slice(0, 15).forEach(function(item, index) {
        const div = document.createElement('div');
        div.className = 'ranking-item' + (index === 0 ? ' first' : '');
        var avatar = (item.usuario || '?').slice(0, 2).toUpperCase();
        div.innerHTML = '<div class="ranking-position">' + (index + 1) + '</div>' +
            '<div class="ranking-avatar">' + avatar + '</div>' +
            '<div class="ranking-info"><div class="ranking-name">' + (item.usuario || '?') + '</div>' +
            '<div class="ranking-role">' + (item.numTransacciones || 0) + ' ventas · ' + (item.ticketMedio ? item.ticketMedio.toFixed(0) : '0') + '€ medio</div></div>' +
            '<div class="ranking-amount">' + (item.ventas || 0).toFixed(0) + '€</div>';
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
    };
    reader.readAsDataURL(input.files[0]);
}

function abrirModalTransaccion(tipo, categoria) {
    estado.transaccionActual = { tipo, categoria };
    document.getElementById('modal-transaccion-titulo').textContent = tipo === 'gasto' ? 'Nuevo Gasto' : 'Nuevo Ingreso';
    document.getElementById('modal-transaccion-categoria').textContent = categoria.nombre;
    document.getElementById('transaccion-monto').value = '';
    document.getElementById('transaccion-nota').value = '';
    document.getElementById('transaccion-gramos').value = '';
    estado.fotoActual = null;
    const preview = document.getElementById('foto-preview');
    if (preview) { preview.style.display = 'none'; preview.src = ''; }
    const stockBadge = document.getElementById('stock-badge');
    const gramosGroup = document.getElementById('gramos-group');
    const fotoGroup = document.getElementById('foto-group');
    if (stockBadge) stockBadge.style.display = 'none';
    if (gramosGroup) gramosGroup.style.display = 'none';
    if (fotoGroup) fotoGroup.style.display = 'block';
    if (tipo === 'gasto' && categoria.esRecarga) {
        if (stockBadge) stockBadge.style.display = 'block';
        if (gramosGroup) gramosGroup.style.display = 'block';
    }
    // Ingresos de Recarga B / Recarga V: mostrar gramos para descontar stock
    if (tipo === 'ingreso' && categoria.esRecarga) {
        if (gramosGroup) gramosGroup.style.display = 'block';
        if (stockBadge) { stockBadge.textContent = '📦 Stock descontado automáticamente'; stockBadge.style.display = 'block'; }
    }
    if (tipo === 'ingreso' && fotoGroup) fotoGroup.style.display = 'none';
    document.getElementById('modalTransaccion').classList.add('active');
    setTimeout(() => document.getElementById('transaccion-monto').focus(), 100);
    if (navigator.vibrate) navigator.vibrate(30);
}

function cerrarModalTransaccion() {
    var modal = document.getElementById('modalTransaccion');
    if (modal) modal.classList.remove('active');
    estado.transaccionActual = null;
    estado.fotoActual = null;
    var btn = document.getElementById('btn-guardar-transaccion');
    if (btn) { btn.disabled = false; btn.textContent = 'Guardar'; }
}


function editarReglasConsumo() { cambiarPantalla('tabla-precios'); }

function actualizarSaldos() {
    if (typeof estado === 'undefined' || !estado) return;
    var cuentas = estado.cuentas || {};
    function setText(id, text) { var e = document.getElementById(id); if (e) e.textContent = text; }
    setText('saldo-efectivo', (cuentas.efectivo || 0).toFixed(2) + '€');
    setText('saldo-bbva', (cuentas.bbva || 0).toFixed(2) + '€');
    setText('saldo-caja', (cuentas.caja || 0).toFixed(2) + '€');
    setText('saldo-monedero', (cuentas.monedero || 0).toFixed(2) + '€');
    var total = Object.values(cuentas).reduce(function(s, v) { return s + (v || 0); }, 0);
    setText('saldo-total', total.toFixed(2) + '€');
    var diaData = getDiaData(estado.diaOffset);
    var totalDeuda = (estado.clientes || []).reduce(function(acc, cli) { return acc + (cli.deuda || 0); }, 0);
    setText('dash-deuda', totalDeuda.toFixed(0) + '€');
    setText('dash-ingresos', diaData.ingresos.toFixed(0) + '€');
    setText('dash-gastos', diaData.gastos.toFixed(0) + '€');
    const sB = document.getElementById('stock-recargaB');
    const sV = document.getElementById('stock-recargaV');
    if (sB) sB.value = (estado.stockTotalB || 0).toFixed(2);
    if (sV) sV.value = (estado.stockTotalV || 0).toFixed(2);
    renderizarListaStock();
    renderizarTablaPrecios();
    renderizarOficina();
    // Refrescar desde la nube si Supabase está activo (solo si estamos en HOY)
    if (_supabase && estado.diaOffset === 0) cargarDatosDashboard();
}
