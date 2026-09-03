/* 霓虹突袭 · Service Worker — 离线缓存核心资源 */
const CACHE_NAME = 'neon-assault-v14';
const CORE_ASSETS = [
  './',
  './index.html',
  './guide.html',
  './game.js',
  './sprites.js',
  './textures.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const reqUrl = new URL(req.url);
  /* 安装包与投放清单走网络：大文件不能进 SW，清单也要能马上看到新版本 */
  if (reqUrl.pathname.includes('/releases/')) {
    event.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }
  // 优先命中缓存，失败再回源
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(resp => {
        // 只缓存同域静态资源
        const url = new URL(req.url);
        if (url.origin !== self.location.origin) return resp;
        const isStatic = /\.(png|jpg|jpeg|webp|svg|js|html|json|css|woff2?)$/.test(url.pathname);
        if (resp.ok && isStatic) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
