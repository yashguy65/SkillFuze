'use client'

import { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Search, Check, CheckCheck, MessageSquare } from 'lucide-react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from '../notifications-context'
import { RealtimeChannel } from '@supabase/supabase-js'

type MessageStatus = 'sent' | 'delivered' | 'read'

type Message = {
  id: string
  senderId: string
  receiverId: string
  text: string
  timestamp: string
  status: MessageStatus
  created_at?: string
}

type Chat = {
  id: string
  userId: string
  name: string
  avatar: string
  lastMessage?: string
  lastMessageTime?: string
  unreadCount: number
  online: boolean
  messages: Message[]
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

function formatMessageTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function toMessage(msg: DbMessage, overrideStatus?: MessageStatus): Message {
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

function countUnread(messages: Message[], myId: string) {
  return messages.filter((msg) => msg.receiverId === myId && msg.status !== 'read').length
}

function sortChats(chats: Chat[]) {
  return [...chats].sort((a, b) => {
    const aTime = a.messages.length ? new Date(a.messages[a.messages.length - 1].created_at!).getTime() : 0
    const bTime = b.messages.length ? new Date(b.messages[b.messages.length - 1].created_at!).getTime() : 0
    return bTime - aTime
  })
}

function createChat(userId: string, profile?: DiscoverUser): Chat {
  const name = profile?.username || `User ${userId.substring(0, 8)}`
  return {
    id: `chat_${userId}`,
    userId,
    name,
    avatar: profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    unreadCount: 0,
    online: false,
    messages: []
  }
}

function MessagesContent() {
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get('user_id')
  const { setConversationRead } = useNotifications()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createClient(), [])
  const chatChannelRef = useRef<RealtimeChannel | null>(null)
  const presenceChannelRef = useRef<RealtimeChannel | null>(null)
  const currentUserIdRef = useRef<string | null>(null)
  const selectedChatIdRef = useRef<string | null>(null)
  const initialUserIdRef = useRef(initialUserId)
  const chatProfilesRef = useRef<Map<string, DiscoverUser>>(new Map())

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId
  }, [selectedChatId])

  const markConversationRead = useCallback(async (otherUserId: string) => {
    const myId = currentUserIdRef.current
    if (!myId) return

    setChats((prev) => prev.map((chat) => {
      if (chat.userId !== otherUserId) return chat

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

  const selectChatByUserId = useCallback((userId: string, shouldMarkRead = true) => {
    const targetChatId = `chat_${userId}`
    setSelectedChatId(targetChatId)

    setChats((prev) => {
      const existing = prev.find((chat) => chat.userId === userId)
      if (existing) return prev
      return [createChat(userId, chatProfilesRef.current.get(userId)), ...prev]
    })

    if (shouldMarkRead) {
      void markConversationRead(userId)
    }
  }, [markConversationRead])

  useEffect(() => {
    if (!initialUserId || isLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    selectChatByUserId(initialUserId)
  }, [initialUserId, isLoading, selectChatByUserId])

  useEffect(() => {
    const initData = async () => {
      try {
        setIsLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }

        const myId = user.id
        setCurrentUserId(myId)
        currentUserIdRef.current = myId

        const res = await fetch('/api/users/discover')
        const discoverData = await res.json()
        const users: DiscoverUser[] = discoverData.users || []
        chatProfilesRef.current = new Map(users.map((discoverUser) => [discoverUser.id, discoverUser]))

        const chatMap = new Map<string, Chat>()
        users
          .filter((discoverUser) => discoverUser.id !== myId)
          .forEach((discoverUser) => {
            chatMap.set(discoverUser.id, createChat(discoverUser.id, discoverUser))
          })

        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order('created_at', { ascending: true })

        if (error && error.code !== '42P01') {
          console.error('Error fetching messages:', error)
        }

        const validMessages = (messagesData || []) as DbMessage[]

        validMessages.forEach((msg) => {
          const otherUserId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id
          const chat = chatMap.get(otherUserId) ?? createChat(otherUserId, chatProfilesRef.current.get(otherUserId))
          const formattedMessage = toMessage(msg)

          chat.messages.push(formattedMessage)
          chat.lastMessage = msg.text
          chat.lastMessageTime = formattedMessage.timestamp
          chat.unreadCount = countUnread(chat.messages, myId)
          chatMap.set(otherUserId, chat)
        })

        let finalChats = sortChats([...chatMap.values()].filter((chat) => chat.messages.length > 0))
        const targetUserId = initialUserIdRef.current
        let targetChat: Chat | undefined

        if (targetUserId) {
          targetChat = finalChats.find((chat) => chat.userId === targetUserId)

          if (!targetChat) {
            targetChat = chatMap.get(targetUserId) ?? createChat(targetUserId, chatProfilesRef.current.get(targetUserId))
          }

          finalChats = [targetChat, ...finalChats.filter((chat) => chat.userId !== targetUserId)]
          setSelectedChatId(targetChat.id)
        } else if (finalChats.length > 0) {
          targetChat = finalChats[0]
          setSelectedChatId(targetChat.id)
        }

        setChats(finalChats)

        if (targetChat) {
          void markConversationRead(targetChat.userId)
        }

        const presenceChannel = supabase.channel('online-users', {
          config: { presence: { key: myId } }
        })

        presenceChannel
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
          .channel('public:messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new as DbMessage
            if (newMsg.sender_id !== myId && newMsg.receiver_id !== myId) return

            const otherUserId = newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id
            const isIncomingOpen = newMsg.receiver_id === myId && selectedChatIdRef.current === `chat_${otherUserId}`
            const formattedMessage = toMessage(newMsg, isIncomingOpen ? 'read' : undefined)

            setChats((prevChats) => {
              const existingChat = prevChats.find((chat) => chat.userId === otherUserId)
              const baseChat = existingChat ?? createChat(otherUserId, chatProfilesRef.current.get(otherUserId))

              if (baseChat.messages.some((msg) => msg.id === newMsg.id)) {
                return prevChats
              }

              const messages = [...baseChat.messages, formattedMessage]
              const updatedChat: Chat = {
                ...baseChat,
                messages,
                lastMessage: newMsg.text,
                lastMessageTime: formattedMessage.timestamp,
                unreadCount: countUnread(messages, myId)
              }

              const withoutUpdated = prevChats.filter((chat) => chat.userId !== otherUserId)
              return sortChats([updatedChat, ...withoutUpdated])
            })

            if (isIncomingOpen) {
              void markConversationRead(otherUserId)
            }
          })
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            const updatedMsg = payload.new as DbMessage
            if (updatedMsg.sender_id !== myId && updatedMsg.receiver_id !== myId) return

            const otherUserId = updatedMsg.sender_id === myId ? updatedMsg.receiver_id : updatedMsg.sender_id

            setChats((prevChats) => prevChats.map((chat) => {
              if (chat.userId !== otherUserId) return chat

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
                unreadCount: countUnread(messages, myId)
              }
            }))
          })
          .subscribe()

        chatChannelRef.current = chatChannel
      } catch (err) {
        console.error('Failed to init messages', err)
      } finally {
        setIsLoading(false)
      }
    }

    void initData()

    return () => {
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current)
      if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current)
    }
  }, [markConversationRead, supabase])

  const handleChatSelect = (chat: Chat) => {
    setSelectedChatId(chat.id)
    void markConversationRead(chat.userId)
  }

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

      return {
        ...chat,
        messages: [...chat.messages, {
          id: tempId,
          senderId: currentUserId,
          receiverId: chat.userId,
          text: msgText,
          timestamp: timeString,
          status: 'sent',
          created_at: createdAt
        }],
        lastMessage: msgText,
        lastMessageTime: timeString
      }
    })))

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

        const messages = chat.messages.map((msg) => (
          msg.id === tempId ? { ...toMessage(inserted), status: msg.status } : msg
        ))

        return {
          ...chat,
          messages,
          lastMessage: inserted.text,
          lastMessageTime: formatMessageTime(inserted.created_at)
        }
      }))
    }
  }

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
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
          <h2 className="text-xl font-bold text-white mb-4">Chat</h2>
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
            const isOnline = onlineUsers.has(chat.userId)
            return (
              <div
                key={chat.id}
                onClick={() => handleChatSelect(chat)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-l-2 ${selectedChatId === chat.id ? 'bg-blue-500/10 border-blue-500' : 'border-transparent hover:bg-slate-800/50'}`}
              >
                <div className="relative">
                  <Image src={chat.avatar} alt={chat.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover border border-slate-700" unoptimized />
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-medium text-slate-200 truncate">{chat.name}</h3>
                    <span className="text-xs text-slate-500 shrink-0">{chat.lastMessageTime}</span>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <p className={`text-sm truncate font-light ${chat.unreadCount > 0 ? 'text-white font-semibold' : 'text-slate-400'}`}>
                      {chat.lastMessage || 'New connection'}
                    </p>
                    {chat.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-lg shadow-blue-500/30">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-slate-950 relative">
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image src={selectedChat.avatar} alt={selectedChat.name} width={40} height={40} className="w-10 h-10 rounded-full object-cover border border-slate-700" unoptimized />
                {onlineUsers.has(selectedChat.userId) && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-white">{selectedChat.name}</h3>
                <p className="text-xs text-slate-400">
                  {onlineUsers.has(selectedChat.userId) ? 'Online' : 'Offline'}
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
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${isMe
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-slate-800 text-slate-200 rounded-bl-sm'
                        }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.text}</p>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500">
                      <span>{msg.timestamp}</span>
                      {isMe && (
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
