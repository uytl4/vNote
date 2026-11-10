/* Offline cache for the TOEIC Reading site. Bump VERSION whenever files change. */
var VERSION = 'toeic-rc-v4';
var FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/toeic.css',
  'js/toeic-keys.js', 'js/core.js', 'js/pdfview.js', 'js/toeic.js',
  'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Same-origin files: network first (so updates arrive), cache when offline.
// Other origins (Google Drive viewer) are left alone.
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(fetch(req).then(function (res) {
    var copy = res.clone();
    caches.open(VERSION).then(function (c) { c.put(req, copy); });
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) { return hit || caches.match('index.html'); });
  }));
});
