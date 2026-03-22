/* SILBER GESTIÓN — silber-alerts.js
   Sistema de notificaciones, sonido, toasts y alertas inteligentes.
   Sin librerías externas. Sin tocar lógica de negocio.
*/

(function () {
    'use strict';

    /* ── App visibility ───────────────────────────────────────── */
    function isAppVisible() {
        return document.visibilityState === 'visible';
    }
    window.isAppVisible = isAppVisible;

    /* ── Sound: Web Audio API (no archivo externo necesario) ──── */
    /* Genera un pitido de notificación tipo "ping" de dos tonos.  */
    function playNotificationSound() {
        if (!isAppVisible()) return;
        try {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            var ctx = new AC();

            function tone(freq, start, dur, vol) {
                var osc  = ctx.createOscillator();
                var gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(vol, start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
                osc.start(start);
                osc.stop(start + dur);
            }

            var t = ctx.currentTime;
            tone(880, t,        0.14, 0.45);   /* high ping  */
            tone(660, t + 0.12, 0.20, 0.28);   /* soft follow */

            /* Liberar contexto al finalizar */
            setTimeout(function () { try { ctx.close(); } catch (e) {} }, 600);
        } catch (e) {}
    }
    window.playNotificationSound = playNotificationSound;

    /* ── Toast: aviso visual en foreground ───────────────────── */
    var _queue   = [];
    var _running = false;

    function mostrarToast(msg, tipo) {
        /* Anti-spam: máx 3 pendientes */
        if (_queue.length >= 3) return;
        _queue.push({ msg: msg || '', tipo: tipo || 'normal' });
        if (!_running) _drainQueue();
    }
    window.mostrarToast = mostrarToast;

    function _drainQueue() {
        if (_queue.length === 0) { _running = false; return; }
        _running = true;
        var item = _queue.shift();
        _showSingleToast(item.msg, item.tipo);
    }

    function _showSingleToast(msg, tipo) {
        var container = _getContainer();
        var el = document.createElement('div');
        el.className = 'silber-toast silber-toast--' + tipo;
        el.textContent = msg;
        container.appendChild(el);

        /* Fade in (doble rAF para garantizar transición) */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () { el.classList.add('silber-toast--in'); });
        });

        /* Fade out tras 3 s */
        setTimeout(function () {
            el.classList.remove('silber-toast--in');
            setTimeout(function () {
                if (el.parentNode) el.remove();
                setTimeout(_drainQueue, 60);   /* pausa entre toasts */
            }, 280);
        }, 3000);
    }

    function _getContainer() {
        var c = document.getElementById('silber-toast-wrap');
        if (c) return c;
        c = document.createElement('div');
        c.id = 'silber-toast-wrap';
        document.body.appendChild(c);
        return c;
    }

    /* ── Alert priority system ────────────────────────────────── */
    var ALERT_TYPES = {
        CRITICAL:  'critical',
        IMPORTANT: 'important',
        NORMAL:    'normal',
        SILENT:    'silent'
    };
    window.ALERT_TYPES = ALERT_TYPES;

    /**
     * dispararAlerta(tipo, titulo, cuerpo, url)
     *
     * CRITICAL  → push (background) + sonido + toast (foreground)
     * IMPORTANT → sonido + toast
     * NORMAL    → solo toast
     * SILENT    → nada
     */
    function dispararAlerta(tipo, titulo, cuerpo, url) {
        if (tipo === ALERT_TYPES.SILENT) return;

        if (isAppVisible()) {
            /* App abierta */
            if (tipo === ALERT_TYPES.CRITICAL || tipo === ALERT_TYPES.IMPORTANT) {
                playNotificationSound();
            }
            mostrarToast(titulo, tipo);
        } else {
            /* App en background: push nativo para CRITICAL */
            if (tipo === ALERT_TYPES.CRITICAL) {
                _triggerPush(titulo, cuerpo || '', url || '/');
            }
        }
    }
    window.dispararAlerta = dispararAlerta;

    function _triggerPush(titulo, cuerpo, url) {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.ready.then(function (reg) {
            if (!reg.showNotification) return;
            reg.showNotification(titulo, {
                body:    cuerpo,
                icon:    '/icon-192.png',
                badge:   '/icon-192.png',
                data:    url,
                vibrate: [100, 50, 100]
            });
        }).catch(function () {});
    }

    /* ── Casos de uso (estructura lista para conectar) ────────── */

    /** Nueva deuda de cliente → CRITICAL */
    window.alertaNuevaDeuda = function (cliente, monto) {
        var label = cliente || 'Cliente';
        var euros = (typeof monto === 'number') ? ' — ' + monto.toFixed(2) + '€' : '';
        dispararAlerta(ALERT_TYPES.CRITICAL, '⚠️ Nueva deuda: ' + label + euros, '', '/');
    };

    /** Modificación importante → IMPORTANT */
    window.alertaModificacion = function (detalle) {
        dispararAlerta(ALERT_TYPES.IMPORTANT, '✏️ ' + (detalle || 'Modificación registrada'), '', '/');
    };

    /** Acción normal → NORMAL */
    window.alertaAccionNormal = function (detalle) {
        dispararAlerta(ALERT_TYPES.NORMAL, '✅ ' + (detalle || 'Acción completada'), '', '/');
    };

    /* ── Inyectar contenedor si no existe al cargar DOM ────────── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _getContainer);
    } else {
        _getContainer();
    }

})();
