/* SILBER GESTIÓN — supabase.js
   Sync opcional con Supabase. La fuente de verdad es localStorage (estado);
   si Supabase falla o no está configurado, la app sigue funcionando en local.
*/
// Supabase es opcional. Si no se inyecta URL/KEY, la app funciona 100% local sin ruido de red.
var SUPABASE_URL = typeof window !== 'undefined' && window.SILBER_SUPABASE_URL ? window.SILBER_SUPABASE_URL : '';
var SUPABASE_KEY = typeof window !== 'undefined' && window.SILBER_SUPABASE_KEY ? window.SILBER_SUPABASE_KEY : '';
var _supabase = null;
try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL !== 'TU_URL_DE_SUPABASE') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) { console.warn('Supabase no iniciado:', e); }

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
    try {
        estado.clientes.forEach(function(c) {
            var row = { id: String(c.id), nombre: c.nombre, whatsapp: c.whatsapp || '', limite: c.limite || 0, dia_pago: c.diaPago || 1, producto: c.producto || '', deuda: c.deuda || 0, lat: c.lat != null ? c.lat : null, lng: c.lng != null ? c.lng : null };
            _supabase.from('clients').upsert(row, { onConflict: 'id' }).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] clients upsert:', err); });
        });
    } catch (err) {}
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

// ── 3. REALTIME SUBSCRIPTION ──────────────────────────────────
function _setupRealtimeSync() {
    if (!_supabase) return;
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
});