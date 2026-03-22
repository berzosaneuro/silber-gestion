/* SILBER GESTIÓN — master-security.js
   Controles MASTER: biometría para acciones sensibles, log de actividad, notificaciones entre MASTERs, cierres de caja.
*/

const ACTIVITY_LOG_KEY = 'activity_log';
const NOTIFICATIONS_KEY = 'silber_master_notifications';
const CASH_CLOSINGS_KEY = 'silber_cash_closings';
const NOTIFICATION_POLL_MS = 5000;
const ACTIVITY_LOG_MAX = 500;
const AUDIT_SHORT_TERM_MAX = 500;
const DAILY_SUMMARY_MAX_DAYS = 90;
// El jefe (Jefazo) recibe más avisos: cuando la otra master o un ADMIN hace algo sensible.
const MAIN_MASTER_USER = 'Jefazo';

function _activityLogPayload(entry) {
    return (entry.timestamp || '') + '|' + (entry.user || '') + '|' + (entry.role || '') + '|' + (entry.action || '') + '|' + (entry.details || '');
}
function _hashPayload(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
        h = ((h << 5) - h) + str.charCodeAt(i);
        h = h & h;
    }
    return (h >>> 0).toString(16);
}

// ——— Requiere ser admin (Jefazo o Jefaza) y (si hay biometría) verificación Face ID.
function requireMasterBiometric(onVerified) {
    if (typeof esMaster !== 'function' || !esMaster()) {
        if (typeof onVerified === 'function') onVerified(false);
        return;
    }
    const credGuardadas = localStorage.getItem('silber_biometric_creds');
    if (credGuardadas && typeof window.PublicKeyCredential !== 'undefined') {
        (typeof autenticarBiometria === 'function' ? autenticarBiometria() : Promise.resolve(false))
            .then(function(ok) { if (typeof onVerified === 'function') onVerified(!!ok); })
            .catch(function() { if (typeof onVerified === 'function') onVerified(false); });
    } else {
        if (typeof onVerified === 'function') onVerified(true);
    }
}

// ——— Activity log (with integrity hash; max ACTIVITY_LOG_MAX)
function activityLogAdd(entry) {
    var list = [];
    try {
        var raw = localStorage.getItem(ACTIVITY_LOG_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    if (!Array.isArray(list)) list = [];
    entry.timestamp = entry.timestamp || new Date().toISOString().slice(0, 16);
    entry.user = entry.user || (typeof sesionActual !== 'undefined' && sesionActual ? sesionActual.usuario : '?');
    entry.role = entry.role || (typeof sesionActual !== 'undefined' && sesionActual ? sesionActual.rol : '?');
    entry.hash = _hashPayload(_activityLogPayload(entry));
    list.push(entry);
    while (list.length > ACTIVITY_LOG_MAX) list.shift();
    try {
        localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(list));
    } catch (e) {}
    if (typeof _supabase !== 'undefined' && _supabase) {
        try {
            _supabase.from('activity_log').insert({
                timestamp: entry.timestamp,
                user: entry.user,
                role: entry.role,
                action: entry.action,
                details: entry.details || '',
                hash: entry.hash || null
            }).then(function() {}).catch(function() {});
        } catch (err) {}
    }
}

function getActivityLogValidated() {
    var list = [];
    try {
        var raw = localStorage.getItem(ACTIVITY_LOG_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    if (!Array.isArray(list)) return list;
    var tampered = false;
    for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.hash) {
            var expected = _hashPayload(_activityLogPayload(e));
            if (expected !== e.hash) {
                tampered = true;
                break;
            }
        }
    }
    if (tampered) {
        try {
            var tEntry = { action: 'LOG_TAMPERING_DETECTED', details: 'Activity log integrity mismatch' };
            tEntry.timestamp = new Date().toISOString().slice(0, 16);
            tEntry.hash = _hashPayload(_activityLogPayload(tEntry));
            list.push(tEntry);
            while (list.length > ACTIVITY_LOG_MAX) list.shift();
            localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify(list));
        } catch (err) {}
        if (typeof notifyOtherMaster === 'function') notifyOtherMaster('⚠️ Log: integridad del registro de actividad alterada.');
    }
    return list;
}

// ——— Notificar al otro MASTER (solo si el actual es MASTER)
function notifyOtherMaster(message) {
    if (typeof esMaster !== 'function' || !esMaster() || !sesionActual) return;
    var from = sesionActual.usuario;
    pushNotificationForMasters(from, message);
}

// ——— Avisar a los MASTER. Si forMainMasterOnly === true, solo el jefe (MAIN_MASTER_USER) verá la notificación.
function pushNotificationForMasters(fromUser, message, forMainMasterOnly) {
    var list = [];
    try {
        var raw = localStorage.getItem(NOTIFICATIONS_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    list.push({ from: fromUser || '?', message: message, ts: Date.now(), read: false, forMainMasterOnly: !!forMainMasterOnly });
    while (list.length > 100) list.shift();
    try {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
    } catch (e) {}
}

// ——— Obtener notificaciones no leídas para el MASTER actual. El jefe (MAIN_MASTER_USER) ve también las que son solo para él.
function getUnreadMasterNotifications() {
    if (typeof esMaster !== 'function' || !esMaster() || !sesionActual) return [];
    var list = [];
    try {
        var raw = localStorage.getItem(NOTIFICATIONS_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    var me = sesionActual.usuario;
    return list.filter(function(n) {
        if (n.read) return false;
        if (n.from === me) return false;
        if (n.forMainMasterOnly) return me === MAIN_MASTER_USER;
        return true;
    });
}

function markMasterNotificationsRead() {
    if (!sesionActual) return;
    var me = sesionActual.usuario;
    var list = [];
    try {
        var raw = localStorage.getItem(NOTIFICATIONS_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    list.forEach(function(n) { if (n.from !== me) n.read = true; });
    try {
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(list));
    } catch (e) {}
}

// ——— Toast de notificación para MASTER
function mostrarNotificacionMaster(texto) {
    var el = document.getElementById('master-notification-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'master-notification-toast';
        el.style.cssText = 'position:fixed;top:60px;right:12px;max-width:320px;padding:12px 14px;background:rgba(15,23,42,0.98);border:1px solid rgba(14,165,233,0.5);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;font-size:13px;color:#F1F5F9;display:none;';
        var cierre = document.createElement('button');
        cierre.textContent = '×';
        cierre.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer;line-height:1;';
        cierre.onclick = function() { el.style.display = 'none'; };
        el.appendChild(cierre);
        document.body.appendChild(el);
    }
    var first = el.querySelector('.master-toast-msg');
    if (first) first.textContent = texto;
    else {
        var msg = document.createElement('div');
        msg.className = 'master-toast-msg';
        msg.style.marginRight = '20px';
        msg.textContent = texto;
        el.insertBefore(msg, el.firstChild);
    }
    el.style.display = 'block';
    setTimeout(function() { el.style.display = 'none'; }, 8000);
}
// ——— Poll de notificaciones (solo MASTER)
var _notificationPollTimer = null;
function startMasterNotificationPoll() {
    if (_notificationPollTimer) return;
    function check() {
        if (typeof esMaster !== 'function' || !esMaster()) return;
        var unread = getUnreadMasterNotifications();
        if (unread.length) {
            mostrarNotificacionMaster(unread[0].from + ': ' + unread[0].message);
            markMasterNotificationsRead();
        }
    }
    _notificationPollTimer = setInterval(check, NOTIFICATION_POLL_MS);
    setTimeout(check, 2000);
}

// ——— Fraud detection & audit ———
var _auditShortTerm = [];
var SUSPICIOUS_WINDOW_MS = 30 * 60 * 1000;
var SUSPICIOUS_LIMIT = 3;
var CASH_DIFF_WARNING = 20;
var CASH_DIFF_CRITICAL = 50;
var DAILY_SUMMARY_KEY = 'silber_daily_activity_summary';

function _pruneAuditShortTerm() {
    var now = Date.now();
    _auditShortTerm = _auditShortTerm.filter(function(e) { return now - e.ts < SUSPICIOUS_WINDOW_MS; });
    if (_auditShortTerm.length > AUDIT_SHORT_TERM_MAX) _auditShortTerm = _auditShortTerm.slice(-AUDIT_SHORT_TERM_MAX);
}

function recordTransactionEditOrDelete(user, role, action, txId) {
    _auditShortTerm.push({ user: user || '?', role: role || '?', action: action, ts: Date.now(), txId: txId || null });
    _pruneAuditShortTerm();
    if (role === 'JEFAZA') {
        var windowStart = Date.now() - SUSPICIOUS_WINDOW_MS;
        var recent = _auditShortTerm.filter(function(e) { return e.user === user && e.ts >= windowStart; });
        var count = recent.length;
        var msg = action === 'delete' ? 'Eliminación de transacción' : 'Edición de transacción';
        activityLogAdd({ action: 'ADMIN_ACTIVITY_ALERT', user: user, role: role, details: msg + (txId ? ' (id ' + txId + ')' : '') });
        pushNotificationForMasters(user || 'Jefaza', '⚠️ ' + msg + ' — revisar si es correcto.', true);
        if (count > SUSPICIOUS_LIMIT) {
            var msg2 = 'Jefaza: más de ' + SUSPICIOUS_LIMIT + ' ' + (action === 'delete' ? 'eliminaciones' : 'ediciones') + ' en 30 min';
            activityLogAdd({ action: 'ADMIN_ACTIVITY_ALERT', user: user, role: role, details: msg2 });
            pushNotificationForMasters('Sistema', '🚨 ' + msg2, true);
        }
    }
    if (role === 'WORKER') {
        var windowStart = Date.now() - SUSPICIOUS_WINDOW_MS;
        var recent = _auditShortTerm.filter(function(e) { return e.user === user && e.ts >= windowStart; });
        var count = recent.length;
        if (count > SUSPICIOUS_LIMIT) {
            var msg = 'Más de ' + SUSPICIOUS_LIMIT + ' ' + (action === 'delete' ? 'eliminaciones' : 'ediciones') + ' de transacciones en 30 minutos';
            activityLogAdd({ action: 'SUSPICIOUS_ACTIVITY', user: user, role: role, details: msg });
            notifyOtherMaster('⚠️ Actividad sospechosa: ' + user + ' — ' + msg);
        }
        if (txId) {
            var editsSameTx = recent.filter(function(e) { return e.action === 'edit' && e.txId == txId; }).length;
            if (editsSameTx >= 2) {
                activityLogAdd({ action: 'SUSPICIOUS_SALES_PATTERN', user: user, details: 'Repeated edits of the same transaction detected' });
                notifyOtherMaster('⚠️ Patrón ventas: ' + user + ' — Ediciones repetidas de la misma transacción.');
            }
            var deletesRecent = recent.filter(function(e) { return e.action === 'delete'; }).length;
            var createsRecent = recent.filter(function(e) { return e.action === 'create'; }).length;
            if (createsRecent > 0 && deletesRecent >= 2 && count >= 4) {
                activityLogAdd({ action: 'SUSPICIOUS_SALES_PATTERN', user: user, details: 'High cancellation rate and deletions in short time' });
                notifyOtherMaster('⚠️ Patrón ventas: ' + user + ' — Posible manipulación (eliminaciones y cancelaciones).');
            }
        }
    }
}

function recordTransactionCreated(txId) {
    if (!sesionActual || !txId) return;
    _auditShortTerm.push({ user: sesionActual.usuario, role: sesionActual.rol || '?', action: 'create', ts: Date.now(), txId: txId });
    _pruneAuditShortTerm();
}

function checkHighValue(monto) {
    var umbral = (typeof estado !== 'undefined' && estado && typeof estado.umbralAlertaAltoValor === 'number') ? estado.umbralAlertaAltoValor : 200;
    if (monto <= umbral) return;
    var details = 'Transacción de ' + monto.toFixed(2) + '€ registrada';
    activityLogAdd({ action: 'HIGH_VALUE_TRANSACTION', details: details });
    notifyOtherMaster('💰 ' + details);
}

function recordCashDifferenceAlert(difference) {
    var abs = Math.abs(difference);
    if (abs <= CASH_DIFF_WARNING) return;
    var action = abs > CASH_DIFF_CRITICAL ? 'CRITICAL_CASH_DIFFERENCE' : 'WARNING_CASH_DIFFERENCE';
    var details = 'Diferencia en cierre: ' + difference.toFixed(2) + '€';
    activityLogAdd({ action: action, details: details });
    notifyOtherMaster('🔐 Cierre: ' + details);
}

function recordTransactionDeleted(amount, category, timestamp, deletedBy, tipo) {
    var details = 'Eliminó ' + (tipo === 'gasto' ? 'gasto' : 'ingreso') + ' ' + amount.toFixed(2) + '€ (' + category + ')';
    activityLogAdd({ action: 'TRANSACTION_DELETED', user: deletedBy, details: details, _amount: amount, _category: category, _timestamp: timestamp });
}

function getDailySummaries() {
    var list = [];
    try {
        var raw = localStorage.getItem(DAILY_SUMMARY_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    list = Array.isArray(list) ? list : [];
    while (list.length > DAILY_SUMMARY_MAX_DAYS) list.pop();
    return list;
}

function saveDailySummary(date, summary) {
    var list = getDailySummaries();
    var existing = list.findIndex(function(s) { return s.date === date; });
    var entry = { date: date, total_transactions: summary.total_transactions || 0, deleted_count: summary.deleted_count || 0, edited_count: summary.edited_count || 0, suspicious_count: summary.suspicious_count || 0 };
    if (existing >= 0) list[existing] = entry; else list.push(entry);
    list.sort(function(a, b) { return b.date.localeCompare(a.date); });
    while (list.length > DAILY_SUMMARY_MAX_DAYS) list.pop();
    try { localStorage.setItem(DAILY_SUMMARY_KEY, JSON.stringify(list)); } catch (e) {}
    if (typeof _supabase !== 'undefined' && _supabase) {
        try {
            _supabase.from('daily_activity_summary').insert({ date: date, total_transactions: entry.total_transactions, deleted_count: entry.deleted_count, edited_count: entry.edited_count, suspicious_count: entry.suspicious_count }).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] daily_activity_summary:', err); });
        } catch (err) {}
    }
}

function buildDailySummary(dateStr) {
    var list = getActivityLogValidated();
    var dayStart = dateStr + 'T00:00';
    var dayEnd = dateStr + 'T23:59';
    var dayLog = list.filter(function(e) {
        var t = e.timestamp || '';
        return t >= dayStart && t <= dayEnd;
    });
    var deleted = dayLog.filter(function(e) { return e.action === 'TRANSACTION_DELETED'; }).length;
    var edited = dayLog.filter(function(e) { return e.action === 'EDIT_TRANSACTION'; }).length;
    var suspicious = dayLog.filter(function(e) { return e.action === 'SUSPICIOUS_ACTIVITY'; }).length;
    var totalTx = 0;
    if (typeof estado !== 'undefined' && estado) {
        totalTx = (estado.gastosRegistros || []).filter(function(x) { return x.fecha === dateStr; }).length + (estado.ingresosRegistros || []).filter(function(x) { return x.fecha === dateStr; }).length;
    }
    saveDailySummary(dateStr, { total_transactions: totalTx, deleted_count: deleted, edited_count: edited, suspicious_count: suspicious });
}

function getAuditData() {
    var list = getActivityLogValidated();
    var recent = list.slice(-300).reverse();
    return {
        suspicious: recent.filter(function(e) { return e.action === 'SUSPICIOUS_ACTIVITY' || e.action === 'SUSPICIOUS_SALES_PATTERN'; }),
        deletions: recent.filter(function(e) { return e.action === 'TRANSACTION_DELETED'; }),
        highValue: recent.filter(function(e) { return e.action === 'HIGH_VALUE_TRANSACTION'; }),
        cashDifference: recent.filter(function(e) { return e.action === 'WARNING_CASH_DIFFERENCE' || e.action === 'CRITICAL_CASH_DIFFERENCE'; }),
        dailySummaries: getDailySummaries().slice(0, 30)
    };
}

// ——— Cash closings (historial completo con conciliación)
function getCashClosings() {
    var list = [];
    try {
        var raw = localStorage.getItem(CASH_CLOSINGS_KEY);
        if (raw) list = JSON.parse(raw);
    } catch (e) {}
    return Array.isArray(list) ? list : [];
}

function saveCashClosing(record) {
    var list = getCashClosings();
    record.date = record.date || new Date().toISOString().split('T')[0];
    record.closed_by = record.closed_by || (typeof sesionActual !== 'undefined' && sesionActual ? sesionActual.usuario : '?');
    list.push(record);
    try {
        localStorage.setItem(CASH_CLOSINGS_KEY, JSON.stringify(list));
    } catch (e) {}
    if (typeof _supabase !== 'undefined' && _supabase) {
        try {
            _supabase.from('cash_closings').insert(record).then(function() {}).catch(function(err) { if (console && console.warn) console.warn('[Supabase] cash_closings:', err); });
        } catch (err) {}
    }
}
