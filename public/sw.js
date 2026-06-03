const CACHE = 'fayko-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Network-first strategy (app is always online)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return
  if (!e.request.url.startsWith(self.location.origin)) return
  // Skip API routes & Supabase
  if (e.request.url.includes('/api/') || e.request.url.includes('supabase')) return

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})

// Push notification receiver
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {}
  const title = data.title || 'Fayko'
  const options = {
    body: data.body || '',
    icon: '/api/pwa-icon/192',
    badge: '/api/pwa-icon/72',
    tag: data.tag || 'fayko',
    renotify: true,
    data: { url: data.url || '/' },
    actions: data.actions || [],
  }
  e.waitUntil(self.registration.showNotification(title, options))
})

// Click on notification -> open the app
self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.startsWith(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        clients.openWindow(url)
      }
    })
  )
})
