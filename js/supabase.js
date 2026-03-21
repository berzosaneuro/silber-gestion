/* SILBER GESTIÓN — supabase.js
   Sync opcional con Supabase. La fuente de verdad es localStorage (estado);
   si Supabase falla o no está configurado, la app sigue funcionando en local.
*/
var SUPABASE_URL = typeof window !== 'undefined' && window.SILBER_SUPABASE_URL ? window.SILBER_SUPABASE_URL : 'TU_URL_DE_SUPABASE';
var SUPABASE_KEY = typeof window !== 'undefined' && window.SILBER_SUPABASE_KEY ? window.SILBER_SUPABASE_KEY : 'TU_LLAVE_ANON_DE_SUPABASE';
var _supabase = null;
try {
    if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL !== 'TU_URL_DE_SUPABASE') {
        _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) { console.warn('Supabase no iniciado:', e); }

// ===== DASHBOARD DESDE SUPABASE =====
async function cargarDatosDashboard() {
    if (!_supabase) return;
    try {
        const hoy = new Date().toISOString().split('T')[0]; // "2026-02-23"

        // Usamos gte/lt sobre created_at (timestamp) para filtrar el día completo
        const { data, error } = await _supabase
            .from('transacciones')
            .select('monto, tipo')
            .gte('created_at', hoy + 'T00:00:00Z')
            .lt('created_at',  hoy + 'T23:59:59Z');

        if (error) { console.warn('Supabase dashboard error:', error.message); return; }
        if (!data || data.length === 0) return;

        const ingresosNube = data
            .filter(t => t.tipo === 'ingreso')
            .reduce((s, t) => s + Number(t.monto), 0);
        const gastosNube = data
            .filter(t => t.tipo === 'gasto')
            .reduce((s, t) => s + Number(t.monto), 0);

        // Sincronizar con registrosDiarios local para que máquina del tiempo también cuadre
        const fechaHoy = new Date().toISOString().split('T')[0];
        if (!estado.registrosDiarios[fechaHoy])
            estado.registrosDiarios[fechaHoy] = { gastos: 0, ingresos: 0 };
        estado.registrosDiarios[fechaHoy].ingresos = ingresosNube;
        estado.registrosDiarios[fechaHoy].gastos   = gastosNube;

        // Actualizar UI del dashboard
        const elI = document.getElementById('dash-ingresos');
        const elG = document.getElementById('dash-gastos');
        if (elI) elI.textContent = ingresosNube.toFixed(0) + '€';
        if (elG) elG.textContent = gastosNube.toFixed(0) + '€';

        // Redibujar donut con datos reales de la nube
        dibujarDonut();

    } catch (e) { console.warn('cargarDatosDashboard excepción:', e); }
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

/** Re-render all key UI areas after a state merge */
function _reRenderAll() {
    try {
        if (typeof actualizarSaldos      === 'function') actualizarSaldos();
        if (typeof renderizarClientes    === 'function') renderizarClientes();
        if (typeof renderizarRanking     === 'function') renderizarRanking();
        if (typeof dibujarDonut          === 'function') dibujarDonut();
        if (typeof actualizarTimeMachine === 'function') actualizarTimeMachine();
        if (typeof renderizarOficina     === 'function') renderizarOficina();
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
 * Before writing, does a lightweight pre-flight check on updated_at.
 * If cloud is newer → pulls instead of pushing. Prevents stale overwrites.
 */
async function syncEstadoToCloud() {
    if (!_supabase)        return;
    if (_isRemoteUpdate)   return;  // never echo a remote update back up

    try {
        // ── Pre-flight: fetch only updated_at (very cheap) ──────
        var checkRes = await _supabase
            .from('app_state')
            .select('updated_at')
            .eq('id', 'global')
            .maybeSingle();   // won't error if row doesn't exist yet

        if (!checkRes.error && checkRes.data && checkRes.data.updated_at) {
            var cloudTs = new Date(checkRes.data.updated_at).getTime();
            var localTs = estado._updatedAt ? new Date(estado._updatedAt).getTime() : 0;

            if (cloudTs > localTs) {
                // Cloud is newer — pull the full row and abort our write
                silberWarn('syncEstadoToCloud — nube más reciente, abortando escritura y aplicando nube…');

                var fullRes = await _supabase
                    .from('app_state')
                    .select('estado_json, updated_at')
                    .eq('id', 'global')
                    .single();

                if (!fullRes.error && fullRes.data && fullRes.data.estado_json) {
                    _isRemoteUpdate = true;
                    _applyCloudData(fullRes.data.estado_json);
                    guardarEstado();
                    _reRenderAll();
                    _isRemoteUpdate = false;
                    _showSyncToast('Datos actualizados desde otro dispositivo');
                }
                return;  // ← do NOT overwrite the cloud
            }
        }

        // ── Proceed with write (local is same or newer) ─────────
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
            silberWarn('syncEstadoToCloud — error:', res.error);
        } else {
            silberLog('syncEstadoToCloud — OK (' + payload.updated_at + ')');
        }

    } catch (e) {
        silberWarn('syncEstadoToCloud — excepción:', e);
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
            silberLog('cargarEstadoFromCloud — sin fila global, usando localStorage');
            return false;
        }

        var cloudTs = res.data.updated_at ? new Date(res.data.updated_at).getTime() : 0;
        var localTs = estado._updatedAt   ? new Date(estado._updatedAt).getTime()   : 0;

        if (cloudTs > localTs) {
            silberLog('cargarEstadoFromCloud — nube más reciente (' + res.data.updated_at + '), aplicando…');
            _isRemoteUpdate = true;
            _applyCloudData(res.data.estado_json);
            guardarEstado();
            _isRemoteUpdate = false;
            return true;
        }

        silberLog('cargarEstadoFromCloud — local igual o más reciente, sin cambios');
        return false;

    } catch (e) {
        silberWarn('cargarEstadoFromCloud — excepción, continuando en local:', e);
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

                    silberLog('Realtime — update recibido (' + payload.new.updated_at + '), aplicando…');
                    _isRemoteUpdate = true;

                    _applyCloudData(payload.new.estado_json);
                    guardarEstado();    // persist locally (won't re-trigger sync)
                    _reRenderAll();

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