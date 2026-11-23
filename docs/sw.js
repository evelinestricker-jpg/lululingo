// Lululingo offline-cache. Hæv VERSION, når appens filer ændres, så telefonen henter de nye.
const VERSION = 'lululingo-v4';
const CORE = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/srs.js', 'js/ui.js', 'js/data.js', 'js/cartoon.js', 'js/prompt.js', 'js/claude.js', 'js/openrouter.js',
  'js/screens/home.js', 'js/screens/library.js', 'js/screens/player.js', 'js/screens/cards.js',
  'js/screens/chat.js', 'js/screens/learn.js', 'js/screens/game.js', 'js/screens/settings.js',
  'vendor/anthropic.js', 'episodes/index.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Chat med Claude går altid direkte til nettet
  if (url.hostname === 'api.anthropic.com' || url.hostname === 'openrouter.ai') return;
  // Lyd hentes med Range-forespørgsler – lad browseren klare dem selv
  if (req.headers.has('range')) return;
  const sameOrigin = url.origin === self.location.origin;
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  // Netværk først (så opdateringer kommer med), cache som reserve når man er offline
  e.respondWith(
    fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
