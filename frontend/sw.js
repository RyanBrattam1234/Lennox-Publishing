/* Only public, fixed assets belong in this cache. No posts or editor data. */
const CACHE_PREFIX = 'lennox-public-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v1';
const CORE_ASSETS = [
  '/offline.html', '/styles.css', '/pwa.css', '/pwa.js',
  '/assets/fonts/dm-sans-regular.ttf', '/assets/fonts/dm-sans-medium.ttf', '/assets/fonts/libre-caslon-display.ttf',
  '/apple-touch-icon.png', '/assets/icons/icon-192.png'
];
const STATIC_ASSETS = new Set([
  ...CORE_ASSETS, '/blog.css', '/privacy.css', '/privacy.js', '/privacy-storage.mjs',
  '/script.js', '/blog-feed.js', '/blog-format.mjs', '/pwa.js',
  '/manifest.webmanifest', '/assets/favicon.svg', '/assets/icons/favicon-32.png',
  '/assets/icons/icon-512.png', '/assets/icons/icon-maskable-512.png',
  '/assets/fonts/dm-sans-medium.ttf', '/assets/fonts/dm-sans-bold.ttf',
  '/assets/book-cover.webp', '/assets/maggie-cover.webp', '/assets/publisher-logo.webp'
]);

self.addEventListener('install', event => {
  // Do not force activation or reload a tab with unsaved editorial work.
  event.waitUntil((async () => {
    const responses = await Promise.all(CORE_ASSETS.map(async path => {
      const response = await fetch(new Request(path, {cache:'reload', credentials:'omit'}));
      if (!response.ok || response.redirected) throw new Error('Offline asset unavailable');
      return [path, response];
    }));
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(responses.map(([path,response]) => cache.put(path,response)));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function navigate(request) {
  try {
    // HTML, published articles and protected pages always come from the server.
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_NAME);
    const fallback = await cache.match('/offline.html');
    return fallback || new Response('Du bist offline. Bitte verbinde dich mit dem Internet und lade die Seite neu.', {
      status:503, headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}
    });
  }
}

async function publicAsset(request,event) {
  try {
    const response = await fetch(request);
    if (response.ok && !response.redirected && !/no-store/i.test(response.headers.get('Cache-Control') || '')) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(request,copy)).catch(() => {}));
    }
    return response;
  } catch (error) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || request.headers.has('Range')) return;
  // Never intercept API, authentication, uploaded images or browser auth flows.
  if (url.pathname.startsWith('/api/') || /^\/(signin-with-chatgpt|signout-with-chatgpt|callback)(\/|$)/.test(url.pathname)) return;
  if (request.mode === 'navigate') { event.respondWith(navigate(request)); return; }
  if (!url.search && STATIC_ASSETS.has(url.pathname)) event.respondWith(publicAsset(request,event));
});
