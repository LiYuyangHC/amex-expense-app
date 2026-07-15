const CACHE_NAME = "amex-expense-v3-0-6";
const APP_SHELL = [
  "./", "./index.html", "./manifest.json", "./icon.png", "./css/app.css?v=3.0.6",
  "./js/config.js?v=3.0.6", "./js/db.js?v=3.0.6", "./js/cloud.js?v=3.0.6", "./js/app.js?v=3.0.6"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isAppCode = url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || event.request.mode === "navigate";
  if (isAppCode) {
    event.respondWith(fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request).then(r => r || caches.match("./index.html"))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
    return response;
  })));
});
