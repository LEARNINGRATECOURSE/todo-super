/* TaskFlow Pro service worker: precache app shell, stale-while-revalidate for assets,
   network-first navigation with offline fallback, notification click handling.
   All URLs are resolved against the worker's scope so the app works at any base path
   (e.g. https://user.github.io/todo-super/). */
const VERSION = 'taskflow-__BUILD_ID__';
// Replaced at build time with the hashed bundle files, relative to the scope (see vite.config.ts).
const BUILD_ASSETS = /*__PRECACHE__*/[];
const SCOPE = self.registration.scope;
const url = (path) => new URL(path, SCOPE).href;
const SHELL = [...BUILD_ASSETS, '', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'].map(url);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);
  if (reqUrl.origin !== self.location.origin) return;
  if (!reqUrl.href.startsWith(SCOPE)) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(url('index.html'), copy));
          return res;
        })
        .catch(() => caches.match(url('index.html')).then((r) => r || caches.match(SCOPE))),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || SCOPE;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
