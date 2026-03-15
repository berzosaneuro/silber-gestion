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
        _supabase.from('worker_locations').insert({ user: user || '?', role: role || '?', lat: lat, lng: lng, timestamp: ts }).then(function() {}).catch(function() {});
    } catch (err) {}
}

// ——— Sync clients to Supabase (upsert by id)
function syncClientsToSupabase() {
    if (typeof _supabase === 'undefined' || !_supabase || !estado.clientes || !estado.clientes.length) return;
    try {
        estado.clientes.forEach(function(c) {
            var row = { id: String(c.id), nombre: c.nombre, whatsapp: c.whatsapp || '', limite: c.limite || 0, dia_pago: c.diaPago || 1, producto: c.producto || '', deuda: c.deuda || 0, lat: c.lat != null ? c.lat : null, lng: c.lng != null ? c.lng : null };
            _supabase.from('clients').upsert(row, { onConflict: 'id' }).then(function() {}).catch(function() {});
        });
    } catch (err) {}
}