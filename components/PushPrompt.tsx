'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64   = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData  = window.atob(base64)
  const buf = new ArrayBuffer(rawData.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i)
  return buf
}

export default function PushPrompt() {
  const [show,    setShow]    = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!VAPID_PUBLIC) return
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return
    // Show after 3s if permission not yet decided
    const t = setTimeout(() => setShow(true), 3000)
    return () => clearTimeout(t)
  }, [])

  async function enable() {
    setLoading(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setShow(false); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })

      setShow(false)
    } catch (err) {
      console.error('[Push] erreur inscription', err)
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-24 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50">
      <div className="bg-stone-800 text-white rounded-2xl p-4 shadow-2xl flex items-start gap-3">
        <Bell size={20} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Activer les notifications</p>
          <p className="text-xs text-stone-300 mt-0.5">
            Re&ccedil;ois une alerte quand une mission urgente est d&eacute;tect&eacute;e.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={enable}
              disabled={loading}
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold py-2 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'En cours&hellip;' : 'Activer'}
            </button>
            <button
              onClick={() => setShow(false)}
              className="px-3 py-2 text-stone-400 hover:text-white text-xs transition"
            >
              Plus tard
            </button>
          </div>
        </div>
        <button onClick={() => setShow(false)} className="text-stone-500 hover:text-white shrink-0">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
