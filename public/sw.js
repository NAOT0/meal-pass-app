// public/sw.js
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating.');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // ここにオフライン用のキャッシュ処理などを書けますが、
  // まずはPWA認識させるために空のフェッチリスナーを置きます。
});