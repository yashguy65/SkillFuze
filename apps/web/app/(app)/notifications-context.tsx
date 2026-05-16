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

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === '42703'
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [totalUnread, setTotalUnread] = useState(0)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const currentUserIdRef = useRef<string | null>(null)

  const ensureCurrentUserId = useCallback(async () => {
    if (currentUserIdRef.current) return currentUserIdRef.current

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    currentUserIdRef.current = user.id
    setCurrentUserId(user.id)
    return user.id
  }, [supabase])

  const refreshUnreadCountForUser = useCallback(async (userId: string) => {
    const { count: directCount, error: directError } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .or('status.neq.read,status.is.null')

    if (directError) {
      console.error('[notifications] direct unread count failed:', directError)
      return
    }

    const { data: memberships, error: membershipError } = await supabase
      .from('chat_group_members')
      .select('group_id, last_read_at, joined_at')
      .eq('user_id', userId)

    if (membershipError) {
      if (!isMissingTableError(membershipError)) {
        console.error('[notifications] group membership unread count failed:', membershipError)
      }
      setTotalUnread(directCount ?? 0)
      return
    }

    let groupUnread = 0
    for (const membership of memberships || []) {
      const since = membership.last_read_at || membership.joined_at || new Date(0).toISOString()
      const { count, error } = await supabase
        .from('chat_group_messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', membership.group_id)
        .neq('sender_id', userId)
        .gt('created_at', since)

      if (error) {
        if (!isMissingTableError(error)) {
          console.error('[notifications] group unread count failed:', error)
        }
        continue
      }

      groupUnread += count ?? 0
    }

    setTotalUnread((directCount ?? 0) + groupUnread)
  }, [supabase])

  const refreshUnreadCount = useCallback(async () => {
    const userId = await ensureCurrentUserId()
    if (!userId) return
    await refreshUnreadCountForUser(userId)
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
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_group_messages',
          },
          () => void refreshUnreadCountForUser(user.id)
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_group_members',
            filter: `user_id=eq.${user.id}`,
          },
          () => void refreshUnreadCountForUser(user.id)
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_group_members',
            filter: `user_id=eq.${user.id}`,
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
    const userId = await ensureCurrentUserId()
    if (!userId) return

    const { error } = await supabase
      .from('messages')
      .update({ status: 'read' })
      .eq('receiver_id', userId)
      .eq('sender_id', otherUserId)
      .or('status.neq.read,status.is.null')

    if (error) {
      console.error('[notifications] mark conversation read failed:', error)
      return
    }

    await refreshUnreadCountForUser(userId)
  }, [ensureCurrentUserId, refreshUnreadCountForUser, supabase])

  const setGroupRead = useCallback(async (groupId: string) => {
    const userId = await ensureCurrentUserId()
    if (!userId) return

    const { error } = await supabase.rpc('mark_chat_group_read', {
      p_group_id: groupId
    })

    if (error) {
      if (!isMissingTableError(error)) {
        console.error('[notifications] mark group read failed:', error)
      }
      return
    }

    await refreshUnreadCountForUser(userId)
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

  return (
    <NotifContext.Provider value={{ totalUnread, refreshUnreadCount, setConversationRead, setGroupRead, pushEnabled, pushSupported, requestPush }}>
      {children}
    </NotifContext.Provider>
  )
}
