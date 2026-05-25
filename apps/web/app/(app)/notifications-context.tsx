'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type NotifContextType = {
  totalUnread: number
  refreshUnreadCount: () => Promise<void>
  setConversationRead: (otherUserId: string) => Promise<void>
  setGroupRead: (groupId: string) => Promise<void>
  pushEnabled: boolean
  pushSupported: boolean
  requestPush: () => Promise<void>
}

const NotifContext = createContext<NotifContextType>({
  totalUnread: 0,
  refreshUnreadCount: async () => {},
  setConversationRead: async () => {},
  setGroupRead: async () => {},
  pushEnabled: false,
  pushSupported: false,
  requestPush: async () => {}
})

export function useNotifications() {
  return useContext(NotifContext)
}

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

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [totalUnread, setTotalUnread] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const currentUserIdRef = useRef<string | null>(null)

  const ensureCurrentUserId = useCallback(async () => {
    if (currentUserIdRef.current) return currentUserIdRef.current

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    currentUserIdRef.current = user.id
    setCurrentUserId(user.id)
    return user.id
  }, [supabase])

  const refreshUnreadCountForUser = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/chat/threads', {
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })
      if (!res.ok) return
      const threads = await res.json() as { unreadCount: number }[]
      const total = threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0)
      setTotalUnread(total)
    } catch (err) {
      console.error('[notifications] failed to refresh unread:', err)
    }
  }, [supabase])

  const refreshUnreadCount = useCallback(async () => {
    const userId = await ensureCurrentUserId()
    if (!userId) return
    await refreshUnreadCountForUser()
  }, [ensureCurrentUserId, refreshUnreadCountForUser])

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

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setCurrentUserId(user.id)
      currentUserIdRef.current = user.id
      await refreshUnreadCountForUser()
    }

    void init()
  }, [refreshUnreadCountForUser, supabase])

  const setConversationRead = useCallback(async (otherUserId: string) => {
    const userId = await ensureCurrentUserId()
    if (!userId) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      await fetch('/api/chat/messages/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ senderId: otherUserId })
      })
    } catch (err) {
      console.error('[notifications] mark conversation read failed:', err)
    }

    await refreshUnreadCountForUser()
  }, [ensureCurrentUserId, refreshUnreadCountForUser, supabase])

  const setGroupRead = useCallback(async (groupId: string) => {
    const userId = await ensureCurrentUserId()
    if (!userId) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    try {
      await fetch('/api/chat/groups/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ groupId })
      })
    } catch (err) {
      console.error('[notifications] mark group read failed:', err)
    }

    await refreshUnreadCountForUser()
  }, [ensureCurrentUserId, refreshUnreadCountForUser, supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshUnreadCount()

    const handleFocus = () => void refreshUnreadCount()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshUnreadCount()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pathname, refreshUnreadCount])

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

  const contextValue = useMemo(() => ({
    totalUnread,
    refreshUnreadCount,
    setConversationRead,
    setGroupRead,
    pushEnabled,
    pushSupported,
    requestPush
  }), [totalUnread, refreshUnreadCount, setConversationRead, setGroupRead, pushEnabled, pushSupported, requestPush])

  return (
    <NotifContext.Provider value={contextValue}>
      {children}
    </NotifContext.Provider>
  )
}
