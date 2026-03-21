// ═══════════════════════════════════════════════════════════════
//  AMOR.JS  —  Premium emotional feedback layer (La Jefaza only)
//  Zero business-logic impact. Pure cosmetic / emotional layer.
//  All features gated behind esJefaza() role check.
// ═══════════════════════════════════════════════════════════════

(function _initAmor() {
    'use strict';

    // ── Role gate ─────────────────────────────────────────────
    // Safe wrapper — esJefaza() is defined in app.js (loads before)
    // but sesionActual may be null until login, so we re-check at runtime.
    function _isJefaza() {
        try { return typeof esJefaza === 'function' && esJefaza(); }
        catch (e) { return false; }
    }

    // ── Message pools ─────────────────────────────────────────

    var WELCOME_MORNING = [
        'Buenos días mi vida ☀️ hoy lo vas a hacer increíble',
        'Empieza otro día y tú lo haces especial 💖',
        'Que bonito es verte trabajar así ☀️'
    ];
    var WELCOME_AFTERNOON = [
        'Seguimos sumando 💪 me encanta cómo lo haces',
        'Paso a paso, pero siempre hacia arriba ✨',
        'A pleno rendimiento como siempre 💖'
    ];
    var WELCOME_NIGHT = [
        'Orgulloso de ti 💖 has hecho un gran día',
        'Cierra el día sabiendo que lo hiciste increíble 🌙',
        'Noche de trabajo y tú siempre al frente 💖'
    ];

    // Context-aware: keyed by active screen group
    var ACTION_CLIENT = [
        'Otro más contigo 💖 qué bien lo haces',
        'Así crece esto, gracias a ti 💖',
        'Cada cliente es un paso más ✨'
    ];
    var ACTION_INCOME = [
        'Así se construye 💪 vamos a por más',
        'Cada ingreso cuenta, y los tuyos suman 💖',
        'Paso a paso lo estamos consiguiendo ✨'
    ];
    var ACTION_EXPENSE = [
        'Todo bajo control 💋 así se lleva esto',
        'Las cuentas claras, como siempre 💖',
        'Perfecto, cada detalle importa ✨'
    ];
    var ACTION_GENERIC = [
        'Perfecto nena 💋 todo bajo control',
        'Eres la mejor en esto 💖',
        'Sin ti nada de esto funcionaría ✨',
        'Lo haces sin esfuerzo y eso es lo más bonito 💋'
    ];

    var SPECIAL = [
        'Muy bien nena 💖 eres la mejor',
        'Sin ti esto no sería nada 💖',
        'Orgulloso de ti siempre 💖',
        'Eres lo mejor que me ha pasado 💖'
    ];
    var SURPRISE = [
        'Eres lo mejor que me ha pasado 💖',
        'Contigo todo tiene sentido ✨',
        'Me pones muy feliz viéndote trabajar así 💖',
        'Ojalá supieras lo increíble que eres 🌙'
    ];

    // Premium confetti palette — soft, no harsh neons
    var CONF_COLORS = [
        '#f9a8c9', '#e879a0', '#c084d4',
        '#a5b4fc', '#fde68a', '#ffffff',
        '#f0abcd', '#d8b4fe'
    ];

    function _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ── Silence rule ──────────────────────────────────────────
    // Never show messages while user is typing or navigating.
    var _navigating = false;

    function _isBusy() {
        if (_navigating) return true;
        try {
            var el = document.activeElement;
            if (!el) return false;
            var tag = el.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
        } catch (e) { return false; }
    }

    function _markNavigating() {
        _navigating = true;
        clearTimeout(_markNavigating._t);
        _markNavigating._t = setTimeout(function () { _navigating = false; }, 450);
    }

    // ── Time-based welcome (once per calendar day) ────────────
    var AMOR_DAY_KEY = 'silber_amor_day';

    function _hasShownToday() {
        try {
            return localStorage.getItem(AMOR_DAY_KEY) === new Date().toDateString();
        } catch (e) { return false; }
    }
    function _markShownToday() {
        try { localStorage.setItem(AMOR_DAY_KEY, new Date().toDateString()); }
        catch (e) {}
    }
    function _getWelcomeMsg() {
        var h = new Date().getHours();
        if (h >= 6  && h < 12) return _pick(WELCOME_MORNING);
        if (h >= 12 && h < 20) return _pick(WELCOME_AFTERNOON);
        return _pick(WELCOME_NIGHT);  // 20–05
    }

    // ── Context detector for action messages ──────────────────
    var CLIENT_SCREENS  = { 'screen-deuda': 1, 'screen-oficina': 1 };
    var INCOME_SCREENS  = { 'screen-ingresos': 1, 'screen-llegadas': 1, 'screen-cuentas': 1 };
    var EXPENSE_SCREENS = { 'screen-gastos': 1, 'screen-transferencias': 1 };

    function _getActionMsg() {
        try {
            var active = document.querySelector('.screen.active');
            var id = active ? active.id : '';
            if (CLIENT_SCREENS[id])  return _pick(ACTION_CLIENT);
            if (INCOME_SCREENS[id])  return _pick(ACTION_INCOME);
            if (EXPENSE_SCREENS[id]) return _pick(ACTION_EXPENSE);
        } catch (e) {}
        return _pick(ACTION_GENERIC);
    }

    // ── Premium Love Toast ────────────────────────────────────
    // Scale-in animation (no slide). Subtle glow. Never stacks.
    function _showLoveToast(msg) {
        if (!_isJefaza()) return;
        try {
            var prev = document.getElementById('silber-love-toast');
            if (prev) { clearTimeout(prev._t); prev.remove(); }

            var el = document.createElement('div');
            el.id = 'silber-love-toast';
            el.className = 'silber-love-toast';
            el.innerHTML =
                '<div class="slt-pill">' +
                '<span class="slt-text">' + msg + '</span>' +
                '</div>';
            document.body.appendChild(el);

            // Double-rAF ensures CSS transition fires reliably
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { el.classList.add('slt-visible'); });
            });

            el._t = setTimeout(function () {
                el.classList.remove('slt-visible');
                setTimeout(function () { if (el.parentNode) el.remove(); }, 500);
            }, 4200);
        } catch (e) {}
    }

    // ── Premium Special Moment ────────────────────────────────
    // Cinematic feel: subtle veil, parallax hearts, reduced soft confetti.
    function _showSpecialMoment(msg) {
        if (!_isJefaza()) return;
        try {
            if (document.getElementById('silber-special-ov')) return;

            var ov = document.createElement('div');
            ov.id = 'silber-special-ov';
            ov.className = 'silber-special-ov';

            // Atmospheric veil layer
            var veil = document.createElement('div');
            veil.className = 'sso-veil';
            ov.appendChild(veil);

            // Message
            var msgEl = document.createElement('div');
            msgEl.className = 'sso-msg';
            msgEl.textContent = msg || _pick(SPECIAL);
            ov.appendChild(msgEl);

            document.body.appendChild(ov);

            // ── Hearts — 3 speed tiers for parallax ──────────
            var GLYPHS = ['💖', '💕', '💗', '💓', '✨', '💋', '🌹'];
            var TIERS  = [
                { dur: 3.6, size: [12, 16] },   // slow  — background layer
                { dur: 2.5, size: [16, 22] },   // medium
                { dur: 1.9, size: [20, 28] }    // fast  — foreground layer
            ];
            for (var h = 0; h < 12; h++) {
                (function (i) {
                    setTimeout(function () {
                        var tier  = TIERS[i % TIERS.length];
                        var heart = document.createElement('div');
                        heart.className = 'sso-heart';
                        heart.textContent = GLYPHS[i % GLYPHS.length];
                        var left  = 4  + Math.random() * 92;
                        var dur   = (tier.dur + Math.random() * 0.6).toFixed(2);
                        var delay = (Math.random() * 0.4).toFixed(2);
                        var size  = (tier.size[0] + Math.random() * (tier.size[1] - tier.size[0])).toFixed(0);
                        var drift = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 20);
                        heart.style.cssText =
                            'left:' + left + '%;' +
                            'font-size:' + size + 'px;' +
                            'animation-duration:' + dur + 's;' +
                            'animation-delay:' + delay + 's;' +
                            '--drift:' + drift + 'px;';
                        ov.appendChild(heart);
                    }, i * 90);
                })(h);
            }

            // ── Confetti — 14 particles, soft palette only ───
            for (var c = 0; c < 14; c++) {
                (function (i) {
                    setTimeout(function () {
                        var conf  = document.createElement('div');
                        var isBar = Math.random() > 0.6;
                        conf.className = 'sso-conf' + (isBar ? ' sso-conf--bar' : '');
                        var left  = Math.random() * 100;
                        var color = _pick(CONF_COLORS);
                        var dur   = (2.2 + Math.random() * 1.4).toFixed(2);
                        var delay = (Math.random() * 1.0).toFixed(2);
                        var w     = isBar ? 2 : (4 + Math.random() * 4).toFixed(0);
                        var h2    = isBar ? (9 + Math.random() * 6).toFixed(0) : w;
                        conf.style.cssText =
                            'left:' + left + '%;' +
                            'background:' + color + ';' +
                            'width:' + w + 'px;' +
                            'height:' + h2 + 'px;' +
                            'animation-duration:' + dur + 's;' +
                            'animation-delay:' + delay + 's;';
                        ov.appendChild(conf);
                    }, i * 50);
                })(c);
            }

            // Reveal
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { ov.classList.add('sso-visible'); });
            });

            // Fade out cleanly — 3.8s display, 800ms fade
            setTimeout(function () {
                ov.classList.add('sso-out');
                setTimeout(function () { if (ov.parentNode) ov.remove(); }, 800);
            }, 3800);

        } catch (e) {}
    }

    // ── Welcome: fires once per session AND once per day ──────
    var _welcomeShown = false;

    function _triggerWelcome() {
        if (!_isJefaza()) return;
        if (_welcomeShown) return;
        if (_hasShownToday()) return;
        _welcomeShown = true;
        _markShownToday();
        setTimeout(function () { _showLoveToast(_getWelcomeMsg()); }, 1400);
    }

    function _watchForLogin() {
        // Already logged in (e.g. page reload with active session)
        if (!document.body.classList.contains('login-visible')) {
            // Defer to give app.js time to restore sesionActual
            setTimeout(_triggerWelcome, 800);
            return;
        }
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') return;
                var hadLogin = m.oldValue && m.oldValue.indexOf('login-visible') > -1;
                var hasLogin = document.body.classList.contains('login-visible');
                if (hadLogin && !hasLogin) {
                    obs.disconnect();
                    // Defer so sesionActual is populated
                    setTimeout(_triggerWelcome, 900);
                }
            });
        });
        obs.observe(document.body, { attributes: true, attributeOldValue: true });
    }

    // ── Action feedback + surprise ────────────────────────────
    var _saveCount      = 0;
    var _lastActionMsg  = 0;
    var _lastSurprise   = 0;
    var ACTION_INTERVAL = 28000;   // min 28s between action toasts
    var ACTION_EVERY_N  = 7;       // ~every 7th save
    var SURPRISE_PROB   = 0.05;    // 5% chance per eligible save
    var SURPRISE_COOL   = 300000;  // 5 min between surprises

    function _hookSave() {
        var _prev = window.guardarEstado;
        if (typeof _prev !== 'function') return;

        window.guardarEstado = function () {
            _prev.apply(this, arguments);
            if (!_isJefaza() || _isBusy()) return;

            _saveCount++;
            var now = Date.now();

            // ── Occasional surprise (rare, cinematic) ─────────
            if (
                Math.random() < SURPRISE_PROB &&
                (now - _lastSurprise) > SURPRISE_COOL
            ) {
                _lastSurprise = now;
                _lastActionMsg = now;   // suppress regular toast this cycle
                setTimeout(function () {
                    if (!_isBusy()) _showSpecialMoment(_pick(SURPRISE));
                }, 700);
                return;
            }

            // ── Regular action feedback (throttled) ───────────
            if (
                _saveCount % ACTION_EVERY_N === 0 &&
                (now - _lastActionMsg) > ACTION_INTERVAL
            ) {
                _lastActionMsg = now;
                setTimeout(function () {
                    if (!_isBusy()) _showLoveToast(_getActionMsg());
                }, 380);
            }
        };
    }

    // ── Special moment: expose globally ──────────────────────
    window.silberEspecial = _showSpecialMoment;

    // ── Logout: show special moment, reset state ──────────────
    function _hookLogout() {
        ['cerrarSesion', 'volverLogin', 'doLogout'].forEach(function (name) {
            var prev = window[name];
            if (typeof prev !== 'function') return;
            window[name] = function () {
                if (_isJefaza()) _showSpecialMoment();
                var args = arguments;
                setTimeout(function () { prev.apply(window, args); }, 900);
            };
        });
    }

    // Watch for login screen re-appearing (= any logout via cambiarPantalla)
    function _watchForLogout() {
        var loginScreen = document.getElementById('screen-login');
        if (!loginScreen) return;
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') return;
                var wasHidden = m.oldValue && m.oldValue.indexOf('active') === -1;
                var isActive  = loginScreen.classList.contains('active');
                if (wasHidden && isActive) {
                    if (_isJefaza()) _showSpecialMoment();
                    _welcomeShown = false;  // fresh welcome on next login
                }
            });
        });
        obs.observe(loginScreen, { attributes: true, attributeOldValue: true });
    }

    // Wrap cambiarPantalla to set navigating flag (silence rule)
    function _hookNavigation() {
        var prev = window.cambiarPantalla;
        if (typeof prev !== 'function') return;
        window.cambiarPantalla = function () {
            _markNavigating();
            return prev.apply(this, arguments);
        };
    }

    // ── Init ──────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        setTimeout(function () {
            _watchForLogin();
            _hookSave();
            _hookLogout();
            _hookNavigation();
            _watchForLogout();
        }, 60);
    });

})();
