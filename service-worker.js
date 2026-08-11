const APP_VERSION = '1.1.0';
const CACHE_NAME = `location-${APP_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './reset_password.html',
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
  './push.js?v=1.0.13',
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


// Web Push: 앱이 열려 있지 않아도 관리자에게 알림을 표시합니다.
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch (_) {
      try {
        payload = { body: event.data ? event.data.text() : '' };
      } catch (_) {
        payload = {};
      }
    }

    const title = payload.title || '부대 병력 위치현황';
    const scope = self.registration.scope;
    const options = {
      body: payload.body || '새 알림이 도착했습니다.',
      icon: payload.icon || new URL('./icons/icon-192.png', scope).href,
      badge: payload.badge || new URL('./icons/icon-96.png', scope).href,
      tag: payload.tag || 'location-push',
      data: {
        url: payload.url || './location_admin.html',
        type: payload.type || 'general',
        ...(payload.data || {})
      }
    };

    try {
      await self.registration.showNotification(title, options);
    } catch (_) {
      // 일부 모바일 브라우저에서 icon/badge 옵션 처리에 실패할 경우 최소 옵션으로 한 번 더 표시합니다.
      await self.registration.showNotification(title, {
        body: options.body,
        data: options.data
      });
    }
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification?.data?.url || './location_admin.html', self.location.href).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      try {
        const current = new URL(client.url);
        const wanted = new URL(target);
        if (current.origin === wanted.origin) {
          if ('navigate' in client) await client.navigate(target);
          if ('focus' in client) return client.focus();
        }
      } catch (_) {}
    }
    return self.clients.openWindow(target);
  })());
});
