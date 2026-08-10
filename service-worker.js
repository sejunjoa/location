const APP_VERSION = '1.0.7';
const CACHE_NAME = `location-${APP_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './location_user.html',
  './location_admin.html',
  './register_user.html',
  './register_admin.html',
  './auth.js',
  './config.js',
  './common.js',
  './admin-ui.js',
  './toast.js',
  './pwa.js',
  './mobile-back.js',
  './pwa.css',
  './manifest.webmanifest',
  './offline.html',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32x32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  // 새 버전은 즉시 강제 교체하지 않고 waiting 상태에서 사용자의 업데이트 선택을 기다린다.
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage?.({ type: 'LOCATION_VERSION', version: APP_VERSION });
  }
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({
      type: 'LOCATION_VERSION_ACTIVATED',
      version: APP_VERSION
    }));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (await caches.match(request)) ||
                 (await caches.match('./index.html')) ||
                 (await caches.match('./offline.html'));
        })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
