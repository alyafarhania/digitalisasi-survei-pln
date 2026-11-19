// Service worker minimal: cache cangkang aplikasi supaya halaman terbuka saat offline.
// Tile peta disimpan terpisah di IndexedDB (lihat src/lib/offlineTiles.js).
const CACHE = 'pln-shell-v1'
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/', '/logo-pln.png', '/kompas.jpg', '/logo-icon.png']).catch(() => {}))) })
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())))
self.addEventListener('fetch', (e) => {
  const r = e.request, u = new URL(r.url)
  if (r.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/')) return
  const staticAsset = u.pathname.startsWith('/_next/static/') || /\.(png|jpg|svg|json|css|js)$/.test(u.pathname)
  e.respondWith(staticAsset
    ? caches.match(r).then((hit) => hit || fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(r, cp)); return res }))
    : fetch(r).then((res) => { const cp = res.clone(); caches.open(CACHE).then((c) => c.put('/', cp)); return res }).catch(() => caches.match('/')))
})
