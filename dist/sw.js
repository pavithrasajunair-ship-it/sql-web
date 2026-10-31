// Service worker: makes the app load offline. 3e8e05f48f is replaced at build time,
// so every new build invalidates the old cache and users get the update.
const CACHE = 'sqlrev-__VERSION__';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './favicon.ico', './favicon-32.png', './apple-touch-icon.png', './launch-poster.jpg', './launch-vertical-poster.jpg', './shot-learn.webp', './shot-practice.webp', './shot-lab.webp'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('sqlrev-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin || req.headers.has('range')) return;   // let the browser stream video ranges itself
  if (req.mode === 'navigate') {                       // page loads: network first (fresh), cache when offline
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', copy)); return r; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));   // static assets: cache first
});
