// public/sw.js
const CACHE_NAME = 'meal-pass-v1';

self.addEventListener('install', (event) => {
  // 新しいSWがインストールされたら待機せずに即座にアクティブにする
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // 古いキャッシュをクリア
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // 404エラーを防ぐため、ネットワーク優先で取得する
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});