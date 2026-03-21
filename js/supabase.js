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
//     id         text primary key,
//     estado_json jsonb,
//     updated_at  timestamptz default now()
//   );
//   -- Disable RLS for this table (or add permissive policies):
//   alter table app_state disable row level security;
//   -- Enable Realtime for this table:
//   alter publication supabase_realtime add table app_state;
// =============================================================

var _isRemoteUpdate = false;   // guard: prevents re-uploading what we just received
var _syncTimer      = null;    // debounce handle for syncEstadoToCloud

// ── 1. WRITE: push full estado to the cloud ──────────────────
async function syncEstadoToCloud() {
    if (!_supabase) return;
    if (_isRemoteUpdate) return;          // never echo a remote update back up
    try {
        // Build a clean, photo-free payload (keeps size small)
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

// ── 2. READ: load cloud state at startup ─────────────────────
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

        var cloudData = res.data.estado_json;
        var cloudTs   = res.data.updated_at  ? new Date(res.data.updated_at).getTime()   : 0;
        var localTs   = estado._updatedAt    ? new Date(estado._updatedAt).getTime()     : 0;

        if (cloudTs > localTs) {
            silberLog('cargarEstadoFromCloud — nube más reciente (' + res.data.updated_at + '), aplicando…');
            _isRemoteUpdate = true;
            // Merge: keep session fields from local, replace data from cloud
            var sessionFields = {
                historialPantallas : estado.historialPantallas,
                transaccionActual  : estado.transaccionActual,
                clienteActual      : estado.clienteActual
            };
            Object.assign(estado, cloudData, sessionFields);
            guardarEstado();                 // persist merged state locally
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

                    // Ignore if we already have this version (our own echo)
                    if (cloudTs <= localTs) {
                        silberLog('Realtime — update ignorado (no es más reciente)');
                        return;
                    }

                    silberLog('Realtime — update recibido (' + payload.new.updated_at + '), aplicando…');
                    _isRemoteUpdate = true;

                    var sessionFields = {
                        historialPantallas : estado.historialPantallas,
                        transaccionActual  : estado.transaccionActual,
                        clienteActual      : estado.clienteActual
                    };
                    Object.assign(estado, payload.new.estado_json, sessionFields);
                    guardarEstado();            // persist locally (won't re-trigger sync)
                    _reRenderAll();             // refresh UI

                    _isRemoteUpdate = false;

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

// ── 4. RE-RENDER helper — refresh all key UI areas ───────────
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

// ── 6. DOMContentLoaded: pull cloud state, then subscribe ─────
document.addEventListener('DOMContentLoaded', function() {
    if (!_supabase) return;

    cargarEstadoFromCloud().then(function(wasUpdated) {
        if (wasUpdated) {
            // Cloud had fresher data — re-render everything
            _reRenderAll();
            if (typeof validateEstado === 'function') validateEstado();
        }
        // Always set up realtime after the initial load
        _setupRealtimeSync();
    });
});