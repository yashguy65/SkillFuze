// SkillFuze Service Worker — Push Notifications

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  // @ts-expect-error: claim() exists on clients but is not typed in default SW env
  self.registration?.active?.postMessage({ type: 'CLAIM_CLIENTS' })
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'SkillFuze', body: event.data?.text() ?? 'New message' }
  }

  const title = data.title || 'SkillFuze'
  const options = {
    body: data.body || 'You have a new message',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: data.tag || 'skillfuze-message',
    renotify: true,
    data: { url: data.url || '/messages' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Open Chat' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  const targetUrl = event.notification.data?.url || '/messages'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes('/messages') && 'focus' in client) {
          return client.focus()
        }
      }
      // Or open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl)
      }
    })
  )
})
