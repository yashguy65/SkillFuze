'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────

type NotifContextType = {
  totalUnread: number
  markAllRead: () => void
  pushEnabled: boolean
  pushSupported: boolean
  requestPush: () => Promise<void>
}

// ─── Context ────────────────────────────────────────────────────────────────

const NotifContext = createContext<NotifContextType>({
  totalUnread: 0,
  markAllRead: () => {},
  pushEnabled: false,
  pushSupported: false,
  requestPush: async () => {}
})

export function useNotifications() {
  return useContext(NotifContext)
}

// ─── Helper: base64url → Uint8Array for VAPID key ───────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

// ─── Provider ───────────────────────────────────────────────────────────────

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [totalUnread, setTotalUnread] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = useRef(createClient()).current
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── Register Service Worker ─────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    
    if (supported) {
      navigator.serviceWorker.ready.then(async (reg) => {
        const existing = await reg.pushManager.getSubscription()
        setPushEnabled(!!existing)
      }).catch(() => {})
      
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPushSupported(supported)
    }
  }, [])

  // ── Init user & subscribe to realtime for unread count ─────────────────
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      // Listen for new incoming messages — increment badge when not on /messages
      const channel = supabase
        .channel('global:notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          () => {
            if (!window.location.pathname.startsWith('/messages')) {
              setTotalUnread((prev) => prev + 1)
            }
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    init()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mark all read (called when user opens /messages) ────────────────────
  const markAllRead = useCallback(() => {
    setTotalUnread(0)
  }, [])

  // ── Request push permission + subscribe ─────────────────────────────────
  const requestPush = useCallback(async () => {
    if (!pushSupported || !currentUserId) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

    if (!vapidPublicKey) {
      console.error('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set')
      return
    }

    try {
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
      })

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      })

      if (res.ok) {
        setPushEnabled(true)
      }
    } catch (err) {
      console.error('[Push] Subscribe failed:', err)
    }
  }, [pushSupported, currentUserId])

  return (
    <NotifContext.Provider value={{ totalUnread, markAllRead, pushEnabled, pushSupported, requestPush }}>
      {children}
    </NotifContext.Provider>
  )
}
