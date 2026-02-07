// public/sw.js
const CACHE_NAME = 'meal-pass-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // index.html や sw.js は常にネットワークから最新を取得する
  if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/sw.js') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // それ以外のJSや画像はキャッシュがあればそれを返し、なければネットワークから取得
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((fetchResponse) => {
        // 静的ファイル（_expo/staticなど）ならキャッシュに保存
        if (event.request.url.includes('_expo/static') || event.request.url.includes('assets')) {
          const responseClone = fetchResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return fetchResponse;
      });
    })
  );
});