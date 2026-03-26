/* SILBER GESTIÓN — supabase.js
   Sync opcional con Supabase. La fuente de verdad es localStorage (estado);
   si Supabase falla o no está configurado, la app sigue funcionando en local.
*/
if (typeof window !== 'undefined') window.SILBER_DEBUG = true;
function log() {
    if (typeof window !== 'undefined' && window.SILBER_DEBUG && typeof console !== 'undefined' && console.log) {
        console.log.apply(console, arguments);
    }
}
if (typeof window !== 'undefined') window.log = log;

// Supabase es opcional. Si no se inyecta URL/KEY, la app funciona 100% local sin ruido de red.
var SUPABASE_URL = typeof window !== 'undefined' && window.SILBER_SUPABASE_URL ? window.SILBER_SUPABASE_URL : '';
var SUPABASE_KEY = typeof window !== 'undefined' && window.SILBER_SUPABASE_KEY ? window.SILBER_SUPABASE_KEY : '';
var _supabase = null;
try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL !== 'TU_URL_DE_SUPABASE') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) { console.warn('Supabase no iniciado:', e); }
if (typeof window !== 'undefined') window._supabase = _supabase;
var _silberTableSyncEnabled = !!_supabase;
var _silberCorePushInFlight = false;
var _silberCorePullTimer = null;
var _silberLastCorePushAt = 0;
var _silberCoreSyncRetryPending = false;
var _silberCoreRetryTimer = null;
if (typeof window !== 'undefined') window.__silberTableSyncEnabled = _silberTableSyncEnabled;

function _sbInfo(msg, data) {
    if (typeof console === 'undefined' || !console.info) return;
    if (data !== undefined) console.info('[Silber]', msg, data);
    else console.info('[Silber]', msg);
}
function _sbGetCurrentUser(required) {
    var currentUser = null;
    try { currentUser = JSON.parse(localStorage.getItem('silber_sesion_activa') || 'null'); } catch (_) {}
    if (!currentUser || !currentUser.usuario) {
        console.error('No active user session');
        if (required) throw new Error('User not logged in');
        return null;
    }
    return currentUser;
}
function _sbNewId() {
    try {
        if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (_) {}
    return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

// ===== DASHBOARD DESDE SUPABASE =====
async function cargarDatosDashboard() {
    // Deshabilitado: la fuente de verdad es el ledger local (estado.*Registros).
    // Este método antes sobreescribía totales diarios y creaba inconsistencias UI.
    return;
}

// ——— Worker location (persist to Supabase, fallback silent)
function saveWorkerLocation(user, role, lat, lng) {
    if (typeof _supabase === 'undefined' || !_supabase) return;
    try {
        var ts = new Date().toISOString().slice(0, 16);
        _supabase.from('worker_locations').insert({ user: user || '?', role: role || '?', lat: lat, lng: lng, timestamp: ts }).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] worker_locations:', err); });
    } catch (err) {}
}

// ——— Sync clients to Supabase (upsert by id)
function syncClientsToSupabase() {
    if (typeof _supabase === 'undefined' || !_supabase || !estado.clientes || !estado.clientes.length) return;
    if (_silberTableSyncEnabled) {
        // En modo tablas core, un único sync conserva consistencia entre entidades.
        _triggerCloudSync();
        return;
    }
    try {
        estado.clientes.forEach(function(c) {
            var row = { id: String(c.id), nombre: c.nombre, whatsapp: c.whatsapp || '', limite: c.limite || 0, dia_pago: c.diaPago || 1, producto: c.producto || '', deuda: c.deuda || 0, lat: c.lat != null ? c.lat : null, lng: c.lng != null ? c.lng : null };
            _supabase.from('clientes').upsert(row, { onConflict: 'id' }).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] clientes upsert:', err); });
        });
    } catch (err) {}
}

function _sbNum(v, d) {
    var n = Number(v);
    return Number.isFinite(n) ? n : (d || 0);
}
function _sbReadDbDeudasLocal() {
    try {
        var s = localStorage.getItem('db_deudas');
        if (s) return JSON.parse(s);
    } catch (_) {}
    return { clientes: [], deudas: [], historial: [] };
}
function _sbWriteDbDeudasLocal(db) {
    try { localStorage.setItem('db_deudas', JSON.stringify(db || { clientes: [], deudas: [], historial: [] })); } catch (_) {}
}
async function _sbFetchTable(table) {
    if (!_supabase) return null;
    try {
        var q = _supabase.from(table).select('*');
        // Aislamiento por usuario para clientes (producción): cada user ve solo sus filas.
        if (table === 'clientes') {
            var cur = _sbGetCurrentUser(true);
            q = q.eq('user_id', cur.usuario);
        }
        var res = await q;
        if (res.error) throw res.error;
        return Array.isArray(res.data) ? res.data : [];
    } catch (e) {
        silberWarn('[CORE_SYNC] fetch ' + table + ' falló:', e);
        return null;
    }
}
function _sbUniqueIds(rows, key) {
    var out = [];
    var seen = {};
    (rows || []).forEach(function(r) {
        if (!r || r[key] == null) return;
        var id = String(r[key]);
        if (seen[id]) return;
        seen[id] = true;
        out.push(id);
    });
    return out;
}
function _sbChunk(arr, size) {
    var out = [];
    for (var i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}
async function _sbDeleteMissingRows(table, key, nextIds) {
    if (!_supabase) return false;
    try {
        var selQ = _supabase.from(table).select(key);
        var scopedUser = null;
        if (table === 'clientes') {
            scopedUser = _sbGetCurrentUser(true);
            selQ = selQ.eq('user_id', scopedUser.usuario);
        }
        var sel = await selQ;
        if (sel.error) throw sel.error;
        var keep = {};
        (nextIds || []).forEach(function(id) { keep[String(id)] = true; });
        var toDelete = (sel.data || [])
            .map(function(r) { return r && r[key] != null ? String(r[key]) : null; })
            .filter(function(id) { return id && !keep[id]; });
        if (!toDelete.length) return true;
        var chunks = _sbChunk(toDelete, 250);
        for (var i = 0; i < chunks.length; i++) {
            var delQ = _supabase.from(table).delete().in(key, chunks[i]);
            if (table === 'clientes' && scopedUser) delQ = delQ.eq('user_id', scopedUser.usuario);
            var delRes = await delQ;
            if (delRes.error) throw delRes.error;
        }
        return true;
    } catch (e) {
        silberWarn('[CORE_SYNC] prune ' + table + ' falló:', e);
        return false;
    }
}
async function _sbUpsertTableRows(table, key, rows, pruneMissing) {
    if (!_supabase) return false;
    try {
        var safeRows = Array.isArray(rows) ? rows : [];
        if (safeRows.length) {
            safeRows.forEach(function(r) {
                if (!r) return;
                if (!r[key]) r[key] = _sbNewId();
            });
        }
        if (table === 'clientes' && safeRows.length) {
            var cur = _sbGetCurrentUser(true);
            safeRows = safeRows.map(function(r) {
                var out = Object.assign({}, r);
                out.user_id = cur.usuario;
                return out;
            });
        }
        if (safeRows.length) {
            var upRes = await _supabase.from(table).upsert(safeRows, { onConflict: key });
            if (upRes.error) throw upRes.error;
        }
        if (pruneMissing) {
            var ids = _sbUniqueIds(safeRows, key);
            var okPrune = await _sbDeleteMissingRows(table, key, ids);
            if (!okPrune) return false;
        }
        return true;
    } catch (e) {
        silberWarn('[CORE_SYNC] upsert ' + table + ' falló:', e);
        return false;
    }
}
function _sbIsCoreBundleEmpty(b) {
    return (!b.clientes || !b.clientes.length)
        && (!b.cuentas || !b.cuentas.length)
        && (!b.transacciones || !b.transacciones.length)
        && (!b.deudas || !b.deudas.length)
        && (!b.productos || !b.productos.length);
}
function _sbMapCuentasRowsToEstado(rows) {
    if (!rows || !rows.length) return null;
    var one = rows[0] || {};
    if (one.efectivo != null || one.bbva != null || one.caja != null || one.monedero != null) {
        return {
            efectivo: _sbNum(one.efectivo, 0),
            bbva: _sbNum(one.bbva, 0),
            caja: _sbNum(one.caja, 0),
            monedero: _sbNum(one.monedero, 0)
        };
    }
    var out = { efectivo: 0, bbva: 0, caja: 0, monedero: 0 };
    rows.forEach(function(r) {
        var k = String(r.nombre || r.cuenta || r.id || '').toLowerCase();
        var val = _sbNum(r.saldo != null ? r.saldo : (r.monto != null ? r.monto : r.valor), 0);
        if (k === 'efectivo' || k === 'bbva' || k === 'caja' || k === 'monedero') out[k] = val;
    });
    return out;
}
function _sbBuildCoreRowsFromEstado() {
    var curUser = null;
    try { curUser = _sbGetCurrentUser(false); } catch (_) {}
    var clientes = (estado.clientes || []).map(function(c) {
        return {
            id: String(c.id || _sbNewId()),
            user_id: curUser && curUser.usuario ? curUser.usuario : undefined,
            nombre: c.nombre || '',
            telefono: c.telefono || c.whatsapp || '',
            whatsapp: c.whatsapp || c.telefono || '',
            limite: _sbNum(c.limite, 0),
            dia_pago: _sbNum(c.diaPago, 1),
            producto: c.producto || '',
            deuda: _sbNum(c.deuda, 0),
            lat: c.lat != null ? _sbNum(c.lat, null) : null,
            lng: c.lng != null ? _sbNum(c.lng, null) : null
        };
    });
    var cuentas = ['efectivo', 'bbva', 'caja', 'monedero'].map(function(k) {
        return { id: k, nombre: k, saldo: _sbNum((estado.cuentas || {})[k], 0) };
    });
    var transacciones = [];
    (estado.gastosRegistros || []).forEach(function(r) {
        transacciones.push({
            id: String(r.id != null ? r.id : _sbNewId()),
            tipo: 'gasto',
            categoria: r.categoria || '',
            monto: _sbNum(r.monto, 0),
            cuenta: r.cuenta || 'efectivo',
            fecha: r.fecha || new Date().toISOString().split('T')[0],
            hora: r.hora || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            gramos: _sbNum(r.gramos, 0),
            nota: r.nota || '',
            registrado_por: r.registradoPor || (sesionActual ? sesionActual.usuario : '?')
        });
    });
    (estado.ingresosRegistros || []).forEach(function(r) {
        transacciones.push({
            id: String(r.id != null ? r.id : _sbNewId()),
            tipo: 'ingreso',
            categoria: r.categoria || '',
            monto: _sbNum(r.monto, 0),
            cuenta: r.cuenta || 'efectivo',
            fecha: r.fecha || new Date().toISOString().split('T')[0],
            hora: r.hora || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            gramos: _sbNum(r.gramos, 0),
            nota: r.nota || '',
            registrado_por: r.registradoPor || (sesionActual ? sesionActual.usuario : '?')
        });
    });
    var db = _sbReadDbDeudasLocal();
    var deudas = (db.deudas || []).map(function(d) {
        return {
            id: String(d.id != null ? d.id : _sbNewId()),
            cliente_id: String(d.cliente_id || ''),
            producto: d.producto || '',
            cantidad: _sbNum(d.cantidad, 0),
            dia_pago: _sbNum(d.dia_pago, 1),
            fecha_creacion: d.fecha_creacion || new Date().toISOString().split('T')[0],
            pagada: !!d.pagada,
            historial_pagos: Array.isArray(d.historial_pagos) ? d.historial_pagos : []
        };
    });
    var productos = (estado.productos || []).map(function(p) {
        return {
            id: String(p.id != null ? p.id : _sbNewId()),
            nombre: p.nombre || '',
            precio_por_gramo: _sbNum(p.precio_por_gramo, 0),
            stock_gramos: _sbNum(p.stock_gramos, 0),
            stock_minimo: _sbNum(p.stock_minimo, 0),
            activo: p.activo !== false,
            created_at: p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
        };
    });
    return { clientes: clientes, cuentas: cuentas, transacciones: transacciones, deudas: deudas, productos: productos };
}
async function fetchClientes() {
    if (!_supabase) return { data: [], error: null };
    var currentUser = _sbGetCurrentUser(true);
    return _supabase
        .from('clientes')
        .select('*')
        .eq('user_id', currentUser.usuario);
}
if (typeof window !== 'undefined') window.fetchClientes = fetchClientes;
async function _syncCoreTablesFromEstado(opts) {
    if (!_supabase) return false;
    if (_silberCorePushInFlight) return false;
    var options = opts || {};
    var pruneMissing = options.pruneMissing !== false;
    _silberCorePushInFlight = true;
    try {
        var rows = _sbBuildCoreRowsFromEstado();
        var ok1 = await _sbUpsertTableRows('clientes', 'id', rows.clientes, pruneMissing);
        var ok2 = await _sbUpsertTableRows('cuentas', 'id', rows.cuentas, pruneMissing);
        var ok3 = await _sbUpsertTableRows('transacciones', 'id', rows.transacciones, pruneMissing);
        var ok4 = await _sbUpsertTableRows('deudas', 'id', rows.deudas, pruneMissing);
        var ok5 = await _sbUpsertTableRows('productos', 'id', rows.productos, pruneMissing);
        var ok = !!(ok1 && ok2 && ok3 && ok4 && ok5);
        if (ok) {
            _silberLastCorePushAt = Date.now();
            _silberCoreSyncRetryPending = false;
            if (_silberCoreRetryTimer) {
                clearTimeout(_silberCoreRetryTimer);
                _silberCoreRetryTimer = null;
            }
            _sbInfo('[CORE_SYNC] SAVE OK (tablas)');
        }
        return ok;
    } catch (e) {
        silberWarn('[CORE_SYNC] syncCoreTablesFromEstado excepción:', e);
        return false;
    } finally {
        _silberCorePushInFlight = false;
    }
}
function _sbNormalizeCoreBundle(bundle) {
    return {
        clientes: (bundle && Array.isArray(bundle.clientes)) ? bundle.clientes : [],
        cuentas: (bundle && Array.isArray(bundle.cuentas)) ? bundle.cuentas : [],
        transacciones: (bundle && Array.isArray(bundle.transacciones)) ? bundle.transacciones : [],
        deudas: (bundle && Array.isArray(bundle.deudas)) ? bundle.deudas : [],
        productos: (bundle && Array.isArray(bundle.productos)) ? bundle.productos : []
    };
}
function _silberHasAnyRows(bundle) {
    var b = _sbNormalizeCoreBundle(bundle);
    return b.clientes.length || b.cuentas.length || b.transacciones.length || b.deudas.length || b.productos.length;
}
async function _sbFetchCoreBundle() {
    if (!_supabase) return null;
    var bundle = {
        clientes: await _sbFetchTable('clientes'),
        cuentas: await _sbFetchTable('cuentas'),
        transacciones: await _sbFetchTable('transacciones'),
        deudas: await _sbFetchTable('deudas'),
        productos: await _sbFetchTable('productos')
    };
    if (!bundle.clientes && !bundle.cuentas && !bundle.transacciones && !bundle.deudas && !bundle.productos) return null;
    return _sbNormalizeCoreBundle(bundle);
}
function _silberScheduleCoreRetry(reason) {
    if (!_supabase || !_silberTableSyncEnabled) return;
    _silberCoreSyncRetryPending = true;
    if (_silberCoreRetryTimer) return;
    silberWarn('[CORE_SYNC] modo fallback local; reintento en 5s (' + (reason || 'save error') + ')');
    _silberCoreRetryTimer = setTimeout(function() {
        _silberCoreRetryTimer = null;
        if (!_silberCoreSyncRetryPending) return;
        syncEstadoToCloud().then(function(ok) {
            if (!ok) _silberScheduleCoreRetry('retry failed');
        }).catch(function() {
            _silberScheduleCoreRetry('retry exception');
        });
    }, 5000);
}
async function _silberBootstrapCoreTables() {
    if (!_supabase) return false;
    var bundle = await _sbFetchCoreBundle();
    if (!bundle) return false;

    // Migración inicial one-shot: cloud vacío -> subir estado local sin poda destructiva.
    if (!_silberHasAnyRows(bundle)) {
        _sbInfo('[CORE_SYNC] cloud vacío; iniciando migración local -> Supabase');
        var migrated = await _syncCoreTablesFromEstado({ pruneMissing: false });
        if (migrated) _sbInfo('[CORE_SYNC] migración inicial completada');
        return false;
    }

    _isRemoteUpdate = true;
    var changed = _sbApplyCoreBundleToEstado(bundle);
    try { guardarEstado(); } catch (_) {}
    _isRemoteUpdate = false;
    if (changed) _sbInfo('[CORE_SYNC] LOAD OK (tablas)');
    return changed;
}
function _sbApplyCoreBundleToEstado(bundle) {
    if (!bundle) return false;
    var changed = false;
    var remoteClientes = bundle.clientes || [];
    var remoteCuentas = bundle.cuentas || [];
    var remoteTx = bundle.transacciones || [];
    var remoteDeudas = bundle.deudas || [];
    var remoteProductos = bundle.productos || [];

    if (remoteClientes.length) {
        estado.clientes = remoteClientes.map(function(c) {
            return {
                id: c.id != null ? c.id : String(Date.now() + Math.random()),
                nombre: c.nombre || '',
                telefono: c.telefono || c.whatsapp || '',
                whatsapp: c.whatsapp || c.telefono || '',
                limite: _sbNum(c.limite != null ? c.limite : c.limite_credito, 0),
                diaPago: _sbNum(c.dia_pago, 1),
                producto: c.producto || '',
                deuda: _sbNum(c.deuda, 0),
                historial: [],
                lat: c.lat != null ? _sbNum(c.lat, null) : undefined,
                lng: c.lng != null ? _sbNum(c.lng, null) : undefined
            };
        });
        changed = true;
    }

    var cuentasMapped = _sbMapCuentasRowsToEstado(remoteCuentas);
    if (cuentasMapped) {
        estado.cuentas = cuentasMapped;
        changed = true;
    }

    if (remoteTx.length) {
        estado.gastosRegistros = [];
        estado.ingresosRegistros = [];
        remoteTx.forEach(function(t) {
            var base = {
                id: t.id != null ? t.id : (Date.now() + Math.random()),
                fecha: t.fecha || new Date().toISOString().split('T')[0],
                hora: t.hora || new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
                categoria: t.categoria || '',
                monto: _sbNum(t.monto, 0),
                cuenta: t.cuenta || 'efectivo',
                nota: t.nota || '',
                gramos: _sbNum(t.gramos, 0),
                registradoPor: t.registrado_por || '?'
            };
            if (String(t.tipo || '').toLowerCase() === 'gasto') estado.gastosRegistros.push(base);
            else estado.ingresosRegistros.push(base);
        });
        if (typeof _silberRebuildRegistrosFromLedgers === 'function') _silberRebuildRegistrosFromLedgers();
        changed = true;
    }

    if (remoteProductos.length) {
        estado.productos = remoteProductos.map(function(p) {
            return {
                id: p.id != null ? p.id : String(Date.now() + Math.random()),
                nombre: p.nombre || '',
                precio_por_gramo: _sbNum(p.precio_por_gramo, 0),
                stock_gramos: _sbNum(p.stock_gramos, 0),
                stock_minimo: _sbNum(p.stock_minimo, 0),
                activo: p.activo !== false,
                created_at: p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
        });
        changed = true;
    }

    if (remoteDeudas.length) {
        var db = _sbReadDbDeudasLocal();
        db.deudas = remoteDeudas.map(function(d) {
            return {
                id: d.id != null ? d.id : String(Date.now() + Math.random()),
                cliente_id: d.cliente_id != null ? d.cliente_id : '',
                producto: d.producto || '',
                cantidad: _sbNum(d.cantidad, 0),
                dia_pago: _sbNum(d.dia_pago, 1),
                fecha_creacion: d.fecha_creacion || new Date().toISOString().split('T')[0],
                pagada: !!d.pagada,
                historial_pagos: Array.isArray(d.historial_pagos) ? d.historial_pagos : []
            };
        });
        if (!Array.isArray(db.clientes)) db.clientes = [];
        db.clientes = (estado.clientes || []).map(function(c) {
            return {
                id: c.id,
                nombre: c.nombre || '',
                producto: c.producto || '',
                limite_credito: _sbNum(c.limite, 0),
                telefono: c.telefono || c.whatsapp || '',
                dia_pago: _sbNum(c.diaPago, 1)
            };
        });
        _sbWriteDbDeudasLocal(db);
        (estado.clientes || []).forEach(function(c) {
            var deudaPend = (db.deudas || [])
                .filter(function(d) { return String(d.cliente_id) === String(c.id) && !d.pagada; })
                .reduce(function(s, d) { return s + _sbNum(d.cantidad, 0); }, 0);
            c.deuda = deudaPend;
        });
        changed = true;
    }

    return changed;
}
async function _loadCoreTablesToEstado() {
    return _silberBootstrapCoreTables();
}
function _scheduleCorePullFromRealtime() {
    if (_silberCorePullTimer) clearTimeout(_silberCorePullTimer);
    _silberCorePullTimer = setTimeout(function() {
        // Evita eco inmediato de nuestra propia escritura
        if (Date.now() - _silberLastCorePushAt < 1200) return;
        cargarEstadoFromCloud().then(function(wasUpdated) {
            if (wasUpdated) _reRenderAll();
        });
    }, 350);
}

// =============================================================
// REAL-TIME SHARED STATE SYNC  (app_state table)
//
// Required Supabase SQL (run once in the SQL editor):
//   create table if not exists app_state (
//     id          text primary key,
//     estado_json jsonb,
//     updated_at  timestamptz default now()
//   );
//   alter table app_state disable row level security;
//   alter publication supabase_realtime add table app_state;
// =============================================================

var _isRemoteUpdate  = false;   // guard: prevents re-uploading what we just received
var _syncTimer       = null;    // debounce handle for syncEstadoToCloud
var _lastUserActivity = Date.now();  // track user presence for toast decisions

// Keep _lastUserActivity fresh so we know when the user is active
(function _trackActivity() {
    var opts = { passive: true };
    document.addEventListener('touchstart', function() { _lastUserActivity = Date.now(); }, opts);
    document.addEventListener('mousemove',  function() { _lastUserActivity = Date.now(); }, opts);
    document.addEventListener('keydown',    function() { _lastUserActivity = Date.now(); }, opts);
    document.addEventListener('click',      function() { _lastUserActivity = Date.now(); }, opts);
})();

// ── HELPERS ───────────────────────────────────────────────────

/** Merge cloud data into estado, preserving in-session navigation fields */
function _applyCloudData(cloudData, sessionFields) {
    var keep = sessionFields || {
        historialPantallas : estado.historialPantallas,
        transaccionActual  : estado.transaccionActual,
        clienteActual      : estado.clienteActual
    };
    Object.assign(estado, cloudData, keep);
}

/**
 * _mergeEstados(localSnap, cloudSnap)
 * Returns a merged estado that preserves transactions from BOTH devices.
 * Arrays are merged by id (union); cuentas get local-only deltas applied;
 * registrosDiarios is recomputed from merged arrays.
 */
function _mergeEstados(localSnap, cloudSnap) {
    var ARRAY_FIELDS = [
        'gastosRegistros', 'ingresosRegistros', 'listaStock',
        'historialTransferencias', 'llegadas', 'stock_movements', 'productos',
        'clientes'
    ];

    // Start with cloud as base (cloud holds the newer scalar state)
    var merged = JSON.parse(JSON.stringify(cloudSnap));

    // ── 1. Union array fields by id ──────────────────────────
    //
    // Strategy:
    //   • Items WITH id   → dedup by String(id) only (safe, no false positives)
    //   • Items WITHOUT id → dedup by content fingerprint (legacy data fallback)
    //     Fingerprint = fecha|hora|monto|categoria|cuenta for transactions,
    //     else JSON.stringify. Logs ID_MISSING_FIXED when this path is taken.
    //
    ARRAY_FIELDS.forEach(function(field) {
        var localArr = localSnap[field] || [];
        var cloudArr = cloudSnap[field] || [];
        var seenById  = {};  // id   → true
        var seenByFp  = {};  // fingerprint → true  (no-id items only)
        var result    = [];

        function _fp(item) {
            // Transaction fingerprint: most useful for gastosRegistros/ingresosRegistros
            if (item.fecha != null && item.hora != null && item.monto != null) {
                return (item.fecha || '') + '|' + (item.hora || '') + '|' + (item.monto || 0) + '|' + (item.categoria || '') + '|' + (item.cuenta || '');
            }
            return JSON.stringify(item);
        }

        function _addItem(item, source) {
            if (item.id != null) {
                var key = String(item.id);
                if (!seenById[key]) {
                    seenById[key] = true;
                    seenByFp[_fp(item)] = true;  // also register fingerprint to block no-id dupes
                    result.push(item);
                } else {
                    silberLog('[SYNC] DUPLICATE_SKIPPED (' + source + ', id=' + key + ') in ' + field);
                }
            } else {
                // No id — use fingerprint fallback
                silberWarn('[SYNC] ID_MISSING_FIXED — item without id in ' + field + ' (' + source + '), using fingerprint');
                var fp = _fp(item);
                if (!seenByFp[fp]) {
                    seenByFp[fp] = true;
                    result.push(item);
                } else {
                    silberLog('[SYNC] DUPLICATE_SKIPPED (' + source + ', no-id fingerprint) in ' + field);
                }
            }
        }

        cloudArr.forEach(function(item) { _addItem(item, 'cloud'); });
        localArr.forEach(function(item) { _addItem(item, 'local'); });
        merged[field] = result;
    });

    // ── 2. Apply cuentas deltas for local-only transactions ──
    //
    // Safety rules:
    //   • Only items WITH a valid id are considered (id guarantees uniqueness)
    //   • An item is "local-only" if its id is NOT in the cloud snapshot's array
    //   • Items without id are SKIPPED (can't guarantee they haven't already been
    //     accounted for in the cloud's cuentas) → DELTA_SKIPPED log
    //
    var cloudGastoIds   = {};
    var cloudIngresoIds = {};
    (cloudSnap.gastosRegistros   || []).forEach(function(r) { if (r.id != null) cloudGastoIds[String(r.id)]   = true; });
    (cloudSnap.ingresosRegistros || []).forEach(function(r) { if (r.id != null) cloudIngresoIds[String(r.id)] = true; });
    if (!merged.cuentas) merged.cuentas = {};

    (localSnap.gastosRegistros || []).forEach(function(r) {
        if (r.id == null) {
            silberLog('[SYNC] DELTA_SKIPPED (gasto sin id, monto=' + (r.monto || 0) + ')');
            return;
        }
        if (!cloudGastoIds[String(r.id)]) {
            var c = r.cuenta || 'efectivo';
            merged.cuentas[c] = (merged.cuentas[c] || 0) - (r.monto || 0);
            silberLog('[SYNC] DELTA_APPLIED (gasto local-only id=' + r.id + ', -' + (r.monto || 0) + '€ en ' + c + ')');
        }
    });
    (localSnap.ingresosRegistros || []).forEach(function(r) {
        if (r.id == null) {
            silberLog('[SYNC] DELTA_SKIPPED (ingreso sin id, monto=' + (r.monto || 0) + ')');
            return;
        }
        if (!cloudIngresoIds[String(r.id)]) {
            var c = r.cuenta || 'efectivo';
            merged.cuentas[c] = (merged.cuentas[c] || 0) + (r.monto || 0);
            silberLog('[SYNC] DELTA_APPLIED (ingreso local-only id=' + r.id + ', +' + (r.monto || 0) + '€ en ' + c + ')');
        }
    });

    // ── 3. Merge registrosDiarios ────────────────────────────
    // Start with union of both (keeps days with no individual records)
    var mergedRegs = Object.assign({}, cloudSnap.registrosDiarios || {});
    Object.keys(localSnap.registrosDiarios || {}).forEach(function(k) {
        if (!mergedRegs[k]) mergedRegs[k] = localSnap.registrosDiarios[k];
    });
    // Recompute totals for days that now have individual records
    var daysWithRecords = {};
    merged.gastosRegistros.forEach(function(r)   { if (r.fecha) daysWithRecords[r.fecha] = true; });
    merged.ingresosRegistros.forEach(function(r) { if (r.fecha) daysWithRecords[r.fecha] = true; });
    Object.keys(daysWithRecords).forEach(function(fecha) {
        var g = (merged.gastosRegistros   || []).filter(function(r) { return r.fecha === fecha; }).reduce(function(s, r) { return s + (r.monto || 0); }, 0);
        var i = (merged.ingresosRegistros || []).filter(function(r) { return r.fecha === fecha; }).reduce(function(s, r) { return s + (r.monto || 0); }, 0);
        mergedRegs[fecha] = { gastos: g, ingresos: i };
    });
    merged.registrosDiarios = mergedRegs;

    return merged;
}

/** Re-render all key UI areas after a state merge */
function _reRenderAll() {
    try {
        if (typeof _silberRebuildRegistrosFromLedgers === 'function') _silberRebuildRegistrosFromLedgers();
        if (typeof actualizarSaldos      === 'function') actualizarSaldos();
        if (typeof renderizarClientes    === 'function') renderizarClientes();
        if (typeof renderizarRanking     === 'function') renderizarRanking();
        if (typeof dibujarDonut          === 'function') dibujarDonut();
        if (typeof actualizarTimeMachine === 'function') actualizarTimeMachine();
        if (typeof renderizarOficina     === 'function') renderizarOficina();
        if (typeof renderizarDesgloseGastos === 'function') renderizarDesgloseGastos();
        if (typeof renderizarDesgloseIngresos === 'function') renderizarDesgloseIngresos();
        if (typeof renderProductos === 'function') renderProductos();
        if (typeof renderDashboardProductosAlerta === 'function') renderDashboardProductosAlerta();
    } catch (e) {
        silberWarn('_reRenderAll — excepción:', e);
    }
}

// ── SYNC TOAST ────────────────────────────────────────────────
/**
 * _showSyncToast(msg, type)
 * type: 'ok' (default) | 'warn'
 * Non-blocking pill that auto-dismisses after 3 s.
 */
function _showSyncToast(msg, type) {
    try {
        // Remove any existing toast so messages don't stack
        var prev = document.getElementById('silber-sync-toast');
        if (prev) {
            clearTimeout(prev._dismissTimer);
            prev.remove();
        }

        var toast = document.createElement('div');
        toast.id = 'silber-sync-toast';
        toast.className = 'silber-sync-toast silber-sync-toast--' + (type || 'ok');

        var icon = (type === 'warn') ? '⚠' : '✓';
        toast.innerHTML =
            '<div class="sst-pill">'
            + '<span class="sst-icon">' + icon + '</span>'
            + '<span class="sst-text">' + msg + '</span>'
            + '</div>';

        document.body.appendChild(toast);

        // Animate in (double-rAF ensures transition fires)
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                toast.classList.add('sst-visible');
            });
        });

        // Auto-dismiss
        toast._dismissTimer = setTimeout(function() {
            toast.classList.remove('sst-visible');
            setTimeout(function() { if (toast.parentNode) toast.remove(); }, 350);
        }, 3000);

    } catch (e) { /* toast is cosmetic — never crash for this */ }
}

// ── 1. WRITE: push full estado to the cloud ──────────────────
/**
 * Pre-flight check on updated_at.
 * If cloud is newer → MERGE (union arrays by id) then push merged state.
 * If local is same or newer → push directly.
 */
async function syncEstadoToCloud() {
    if (!_supabase)      return;
    if (_isRemoteUpdate) return;  // never echo a remote update back up
    if (_silberTableSyncEnabled) {
        // Modo primario por tablas core (clientes/cuentas/transacciones/deudas/productos).
        // localStorage ya quedó persistido por guardarEstado(); aquí sólo empujamos a cloud.
        var okCore = await _syncCoreTablesFromEstado();
        if (!okCore) {
            silberWarn('[CORE_SYNC] push falló, fallback local activo');
            _silberScheduleCoreRetry('push failed');
        }
        return okCore;
    }

    try {
        // ── Pre-flight: fetch only updated_at (very cheap) ──────
        var checkRes = await _supabase
            .from('app_state')
            .select('updated_at')
            .eq('id', 'global')
            .maybeSingle();

        if (!checkRes.error && checkRes.data && checkRes.data.updated_at) {
            var cloudTs = new Date(checkRes.data.updated_at).getTime();
            var localTs = estado._updatedAt ? new Date(estado._updatedAt).getTime() : 0;

            if (cloudTs > localTs) {
                // CONFLICT: cloud is newer — fetch full row and MERGE
                silberLog('[SYNC] CONFLICT detectado — cloud más reciente, iniciando MERGE…');

                var fullRes = await _supabase
                    .from('app_state')
                    .select('estado_json, updated_at')
                    .eq('id', 'global')
                    .single();

                if (!fullRes.error && fullRes.data && fullRes.data.estado_json) {
                    var localSnap  = JSON.parse(JSON.stringify(estado));
                    var mergedSnap = _mergeEstados(localSnap, fullRes.data.estado_json);
                    mergedSnap._updatedAt = new Date().toISOString();

                    silberLog('[SYNC] MERGE aplicado — gastos: '
                        + (mergedSnap.gastosRegistros   || []).length
                        + ', ingresos: '
                        + (mergedSnap.ingresosRegistros || []).length);

                    _isRemoteUpdate = true;
                    _applyCloudData(mergedSnap);
                    guardarEstado();
                    _reRenderAll();
                    _isRemoteUpdate = false;

                    // Push the merged state up to cloud
                    var mSnap = JSON.parse(JSON.stringify(mergedSnap));
                    if (Array.isArray(mSnap.clientes)) {
                        mSnap.clientes.forEach(function(c) { delete c.foto; });
                    }
                    delete mSnap.fotoActual;

                    var mergeRes = await _supabase
                        .from('app_state')
                        .upsert({ id: 'global', estado_json: mSnap, updated_at: mergedSnap._updatedAt }, { onConflict: 'id' });

                    if (mergeRes.error) {
                        silberWarn('[SYNC] Error al subir estado mergeado:', mergeRes.error);
                    } else {
                        silberLog('[SYNC] PUSH OK (post-merge) — ' + mergedSnap._updatedAt);
                        _showSyncToast('Sincronizado — datos de ambos dispositivos combinados');
                    }
                    return;
                }
            }
        }

        // ── Local is same or newer — push directly ───────────────
        var snap = JSON.parse(JSON.stringify(estado));
        if (Array.isArray(snap.clientes)) {
            snap.clientes.forEach(function(c) { delete c.foto; });
        }
        delete snap.fotoActual;

        var payload = {
            id:          'global',
            estado_json: snap,
            updated_at:  new Date().toISOString()
        };

        var res = await _supabase
            .from('app_state')
            .upsert(payload, { onConflict: 'id' });

        if (res.error) {
            silberWarn('[SYNC] Error al subir:', res.error);
        } else {
            silberLog('[SYNC] PUSH OK — ' + payload.updated_at);
        }

    } catch (e) {
        silberWarn('[SYNC] syncEstadoToCloud — excepción:', e);
    }
}

// Debounced trigger — called after every guardarEstado()
function _triggerCloudSync() {
    if (_isRemoteUpdate) return;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(syncEstadoToCloud, 1500);
}

// ── 2. READ: load cloud state (startup + manual refresh) ──────
async function cargarEstadoFromCloud() {
    if (!_supabase) return false;
    if (_silberTableSyncEnabled) {
        try {
            var changedCore = await _loadCoreTablesToEstado();
            if (changedCore) silberLog('[CORE_SYNC] PULL OK (tablas)');
            else silberLog('[CORE_SYNC] sin cambios remotos, usando estado local');
            return changedCore;
        } catch (eCore) {
            silberWarn('[CORE_SYNC] pull falló, fallback local:', eCore);
            return false;
        }
    }
    try {
        var res = await _supabase
            .from('app_state')
            .select('estado_json, updated_at')
            .eq('id', 'global')
            .single();

        if (res.error || !res.data || !res.data.estado_json) {
            silberLog('[SYNC] cargarEstadoFromCloud — sin fila global, usando localStorage');
            return false;
        }

        var cloudTs = res.data.updated_at ? new Date(res.data.updated_at).getTime() : 0;
        var localTs = estado._updatedAt   ? new Date(estado._updatedAt).getTime()   : 0;

        if (cloudTs > localTs) {
            silberLog('[SYNC] CONFLICT detectado — cloud más reciente (' + res.data.updated_at + '), aplicando MERGE…');

            var localSnap  = JSON.parse(JSON.stringify(estado));
            var mergedSnap = _mergeEstados(localSnap, res.data.estado_json);
            mergedSnap._updatedAt = res.data.updated_at;  // keep cloud timestamp

            silberLog('[SYNC] MERGE aplicado — gastos: '
                + (mergedSnap.gastosRegistros   || []).length
                + ', ingresos: '
                + (mergedSnap.ingresosRegistros || []).length);

            _isRemoteUpdate = true;
            _applyCloudData(mergedSnap);
            guardarEstado();
            _isRemoteUpdate = false;

            silberLog('[SYNC] PULL OK — ' + res.data.updated_at);
            return true;
        }

        silberLog('[SYNC] cargarEstadoFromCloud — local igual o más reciente, sin cambios');
        return false;

    } catch (e) {
        silberWarn('[SYNC] cargarEstadoFromCloud — excepción, continuando en local:', e);
        return false;
    }
}

// ====== TABLE-BASED SYNC (clientes, cuentas, transacciones, deudas, productos) ======
function _silberDateKey(d) {
    try {
        var dt = d ? new Date(d) : new Date();
        return dt.toISOString().split('T')[0];
    } catch (e) {
        return new Date().toISOString().split('T')[0];
    }
}

function _silberApplyRowsToEstado(rows) {
    if (!rows) return false;
    var changed = false;

    // cuentas -> estado.cuentas
    if (Array.isArray(rows.cuentas) && rows.cuentas.length) {
        var nextCuentas = Object.assign({}, estado.cuentas || {});
        rows.cuentas.forEach(function(r) {
            var key = String(r.nombre || r.id || '').toLowerCase();
            if (!key) return;
            var saldo = Number(r.saldo);
            if (!Number.isFinite(saldo)) return;
            nextCuentas[key] = saldo;
        });
        estado.cuentas = nextCuentas;
        changed = true;
    }

    // clientes -> estado.clientes
    if (Array.isArray(rows.clientes) && rows.clientes.length) {
        var byId = {};
        (estado.clientes || []).forEach(function(c) { byId[String(c.id)] = c; });
        rows.clientes.forEach(function(r) {
            var id = String(r.id);
            if (!id) return;
            var prev = byId[id] || {};
            byId[id] = {
                id: r.id,
                nombre: r.nombre || prev.nombre || '',
                telefono: r.telefono || r.whatsapp || prev.telefono || prev.whatsapp || '',
                whatsapp: r.telefono || r.whatsapp || prev.telefono || prev.whatsapp || '',
                limite: Number(r.limite || r.limite_credito || prev.limite) || 0,
                diaPago: Number(r.dia_pago || prev.diaPago) || 1,
                producto: r.producto || prev.producto || '',
                deuda: Number(r.deuda || prev.deuda) || 0,
                historial: Array.isArray(prev.historial) ? prev.historial : []
            };
            if (r.lat != null) byId[id].lat = Number(r.lat);
            if (r.lng != null) byId[id].lng = Number(r.lng);
        });
        estado.clientes = Object.keys(byId).map(function(k) { return byId[k]; });
        changed = true;
    }

    // deudas -> db_deudas + deuda acumulada en clientes
    if (Array.isArray(rows.deudas)) {
        var db = cargarDbDeudas();
        if (!Array.isArray(db.clientes)) db.clientes = [];
        if (!Array.isArray(db.deudas)) db.deudas = [];
        if (!Array.isArray(db.historial)) db.historial = [];
        db.deudas = rows.deudas.map(function(d) {
            return {
                id: d.id,
                cliente_id: d.cliente_id,
                producto: d.producto || '',
                cantidad: Number(d.cantidad || 0),
                dia_pago: Number(d.dia_pago || 1),
                fecha_creacion: _silberDateKey(d.fecha_creacion || d.created_at),
                pagada: !!d.pagada,
                historial_pagos: Array.isArray(d.historial_pagos) ? d.historial_pagos : []
            };
        });
        // Recalcular deuda por cliente con base en deudas no pagadas
        var deudaByCliente = {};
        db.deudas.forEach(function(d) {
            if (!d.pagada) {
                var cid = String(d.cliente_id);
                deudaByCliente[cid] = (deudaByCliente[cid] || 0) + (Number(d.cantidad) || 0);
            }
        });
        (estado.clientes || []).forEach(function(c) {
            c.deuda = Number(deudaByCliente[String(c.id)] || 0);
        });
        guardarDbDeudas(db);
        changed = true;
    }

    // productos -> estado.productos
    if (Array.isArray(rows.productos) && rows.productos.length) {
        estado.productos = rows.productos.map(function(p) {
            return {
                id: p.id,
                nombre: p.nombre || '',
                precio_por_gramo: Number(p.precio_por_gramo || 0),
                stock_gramos: Number(p.stock_gramos || 0),
                stock_minimo: Number(p.stock_minimo || 0),
                activo: p.activo !== false,
                created_at: p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ')
            };
        });
        changed = true;
    }

    // transacciones -> ledgers locales + registrosDiarios
    if (Array.isArray(rows.transacciones) && rows.transacciones.length) {
        var gastos = [];
        var ingresos = [];
        var cuentasDelta = { efectivo: 0, bbva: 0, caja: 0, monedero: 0 };
        var registros = {};
        rows.transacciones.forEach(function(t) {
            var tipo = String(t.tipo || '').toLowerCase();
            var fecha = _silberDateKey(t.fecha || t.created_at);
            var monto = Number(t.monto || 0);
            var cuenta = t.cuenta || 'efectivo';
            var row = {
                id: t.id,
                fecha: fecha,
                hora: t.hora || (t.created_at ? new Date(t.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''),
                categoria: t.categoria || '',
                monto: monto,
                cuenta: cuenta,
                nota: t.nota || '',
                gramos: Number(t.gramos || 0),
                registradoPor: t.registrado_por || '?',
                esRecarga: t.es_recarga || null
            };
            if (!registros[fecha]) registros[fecha] = { gastos: 0, ingresos: 0 };
            if (tipo === 'gasto') {
                gastos.push(row);
                registros[fecha].gastos += monto;
                cuentasDelta[cuenta] = (cuentasDelta[cuenta] || 0) - monto;
            } else if (tipo === 'ingreso') {
                ingresos.push(row);
                registros[fecha].ingresos += monto;
                cuentasDelta[cuenta] = (cuentasDelta[cuenta] || 0) + monto;
            }
        });
        estado.gastosRegistros = gastos;
        estado.ingresosRegistros = ingresos;
        estado.registrosDiarios = registros;
        // Si cuentas no vinieron desde tabla, derivarlas del delta (base cero) para consistencia
        if (!Array.isArray(rows.cuentas) || !rows.cuentas.length) {
            ['efectivo', 'bbva', 'caja', 'monedero'].forEach(function(k) {
                estado.cuentas[k] = Number(cuentasDelta[k] || 0);
            });
        }
        changed = true;
    }

    return changed;
}

async function _silberLoadTablesFromSupabase() {
    if (!_supabase) return false;
    try {
        var tableMap = {
            clientes: 'clientes',
            cuentas: 'cuentas',
            transacciones: 'transacciones',
            deudas: 'deudas',
            productos: 'productos'
        };
        var requested = Object.keys(tableMap);
        var out = {};
        for (var i = 0; i < requested.length; i++) {
            var logical = requested[i];
            var table = tableMap[logical];
            var res = await _supabase.from(table).select('*');
            if (res && !res.error && Array.isArray(res.data)) {
                out[logical] = res.data;
            } else if (res && res.error) {
                silberWarn('[SYNC] tabla ' + table + ' no disponible:', res.error.message || res.error);
            }
        }
        // If all empty/unavailable, keep local data
        var hasAny = requested.some(function(k) { return Array.isArray(out[k]) && out[k].length > 0; });
        if (!hasAny) return false;
        return _silberApplyRowsToEstado(out);
    } catch (e) {
        silberWarn('[SYNC] _silberLoadTablesFromSupabase excepción:', e);
        return false;
    }
}

async function _silberSaveAllTablesToSupabase() {
    if (!_supabase || typeof estado === 'undefined' || !estado) return false;
    try {
        // 1) clientes
        var clientesRows = (estado.clientes || []).map(function(c) {
            return {
                id: String(c.id),
                nombre: c.nombre || '',
                telefono: c.telefono || c.whatsapp || '',
                whatsapp: c.telefono || c.whatsapp || '',
                limite: Number(c.limite || 0),
                dia_pago: Number(c.diaPago || 1),
                producto: c.producto || '',
                deuda: Number(c.deuda || 0),
                lat: c.lat != null ? Number(c.lat) : null,
                lng: c.lng != null ? Number(c.lng) : null,
                updated_at: new Date().toISOString()
            };
        });
        if (clientesRows.length) {
            await _supabase.from('clientes').upsert(clientesRows, { onConflict: 'id' });
        }

        // 2) cuentas
        var cuentasRows = Object.keys(estado.cuentas || {}).map(function(k) {
            return {
                id: String(k),
                nombre: String(k),
                saldo: Number(estado.cuentas[k] || 0),
                updated_at: new Date().toISOString()
            };
        });
        if (cuentasRows.length) {
            await _supabase.from('cuentas').upsert(cuentasRows, { onConflict: 'id' });
        }

        // 3) transacciones (ledger local completo)
        var txRows = [];
        (estado.gastosRegistros || []).forEach(function(g) {
            txRows.push({
                id: String(g.id || (Date.now() + Math.random())),
                tipo: 'gasto',
                categoria: g.categoria || '',
                monto: Number(g.monto || 0),
                cuenta: g.cuenta || 'efectivo',
                gramos: Number(g.gramos || 0),
                nota: g.nota || '',
                registrado_por: g.registradoPor || '?',
                fecha: g.fecha || _silberDateKey(),
                hora: g.hora || '',
                es_recarga: g.esRecarga || null,
                updated_at: new Date().toISOString()
            });
        });
        (estado.ingresosRegistros || []).forEach(function(i) {
            txRows.push({
                id: String(i.id || (Date.now() + Math.random())),
                tipo: 'ingreso',
                categoria: i.categoria || '',
                monto: Number(i.monto || 0),
                cuenta: i.cuenta || 'efectivo',
                gramos: Number(i.gramos || 0),
                nota: i.nota || '',
                registrado_por: i.registradoPor || '?',
                fecha: i.fecha || _silberDateKey(),
                hora: i.hora || '',
                es_recarga: i.esRecarga || null,
                updated_at: new Date().toISOString()
            });
        });
        if (txRows.length) {
            await _supabase.from('transacciones').upsert(txRows, { onConflict: 'id' });
        }

        // 4) deudas (desde db_deudas)
        var db = (typeof cargarDbDeudas === 'function') ? cargarDbDeudas() : { deudas: [] };
        var deudaRows = (db.deudas || []).map(function(d) {
            return {
                id: String(d.id),
                cliente_id: String(d.cliente_id),
                producto: d.producto || '',
                cantidad: Number(d.cantidad || 0),
                dia_pago: Number(d.dia_pago || 1),
                fecha_creacion: d.fecha_creacion || _silberDateKey(),
                pagada: !!d.pagada,
                historial_pagos: Array.isArray(d.historial_pagos) ? d.historial_pagos : [],
                updated_at: new Date().toISOString()
            };
        });
        if (deudaRows.length) {
            await _supabase.from('deudas').upsert(deudaRows, { onConflict: 'id' });
        }

        // 5) productos
        var productoRows = (estado.productos || []).map(function(p) {
            return {
                id: String(p.id),
                nombre: p.nombre || '',
                precio_por_gramo: Number(p.precio_por_gramo || 0),
                stock_gramos: Number(p.stock_gramos || 0),
                stock_minimo: Number(p.stock_minimo || 0),
                activo: p.activo !== false,
                created_at: p.created_at || new Date().toISOString().slice(0, 19).replace('T', ' '),
                updated_at: new Date().toISOString()
            };
        });
        if (productoRows.length) {
            await _supabase.from('productos').upsert(productoRows, { onConflict: 'id' });
        }
        return true;
    } catch (e) {
        silberWarn('[SYNC] _silberSaveAllTablesToSupabase excepción:', e);
        return false;
    }
}

function _silberSetupTableRealtimeSync() {
    if (!_supabase) return;
    var watched = ['clientes', 'cuentas', 'transacciones', 'deudas', 'productos'];
    watched.forEach(function(table) {
        try {
            _supabase
                .channel('silber_table_' + table)
                .on('postgres_changes', { event: '*', schema: 'public', table: table }, function() {
                    cargarEstadoFromCloud().then(function(updated) {
                        if (updated) {
                            _reRenderAll();
                            if (typeof validateEstado === 'function') validateEstado();
                        }
                    });
                })
                .subscribe();
        } catch (e) {
            silberWarn('[SYNC] realtime tabla ' + table + ' falló:', e);
        }
    });
}

// ── 3. REALTIME SUBSCRIPTION ──────────────────────────────────
function _setupRealtimeSync() {
    if (!_supabase) return;
    if (_silberTableSyncEnabled) {
        _silberSetupTableRealtimeSync();
        return;
    }
    try {
        _supabase
            .channel('app_state_changes')
            .on('postgres_changes', {
                event:  'UPDATE',
                schema: 'public',
                table:  'app_state'
            }, function(payload) {
                try {
                    if (!payload || !payload.new || !payload.new.estado_json) return;

                    var cloudTs = payload.new.updated_at
                        ? new Date(payload.new.updated_at).getTime() : 0;
                    var localTs = estado._updatedAt
                        ? new Date(estado._updatedAt).getTime() : 0;

                    // Ignore if this is our own echo or stale
                    if (cloudTs <= localTs) {
                        silberLog('Realtime — update ignorado (no es más reciente)');
                        return;
                    }

                    silberLog('[SYNC] CONFLICT detectado (realtime) — aplicando MERGE…');
                    _isRemoteUpdate = true;

                    var _rtLocal   = JSON.parse(JSON.stringify(estado));
                    var _rtMerged  = _mergeEstados(_rtLocal, payload.new.estado_json);
                    _rtMerged._updatedAt = payload.new.updated_at;
                    silberLog('[SYNC] MERGE aplicado (realtime) — gastos: '
                        + (_rtMerged.gastosRegistros   || []).length
                        + ', ingresos: '
                        + (_rtMerged.ingresosRegistros || []).length);

                    _applyCloudData(_rtMerged);
                    guardarEstado();    // persist locally (won't re-trigger sync)
                    _reRenderAll();
                    silberLog('[SYNC] PULL OK (realtime) — ' + payload.new.updated_at);

                    _isRemoteUpdate = false;

                    // Notify user if they're actively using the app (activity in last 60s)
                    var idle = Date.now() - _lastUserActivity;
                    if (idle < 60000) {
                        _showSyncToast('Datos actualizados');
                    }

                } catch (e) {
                    silberWarn('Realtime handler — excepción:', e);
                    _isRemoteUpdate = false;    // always release the flag
                }
            })
            .subscribe(function(status) {
                silberLog('Realtime subscription status:', status);
            });

    } catch (e) {
        silberWarn('_setupRealtimeSync — excepción:', e);
    }
}

// ── 4. PULL-TO-REFRESH ────────────────────────────────────────
/**
 * Custom pull-to-refresh on .screen elements.
 * Works on both mobile (touch) and trackpad with momentum.
 * Uses a fixed indicator — zero impact on document layout.
 */
function _initPullToRefresh() {
    var PTR_THRESHOLD = 65;    // px pull needed to trigger
    var PTR_COOLDOWN  = 3000;  // ms before next PTR allowed

    var _ptrStartY   = 0;
    var _ptrActive   = false;
    var _ptrCooling  = false;
    var _ptrDone     = false;

    // Create the fixed indicator element
    var ind = document.createElement('div');
    ind.id = 'silber-ptr';
    ind.innerHTML =
        '<div class="sptr-inner">'
        + '<div class="sptr-spinner"></div>'
        + '<span class="sptr-label">Desliza para actualizar</span>'
        + '</div>';
    document.body.appendChild(ind);

    var label = ind.querySelector('.sptr-label');

    function getActiveScreen() {
        return document.querySelector('.screen.active');
    }

    function resetIndicator() {
        ind.style.transform = '';
        ind.style.opacity   = '';
        ind.classList.remove('sptr-loading', 'sptr-ready');
        label.textContent = 'Desliza para actualizar';
    }

    function triggerRefresh() {
        _ptrDone    = true;
        _ptrCooling = true;
        ind.classList.add('sptr-loading');
        ind.style.transform = 'translateY(0)';
        ind.style.opacity   = '1';
        label.textContent   = 'Actualizando…';

        var fn = (typeof cargarEstadoFromCloud === 'function')
            ? cargarEstadoFromCloud
            : function() { return Promise.resolve(false); };

        fn().then(function(wasUpdated) {
            if (wasUpdated) {
                _reRenderAll();
                if (typeof validateEstado === 'function') validateEstado();
                _showSyncToast('Datos actualizados');
            } else {
                _showSyncToast('Ya tienes la última versión');
            }
        }).catch(function() {
            _showSyncToast('No se pudo actualizar', 'warn');
        }).finally(function() {
            resetIndicator();
            setTimeout(function() { _ptrCooling = false; }, PTR_COOLDOWN);
        });
    }

    // ── Touch events ──────────────────────────────────────────
    document.addEventListener('touchstart', function(e) {
        if (_ptrCooling) return;
        var screen = getActiveScreen();
        // Only activate when at the very top of the scrollable screen
        if (!screen || screen.scrollTop > 3) return;
        _ptrStartY  = e.touches[0].clientY;
        _ptrActive  = true;
        _ptrDone    = false;
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        if (!_ptrActive || _ptrDone || _ptrCooling) return;
        var screen = getActiveScreen();
        if (!screen || screen.scrollTop > 3) { _ptrActive = false; return; }

        var dy = e.touches[0].clientY - _ptrStartY;
        if (dy <= 0) { _ptrActive = false; return; }

        // Rubber-band resistance: progress slows as it extends
        var progress  = Math.min(dy / PTR_THRESHOLD, 1);
        var translate = Math.round(dy * 0.45 - 60);    // starts offscreen at -60

        ind.style.transform = 'translateY(' + translate + 'px)';
        ind.style.opacity   = progress.toFixed(2);

        if (dy >= PTR_THRESHOLD) {
            ind.classList.add('sptr-ready');
            label.textContent = 'Suelta para actualizar';
        } else {
            ind.classList.remove('sptr-ready');
            label.textContent = 'Desliza para actualizar';
        }
    }, { passive: true });

    document.addEventListener('touchend', function(e) {
        if (!_ptrActive || _ptrDone || _ptrCooling) { _ptrActive = false; return; }
        var dy = e.changedTouches[0].clientY - _ptrStartY;
        _ptrActive = false;

        if (dy >= PTR_THRESHOLD) {
            triggerRefresh();
        } else {
            resetIndicator();
        }
    }, { passive: true });

    document.addEventListener('touchcancel', function() {
        if (_ptrActive) { _ptrActive = false; resetIndicator(); }
    }, { passive: true });
}

// ── 5. PATCH guardarEstado to stamp timestamp + trigger sync ──
//    Runs at parse time; chains on top of stability.js patch.
(function _patchGuardarForSync() {
    var _prevGuardar = window.guardarEstado;
    window.guardarEstado = function() {
        // Stamp a write-time so conflict resolution has a reference
        if (!_isRemoteUpdate && typeof estado !== 'undefined') {
            estado._updatedAt = new Date().toISOString();
        }
        _prevGuardar();         // call stability.js version (quota-safe save)
        _triggerCloudSync();    // schedule cloud push (no-op if _isRemoteUpdate)
    };
})();

// ── 6. DOMContentLoaded: pull cloud state → subscribe → PTR ──
document.addEventListener('DOMContentLoaded', function() {
    // Pull-to-refresh works even without Supabase (shows "ya tienes la última")
    _initPullToRefresh();

    if (!_supabase) return;

    cargarEstadoFromCloud().then(function(wasUpdated) {
        if (wasUpdated) {
            _reRenderAll();
            if (typeof validateEstado === 'function') validateEstado();
        }
        _setupRealtimeSync();
    });

    window.addEventListener('online', function() {
        if (_silberCoreSyncRetryPending) {
            _sbInfo('[CORE_SYNC] conexión restaurada; reintentando sincronización pendiente');
            _silberScheduleCoreRetry('online');
        }
    });
});