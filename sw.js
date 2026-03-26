/* SILBER GESTIÓN — sw.js
   Minimal service worker for PWA installability and basic offline shell.
   Does NOT intercept Supabase API calls, CDN resources, or auth flows.
*/

var CACHE = 'silber-v3';

/* ── Install: cache the app shell ──────────────────────────── */
self.addEventListener('install', function(e) {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(function(cache) {
            /* Precache critical shell + icons to avoid stale launcher assets.
               Wrapping in catch so a single missing file never blocks installation. */
            return cache.addAll([
                '/index.html',
                '/manifest.json',
                '/icons/icon-192.png',
                '/icons/icon-512.png',
                '/icons/icon-192-maskable.png',
                '/icons/icon-512-maskable.png'
            ]).catch(function(err) {
                console.warn('[SW] Could not precache shell/icons:', err);
            });
        })
    );
});

/* ── Activate: remove old caches ───────────────────────────── */
self.addEventListener('activate', function(e) {
    e.waitUntil(
        caches.keys().then(function(keys) {
            return Promise.all(
                keys.filter(function(k) { return k !== CACHE; })
                    .map(function(k) { return caches.delete(k); })
            );
        }).then(function() { return self.clients.claim(); })
    );
});

/* ── Fetch: cache-first for same-origin, pass-through otherwise ── */
self.addEventListener('fetch', function(e) {
    var req = e.request;

    // Only handle GET
    if (req.method !== 'GET') return;

    var url = req.url;

    // Never intercept Supabase API calls (auth + data)
    if (url.includes('supabase.co')) return;

    // Never intercept CDN resources
    if (url.includes('jsdelivr.net'))    return;
    if (url.includes('googleapis.com'))  return;
    if (url.includes('gstatic.com'))     return;

    // Same-origin requests: cache-first, network fallback, dynamic cache fill
    if (url.startsWith(self.location.origin)) {
        e.respondWith(
            caches.match(req).then(function(cached) {
                if (cached) return cached;

                return fetch(req).then(function(res) {
                    // Dynamically cache valid same-origin responses
                    if (res.ok && res.type === 'basic') {
                        var clone = res.clone();
                        caches.open(CACHE).then(function(c) { c.put(req, clone); });
                    }
                    return res;
                }).catch(function() {
                    // Offline fallback: return cached index.html for navigation
                    if (req.mode === 'navigate') return caches.match('/index.html');
                });
            })
        );
    }
    // Cross-origin (not Supabase/CDN — e.g. custom APIs): pass through
});

/* ── Push: show notification ────────────────────────────── */
self.addEventListener('push', function(event) {
    var data = {};
    try { data = event.data ? event.data.json() : {}; } catch (e) {}
    event.waitUntil(
        self.registration.showNotification(data.title || 'Silber Gestión', {
            body:    data.body    || '',
            icon:    '/icons/icon-192.png',
            badge:   '/icons/icon-192.png',
            data:    data.url    || '/',
            vibrate: [100, 50, 100]
        })
    );
});

/* ── Notification click: focus or open app ──────────────── */
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    var target = event.notification.data || '/';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then(function(list) {
                for (var i = 0; i < list.length; i++) {
                    if (list[i].url && list[i].focus) {
                        return list[i].focus();
                    }
                }
                return self.clients.openWindow(target);
            })
    );
});
