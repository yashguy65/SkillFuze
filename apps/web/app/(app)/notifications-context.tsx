'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

type NotifContextType = {
  totalUnread: number
  refreshUnreadCount: () => Promise<void>
  setConversationRead: (otherUserId: string) => Promise<void>
  pushEnabled: boolean
  pushSupported: boolean
  requestPush: () => Promise<void>
}

const NotifContext = createContext<NotifContextType>({
  totalUnread: 0,
  refreshUnreadCount: async () => {},
  setConversationRead: async () => {},
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
  const [totalUnread, setTotalUnread] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  const refreshUnreadCountForUser = useCallback(async (userId: string) => {
    const { count, error } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .neq('status', 'read')

    if (error) {
      console.error('[notifications] unread count failed:', error)
      return
    }

    setTotalUnread(count ?? 0)
  }, [supabase])

  const refreshUnreadCount = useCallback(async () => {
    const userId = currentUserIdRef.current
    if (!userId) return
    await refreshUnreadCountForUser(userId)
  }, [refreshUnreadCountForUser])

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
      await refreshUnreadCountForUser(user.id)

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
          () => void refreshUnreadCountForUser(user.id)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `receiver_id=eq.${user.id}`,
          },
          () => void refreshUnreadCountForUser(user.id)
        )
        .subscribe()

      channelRef.current = channel
    }

    void init()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [refreshUnreadCountForUser, supabase])

  const setConversationRead = useCallback(async (otherUserId: string) => {
    const userId = currentUserIdRef.current
    if (!userId) return

    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId)
      .neq('status', 'read')

    if (error) {
      console.error('[notifications] mark conversation read failed:', error)
      return
    }

    await refreshUnreadCountForUser(userId)
  }, [refreshUnreadCountForUser, supabase])

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
    <NotifContext.Provider value={{ totalUnread, refreshUnreadCount, setConversationRead, pushEnabled, pushSupported, requestPush }}>
      {children}
    </NotifContext.Provider>
  )
}
