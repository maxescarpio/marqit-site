// Marqit service worker — handles incoming Web Push messages and
// notification clicks. This file must be served from the site root
// (https://playmarqit.com/sw.js) so its scope covers the whole site.

self.addEventListener('install', function(event){
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function(event){
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e){
    data = { title: 'Marqit', body: event.data ? event.data.text() : '' };
  }

  var title = data.title || 'Marqit';
  var options = {
    body: data.body || '',
    icon: '/apple-touch-icon.png',
    badge: '/favicon.ico',
    data: { url: data.url || '/' },
    tag: data.tag || undefined
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList){
      for (var i = 0; i < clientList.length; i++){
        var client = clientList[i];
        if ('focus' in client){
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow){
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
