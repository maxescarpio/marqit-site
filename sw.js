// Marqit service worker.
//
// Deliberately minimal. The whole point of the current deploy workflow is
// that a GitHub edit + Netlify deploy shows up live instantly -- an
// aggressive caching service worker would fight that by serving stale
// index.html/app.js/style.css to installed users. So this SW exists mostly
// to satisfy PWA "installability" requirements (a manifest + a registered
// service worker with a fetch handler) rather than to actually cache the
// app shell.
//
// What it DOES do: falls back to a tiny offline page if the network is
// unreachable, so the PWA doesn't show a bare browser error when opened
// with no connection. Everything else always goes to the network first.

const CACHE_NAME = 'marqit-shell-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.add(OFFLINE_URL);
    })
  );
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(
        names.filter(function(name){ return name !== CACHE_NAME; })
             .map(function(name){ return caches.delete(name); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event){
  // Only handle page navigations specially (offline fallback). Everything
  // else (JS, CSS, API calls to Supabase, images) passes straight through
  // to the network untouched -- no caching, no risk of staleness.
  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request).catch(function(){
        return caches.match(OFFLINE_URL);
      })
    );
  }
  // else: do nothing -- let the browser's default network fetch happen.
});

// --- Web Push -----------------------------------------------------------
// This pairs with the existing subscribe/unsubscribe flow already built in
// app.js (VAPID key, push_subscriptions table, the "Turn on push
// notifications" toggle in settings). That code subscribes the browser and
// saves the subscription to Supabase -- this is the other half: actually
// displaying a notification when a push arrives, and handling the tap.
self.addEventListener('push', function(event){
  var data = {};
  try{ data = event.data ? event.data.json() : {}; }catch(e){ /* fall back to defaults below */ }

  var title = data.title || 'Marqit';
  var options = {
    body: data.body || "Today's calls are up.",
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList){
      for(var i = 0; i < clientList.length; i++){
        var client = clientList[i];
        if('focus' in client) return client.focus();
      }
      if(self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
