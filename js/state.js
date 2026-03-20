/* SILBER GESTIÓN — state.js */

// Credenciales: definibles desde fuera para no commitear secretos (window.SILBER_USUARIOS antes de cargar scripts).
// Por defecto, valores alineados con la documentación; en producción cambiar o inyectar vía SILBER_USUARIOS.
var USUARIOS = (typeof window !== 'undefined' && window.SILBER_USUARIOS && Array.isArray(window.SILBER_USUARIOS))
    ? window.SILBER_USUARIOS
    : [
        { username: 'Jefazo', password: '15031980', role: 'JEFAZO' },
        { username: 'Jefaza', password: '03021987', role: 'JEFAZA' }
    ];
var sesionActual = null;

const STORAGE_KEY = 'silber_gestion_v2';
const PREFS_KEY = 'silber_prefs';

function toggleConfigPref(key, el) {
    el.classList.toggle('active');
    try {
        var prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        prefs[key] = el.classList.contains('active');
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch (e) {}
}

function restaurarPreferenciasConfig() {
    try {
        var prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        ['notif', 'sonidos', 'vibra'].forEach(function(k) {
            var el = document.getElementById('config-' + k);
            if (el) {
                if (prefs[k] !== false) el.classList.add('active'); else el.classList.remove('active');
            }
        });
    } catch (e) {}
}

function cargarEstado() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return null;
}

function guardarEstado() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch(e) { console.warn('Error guardando:', e); }
}

const estadoInicial = {
    periodo: 'day',
    diaOffset: 0,
    cuentas: { efectivo: 487, bbva: 1250, caja: 320, monedero: 150 },
    stock: { recargaB: 0, recargaV: 0 },
    stockTotalB: 0,
    stockTotalV: 0,
    costePorGramoB: 22,
    costePorGramoV: 1,
    stockProductos: {
        'Bolsa':       { precio: 25,  gramaje: 0.5, stock: 0 },
        'Piedra 28':   { precio: 28,  gramaje: 1,   stock: 0 },
        'Piedra 30':   { precio: 30,  gramaje: 1,   stock: 0 },
        'Piedra 32':   { precio: 32,  gramaje: 1,   stock: 0 },
        'Piedra 34':   { precio: 34,  gramaje: 1,   stock: 0 },
        'Verde':       { precio: 5,   gramaje: 1,   stock: 0 },
        'Brócoli 3':   { precio: 3,   gramaje: 1,   stock: 0 },
        'Brócoli 3.5': { precio: 3.5, gramaje: 1,   stock: 0 }
    },
    listaStock: [],
    trabajadores: [
        { id: 1, nombre: 'María García', role: 'Vendedora', ventas: 420, avatar: 'MG' },
        { id: 2, nombre: 'Tú (Admin)', role: 'Administrador', ventas: 487, avatar: 'US' },
        { id: 3, nombre: 'Carlos López', role: 'Vendedor', ventas: 350, avatar: 'CL' }
    ],
    registrosDiarios: {},
    clientes: [
        { id: 1, nombre: 'Juan Pérez', whatsapp: '+34 600 111 222', limite: 500, diaPago: 15, producto: 'bolsa', deuda: 150, historial: [
            { fecha: '2026-02-10', tipo: 'Venta', monto: 50, deudaTotal: 150 },
            { fecha: '2026-02-01', tipo: 'Pago', monto: -100, deudaTotal: 100 }
        ]}
    ],
    historialPantallas: ['dashboard'],
    transaccionActual: null,
    clienteActual: null,
    fotoActual: null
};

var estado;
try {
    var estadoCargado = cargarEstado();
    estado = estadoCargado || JSON.parse(JSON.stringify(estadoInicial));
    if (!estado.historialPantallas || !estado.historialPantallas.length) {
        estado.historialPantallas = ['dashboard'];
    } else {
        estado.historialPantallas = estado.historialPantallas.filter(function(p) { return p !== 'login'; });
        if (!estado.historialPantallas.length) estado.historialPantallas = ['dashboard'];
    }
    estado.historialPantallas = ['dashboard'];
} catch (e) {
    estado = { historialPantallas: ['dashboard'], diaOffset: 0, periodo: 'day', cuentas: {}, registrosDiarios: {}, categoriasGastos: [], categoriasIngresos: [], stockProductos: {}, productos: [], stock_movements: [] };
}

// Migración: asegurar que stockProductos existe y tiene el formato correcto
if (!estado.stockProductos) {
    estado.stockProductos = {
        'Bolsa':       { precio: 25,  gramaje: 0.5, stock: 0 },
        'Piedra 28':   { precio: 28,  gramaje: 1,   stock: 0 },
        'Piedra 30':   { precio: 30,  gramaje: 1,   stock: 0 },
        'Piedra 32':   { precio: 32,  gramaje: 1,   stock: 0 },
        'Piedra 34':   { precio: 34,  gramaje: 1,   stock: 0 },
        'Verde':       { precio: 5,   gramaje: 1,   stock: 0 },
        'Brócoli 3':   { precio: 3,   gramaje: 1,   stock: 0 },
        'Brócoli 3.5': { precio: 3.5, gramaje: 1,   stock: 0 }
    };
}
// Limpiar reglasConsumo obsoleto si existe
delete estado.reglasConsumo;
// Umbral para alerta de transacción de alto valor (€)
if (typeof estado.umbralAlertaAltoValor !== 'number') estado.umbralAlertaAltoValor = 200;
// Productos (módulo productos.js): id, nombre, precio_por_gramo, stock_gramos, stock_minimo, activo, created_at
if (!estado.productos) estado.productos = [];
// Historial de movimientos de stock: producto, tipo, cantidad_gramos, usuario, timestamp
if (!estado.stock_movements) estado.stock_movements = [];
// Registro de llegadas de trabajadores a clientes (geolocalización)
if (!Array.isArray(estado.llegadas)) estado.llegadas = [];

estado.categoriasGastos = [
    { nombre: 'Casa', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>` },
    { nombre: 'Comida', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M3 2v7c0 2.8 2.2 5 5 5s5-2.2 5-5V2"/><path d="M8 2v7"/><path d="M16 2v4a4 4 0 004 4v12"/></svg>` },
    { nombre: 'Salud', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M12 5v14M5 12h14"/></svg>` },
    { nombre: 'Ocio', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="7" cy="12" r="1.5" fill="white"/><circle cx="17" cy="12" r="1.5" fill="white"/></svg>` },
    { nombre: 'Café', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M17 8h1a4 4 0 010 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><path d="M6 2v2M10 2v2"/></svg>` },
    { nombre: 'Tabaco', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M2 15h14M2 18h14M18 15h.01M21 15v3M18 9c0-3 3-3 3-6"/></svg>` },
    { nombre: 'Transporte', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>` },
    { nombre: 'Gimnasio', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4M6 12h12"/></svg>` },
    { nombre: 'Familia', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 21v-2a5 5 0 0110 0v2"/><path d="M17 21v-1.5a4 4 0 00-4-4"/></svg>` },
    { nombre: 'Regalos', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="3" y="8" width="18" height="4" rx="1"/><rect x="5" y="12" width="14" height="9" rx="1"/><path d="M12 8v13"/><path d="M8 8c0-2 2-4 4-4s4 2 4 4"/></svg>` },
    { nombre: 'Belleza', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M7 3h2v14a2 2 0 01-4 0V3h2zM15 3h2v14a2 2 0 01-4 0V3h2z"/></svg>` },
    { nombre: 'Ropa', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M20.38 3.46L16 2a4 4 0 01-8 0L3.62 3.46a2 2 0 00-1.34 2.23l.58 3.57a1 1 0 00.99.84H6v10a1 1 0 001 1h10a1 1 0 001-1V10h2.15a1 1 0 00.99-.84l.58-3.57a2 2 0 00-1.34-2.23z"/></svg>` },
    { nombre: 'Coche', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M5 17H3v-5l2-4h14l2 4v5h-2M5 17a2 2 0 104 0M15 17a2 2 0 104 0"/><path d="M3 12h18"/></svg>` },
    { nombre: 'Material', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><path d="M12 12v5M9.5 14.5h5"/></svg>` },
    { nombre: 'Farmacia', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2h-4M9 3a3 3 0 006 0M12 9v6M9 12h6"/></svg>` },
    { nombre: 'Servicios', color: '#0EA5E9', esRecarga: false, icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>` },
    { nombre: 'Recarga B', color: '#3B82F6', esRecarga: 'recargaB', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16M3 22h12M15 8h2a2 2 0 012 2v3a2 2 0 002 2 2 2 0 002-2V9l-3-3"/><path d="M6 10h6M6 14h6"/></svg>` },
    { nombre: 'Recarga V', color: '#10B981', esRecarga: 'recargaV', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M3 22V6a2 2 0 012-2h8a2 2 0 012 2v16M3 22h12M15 8h2a2 2 0 012 2v3a2 2 0 002 2 2 2 0 002-2V9l-3-3"/><path d="M6 10h6"/></svg>` }
];

estado.categoriasIngresos = [
    { nombre: 'Bolsa', color: '#3B82F6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>` },
    { nombre: 'Piedra 28', color: '#3B82F6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M12 2L2 8l10 6 10-6-10-6z"/><path d="M2 16l10 6 10-6M2 12l10 6 10-6"/></svg>` },
    { nombre: 'Piedra 30', color: '#3B82F6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><polygon points="12 2 19 7 19 17 12 22 5 17 5 7"/><line x1="5" y1="7" x2="19" y2="7"/><line x1="5" y1="17" x2="19" y2="17"/></svg>` },
    { nombre: 'Piedra 32', color: '#3B82F6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M6 3h12l4 6-10 13L2 9z"/><line x1="2" y1="9" x2="22" y2="9"/></svg>` },
    { nombre: 'Verde', color: '#10B981', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>` },
    { nombre: 'Brócoli 3', color: '#10B981', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><circle cx="12" cy="7" r="4"/><circle cx="7" cy="10" r="3"/><circle cx="17" cy="10" r="3"/><path d="M10 20h4M12 14v6"/></svg>` },
    { nombre: 'Otros', color: '#10B981', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` },
    { nombre: 'War', color: '#EF4444', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><path d="M12 2v10M12 22v-4M4.93 4.93l3.54 3.54M19.07 4.93l-3.54 3.54M2 12h4M22 12h-4"/><circle cx="12" cy="12" r="3"/></svg>` },
    { nombre: 'Salario', color: '#3B82F6', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><path d="M12 15h.01"/></svg>` },
    { nombre: 'Regalo', color: '#EC4899', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><rect x="3" y="8" width="18" height="4" rx="1"/><rect x="5" y="12" width="14" height="9" rx="1"/><path d="M12 8v13"/><path d="M8 8c0-2 2-4 4-4s4 2 4 4"/></svg>` },
    { nombre: 'Interés', color: '#10B981', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>` },
    { nombre: 'Deuda', color: '#6366F1', icon: `<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="34" height="34"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>` }
];

// ===== HELPERS =====
function fechaConOffset(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split('T')[0];
}

function labelDia(offset) {
    if (estado.periodo === 'week')  return 'SEMANA';
    if (estado.periodo === 'month') return 'MES';
    if (estado.periodo === 'year')  return 'AÑO';
    if (offset === 0) return 'HOY';
    if (offset === -1) return 'AYER';
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase();
}

function getDiaData(offset) {
    if (typeof estado === 'undefined' || !estado) return { gastos: 0, ingresos: 0 };
    var periodo = estado.periodo || 'day';

    if (periodo === 'day') {
        if (!estado.registrosDiarios) estado.registrosDiarios = {};
        var key = typeof fechaConOffset === 'function' ? fechaConOffset(offset) : '';
        if (!key) return { gastos: 0, ingresos: 0 };
        if (!estado.registrosDiarios[key]) estado.registrosDiarios[key] = { gastos: 0, ingresos: 0 };
        return estado.registrosDiarios[key];
    }

    // Para semana/mes/año: sumar registrosDiarios de las fechas del rango
    const hoy = new Date();
    let desde;
    if (periodo === 'week') {
        desde = new Date(hoy);
        desde.setDate(hoy.getDate() - 6);
    } else if (periodo === 'month') {
        desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    } else if (periodo === 'year') {
        desde = new Date(hoy.getFullYear(), 0, 1);
    }

    var gastos = 0, ingresos = 0;
    var regs = estado.registrosDiarios || {};
    Object.keys(regs).forEach(function(key) {
        const d = new Date(key);
        if (d >= desde && d <= hoy) {
            gastos   += (regs[key] && regs[key].gastos)   || 0;
            ingresos += (regs[key] && regs[key].ingresos) || 0;
        }
    });
    return { gastos: gastos, ingresos: ingresos };
}

// USUARIOS y sesionActual ya definidos al inicio del archivo para que el login siempre funcione

// ===== INIT =====
document.addEventListener('DOMContentLoaded', function() {

    // ── No restaurar sesión al cargar: siempre mostrar login primero (evita pantalla en blanco) ──
    // Si quieres "recordar sesión" en el futuro, descomenta el bloque restaurarSesion y elimina el clear:
    try { localStorage.removeItem('silber_sesion_activa'); } catch(e) {}
    try { document.body.classList.add('login-visible'); } catch(e) {}

    function initCanvas() {
        try {
            var canvas = document.getElementById('donutCanvas');
            if (!canvas || !canvas.getContext) return;
            var parent = canvas.parentElement;
            var w = (parent && parent.offsetWidth > 0) ? parent.offsetWidth : 240;
            var h = (parent && parent.offsetHeight > 0) ? parent.offsetHeight : 240;
            canvas.width = w;
            canvas.height = h;
            if (typeof dibujarDonut === 'function') dibujarDonut();
        } catch (e) { if (typeof console !== 'undefined' && console.warn) console.warn('[Silber] initCanvas:', e); }
    }
    try {
        initCanvas();
        setTimeout(initCanvas, 100);
        if (typeof renderizarRanking === 'function') renderizarRanking();
        if (typeof renderizarCategoriasGastos === 'function') renderizarCategoriasGastos();
        if (typeof renderizarCategoriasIngresos === 'function') renderizarCategoriasIngresos();
        if (typeof renderizarClientes === 'function') renderizarClientes();
        if (typeof actualizarSaldos === 'function') actualizarSaldos();
        if (typeof actualizarTimeMachine === 'function') actualizarTimeMachine();
        if (typeof renderizarTablaPrecios === 'function') renderizarTablaPrecios();
        if (typeof renderizarOficina === 'function') renderizarOficina();
        if (typeof llenarSelectProductos === 'function') { llenarSelectProductos('alta-producto'); llenarSelectProductos('alta-producto2'); }
        restaurarPreferenciasConfig();
        if (typeof window._silberDebug === 'function') window._silberDebug('init-done');
    } catch (e) { if (typeof console !== 'undefined' && console.warn) console.warn('[Silber] DOMContentLoaded init:', e); }

    // Reset diario: guardar última fecha activa y resetear vista si cambió el día
    try {
        const hoyKey = new Date().toISOString().split('T')[0];
        if (estado._ultimoDia && estado._ultimoDia !== hoyKey) {
            revueltaDiaria(hoyKey);
        } else if (!estado._ultimoDia) {
            estado._ultimoDia = hoyKey;
            guardarEstado();
        }
    } catch(e) { console.warn('Error en reset diario:', e); }

    // Comprobar cambio de día cada minuto (para uso nocturno continuo)
    setInterval(() => {
        const ahora = new Date().toISOString().split('T')[0];
        if (estado._ultimoDia && estado._ultimoDia !== ahora) {
            revueltaDiaria(ahora);
        }
    }, 60000);
});