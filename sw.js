const CACHE_NAME = 'uni-schedule-v3';
const RUNTIME_CACHE = 'uni-schedule-runtime-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './favicon.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './fonts/Vazirmatn-Regular.woff2',
  './fonts/Vazirmatn-Medium.woff2',
  './fonts/Vazirmatn-SemiBold.woff2',
  './fonts/Vazirmatn-Bold.woff2'
];

/* ---------- INSTALL: کش کردن اپ‌شل ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        APP_SHELL.map(url => cache.add(url).catch(() => null))
      )
    ).then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE: پاک کردن کش‌های قدیمی ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE_NAME && k !== RUNTIME_CACHE)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- FETCH ---------- */
self.addEventListener('fetch', event => {
  const request = event.request;

  // فقط GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // فقط same-origin
  if (url.origin !== self.location.origin) return;

  /* =========================================================
     1) Navigation / HTML  →  Stale-While-Revalidate
     ========================================================= */
  const isHTML =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    event.respondWith(
      caches.match('./index.html').then(cached => {
        // شروع fetch در پس‌زمینه
        const networkFetch = fetch(request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(c => c.put('./index.html', clone));
            }
            return response;
          })
          .catch(() => null);

        // اگه کش داشتیم → فوراً از کش بده
        if (cached) return cached;

        // اگه کش نداشتیم → منتظر شبکه بمون
        return networkFetch
          .then(res => res || caches.match('./index.html'))
          .then(res => res || new Response(
            '<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="utf-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>آفلاین</title></head>' +
            '<body style="font-family:sans-serif;padding:40px;text-align:center;background:#eef2f7;color:#0f172a">' +
            '<h2>📶 اینترنت وصل نیست</h2>' +
            '<p>برای اولین بار، برنامه را با اینترنت باز کن.</p>' +
            '</body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          ));
      })
    );
    return;
  }

  /* =========================================================
     2) Assets (فونت، آیکون، manifest)  →  Cache-First
     ========================================================= */
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request)
        .then(response => {
          if (
            !response ||
            response.status !== 200 ||
            response.type === 'opaque'
          ) {
            return response;
          }
          const clone = response.clone();
          caches.open(RUNTIME_CACHE).then(c => c.put(request, clone));
          return response;
        })
        .catch(() => {
          return new Response('', {
            status: 503,
            statusText: 'Offline'
          });
        });
    })
  );
});