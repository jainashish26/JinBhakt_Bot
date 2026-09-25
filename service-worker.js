"use strict";

/* ============================================================
 *  JinBhakt service worker
 *  - Relative URLs so it works on any hosting sub-path
 *  - App shell + manifests: precached / network-first (fresh metadata)
 *  - Lazy prayer bodies (content/text/*): cache-first (static, immutable)
 * ============================================================ */

var CACHE_NAME = 'jinbhakt-v6';

var SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/variables.css',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/speech.js',
  './img/logo.png',
  './img/favicon.ico',
  './img/icon-192.png',
  './img/icon-512.png',
  './img/icon-maskable-512.png',
  './img/apple-touch-icon.png'
];

var CONTENT_ASSETS = [
  './content/categories.json',
  './content/bhajan.json',
  './content/pooja.json',
  './content/granth.json',
  './content/stotra.json',
  './content/aarti.json',
  './content/chalisa.json',
  './content/stuti.json',
  './content/bhakti.json',
  './content/katha.json',
  './content/misc.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll() rejects on a single 404 — add individually so one
      // missing optional asset can't break the whole install.
      return Promise.all(
        SHELL_ASSETS.concat(CONTENT_ASSETS).map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] skipped', url, err);
          });
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;   // never touch CDN/fonts

  var isJSON = /\.json(\?|$)/.test(url.pathname);
  var isNavigation = request.mode === 'navigate';
  // Lazy prayer bodies are static/immutable once built — cache them aggressively.
  var isLazyText = url.pathname.indexOf('/content/text/') !== -1;

  // Manifests + navigations: NETWORK FIRST (always fresh metadata).
  // Lazy text files are excluded so they fall through to cache-first below.
  if ((isJSON && !isLazyText) || isNavigation) {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          return isNavigation ? caches.match('./index.html') : Response.error();
        });
      })
    );
    return;
  }

  // Static assets: CACHE FIRST (fast, offline-capable)
  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});


