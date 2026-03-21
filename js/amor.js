// ═══════════════════════════════════════════════════════════════
//  AMOR.JS  —  Motivational & romantic feedback layer
//  Zero business-logic impact. Pure cosmetic / emotional layer.
//  Wraps only after all other scripts have initialised.
// ═══════════════════════════════════════════════════════════════

(function _initAmor() {
    'use strict';

    // ── Message pools ─────────────────────────────────────────
    var WELCOME = [
        'Buenos días mi niña 💖 gracias por todo lo que haces',
        'Eres increíble, vamos a por todo hoy ✨',
        'Gracias por tu trabajo, bebé 💋',
        'Hoy vas a romperla, ya lo sé 🔥',
        'Lo que haces importa mucho 💖',
        'Cada día mejor, contigo todo es posible ✨'
    ];

    var ACTION = [
        'Buen trabajo nena 💋',
        'Así se hace, vamos a por más 🔥',
        'Eres la mejor 💖',
        'Perfecto, seguimos sumando ✨',
        '¡Lo clavaste! 🎯',
        'Crack total 💖',
        'Sigue así, nena 🔥',
        'Qué rápida eres ✨',
        'Ni un fallo, increíble 💋'
    ];

    var SPECIAL = [
        'Muy bien nena 💖 eres la mejor',
        '¡Increíble trabajo hoy! 💋✨',
        'Orgulloso de ti siempre 💖',
        'Sin ti esto no sería nada 💖'
    ];

    var CONFETTI_COLORS = [
        '#ff6b9d', '#c44dff', '#00E5FF', '#FFD700',
        '#ff9f43', '#ffffff', '#a29bfe', '#fd79a8'
    ];

    function _pick(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    // ── Love Toast (bottom, warm style) ──────────────────────
    function _showLoveToast(msg) {
        try {
            var prev = document.getElementById('silber-love-toast');
            if (prev) { clearTimeout(prev._t); prev.remove(); }

            var el = document.createElement('div');
            el.id = 'silber-love-toast';
            el.className = 'silber-love-toast';
            el.innerHTML = '<div class="slt-pill"><span class="slt-text">' + msg + '</span></div>';
            document.body.appendChild(el);

            requestAnimationFrame(function() {
                requestAnimationFrame(function() { el.classList.add('slt-visible'); });
            });

            el._t = setTimeout(function() {
                el.classList.remove('slt-visible');
                setTimeout(function() { if (el.parentNode) el.remove(); }, 420);
            }, 4000);
        } catch (e) {}
    }

    // ── Special Moment Overlay (hearts + confetti) ────────────
    function _showSpecialMoment(msg) {
        try {
            if (document.getElementById('silber-special-ov')) return;

            var ov = document.createElement('div');
            ov.id = 'silber-special-ov';
            ov.className = 'silber-special-ov';
            ov.innerHTML =
                '<div class="sso-msg">' + (msg || _pick(SPECIAL)) + '</div>';
            document.body.appendChild(ov);

            // ── Spawn floating hearts (bottom → up) ──────────
            var HEART_GLYPHS = ['💖', '💕', '💗', '💓', '✨', '💋'];
            for (var h = 0; h < 14; h++) {
                (function (i) {
                    setTimeout(function () {
                        var heart = document.createElement('div');
                        heart.className = 'sso-heart';
                        heart.textContent = HEART_GLYPHS[i % HEART_GLYPHS.length];
                        var left  = 3 + Math.random() * 94;
                        var dur   = (2.0 + Math.random() * 1.4).toFixed(2);
                        var delay = (Math.random() * 0.5).toFixed(2);
                        var size  = (14 + Math.random() * 18).toFixed(0);
                        heart.style.cssText =
                            'left:' + left + '%;' +
                            'font-size:' + size + 'px;' +
                            'animation-duration:' + dur + 's;' +
                            'animation-delay:' + delay + 's;';
                        ov.appendChild(heart);
                    }, i * 70);
                })(h);
            }

            // ── Spawn confetti (top → down) ───────────────────
            for (var c = 0; c < 22; c++) {
                (function (i) {
                    setTimeout(function () {
                        var conf  = document.createElement('div');
                        var isBar = Math.random() > 0.55;
                        conf.className = 'sso-conf' + (isBar ? ' sso-conf--bar' : '');
                        var left  = Math.random() * 100;
                        var color = _pick(CONFETTI_COLORS);
                        var dur   = (1.8 + Math.random() * 1.6).toFixed(2);
                        var delay = (Math.random() * 0.9).toFixed(2);
                        var w     = isBar ? 3 : (4 + Math.random() * 5).toFixed(0);
                        var h2    = isBar ? (8 + Math.random() * 7).toFixed(0) : w;
                        conf.style.cssText =
                            'left:' + left + '%;' +
                            'background:' + color + ';' +
                            'width:' + w + 'px;' +
                            'height:' + h2 + 'px;' +
                            'animation-duration:' + dur + 's;' +
                            'animation-delay:' + delay + 's;';
                        ov.appendChild(conf);
                    }, i * 35);
                })(c);
            }

            // Show
            requestAnimationFrame(function () {
                requestAnimationFrame(function () { ov.classList.add('sso-visible'); });
            });

            // Fade out & remove after 3.4 s
            setTimeout(function () {
                ov.classList.add('sso-out');
                setTimeout(function () { if (ov.parentNode) ov.remove(); }, 700);
            }, 3400);

        } catch (e) {}
    }

    // ── Welcome: fires once after login-visible is removed ────
    var _welcomeShown = false;
    function _watchForLogin() {
        if (_welcomeShown) return;
        // If already logged in (page reload while authenticated)
        if (!document.body.classList.contains('login-visible')) {
            _welcomeShown = true;
            setTimeout(function () { _showLoveToast(_pick(WELCOME)); }, 1400);
            return;
        }
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') return;
                var hadLogin = m.oldValue && m.oldValue.indexOf('login-visible') > -1;
                var hasLogin = document.body.classList.contains('login-visible');
                if (hadLogin && !hasLogin && !_welcomeShown) {
                    _welcomeShown = true;
                    obs.disconnect();
                    setTimeout(function () { _showLoveToast(_pick(WELCOME)); }, 1200);
                }
            });
        });
        obs.observe(document.body, { attributes: true, attributeOldValue: true });
    }

    // ── Action feedback: throttled wrapping of guardarEstado ──
    var _saveCount = 0;
    var _lastActionMsg = 0;
    var ACTION_MIN_INTERVAL = 28000;  // at most once every 28 s
    var ACTION_EVERY_N      = 7;      // roughly every 7th save

    function _hookSave() {
        var _prev = window.guardarEstado;
        if (typeof _prev !== 'function') return;
        window.guardarEstado = function () {
            _prev.apply(this, arguments);
            _saveCount++;
            var now = Date.now();
            if (
                _saveCount % ACTION_EVERY_N === 0 &&
                (now - _lastActionMsg) > ACTION_MIN_INTERVAL
            ) {
                _lastActionMsg = now;
                setTimeout(function () { _showLoveToast(_pick(ACTION)); }, 350);
            }
        };
    }

    // ── Special moment hook: expose globally + optional logout ─
    window.silberEspecial = _showSpecialMoment;

    // Try to wrap common logout-like functions
    function _hookLogout() {
        ['cerrarSesion', 'volverLogin', 'doLogout'].forEach(function (name) {
            var prev = window[name];
            if (typeof prev !== 'function') return;
            window[name] = function () {
                _showSpecialMoment();
                var args = arguments;
                setTimeout(function () { prev.apply(window, args); }, 900);
            };
        });
    }

    // Watch for login screen becoming active again (= logout via cambiarPantalla)
    function _watchForLogout() {
        var loginScreen = document.getElementById('screen-login');
        if (!loginScreen) return;
        var logoutObs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                if (m.type !== 'attributes' || m.attributeName !== 'class') return;
                var hadActive = m.oldValue && m.oldValue.indexOf('active') === -1;
                var hasActive = loginScreen.classList.contains('active');
                if (hadActive && hasActive) {
                    // Login screen just became active = user logged out
                    _showSpecialMoment();
                    // Reset welcome so it fires again next login
                    _welcomeShown = false;
                }
            });
        });
        logoutObs.observe(loginScreen, { attributes: true, attributeOldValue: true });
    }

    // ── Init ──────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        // Wait one tick so all other script patches are settled
        setTimeout(function () {
            _watchForLogin();
            _hookSave();
            _hookLogout();
            _watchForLogout();
        }, 50);
    });

})();
