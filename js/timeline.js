/* SILBER GESTIÓN (NEXUS ERP) — timeline.js — Timeline del Negocio (solo MASTER) */

var TIMELINE_MAX = 200;

function tsSortKey(ts) {
    if (!ts) return '0';
    var s = String(ts).replace(' ', 'T');
    if (s.length === 10) s += 'T00:00';
    return s;
}

function getBusinessTimeline() {
    var events = [];
    var now = new Date().toISOString().slice(0, 16);

    // 1) Activity log (validado)
    if (typeof getActivityLogValidated === 'function') {
        try {
            var log = getActivityLogValidated();
            log.forEach(function(e) {
                events.push({
                    ts: e.timestamp || now,
                    user: e.user || '?',
                    type: 'activity',
                    description: (e.action || '') + (e.details ? ': ' + e.details : '')
                });
            });
        } catch (err) {}
    }

    // 2) Transacciones (creaciones): gastos e ingresos con fecha+hora
    if (typeof estado !== 'undefined' && estado) {
        var gastos = estado.gastosRegistros || [];
        var ingresos = estado.ingresosRegistros || [];
        gastos.forEach(function(r) {
            var ts = (r.fecha || '') + 'T' + (r.hora || '00:00');
            events.push({
                ts: ts,
                user: r.registradoPor || '?',
                type: 'transaction',
                description: 'Creó gasto ' + (r.monto != null ? r.monto.toFixed(2) : '0') + '€ (' + (r.categoria || '') + ')'
            });
        });
        ingresos.forEach(function(r) {
            var ts = (r.fecha || '') + 'T' + (r.hora || '00:00');
            events.push({
                ts: ts,
                user: r.registradoPor || '?',
                type: 'transaction',
                description: 'Creó ingreso ' + (r.monto != null ? r.monto.toFixed(2) : '0') + '€ (' + (r.categoria || '') + ')'
            });
        });
    }

    // 3) Cierres de caja
    if (typeof getCashClosings === 'function') {
        try {
            var cierres = getCashClosings();
            cierres.forEach(function(c) {
                var ts = (c.date || '') + 'T12:00';
                events.push({
                    ts: ts,
                    user: c.closed_by || '?',
                    type: 'cash_closing',
                    description: 'Cierre de caja' + (c.difference != null ? ' (diferencia ' + c.difference.toFixed(2) + '€)' : '')
                });
            });
        } catch (err) {}
    }

    // Ordenar por timestamp descendente y limitar
    events.sort(function(a, b) {
        var ka = tsSortKey(a.ts);
        var kb = tsSortKey(b.ts);
        return ka > kb ? -1 : ka < kb ? 1 : 0;
    });
    return events.slice(0, TIMELINE_MAX);
}

function getBusinessTimelineAsync() {
    var events = getBusinessTimeline();
    if (typeof _supabase === 'undefined' || !_supabase) return Promise.resolve(events);
    return _supabase.from('worker_locations').select('user,timestamp,created_at').order('created_at', { ascending: false }).limit(100)
        .then(function(res) {
            if (res.data && res.data.length) {
                res.data.forEach(function(w) {
                    var ts = w.timestamp || (w.created_at ? w.created_at.slice(0, 16) : '');
                    if (ts) events.push({ ts: ts, user: w.user || '?', type: 'location', description: 'Ubicación trabajador registrada' });
                });
                events.sort(function(a, b) {
                    var ka = tsSortKey(a.ts);
                    var kb = tsSortKey(b.ts);
                    return ka > kb ? -1 : ka < kb ? 1 : 0;
                });
                return events.slice(0, TIMELINE_MAX);
            }
            return events;
        })
        .catch(function() { return events; });
}

function renderBusinessTimeline() {
    if (typeof esMaster !== 'function' || !esMaster()) return;
    var container = document.getElementById('timeline-content');
    if (!container) return;
    container.innerHTML = '<div style="color:var(--text-secondary);font-size:12px;text-align:center;padding:16px;">Cargando…</div>';
    (typeof getBusinessTimelineAsync === 'function' ? getBusinessTimelineAsync() : Promise.resolve(getBusinessTimeline())).then(function(list) {
        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:24px 12px;">Sin eventos en el timeline.</div>';
            return;
        }
        list.forEach(function(ev) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px;';
            var time = (ev.ts || '').split('T')[1] || (ev.ts || '').slice(11, 16) || '—';
            if (time.length > 5) time = time.slice(0, 5);
            var datePart = (ev.ts || '').split('T')[0];
            row.innerHTML = '<span style="color:var(--text-secondary);white-space:nowrap;font-size:12px;">' + (datePart ? datePart + ' ' : '') + time + '</span>'
                + '<span style="color:var(--text-primary);flex:1;"><strong>' + (ev.user || '?') + '</strong> — ' + (ev.description || ev.type || '') + '</span>';
            container.appendChild(row);
        });
    });
}

