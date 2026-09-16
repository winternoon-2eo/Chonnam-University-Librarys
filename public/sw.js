// VibeLib Web Push Service Worker
self.addEventListener('push', function (event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'VibeLib 도서 알림', body: event.data.text() };
    }
  }

  const title = data.title || '📖 도서 반납 알림!';
  const options = {
    body: data.body || '신청하신 도서가 도서관에 방금 반납되어 대출 가능합니다!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: data.url || 'https://lib.jnu.ac.kr',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
