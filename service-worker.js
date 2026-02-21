// ═══════════════════════════════════════════
//  StepToDeen — Service Worker v1.0
//  Offline support + Cache strategy
// ═══════════════════════════════════════════

const CACHE_NAME = 'steptodeen-v1';

// یہ files ہمیشہ cache ہوں گی (offline بھی کام کریں گی)
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Amiri+Quran&family=Amiri:ital,wght@0,400;0,700;1,400&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
];

// ═══ Install: Static assets cache میں ڈالو ═══
self.addEventListener('install', function(event) {
  console.log('[SW] Installing StepToDeen Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Caching static assets');
      // ہر file الگ الگ try کریں تاکہ ایک fail ہو تو باقی cache ہوں
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Could not cache:', url, err);
        }))
      );
    }).then(function() {
      return self.skipWaiting(); // فوری activate
    })
  );
});

// ═══ Activate: پرانے cache صاف کرو ═══
self.addEventListener('activate', function(event) {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim(); // سب tabs کنٹرول میں
    })
  );
});

// ═══ Fetch: Network-first پھر Cache ═══
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // صرف GET requests handle کریں
  if (event.request.method !== 'GET') return;

  // API calls کے لیے Network-first (prayer times, quran, hadith)
  var isApiCall = (
    url.hostname.includes('aladhan.com') ||
    url.hostname.includes('alquran.cloud') ||
    url.hostname.includes('cdn.jsdelivr.net') ||
    url.hostname.includes('api.')
  );

  if (isApiCall) {
    // Network-first: online ہو تو fresh data، offline ہو تو cache
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
  } else {
    // Cache-first: static files کے لیے
    event.respondWith(
      caches.match(event.request).then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        }).catch(function() {
          // Offline fallback
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
      })
    );
  }
});

// ═══ Background Sync (اگر supported ہو) ═══
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-prayer-times') {
    console.log('[SW] Background sync: updating prayer times');
  }
});

// ═══ Push Notifications (مستقبل کے لیے تیار) ═══
self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || 'StepToDeen';
  var options = {
    body: data.body || 'نماز کا وقت ہو گیا ہے',
    icon: './icons/icon-192.png',
    badge: './icons/icon-72.png',
    dir: 'rtl',
    lang: 'ur',
    vibrate: [200, 100, 200],
    tag: 'prayer-notification',
    renotify: true
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
