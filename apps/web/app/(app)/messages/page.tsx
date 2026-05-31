'use client'

import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Search, Check, CheckCheck, MessageSquare, Users, X } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '../notifications-context'
import { Client } from '@stomp/stompjs'

type MessageStatus = 'sent' | 'delivered' | 'read'
type ChatKind = 'direct' | 'group'

type Message = {
  id: string
  senderId: string
  receiverId?: string
  groupId?: string
  senderName?: string
  text: string
  timestamp: string
  status: MessageStatus
  created_at: string
}

type Chat = {
  id: string
  kind: ChatKind
  userId?: string
  groupId?: string
  name: string
  avatar: string
  lastMessage?: string
  lastMessageTime?: string
  lastActivityAt?: string
  unreadCount: number
  online: boolean
  messages: Message[]
  memberIds?: string[]
  adminIds?: string[]
  memberNames?: string[]
  lastReadAt?: string | null
  isOwner?: boolean
  ownerId?: string
}

type DiscoverUser = {
  id: string
  username: string
  avatar: string
  bio: string
}

type DbMessage = {
  id: string
  sender_id?: string
  senderId?: string
  receiver_id?: string
  receiverId?: string
  text: string
  status?: MessageStatus | null
  created_at?: string
  createdAt?: string
}

type DbGroupMessage = {
  id: string
  group_id?: string
  groupId?: string
  sender_id?: string
  senderId?: string
  text: string
  created_at?: string
  createdAt?: string
}

type ChatThreadSummary = {
  id: string
  kind: ChatKind
  userId?: string
  groupId?: string
  name: string
  avatar: string
  lastMessage: string
  lastMessageTime: string
  lastActivityAt: string
  unreadCount: number
  online: boolean
  memberIds?: string[]
  adminIds?: string[]
  lastReadAt?: string | null
  isOwner?: boolean
  ownerId?: string
}

function formatMessageTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDividerDate(dateStr: string) {
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''

  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()

  if (isSameDay(date, today)) {
    return 'Today'
  }
  if (isSameDay(date, yesterday)) {
    return 'Yesterday'
  }

  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

function userName(userId: string, profiles: Map<string, DiscoverUser>) {
  return profiles.get(userId)?.username || `User ${userId.substring(0, 8)}`
}

function avatarForName(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=e2e8f0`
}

function toDirectMessage(msg: DbMessage, overrideStatus?: MessageStatus): Message {
  const senderId = msg.sender_id ?? msg.senderId
  const receiverId = msg.receiver_id ?? msg.receiverId
  const createdAt = msg.created_at ?? msg.createdAt
  return {
    id: msg.id,
    senderId: senderId || '',
    receiverId,
    text: msg.text,
    timestamp: formatMessageTime(createdAt || ''),
    status: overrideStatus ?? msg.status ?? 'sent',
    created_at: createdAt || ''
  }
}

function toGroupMessage(msg: DbGroupMessage, profiles: Map<string, DiscoverUser>): Message {
  const senderId = msg.sender_id ?? msg.senderId
  const groupId = msg.group_id ?? msg.groupId
  const createdAt = msg.created_at ?? msg.createdAt
  return {
    id: msg.id,
    senderId: senderId || '',
    groupId,
    senderName: userName(senderId || '', profiles),
    text: msg.text,
    timestamp: formatMessageTime(createdAt || ''),
    status: 'sent',
    created_at: createdAt || ''
  }
}

function countDirectUnread(messages: Message[], myId: string) {
  return messages.filter((msg) => msg.receiverId === myId && msg.status !== 'read').length
}

function countGroupUnread(messages: Message[], myId: string, lastReadAt?: string | null) {
  const readTime = lastReadAt ? new Date(lastReadAt).getTime() : 0
  return messages.filter((msg) => msg.senderId !== myId && new Date(msg.created_at).getTime() > readTime).length
}

function sortChats(chats: Chat[]) {
  return [...chats].sort((a, b) => {
    const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
    const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
    return bTime - aTime
  })
}

function createDirectChat(userId: string, profile?: DiscoverUser): Chat {
  const name = profile?.username || `User ${userId.substring(0, 8)}`
  return {
    id: `direct_${userId}`,
    kind: 'direct',
    userId,
    name,
    avatar: profile?.avatar || avatarForName(name),
    unreadCount: 0,
    online: false,
    messages: []
  }
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get('user_id')
  const initialGroupId = searchParams.get('group_id')
  const { setConversationRead, setGroupRead, refreshUnreadCount } = useNotifications()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false)
  const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [isDeletingGroup, setIsDeletingGroup] = useState(false)
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([])
  const [allUsers, setAllUsers] = useState<DiscoverUser[]>([])
  const [isConnected, setIsConnected] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const stompClientRef = useRef<Client | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const selectedChatIdRef = useRef<string | null>(null)
  const initialUserIdRef = useRef(initialUserId)
  const initialGroupIdRef = useRef(initialGroupId)
  const chatProfilesRef = useRef<Map<string, DiscoverUser>>(new Map())
  const groupIdsRef = useRef<Set<string>>(new Set())
  const chatsRef = useRef<Chat[]>([])
  const groupSubscriptionsRef = useRef<Map<string, { unsubscribe: () => void }>>(new Map())

  const chatPartners = useMemo(() => {
    const directChatUserIds = new Set(
      chats
        .filter((c) => c.kind === 'direct' && c.userId)
        .map((c) => c.userId as string)
    )
    return discoverUsers.filter((u) => directChatUserIds.has(u.id))
  }, [chats, discoverUsers])

  const userProfilesMap = useMemo(() => {
    return new Map(allUsers.map((u) => [u.id, u]))
  }, [allUsers])

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId
  }, [selectedChatId])

  const markDirectRead = useCallback(async (otherUserId: string) => {
    const myId = currentUserIdRef.current
    if (!myId) return

    setChats((prev) => prev.map((chat) => {
      if (chat.kind !== 'direct' || chat.userId !== otherUserId) return chat

      return {
        ...chat,
        unreadCount: 0,
        messages: chat.messages.map((msg) => (
          msg.senderId === otherUserId && msg.receiverId === myId
            ? { ...msg, status: 'read' }
            : msg
        ))
      }
    }))

    await setConversationRead(otherUserId)
  }, [setConversationRead])

  const markGroupRead = useCallback(async (groupId: string) => {
    setChats((prev) => prev.map((c) => {
      if (c.kind === 'group' && c.groupId === groupId) {
        return { ...c, unreadCount: 0, lastReadAt: new Date().toISOString() }
      }
      return c
    }))

    await setGroupRead(groupId)
  }, [setGroupRead])

  const selectChat = useCallback((chat: Chat, shouldMarkRead = true) => {
    setSelectedChatId(chat.id)
    setIsParticipantsModalOpen(false)
    if (!shouldMarkRead) return

    if (chat.kind === 'direct' && chat.userId) {
      void markDirectRead(chat.userId)
    } else if (chat.kind === 'group' && chat.groupId) {
      void markGroupRead(chat.groupId)
    }
  }, [markDirectRead, markGroupRead])

  const selectDirectChatByUserId = useCallback((userId: string, shouldMarkRead = true) => {
    const targetChatId = `direct_${userId}`
    setSelectedChatId(targetChatId)
    setIsParticipantsModalOpen(false)

    setChats((prev) => {
      const existing = prev.find((chat) => chat.id === targetChatId)
      if (existing) return prev
      return [createDirectChat(userId, chatProfilesRef.current.get(userId)), ...prev]
    })

    if (shouldMarkRead) {
      void markDirectRead(userId)
    }
  }, [markDirectRead])

  const loadChats = useCallback(async (myId: string, accessToken: string) => {
    const res = await fetch('/api/users/discover')
    const discoverData = await res.json()
    const users: DiscoverUser[] = discoverData.users || []
    chatProfilesRef.current = new Map(users.map((discoverUser) => [discoverUser.id, discoverUser]))
    setAllUsers(users)
    setDiscoverUsers(users.filter((u) => u.id !== myId))

    const threadsRes = await fetch('/api/chat/threads', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    })
    if (!threadsRes.ok) throw new Error('Failed to load active threads')
    const summaries = await threadsRes.json() as ChatThreadSummary[]

    const validGroupIds = new Set<string>()

    const finalChats = await Promise.all(summaries.map(async (t) => {
      let messages: Message[] = []
      try {
        if (t.kind === 'direct' && t.userId) {
          const histRes = await fetch(`/api/chat/history/direct?receiverId=${t.userId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (histRes.ok) {
            const dbMsgs = await histRes.json() as DbMessage[]
            messages = dbMsgs.map(m => toDirectMessage(m))
          }
        } else if (t.kind === 'group' && t.groupId) {
          validGroupIds.add(t.groupId.toString())
          const histRes = await fetch(`/api/chat/history/group?groupId=${t.groupId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          if (histRes.ok) {
            const dbMsgs = await histRes.json() as DbGroupMessage[]
            messages = dbMsgs.map(m => toGroupMessage(m, chatProfilesRef.current))
          }
        }
      } catch (err) {
        console.error('Failed to load message history for thread: ' + t.id, err)
      }

      const lastMessageObj = messages[messages.length - 1]
      const lastMessageText = t.kind === 'group'
        ? (lastMessageObj ? `${lastMessageObj.senderName}: ${lastMessageObj.text}` : `${t.memberIds?.length || 0} members`)
        : (lastMessageObj ? lastMessageObj.text : '')

      return {
        id: t.id,
        kind: t.kind,
        userId: t.userId ? t.userId.toString() : undefined,
        groupId: t.groupId ? t.groupId.toString() : undefined,
        name: t.kind === 'group' ? t.name : (chatProfilesRef.current.get(t.userId?.toString() || '')?.username || `User ${t.userId?.toString().substring(0, 8)}`),
        avatar: t.kind === 'group' ? (t.avatar || avatarForName(t.name)) : (chatProfilesRef.current.get(t.userId?.toString() || '')?.avatar || avatarForName(chatProfilesRef.current.get(t.userId?.toString() || '')?.username || 'user')),
        unreadCount: t.unreadCount,
        online: t.online,
        messages,
        memberIds: t.memberIds ? t.memberIds.map(id => id.toString()) : [],
        adminIds: t.adminIds ? t.adminIds.map(id => id.toString()) : [],
        memberNames: t.memberIds ? t.memberIds.map(id => userName(id.toString(), chatProfilesRef.current)) : [],
        lastReadAt: t.lastReadAt,
        isOwner: t.isOwner !== undefined ? t.isOwner : (t as unknown as { owner?: boolean }).owner,
        ownerId: t.ownerId ? t.ownerId.toString() : undefined,
        lastMessage: lastMessageText,
        lastMessageTime: lastMessageObj ? lastMessageObj.timestamp : undefined,
        lastActivityAt: t.lastActivityAt
      } as Chat
    }))

    groupIdsRef.current = validGroupIds

    let sortedChats = sortChats(finalChats)

    const targetUserId = initialUserIdRef.current
    const targetGroupId = initialGroupIdRef.current
    let targetChat: Chat | undefined

    if (targetGroupId) {
      targetChat = sortedChats.find((chat) => chat.kind === 'group' && chat.groupId === targetGroupId)
    } else if (targetUserId) {
      targetChat = sortedChats.find((chat) => chat.kind === 'direct' && chat.userId === targetUserId)
      if (!targetChat) {
        targetChat = createDirectChat(targetUserId, chatProfilesRef.current.get(targetUserId))
      }
    } else {
      targetChat = sortedChats[0]
    }

    if (targetChat) {
      sortedChats = [targetChat, ...sortedChats.filter((chat) => chat.id !== targetChat?.id)]
      setSelectedChatId(targetChat.id)
    }

    setChats(sortedChats)

    if (targetChat?.kind === 'direct' && targetChat.userId) {
      void markDirectRead(targetChat.userId)
    } else if (targetChat?.kind === 'group' && targetChat.groupId) {
      void markGroupRead(targetChat.groupId)
    }
  }, [markDirectRead, markGroupRead])

  const syncGroupSubscriptions = useCallback((client: Client | null, currentChats: Chat[]) => {
    if (!client || !client.connected) return
    const myId = currentUserIdRef.current
    if (!myId) return

    // Find all group chat IDs
    const currentGroupChats = currentChats.filter((chat) => chat.kind === 'group')
    const activeGroupIds = new Set(currentGroupChats.map((chat) => chat.groupId).filter(Boolean) as string[])

    // Unsubscribe from any groups that are no longer present
    groupSubscriptionsRef.current.forEach((sub, groupId) => {
      if (!activeGroupIds.has(groupId)) {
        try {
          sub.unsubscribe()
        } catch (e) {
          console.error('[STOMP] Failed to unsubscribe from group:', groupId, e)
        }
        groupSubscriptionsRef.current.delete(groupId)
      }
    })

    // Subscribe to new groups
    currentGroupChats.forEach((chat) => {
      const groupId = chat.groupId
      if (!groupId || groupSubscriptionsRef.current.has(groupId)) return

      console.log('[STOMP] Subscribing to group:', groupId)
      try {
        const sub = client.subscribe(`/topic/groups/${groupId}`, (message) => {
          const newMsg = JSON.parse(message.body) as DbGroupMessage
          const senderId = newMsg.sender_id ?? newMsg.senderId
          const msgGroupId = newMsg.group_id ?? newMsg.groupId

          if (!senderId || !msgGroupId) return

          const msgId = newMsg.id
          const msgText = newMsg.text
          const msgCreatedAt = newMsg.created_at ?? newMsg.createdAt
          const chatId = `group_${msgGroupId}`
          const isOpen = selectedChatIdRef.current === chatId
          const formattedMessage = toGroupMessage(newMsg, chatProfilesRef.current)

          setChats((prevChats) => {
            const existingChat = prevChats.find((c) => c.kind === 'group' && c.groupId === msgGroupId)
            if (!existingChat || existingChat.messages.some((msg) => msg.id === msgId)) return prevChats

            const tempIndex = existingChat.messages.findIndex(
              (msg) => msg.id.startsWith('temp_') && msg.text === msgText && msg.senderId === senderId
            )

            const messages = [...existingChat.messages]
            if (tempIndex !== -1) {
              messages[tempIndex] = formattedMessage
            } else {
              messages.push(formattedMessage)
            }

            const nextLastReadAt = isOpen ? new Date().toISOString() : existingChat.lastReadAt
            const updatedChat: Chat = {
              ...existingChat,
              messages,
              lastMessage: `${formattedMessage.senderName}: ${formattedMessage.text}`,
              lastMessageTime: formattedMessage.timestamp,
              lastActivityAt: msgCreatedAt,
              lastReadAt: nextLastReadAt,
              unreadCount: isOpen ? 0 : countGroupUnread(messages, myId, existingChat.lastReadAt)
            }

            const withoutUpdated = prevChats.filter((c) => c.id !== chatId)
            return sortChats([updatedChat, ...withoutUpdated])
          })

          if (isOpen) {
            void markGroupRead(msgGroupId)
          } else {
            void refreshUnreadCount()
          }
        })
        groupSubscriptionsRef.current.set(groupId, sub)
      } catch (e) {
        console.error('[STOMP] Failed to subscribe to group:', groupId, e)
      }
    })
  }, [markGroupRead, refreshUnreadCount])

  useEffect(() => {
    if (isConnected && stompClientRef.current) {
      syncGroupSubscriptions(stompClientRef.current, chats)
    }
  }, [chats, isConnected, syncGroupSubscriptions])

  useEffect(() => {
    let cancelled = false
    let stompClient: Client | null = null

    const initData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled || !user) {
          if (!user) window.location.href = '/login'
          return
        }

        const myId = user.id
        setCurrentUserId(myId)
        currentUserIdRef.current = myId

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        await loadChats(myId, session.access_token)
        if (cancelled) return

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const host = window.location.hostname
        
        let brokerURL = ''
        if (process.env.NODE_ENV === 'development' || host === 'localhost' || host === '127.0.0.1') {
          brokerURL = `${protocol}//${host}:8080/ws-chat`
        } else {
          const apiHost = process.env.NEXT_PUBLIC_API_URL
            ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, '')
            : host
          brokerURL = `${protocol}//${apiHost}/ws-chat`
        }

        stompClient = new Client({
          brokerURL,
          connectHeaders: {
            Authorization: `Bearer ${session.access_token}`
          },
          debug: (str) => {
            console.log('[STOMP] ' + str)
          },
          reconnectDelay: 5000,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000
        })
        stompClient.onConnect = () => {
          if (cancelled) {
            stompClient?.deactivate()
            return
          }
          console.log('[STOMP] Connected to Spring Boot chat socket')
          setIsConnected(true)

          // Clear local cache of subscriptions on new connection
          groupSubscriptionsRef.current.clear()

          stompClient?.subscribe('/user/queue/messages', (message) => {
            const newMsg = JSON.parse(message.body) as DbMessage
            const senderId = newMsg.sender_id ?? newMsg.senderId
            const receiverId = newMsg.receiver_id ?? newMsg.receiverId

            if (!senderId || !receiverId) return
            if (senderId !== myId && receiverId !== myId) return

            const msgId = newMsg.id
            const msgText = newMsg.text
            const msgCreatedAt = newMsg.created_at ?? newMsg.createdAt

            const otherUserId = senderId === myId ? receiverId : senderId
            const chatId = `direct_${otherUserId}`
            const isIncomingOpen = receiverId === myId && selectedChatIdRef.current === chatId
            const formattedMessage = toDirectMessage(newMsg, isIncomingOpen ? 'read' : undefined)

            setChats((prevChats) => {
              const existingChat = prevChats.find((chat) => chat.kind === 'direct' && chat.userId === otherUserId)
              const baseChat = existingChat ?? createDirectChat(otherUserId, chatProfilesRef.current.get(otherUserId))

              if (baseChat.messages.some((msg) => msg.id === msgId)) {
                return prevChats
              }

              const tempIndex = baseChat.messages.findIndex(
                (msg) => msg.id.startsWith('temp_') && msg.text === msgText && msg.senderId === senderId
              )

              const messages = [...baseChat.messages]
              if (tempIndex !== -1) {
                messages[tempIndex] = formattedMessage
              } else {
                messages.push(formattedMessage)
              }

              const updatedChat: Chat = {
                ...baseChat,
                messages,
                lastMessage: msgText,
                lastMessageTime: formattedMessage.timestamp,
                lastActivityAt: msgCreatedAt,
                unreadCount: countDirectUnread(messages, myId)
              }

              const withoutUpdated = prevChats.filter((chat) => chat.id !== chatId)
              return sortChats([updatedChat, ...withoutUpdated])
            })

            if (isIncomingOpen) {
              void markDirectRead(otherUserId)
            } else {
              void refreshUnreadCount()
            }
          })

          stompClient?.subscribe('/topic/presence', (message) => {
            const event = JSON.parse(message.body) as { userId: string; status: 'online' | 'offline' }
            setOnlineUsers((prev) => {
              const next = new Set(prev)
              if (event.status === 'online') {
                next.add(event.userId)
              } else {
                next.delete(event.userId)
              }
              return next
            })
          })

          // Subscribe to all current groups
          syncGroupSubscriptions(stompClient, chatsRef.current)
        }

        stompClient.onDisconnect = () => {
          setIsConnected(false)
        }

        stompClient.onWebSocketClose = () => {
          setIsConnected(false)
        }

        stompClient.activate()
        stompClientRef.current = stompClient

        // Fetch currently online users from REST endpoint
        try {
          const presenceRes = await fetch('/api/chat/presence/online', {
            headers: { Authorization: `Bearer ${session.access_token}` }
          })
          if (presenceRes.ok) {
            const onlineIds = await presenceRes.json() as string[]
            setOnlineUsers(new Set(onlineIds))
          }
        } catch (err) {
          console.error('Failed to load initial online user presence', err)
        }

      } catch (err) {
        console.error('Failed to initialize messages', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void initData()

    return () => {
      cancelled = true
      if (stompClient) {
        console.log('[STOMP] Deactivating socket client')
        stompClient.deactivate()
      }
      stompClientRef.current = null
      setIsConnected(false)
    }
  }, [loadChats, markDirectRead, markGroupRead, refreshUnreadCount, supabase, syncGroupSubscriptions])

  useEffect(() => {
    if (!initialUserId || isLoading) return
    const t = setTimeout(() => selectDirectChatByUserId(initialUserId), 0)
    return () => clearTimeout(t)
  }, [initialUserId, isLoading, selectDirectChatByUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedChatId, chats])

  const selectedChat = chats.find((chat) => chat.id === selectedChatId)

  const addableUsers = useMemo(() => {
    if (!selectedChat || selectedChat.kind !== 'group') return []
    return chatPartners.filter(u => !selectedChat.memberIds?.includes(u.id))
  }, [chatPartners, selectedChat])

  const handleSendMessage = async (e: React.FormEvent | React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat || !currentUserId || !isConnected) return

    const tempId = `temp_${Date.now()}`
    const createdAt = new Date().toISOString()
    const timeString = formatMessageTime(createdAt)
    const msgText = newMessage.trim()

    setNewMessage('')
    setChats((prevChats) => sortChats(prevChats.map((chat) => {
      if (chat.id !== selectedChat.id) return chat

      const senderName = userName(currentUserId, chatProfilesRef.current)
      const optimisticMessage: Message = {
        id: tempId,
        senderId: currentUserId,
        receiverId: chat.userId,
        groupId: chat.groupId,
        senderName,
        text: msgText,
        timestamp: timeString,
        status: 'sent',
        created_at: createdAt
      }

      return {
        ...chat,
        messages: [...chat.messages, optimisticMessage],
        lastMessage: chat.kind === 'group' ? `${senderName}: ${msgText}` : msgText,
        lastMessageTime: timeString,
        lastActivityAt: createdAt
      }
    })))

    if (selectedChat.kind === 'group') {
      if (stompClientRef.current && stompClientRef.current.connected) {
        stompClientRef.current.publish({
          destination: '/app/chat.sendGroup',
          body: JSON.stringify({
            groupId: selectedChat.groupId,
            text: msgText
          })
        })
      }
      if (selectedChat.groupId) void markGroupRead(selectedChat.groupId)
      return
    }

    if (stompClientRef.current && stompClientRef.current.connected) {
      stompClientRef.current.publish({
        destination: '/app/chat.sendDirect',
        body: JSON.stringify({
          receiverId: selectedChat.userId,
          text: msgText
        })
      })
    }
  }

  const toggleMember = (userId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const handleCreateGroup = async () => {
    if (!currentUserId || selectedMemberIds.size === 0 || isCreatingGroup) return

    setIsCreatingGroup(true)
    const chosenMembers = Array.from(selectedMemberIds)
    const defaultName = chosenMembers.map((id) => userName(id, chatProfilesRef.current)).slice(0, 3).join(', ')
    const finalName = groupName.trim() || defaultName || 'New group'

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch('/api/chat/groups/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          name: finalName,
          memberIds: chosenMembers
        })
      })

      if (!res.ok) {
        console.error('Error creating group')
        setIsCreatingGroup(false)
        return
      }


      // Re-trigger load to establish STOMP subscriptions
      await loadChats(currentUserId, session.access_token)

      setGroupName('')
      setSelectedMemberIds(new Set())
      setIsGroupModalOpen(false)
    } catch (err) {
      console.error('Failed to create group:', err)
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!selectedChat || selectedChat.kind !== 'group' || !selectedChat.groupId || isDeletingGroup) return

    if (!confirm('Are you sure you want to delete this group? This action cannot be undone.')) {
      return
    }

    setIsDeletingGroup(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/chat/groups/${selectedChat.groupId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (!res.ok) {
        console.error('Error deleting group')
        alert('Failed to delete group. Please make sure you are the group owner.')
        return
      }

      setChats((prev) => prev.filter((c) => c.groupId !== selectedChat.groupId))
      setSelectedChatId(null)
      setIsParticipantsModalOpen(false)
    } catch (err) {
      console.error('Failed to delete group:', err)
    } finally {
      setIsDeletingGroup(false)
    }
  }

  const handleMakeAdmin = async (newAdminId: string) => {
    if (!selectedChat || selectedChat.kind !== 'group' || !selectedChat.groupId || !currentUserId) return

    const newAdminName = userName(newAdminId, chatProfilesRef.current)
    if (!confirm(`Are you sure you want to make ${newAdminName} an admin of this group?`)) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/chat/groups/${selectedChat.groupId}/members/make-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          memberId: newAdminId
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        alert(errorText || 'Failed to make member admin')
        return
      }

      await loadChats(currentUserId, session.access_token)
      alert(`${newAdminName} is now a group admin.`)
    } catch (err) {
      console.error('Failed to make admin:', err)
    }
  }

  const handleKickMember = async (memberId: string) => {
    if (!selectedChat || selectedChat.kind !== 'group' || !selectedChat.groupId || !currentUserId) return

    const name = userName(memberId, chatProfilesRef.current)
    if (!confirm(`Are you sure you want to kick ${name} from this group?`)) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/chat/groups/${selectedChat.groupId}/members/kick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          memberId: memberId
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        alert(errorText || 'Failed to kick member')
        return
      }

      await loadChats(currentUserId, session.access_token)
      alert(`${name} has been kicked.`)
    } catch (err) {
      console.error('Failed to kick member:', err)
    }
  }

  const handleResignAdmin = async () => {
    if (!selectedChat || selectedChat.kind !== 'group' || !selectedChat.groupId || !currentUserId) return

    const confirmInput = prompt('Type "confirm" to give up your admin status:')
    if (confirmInput !== 'confirm') {
      alert('Action cancelled: Confirmation word did not match.')
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/chat/groups/${selectedChat.groupId}/admin/resign`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (!res.ok) {
        const errorText = await res.text()
        alert(errorText || 'Failed to resign admin status')
        return
      }

      await loadChats(currentUserId, session.access_token)
      alert('You have resigned as admin. You are now a member.')
      setIsParticipantsModalOpen(false)
    } catch (err) {
      console.error('Failed to resign admin status:', err)
    }
  }

  const handleLeaveGroup = async () => {
    if (!selectedChat || selectedChat.kind !== 'group' || !selectedChat.groupId || !currentUserId) return

    if (!confirm('Are you sure you want to leave this group?')) {
      return
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/chat/groups/${selectedChat.groupId}/leave`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`
        }
      })

      if (!res.ok) {
        const errorText = await res.text()
        alert(errorText || 'Failed to leave group')
        return
      }

      setChats((prev) => prev.filter((c) => c.groupId !== selectedChat.groupId))
      setSelectedChatId(null)
      setIsParticipantsModalOpen(false)
      alert('You have left the group.')
    } catch (err) {
      console.error('Failed to leave group:', err)
    }
  }

  const handleAddMembersToGroup = async (memberIdsToAdd: string[]) => {
    if (!selectedChat || selectedChat.kind !== 'group' || !selectedChat.groupId || !currentUserId || memberIdsToAdd.length === 0) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const res = await fetch(`/api/chat/groups/${selectedChat.groupId}/members/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          memberIds: memberIdsToAdd
        })
      })

      if (!res.ok) {
        const errorText = await res.text()
        alert(errorText || 'Failed to add members')
        return
      }

      await loadChats(currentUserId, session.access_token)
      alert('Members added successfully.')
    } catch (err) {
      console.error('Failed to add members:', err)
    }
  }

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
    || chat.memberNames?.some((memberName) => memberName.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  if (isLoading) {
    return (
      <div className="flex h-full bg-slate-950 items-center justify-center">
        <div className="animate-spin text-blue-500 w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="flex h-full bg-slate-950 text-slate-200 overflow-hidden shadow-2xl">
      <div className="w-80 shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Chat</h2>
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Create group chat"
              title="Create group chat"
            >
              <Users className="w-5 h-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {filteredChats.map((chat) => {
            const isOnline = chat.kind === 'direct' && chat.userId ? onlineUsers.has(chat.userId) : false
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => selectChat(chat)}
                className={`w-full flex items-center gap-3 p-4 cursor-pointer transition-colors border-l-2 text-left ${selectedChatId === chat.id ? 'bg-blue-500/10 border-blue-500' : 'border-transparent hover:bg-slate-800/50'}`}
              >
                <div className="relative shrink-0">
                  {chat.kind === 'group' ? (
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-300" />
                    </div>
                  ) : (
                    <Image src={chat.avatar} alt={chat.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover border border-slate-700" unoptimized />
                  )}
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1 gap-2">
                    <h3 className="font-medium text-slate-200 truncate">{chat.name}</h3>
                    <span className="text-xs text-slate-500 shrink-0">{chat.lastMessageTime}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className={`text-sm truncate font-light ${chat.unreadCount > 0 ? 'text-white font-semibold' : 'text-slate-400'}`}>
                      {chat.lastMessage || (chat.kind === 'group' ? `${chat.memberIds?.length || 0} members` : 'New connection')}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="min-w-5 h-5 px-1 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-lg shadow-blue-500/30">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-slate-950 relative">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                {selectedChat.kind === 'group' ? (
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-300" />
                  </div>
                ) : (
                  <Image src={selectedChat.avatar} alt={selectedChat.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover border border-slate-700" unoptimized />
                )}
                {selectedChat.kind === 'direct' && selectedChat.userId && onlineUsers.has(selectedChat.userId) && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <div className="min-w-0">
                {selectedChat.kind === 'group' ? (
                  <button
                    type="button"
                    onClick={() => setIsParticipantsModalOpen(true)}
                    className="font-medium text-white hover:text-blue-400 transition-colors text-left flex flex-col cursor-pointer"
                  >
                    <span className="truncate">{selectedChat.name}</span>
                    <span className="text-xs text-slate-500 font-normal hover:underline">
                      {selectedChat.memberIds?.length || 0} members • View participants
                    </span>
                  </button>
                ) : (
                  <h3 className="font-medium text-white truncate">{selectedChat.name}</h3>
                )}
              </div>
            </div>
          </div>

          {!isConnected && (
            <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-center gap-2 text-xs text-amber-400">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Connecting to chat server... Messages won&apos;t send or receive until reconnected.</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0f1a]" style={{ scrollbarWidth: 'thin' }}>
            {selectedChat.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <p>Start the conversation with {selectedChat.name}</p>
              </div>
            ) : (
              (() => {
                let lastDate = ''
                return selectedChat.messages.map((msg) => {
                  const isMe = msg.senderId === currentUserId
                  const msgDate = formatDividerDate(msg.created_at)
                  const showDivider = msgDate && msgDate !== lastDate
                  if (showDivider) {
                    lastDate = msgDate
                  }
                  return (
                    <div key={msg.id} className="flex flex-col w-full">
                      {showDivider && (
                        <div className="flex justify-center my-4 select-none w-full">
                          <span className="bg-slate-900/60 backdrop-blur-md text-slate-400 text-xs px-3.5 py-1.5 rounded-full border border-slate-800/80 shadow-md font-medium tracking-wide">
                            {msgDate}
                          </span>
                        </div>
                      )}
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        {selectedChat.kind === 'group' && !isMe && (
                          <span className="text-xs text-slate-500 mb-1 px-1">{msg.senderName}</span>
                        )}
                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                            }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                          <span>{msg.timestamp}</span>
                          {isMe && selectedChat.kind === 'direct' && (
                            msg.status === 'read' ? <CheckCheck className="w-3 h-3 text-blue-400" /> :
                              <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void handleSendMessage(e)
                  }
                }}
                disabled={!isConnected}
                placeholder={isConnected ? "Type a message..." : "Chat offline..."}
                className="flex-1 max-h-32 min-h-[44px] bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || !isConnected}
                className="w-11 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                aria-label="Send message"
              >
                <Send className="w-5 h-5 ml-1" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500">
          <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-medium text-slate-400">Your Messages</p>
          <p className="text-sm mt-1">Select a chat or start a new conversation</p>
        </div>
      )}

      {isGroupModalOpen && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="text-white font-semibold">New group chat</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedMemberIds.size} selected</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group name"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
              />
              <div className="max-h-72 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin' }}>
                {chatPartners.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-slate-500">
                    <MessageSquare className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm font-medium text-slate-400">No active chats found</p>
                    <p className="text-xs mt-1 max-w-[240px]">
                      You can only add users to a group chat if you have an existing direct conversation with them.
                    </p>
                  </div>
                ) : (
                  chatPartners.map((user) => {
                    const isSelected = selectedMemberIds.has(user.id)
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => toggleMember(user.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors cursor-pointer ${isSelected ? 'bg-blue-500/10 border border-blue-500/30' : 'border border-transparent hover:bg-slate-800/70'}`}
                      >
                        <Image src={user.avatar || avatarForName(user.username)} alt={user.username} width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-slate-700" unoptimized />
                        <span className="flex-1 text-sm text-slate-200 truncate">{user.username}</span>
                        <span className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-500' : 'border-slate-600'}`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={selectedMemberIds.size === 0 || isCreatingGroup}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {isCreatingGroup ? 'Creating...' : 'Create group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isParticipantsModalOpen && selectedChat && selectedChat.kind === 'group' && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-zoom-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="text-white font-semibold">Group participants</h3>
                <p className="text-xs text-slate-400 mt-1">
                  {selectedChat.memberIds?.length || 0} members
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsParticipantsModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="max-h-80 overflow-y-auto space-y-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
                {selectedChat.memberIds?.map((memberId) => {
                  const profile = userProfilesMap.get(memberId)
                  const name = profile?.username || `User ${memberId.substring(0, 8)}`
                  const isUserAdmin = selectedChat.adminIds?.includes(memberId)
                  const isMe = memberId === currentUserId

                  return (
                    <div
                      key={memberId}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-800/40 bg-slate-950/20"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Image
                          src={profile?.avatar || avatarForName(name)}
                          alt={name}
                          width={36}
                          height={36}
                          className="w-9 h-9 rounded-full object-cover border border-slate-700 shrink-0"
                          unoptimized
                        />
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {name} {isMe && <span className="text-slate-500 text-xs">(you)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isUserAdmin && (
                          <span className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 uppercase tracking-wider shrink-0">
                            Admin
                          </span>
                        )}
                        {!isUserAdmin && selectedChat.isOwner && (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleMakeAdmin(memberId)}
                              className="text-[11px] font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 hover:border-slate-600 transition-colors shrink-0 cursor-pointer"
                            >
                              Make Admin
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleKickMember(memberId)}
                              className="text-[11px] font-semibold text-red-400 hover:text-white bg-red-950/20 hover:bg-red-600 px-2.5 py-1 rounded border border-red-900/30 hover:border-red-500 transition-colors shrink-0 cursor-pointer"
                            >
                              Kick
                            </button>
                          </>
                        )}
                        {isMe && isUserAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleResignAdmin()}
                            className="text-[11px] font-semibold text-amber-400 hover:text-white bg-amber-950/20 hover:bg-amber-600 px-2.5 py-1 rounded border border-amber-900/30 hover:border-amber-500 transition-colors shrink-0 cursor-pointer"
                          >
                            Resign Admin
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Add Members Section */}
            {selectedChat.isOwner && addableUsers.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/30 font-sans">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Add Members</h4>
                <div className="max-h-36 overflow-y-auto space-y-1 mb-2 pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {addableUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        void handleAddMembersToGroup([user.id])
                      }}
                      className="w-full flex items-center justify-between p-2 rounded hover:bg-slate-800/50 text-left transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Image src={user.avatar || avatarForName(user.username)} alt={user.username} width={24} height={24} className="w-6 h-6 rounded-full object-cover border border-slate-700" unoptimized />
                        <span className="text-xs text-slate-200 truncate">{user.username}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                        + Add
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-800 bg-slate-900/50 flex gap-2">
              <button
                type="button"
                onClick={handleLeaveGroup}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer text-center"
              >
                Leave Group
              </button>
              {selectedChat.isOwner && selectedChat.ownerId === currentUserId && (
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  disabled={isDeletingGroup}
                  className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
                >
                  {isDeletingGroup ? (
                    <>
                      <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                      Deleting...
                    </>
                  ) : (
                    'Delete Group'
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full bg-slate-950 items-center justify-center">
        <div className="animate-spin text-blue-500 w-8 h-8 border-4 border-current border-t-transparent rounded-full" />
      </div>
    }>
      <MessagesContent />
    </Suspense>
  )
}
