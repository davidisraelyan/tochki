/* Офлайн-режим: приложение стартует из кэша мгновенно и без сети.
   Версия кэша обновляется автоматически при публикации (publish.mjs). */
const CACHE = "tochki-1319bfa466";
const ASSETS = [
  "./",
  "./index.html",
  "./data.js",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-512.png",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function put(cache, key, res){
  try{
    if(res && res.ok) await cache.put(key, res.clone());
  }catch(_){}
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET") return;
  const url = new URL(req.url);
  if(url.origin !== location.origin) return; // карты и внешние ссылки — не трогаем

  if(req.mode === "navigate" || req.destination === "document"){
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match("./index.html");
      // фоновое обновление страницы, когда сеть есть
      fetch(req).then(r => put(cache, "./index.html", r)).catch(() => {});
      if(cached) return cached;
      try{
        const res = await fetch(req);
        await put(cache, "./index.html", res);
        return res;
      }catch(_){
        return new Response("<!doctype html><meta charset=utf-8><h2>Нет сети</h2><p>Откройте приложение один раз при интернете — дальше оно работает офлайн.</p>",
          { headers: { "content-type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if(hit){
      fetch(req).then(r => put(cache, req, r)).catch(() => {}); // обновляем в фоне
      return hit;
    }
    try{
      const res = await fetch(req);
      await put(cache, req, res);
      return res;
    }catch(_){
      return new Response("", { status: 504, statusText: "offline" });
    }
  })());
});

self.addEventListener("message", e => {
  if(e.data === "ping"){
    e.source && e.source.postMessage({ type: "pong", cache: CACHE });
  }
});
