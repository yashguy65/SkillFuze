'use client'

import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Search, Check, CheckCheck, MessageSquare, Users, Plus, X } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '../notifications-context'
import { RealtimeChannel } from '@supabase/supabase-js'

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
  memberNames?: string[]
  lastReadAt?: string | null
}

type DiscoverUser = {
  id: string
  username: string
  avatar: string
  bio: string
}

type DbMessage = {
  id: string
  sender_id: string
  receiver_id: string
  text: string
  status?: MessageStatus | null
  created_at: string
}

type DbGroup = {
  id: string
  name: string
  avatar_url?: string | null
  created_by: string
  created_at: string
  updated_at?: string | null
}

type DbGroupMember = {
  group_id: string
  user_id: string
  role?: string | null
  last_read_at?: string | null
  joined_at?: string | null
}

type DbGroupMessage = {
  id: string
  group_id: string
  sender_id: string
  text: string
  created_at: string
}

function formatMessageTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function userName(userId: string, profiles: Map<string, DiscoverUser>) {
  return profiles.get(userId)?.username || `User ${userId.substring(0, 8)}`
}

function avatarForName(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1e293b&color=e2e8f0`
}

function toDirectMessage(msg: DbMessage, overrideStatus?: MessageStatus): Message {
  return {
    id: msg.id,
    senderId: msg.sender_id,
    receiverId: msg.receiver_id,
    text: msg.text,
    timestamp: formatMessageTime(msg.created_at),
    status: overrideStatus ?? msg.status ?? 'sent',
    created_at: msg.created_at
  }
}

function toGroupMessage(msg: DbGroupMessage, profiles: Map<string, DiscoverUser>): Message {
  return {
    id: msg.id,
    senderId: msg.sender_id,
    groupId: msg.group_id,
    senderName: userName(msg.sender_id, profiles),
    text: msg.text,
    timestamp: formatMessageTime(msg.created_at),
    status: 'sent',
    created_at: msg.created_at
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

function createGroupChat(
  group: DbGroup,
  members: DbGroupMember[],
  myMembership: DbGroupMember,
  profiles: Map<string, DiscoverUser>
): Chat {
  const memberIds = members.map((member) => member.user_id)
  const memberNames = memberIds.map((memberId) => userName(memberId, profiles))

  return {
    id: `group_${group.id}`,
    kind: 'group',
    groupId: group.id,
    name: group.name,
    avatar: group.avatar_url || avatarForName(group.name),
    unreadCount: 0,
    online: false,
    messages: [],
    memberIds,
    memberNames,
    lastReadAt: myMembership.last_read_at ?? myMembership.joined_at ?? null
  }
}

function isMissingTableError(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === '42703'
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
  const [groupName, setGroupName] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set())
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([])

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const chatChannelRef = useRef<RealtimeChannel | null>(null)
  const presenceChannelRef = useRef<RealtimeChannel | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const selectedChatIdRef = useRef<string | null>(null)
  const initialUserIdRef = useRef(initialUserId)
  const initialGroupIdRef = useRef(initialGroupId)
  const chatProfilesRef = useRef<Map<string, DiscoverUser>>(new Map())
  const groupIdsRef = useRef<Set<string>>(new Set())
  const chatsRef = useRef<Chat[]>([])
  const pendingUpdatesRef = useRef<Map<string, DbMessage>>(new Map())

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

    setChats((prev) => {
      const existing = prev.find((chat) => chat.id === targetChatId)
      if (existing) return prev
      return [createDirectChat(userId, chatProfilesRef.current.get(userId)), ...prev]
    })

    if (shouldMarkRead) {
      void markDirectRead(userId)
    }
  }, [markDirectRead])

  const loadChats = useCallback(async (myId: string) => {
    const res = await fetch('/api/users/discover')
    const discoverData = await res.json()
    const users: DiscoverUser[] = discoverData.users || []
    chatProfilesRef.current = new Map(users.map((discoverUser) => [discoverUser.id, discoverUser]))
    setDiscoverUsers(users.filter((u) => u.id !== myId))

    const directChatMap = new Map<string, Chat>()

    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
      .order('created_at', { ascending: true })

    if (messagesError && !isMissingTableError(messagesError)) {
      console.error('Error fetching messages:', messagesError)
    }

    const validMessages = (messagesData || []) as DbMessage[]

    validMessages.forEach((msg) => {
      const otherUserId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id
      const chat = directChatMap.get(otherUserId) ?? createDirectChat(otherUserId, chatProfilesRef.current.get(otherUserId))
      const formattedMessage = toDirectMessage(msg)

      chat.messages.push(formattedMessage)
      chat.lastMessage = msg.text
      chat.lastMessageTime = formattedMessage.timestamp
      chat.lastActivityAt = msg.created_at
      chat.unreadCount = countDirectUnread(chat.messages, myId)
      directChatMap.set(otherUserId, chat)
    })

    const groupChats: Chat[] = []
    const { data: myMemberships, error: membershipError } = await supabase
      .from('chat_group_members')
      .select('*')
      .eq('user_id', myId)

    if (membershipError && !isMissingTableError(membershipError)) {
      console.error('Error fetching group memberships:', membershipError)
    }

    const memberships = (myMemberships || []) as DbGroupMember[]
    const groupIds = memberships.map((membership) => membership.group_id)
    groupIdsRef.current = new Set(groupIds)

    if (groupIds.length > 0) {
      const [{ data: groupsData, error: groupsError }, { data: allMembersData, error: allMembersError }, { data: groupMessagesData, error: groupMessagesError }] = await Promise.all([
        supabase.from('chat_groups').select('*').in('id', groupIds),
        supabase.from('chat_group_members').select('*').in('group_id', groupIds),
        supabase.from('chat_group_messages').select('*').in('group_id', groupIds).order('created_at', { ascending: true })
      ])

      if (groupsError && !isMissingTableError(groupsError)) console.error('Error fetching groups:', groupsError)
      if (allMembersError && !isMissingTableError(allMembersError)) console.error('Error fetching group members:', allMembersError)
      if (groupMessagesError && !isMissingTableError(groupMessagesError)) console.error('Error fetching group messages:', groupMessagesError)

      const groups = (groupsData || []) as DbGroup[]
      const allMembers = (allMembersData || []) as DbGroupMember[]
      const groupMessages = (groupMessagesData || []) as DbGroupMessage[]

      const messagesByGroup = new Map<string, DbGroupMessage[]>()
      groupMessages.forEach((msg) => {
        const existing = messagesByGroup.get(msg.group_id) || []
        existing.push(msg)
        messagesByGroup.set(msg.group_id, existing)
      })

      groups.forEach((group) => {
        const myMembership = memberships.find((membership) => membership.group_id === group.id)
        if (!myMembership) return

        const members = allMembers.filter((member) => member.group_id === group.id)
        const chat = createGroupChat(group, members, myMembership, chatProfilesRef.current)
        const messages = (messagesByGroup.get(group.id) || []).map((msg) => toGroupMessage(msg, chatProfilesRef.current))
        const lastMessage = messages[messages.length - 1]

        chat.messages = messages
        chat.lastMessage = lastMessage ? `${lastMessage.senderName}: ${lastMessage.text}` : `${chat.memberIds?.length || 0} members`
        chat.lastMessageTime = lastMessage?.timestamp
        chat.lastActivityAt = lastMessage?.created_at || group.updated_at || group.created_at
        chat.unreadCount = countGroupUnread(messages, myId, chat.lastReadAt)
        groupChats.push(chat)
      })
    }

    let finalChats = sortChats([
      ...Array.from(directChatMap.values()),
      ...groupChats
    ])

    const targetUserId = initialUserIdRef.current
    const targetGroupId = initialGroupIdRef.current
    let targetChat: Chat | undefined

    if (targetGroupId) {
      targetChat = finalChats.find((chat) => chat.kind === 'group' && chat.groupId === targetGroupId)
    } else if (targetUserId) {
      targetChat = finalChats.find((chat) => chat.kind === 'direct' && chat.userId === targetUserId)
      if (!targetChat) {
        targetChat = createDirectChat(targetUserId, chatProfilesRef.current.get(targetUserId))
      }
    } else {
      targetChat = finalChats[0]
    }

    if (targetChat) {
      finalChats = [targetChat, ...finalChats.filter((chat) => chat.id !== targetChat?.id)]
      setSelectedChatId(targetChat.id)
    }

    setChats(finalChats)

    if (targetChat?.kind === 'direct' && targetChat.userId) {
      void markDirectRead(targetChat.userId)
    } else if (targetChat?.kind === 'group' && targetChat.groupId) {
      void markGroupRead(targetChat.groupId)
    }
  }, [markDirectRead, markGroupRead, supabase])

  useEffect(() => {
    // Guard against React Strict Mode's double-invocation: the cleanup sets
    // `cancelled = true` synchronously, so the second async initData() call
    // detects it after every await and exits before touching any channels.
    let cancelled = false

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

        await loadChats(myId)
        if (cancelled) return

        const presenceChannel = supabase
          .channel(`online-users:${myId}`, {
            config: { presence: { key: myId } }
          })
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState()
            setOnlineUsers(new Set<string>(Object.keys(state)))
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({ online_at: new Date().toISOString() })
            }
          })

        presenceChannelRef.current = presenceChannel

        const chatChannel = supabase
          .channel('public:chat')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new as DbMessage
            if (newMsg.sender_id !== myId && newMsg.receiver_id !== myId) return

            const otherUserId = newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id
            const chatId = `direct_${otherUserId}`
            const isIncomingOpen = newMsg.receiver_id === myId && selectedChatIdRef.current === chatId
            const formattedMessage = toDirectMessage(newMsg, isIncomingOpen ? 'read' : undefined)

            setChats((prevChats) => {
              const existingChat = prevChats.find((chat) => chat.kind === 'direct' && chat.userId === otherUserId)
              const baseChat = existingChat ?? createDirectChat(otherUserId, chatProfilesRef.current.get(otherUserId))

              if (baseChat.messages.some((msg) => msg.id === newMsg.id)) {
                return prevChats
              }

              const messages = [...baseChat.messages, formattedMessage]
              const updatedChat: Chat = {
                ...baseChat,
                messages,
                lastMessage: newMsg.text,
                lastMessageTime: formattedMessage.timestamp,
                lastActivityAt: newMsg.created_at,
                unreadCount: countDirectUnread(messages, myId)
              }

              const withoutUpdated = prevChats.filter((chat) => chat.id !== chatId)
              return sortChats([updatedChat, ...withoutUpdated])
            })

            if (isIncomingOpen) {
              void markDirectRead(otherUserId)
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            const updatedMsg = payload.new as DbMessage
            if (updatedMsg.sender_id !== myId && updatedMsg.receiver_id !== myId) return

            const otherUserId = updatedMsg.sender_id === myId ? updatedMsg.receiver_id : updatedMsg.sender_id

            setChats((prevChats) => prevChats.map((chat) => {
              if (chat.kind !== 'direct' || chat.userId !== otherUserId) return chat

              const messageExists = chat.messages.some((msg) => msg.id === updatedMsg.id)
              if (!messageExists) {
                pendingUpdatesRef.current.set(updatedMsg.id, updatedMsg)
                return chat
              }

              const messages = chat.messages.map((msg) => (
                msg.id === updatedMsg.id
                  ? {
                      ...msg,
                      text: updatedMsg.text,
                      status: updatedMsg.status ?? msg.status,
                      created_at: updatedMsg.created_at,
                      timestamp: formatMessageTime(updatedMsg.created_at)
                    }
                  : msg
              ))

              const lastMessage = messages[messages.length - 1]

              return {
                ...chat,
                messages,
                lastMessage: lastMessage?.text,
                lastMessageTime: lastMessage?.timestamp,
                lastActivityAt: lastMessage?.created_at,
                unreadCount: countDirectUnread(messages, myId)
              }
            }))
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_group_messages' }, (payload) => {
            const newMsg = payload.new as DbGroupMessage
            if (!groupIdsRef.current.has(newMsg.group_id)) return

            const chatId = `group_${newMsg.group_id}`
            const isOpen = selectedChatIdRef.current === chatId
            const formattedMessage = toGroupMessage(newMsg, chatProfilesRef.current)

            setChats((prevChats) => {
              const existingChat = prevChats.find((chat) => chat.kind === 'group' && chat.groupId === newMsg.group_id)
              if (!existingChat || existingChat.messages.some((msg) => msg.id === newMsg.id)) return prevChats

              const nextLastReadAt = isOpen ? new Date().toISOString() : existingChat.lastReadAt
              const messages = [...existingChat.messages, formattedMessage]
              const updatedChat: Chat = {
                ...existingChat,
                messages,
                lastMessage: `${formattedMessage.senderName}: ${formattedMessage.text}`,
                lastMessageTime: formattedMessage.timestamp,
                lastActivityAt: formattedMessage.created_at,
                lastReadAt: nextLastReadAt,
                unreadCount: isOpen ? 0 : countGroupUnread(messages, myId, existingChat.lastReadAt)
              }

              const withoutUpdated = prevChats.filter((chat) => chat.id !== chatId)
              return sortChats([updatedChat, ...withoutUpdated])
            })

            if (isOpen) {
              void markGroupRead(newMsg.group_id)
            } else {
              void refreshUnreadCount()
            }
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_group_members', filter: `user_id=eq.${myId}` }, () => {
            void loadChats(myId)
            void refreshUnreadCount()
          })
          .subscribe()

        chatChannelRef.current = chatChannel
      } catch (err) {
        console.error('Failed to init messages', err)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void initData()

    return () => {
      cancelled = true
      if (chatChannelRef.current) {
        void supabase.removeChannel(chatChannelRef.current)
        chatChannelRef.current = null
      }
      if (presenceChannelRef.current) {
        void supabase.removeChannel(presenceChannelRef.current)
        presenceChannelRef.current = null
      }
    }
  }, [loadChats, markDirectRead, markGroupRead, refreshUnreadCount, supabase])

  useEffect(() => {
    if (!initialUserId || isLoading) return
    // Defer so setState is not called synchronously inside the effect body
    const t = setTimeout(() => selectDirectChatByUserId(initialUserId), 0)
    return () => clearTimeout(t)
  }, [initialUserId, isLoading, selectDirectChatByUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedChatId, chats])

  const selectedChat = chats.find((chat) => chat.id === selectedChatId)

  const handleSendMessage = async (e: React.FormEvent | React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat || !currentUserId) return

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
      const { data, error } = await supabase.from('chat_group_messages').insert({
        group_id: selectedChat.groupId,
        sender_id: currentUserId,
        text: msgText
      }).select().single()

      if (error) {
        console.error('Error sending group message:', error)
        return
      }

      if (data) {
        const inserted = data as DbGroupMessage
        setChats((prevChats) => prevChats.map((chat) => {
          if (chat.id !== selectedChat.id) return chat
          const insertedMessage = toGroupMessage(inserted, chatProfilesRef.current)
          const messages = chat.messages.map((msg) => (msg.id === tempId ? insertedMessage : msg))

          return {
            ...chat,
            messages,
            lastMessage: `${insertedMessage.senderName}: ${insertedMessage.text}`,
            lastMessageTime: insertedMessage.timestamp,
            lastActivityAt: insertedMessage.created_at
          }
        }))
      }

      if (selectedChat.groupId) void markGroupRead(selectedChat.groupId)
      return
    }

    const { data, error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedChat.userId,
      text: msgText,
      status: 'sent'
    }).select().single()

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    if (data) {
      const inserted = data as DbMessage
      setChats((prevChats) => prevChats.map((chat) => {
        if (chat.id !== selectedChat.id) return chat

        const pendingUpdate = pendingUpdatesRef.current.get(inserted.id)
        if (pendingUpdate) {
          pendingUpdatesRef.current.delete(inserted.id)
          inserted.status = pendingUpdate.status ?? inserted.status
          inserted.text = pendingUpdate.text ?? inserted.text
        }

        const messages = chat.messages.map((msg) => (
          msg.id === tempId ? { ...toDirectMessage(inserted), status: inserted.status ?? msg.status } : msg
        ))

        return {
          ...chat,
          messages,
          lastMessage: inserted.text,
          lastMessageTime: formatMessageTime(inserted.created_at),
          lastActivityAt: inserted.created_at
        }
      }))
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

    const { data: groupData, error: groupError } = await supabase.from('chat_groups').insert({
      name: finalName,
      created_by: currentUserId
    }).select().single()

    if (groupError || !groupData) {
      console.error('Error creating group:', groupError)
      setIsCreatingGroup(false)
      return
    }

    const newGroupId = groupData.id
    const group: DbGroup = {
      id: newGroupId,
      name: finalName,
      created_by: currentUserId,
      created_at: groupData.created_at
    }

    const memberRows = [currentUserId, ...chosenMembers].map((userId) => ({
      group_id: newGroupId,
      user_id: userId,
      role: userId === currentUserId ? 'owner' : 'member',
      last_read_at: userId === currentUserId ? new Date().toISOString() : null
    }))

    const { error: membersError } = await supabase.from('chat_group_members').insert(memberRows)

    if (membersError) {
      console.error('Error adding group members:', membersError)
      // Attempt cleanup if members fail
      await supabase.from('chat_groups').delete().eq('id', newGroupId)
      setIsCreatingGroup(false)
      return
    }

    const chat = createGroupChat(group, memberRows, memberRows[0], chatProfilesRef.current)
    groupIdsRef.current = new Set([...groupIdsRef.current, newGroupId])
    setChats((prev) => sortChats([chat, ...prev]))
    setSelectedChatId(chat.id)
    setGroupName('')
    setSelectedMemberIds(new Set())
    setIsGroupModalOpen(false)
    setIsCreatingGroup(false)
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
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-900/50">
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Chat</h2>
            <button
              type="button"
              onClick={() => setIsGroupModalOpen(true)}
              className="w-9 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-colors"
              aria-label="Create group chat"
              title="Create group chat"
            >
              <Plus className="w-4 h-4" />
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
                <h3 className="font-medium text-white truncate">{selectedChat.name}</h3>
                <p className="text-xs text-slate-400 truncate">
                  {selectedChat.kind === 'group'
                    ? `${selectedChat.memberIds?.length || 0} members`
                    : selectedChat.userId && onlineUsers.has(selectedChat.userId) ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0a0f1a]" style={{ scrollbarWidth: 'thin' }}>
            {selectedChat.messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500">
                <p>Start the conversation with {selectedChat.name}</p>
              </div>
            ) : (
              selectedChat.messages.map((msg) => {
                const isMe = msg.senderId === currentUserId
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
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
                )
              })
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
                placeholder="Type a message..."
                className="flex-1 max-h-32 min-h-[44px] bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all resize-none overflow-y-auto"
                rows={1}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="w-11 h-11 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div>
                <h3 className="text-white font-semibold">New group chat</h3>
                <p className="text-xs text-slate-400 mt-1">{selectedMemberIds.size} selected</p>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
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
                {discoverUsers.map((user) => {
                  const isSelected = selectedMemberIds.has(user.id)
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleMember(user.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${isSelected ? 'bg-blue-500/10 border border-blue-500/30' : 'border border-transparent hover:bg-slate-800/70'}`}
                    >
                      <Image src={user.avatar || avatarForName(user.username)} alt={user.username} width={36} height={36} className="w-9 h-9 rounded-full object-cover border border-slate-700" unoptimized />
                      <span className="flex-1 text-sm text-slate-200 truncate">{user.username}</span>
                      <span className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-500' : 'border-slate-600'}`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={selectedMemberIds.size === 0 || isCreatingGroup}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreatingGroup ? 'Creating...' : 'Create group'}
              </button>
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
