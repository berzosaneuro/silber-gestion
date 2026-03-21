/* SILBER GESTIÓN — stability.js
 * Hardening layer: safe state mutations, localStorage robustness,
 * data-consistency checks, Supabase clarity, render guards, perf throttle.
 * Load order: after state.js, before supabase.js
 */

// ─────────────────────────────────────────────
// 1. DEBUG FLAG
// ─────────────────────────────────────────────
// Set window.SILBER_DEBUG = true in DevTools console to enable verbose logging.
if (typeof window.SILBER_DEBUG === 'undefined') window.SILBER_DEBUG = false;

function silberLog(msg, data) {
    if (!window.SILBER_DEBUG) return;
    if (data !== undefined) console.log('[Silber]', msg, data);
    else console.log('[Silber]', msg);
}

function silberWarn(msg, data) {
    if (typeof console !== 'undefined' && console.warn) {
        if (data !== undefined) console.warn('[Silber]', msg, data);
        else console.warn('[Silber]', msg);
    }
}

// ─────────────────────────────────────────────
// 2. SAFE STATE MUTATION WRAPPER
// ─────────────────────────────────────────────
/**
 * updateEstado(fn) — apply a mutation to `estado` then persist atomically.
 * Usage:  updateEstado(e => { e.cuentas.efectivo += 50; });
 */
function updateEstado(fn) {
    try {
        fn(estado);
    } catch (e) {
        silberWarn('updateEstado — error en mutación:', e);
    }
    try {
        guardarEstado();
    } catch (e) {
        silberWarn('updateEstado — error al guardar:', e);
    }
}

// ─────────────────────────────────────────────
// 3. LOCALSTORAGE ROBUSTNESS
//    Patch guardarEstado with quota-error fallback
// ─────────────────────────────────────────────
(function _patchGuardarEstado() {
    var _origGuardar = guardarEstado;
    window.guardarEstado = function() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
            silberLog('guardarEstado OK');
        } catch (e) {
            if (e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014)) {
                silberWarn('guardarEstado — quota excedida, limpiando fotos y reintentando…');
                // Strip large blobs: clientes[*].foto, fotoActual
                try {
                    var stripped = JSON.parse(JSON.stringify(estado));
                    if (Array.isArray(stripped.clientes)) {
                        stripped.clientes.forEach(function(c) { delete c.foto; });
                    }
                    delete stripped.fotoActual;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
                    silberWarn('guardarEstado — guardado sin fotos (quota)');
                } catch (e2) {
                    silberWarn('guardarEstado — fallo total al guardar:', e2);
                }
            } else {
                silberWarn('guardarEstado — error inesperado:', e);
            }
        }
    };
})();

// ─────────────────────────────────────────────
// 4. DATA CONSISTENCY — validateEstado()
// ─────────────────────────────────────────────
/**
 * Ensures all critical keys exist and have the right types.
 * Called once after DOMContentLoaded (after all scripts are parsed).
 * Non-destructive: only fills in missing/corrupt fields.
 */
function validateEstado() {
    if (typeof estado === 'undefined' || !estado) {
        silberWarn('validateEstado — estado no definido, abortando');
        return;
    }

    var dirty = false;

    function ensure(key, defaultVal, checker) {
        var ok = (checker ? checker(estado[key]) : (estado[key] !== undefined && estado[key] !== null));
        if (!ok) {
            silberWarn('validateEstado — campo faltante/inválido: ' + key + ', restaurando default');
            estado[key] = (typeof defaultVal === 'function') ? defaultVal() : JSON.parse(JSON.stringify(defaultVal));
            dirty = true;
        }
    }

    // Primitive numbers
    ensure('diaOffset',  0, function(v) { return typeof v === 'number'; });
    ensure('umbralAlertaAltoValor', 200, function(v) { return typeof v === 'number' && v > 0; });
    ensure('stockTotalB', 0, function(v) { return typeof v === 'number'; });
    ensure('stockTotalV', 0, function(v) { return typeof v === 'number'; });
    ensure('costePorGramoB', 22, function(v) { return typeof v === 'number' && v > 0; });
    ensure('costePorGramoV', 1,  function(v) { return typeof v === 'number' && v > 0; });

    // Strings
    ensure('periodo', 'day', function(v) { return typeof v === 'string' && ['day','week','month','year'].indexOf(v) !== -1; });

    // Objects
    ensure('cuentas', { efectivo: 0, bbva: 0, caja: 0, monedero: 0 },
        function(v) { return v && typeof v === 'object' && !Array.isArray(v); });
    ensure('stock', { recargaB: 0, recargaV: 0 },
        function(v) { return v && typeof v === 'object' && !Array.isArray(v); });
    ensure('registrosDiarios', {},
        function(v) { return v && typeof v === 'object' && !Array.isArray(v); });
    ensure('stockProductos', {},
        function(v) { return v && typeof v === 'object' && !Array.isArray(v); });

    // Arrays
    ensure('clientes', [],    Array.isArray);
    ensure('productos', [],   Array.isArray);
    ensure('llegadas', [],    Array.isArray);
    ensure('listaStock', [],  Array.isArray);
    ensure('trabajadores', [], Array.isArray);
    ensure('stock_movements', [], Array.isArray);
    ensure('historialPantallas', ['dashboard'],
        function(v) { return Array.isArray(v) && v.length > 0; });

    // Validate individual client records (basic sanity)
    if (Array.isArray(estado.clientes)) {
        estado.clientes.forEach(function(c, i) {
            if (!c || typeof c !== 'object') {
                silberWarn('validateEstado — cliente[' + i + '] inválido, eliminando');
                estado.clientes[i] = null;
                dirty = true;
                return;
            }
            if (typeof c.deuda !== 'number')    { c.deuda = 0;    dirty = true; }
            if (typeof c.limite !== 'number')   { c.limite = 500; dirty = true; }
            if (!Array.isArray(c.historial))    { c.historial = []; dirty = true; }
            if (!c.nombre || typeof c.nombre !== 'string') {
                silberWarn('validateEstado — cliente[' + i + '] sin nombre, marcando');
                c.nombre = c.nombre || ('Cliente ' + (c.id || i));
                dirty = true;
            }
        });
        // Remove null slots
        var before = estado.clientes.length;
        estado.clientes = estado.clientes.filter(Boolean);
        if (estado.clientes.length !== before) dirty = true;
    }

    // Validate producto records
    if (Array.isArray(estado.productos)) {
        estado.productos.forEach(function(p, i) {
            if (!p || typeof p !== 'object') { estado.productos[i] = null; dirty = true; return; }
            if (typeof p.stock_gramos !== 'number') { p.stock_gramos = 0; dirty = true; }
            if (typeof p.precio_por_gramo !== 'number') { p.precio_por_gramo = 0; dirty = true; }
        });
        var beforeP = estado.productos.length;
        estado.productos = estado.productos.filter(Boolean);
        if (estado.productos.length !== beforeP) dirty = true;
    }

    // Validate cuentas values are numbers
    if (estado.cuentas && typeof estado.cuentas === 'object') {
        ['efectivo','bbva','caja','monedero'].forEach(function(k) {
            if (typeof estado.cuentas[k] !== 'number') {
                silberWarn('validateEstado — cuentas.' + k + ' no es número, reseteando a 0');
                estado.cuentas[k] = 0;
                dirty = true;
            }
        });
    }

    if (dirty) {
        silberWarn('validateEstado — estado reparado, guardando…');
        guardarEstado();
    } else {
        silberLog('validateEstado — estado OK');
    }
}

// ─────────────────────────────────────────────
// 5. SAFE RENDER GUARD
// ─────────────────────────────────────────────
/**
 * safeRender(fn, label) — execute a render function, catching any error
 * gracefully so one broken render doesn't break the rest.
 * Usage:  safeRender(renderizarClientes, 'clientes');
 */
function safeRender(fn, label) {
    try {
        if (typeof fn === 'function') fn();
    } catch (e) {
        silberWarn('safeRender [' + (label || '?') + '] — error:', e);
    }
}

// ─────────────────────────────────────────────
// 6. SUPABASE CLARITY GUARD
// ─────────────────────────────────────────────
/**
 * silberSupabaseGuard(label, promise) — wraps a Supabase promise call with
 * debug logging of success/failure. Returns the original promise.
 * Usage:  silberSupabaseGuard('cargarClientes', _supabase.from('clientes').select('*'))
 */
function silberSupabaseGuard(label, promise) {
    if (!promise || typeof promise.then !== 'function') {
        silberWarn('silberSupabaseGuard [' + label + '] — recibió un valor no-promise:', promise);
        return Promise.resolve(null);
    }
    silberLog('Supabase [' + label + '] — iniciando…');
    return promise.then(function(res) {
        if (res && res.error) {
            silberWarn('Supabase [' + label + '] — error:', res.error);
        } else {
            silberLog('Supabase [' + label + '] — OK', window.SILBER_DEBUG ? res : undefined);
        }
        return res;
    }).catch(function(e) {
        silberWarn('Supabase [' + label + '] — excepción:', e);
        throw e;
    });
}

// ─────────────────────────────────────────────
// 7. DOMContentLoaded — post-load hooks
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {

    // ── 7a. Run data consistency check ──────────────────────────────
    try { validateEstado(); } catch (e) { silberWarn('validateEstado excepción:', e); }

    // ── 7b. Log Supabase availability ────────────────────────────────
    setTimeout(function() {
        if (typeof _supabase === 'undefined' || !_supabase) {
            silberLog('Supabase — no activo (modo local)');
        } else {
            silberLog('Supabase — activo y conectado');
        }
    }, 200);

    // ── 7c. Throttle actualizarSaldos (leading + trailing, 200ms) ───
    setTimeout(function() {
        if (typeof window.actualizarSaldos === 'function' && !window.actualizarSaldos._throttled) {
            var _origSaldos = window.actualizarSaldos;
            var _saldosTimer = null;
            var _saldosPending = false;
            var _saldosRunning = false;

            window.actualizarSaldos = function() {
                if (!_saldosRunning) {
                    // Leading edge: run immediately
                    _saldosRunning = true;
                    try { _origSaldos(); } catch(e) { silberWarn('actualizarSaldos error:', e); }
                    _saldosTimer = setTimeout(function() {
                        _saldosRunning = false;
                        if (_saldosPending) {
                            _saldosPending = false;
                            window.actualizarSaldos(); // trailing edge
                        }
                    }, 200);
                } else {
                    // Coalesce subsequent calls into trailing edge
                    _saldosPending = true;
                }
            };
            window.actualizarSaldos._throttled = true;
            silberLog('actualizarSaldos — throttle activo (200ms)');
        }
    }, 0);

    // ── 7d. Wrap key render functions with safeRender ─────────────────
    setTimeout(function() {
        var renders = [
            'renderizarClientes',
            'renderizarRanking',
            'renderizarCategoriasGastos',
            'renderizarCategoriasIngresos',
            'renderizarTablaPrecios',
            'renderizarOficina',
            'renderizarListaStock',
            'renderizarProductos'
        ];
        renders.forEach(function(name) {
            if (typeof window[name] === 'function' && !window[name]._safeWrapped) {
                var _orig = window[name];
                window[name] = function() {
                    try { _orig.apply(this, arguments); }
                    catch(e) { silberWarn('safeRender [' + name + ']:', e); }
                };
                window[name]._safeWrapped = true;
            }
        });
        silberLog('safeRender — render guards aplicados');
    }, 0);

});
