'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Search, Check, CheckCheck, MessageSquare } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Data Types
type Message = {
  id: string
  senderId: string
  receiverId: string
  text: string
  timestamp: string
  status: 'sent' | 'delivered' | 'read'
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

function MessagesContent() {
  const searchParams = useSearchParams()
  const initialUserId = searchParams.get('user_id')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [chats, setChats] = useState<Chat[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 1. Fetch current user and all discover users, then fetch messages
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any;

    const initData = async () => {
      try {
        setIsLoading(true)
        // Get auth user
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          window.location.href = '/login'
          return
        }
        const myId = user.id
        setCurrentUserId(myId)

        // Get discover users (to populate contact info)
        const res = await fetch('/api/users/discover')
        const discoverData = await res.json()
        const users: DiscoverUser[] = discoverData.users || []

        // Map users into chats format
        const initialChats: Chat[] = users
          .filter(u => u.id !== myId)
          .map(u => ({
            id: `chat_${u.id}`,
            userId: u.id,
            name: u.username,
            avatar: u.avatar || `https://ui-avatars.com/api/?name=${u.username}&background=random`,
            unreadCount: 0,
            online: true, // Mock online status
            messages: []
          }))

        // Fetch all messages for current user
        const { data: messagesData, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${myId},receiver_id.eq.${myId}`)
          .order('created_at', { ascending: true })

        if (error && error.code !== '42P01') { // 42P01 is relation does not exist
          console.error('Error fetching messages:', error)
        }

        const validMessages = messagesData || []

        // Attach messages to chats
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        validMessages.forEach((msg: any) => {
          const otherUserId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id
          const chat = initialChats.find(c => c.userId === otherUserId)
          if (chat) {
            const date = new Date(msg.created_at)
            const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            chat.messages.push({
              id: msg.id,
              senderId: msg.sender_id,
              receiverId: msg.receiver_id,
              text: msg.text,
              timestamp: timeString,
              status: msg.status || 'sent',
              created_at: msg.created_at
            })
            chat.lastMessage = msg.text
            chat.lastMessageTime = timeString
          }
        })

        // Sort chats by recent message
        initialChats.sort((a, b) => {
          const aTime = a.messages.length ? new Date(a.messages[a.messages.length - 1].created_at!).getTime() : 0
          const bTime = b.messages.length ? new Date(b.messages[b.messages.length - 1].created_at!).getTime() : 0
          return bTime - aTime
        })

        // Filter out empty chats so the sidebar only shows active conversations
        const finalChats = initialChats.filter(c => c.messages.length > 0)

        // Select chat from URL or default
        if (initialUserId) {
          const targetChatIndex = finalChats.findIndex(c => c.userId === initialUserId)
          if (targetChatIndex !== -1) {
            // Move it to the top
            const [targetChat] = finalChats.splice(targetChatIndex, 1)
            finalChats.unshift(targetChat)
            setSelectedChatId(targetChat.id)
          } else {
            // Check if they are in the full initial list to use their real profile
            const existingProfile = initialChats.find(c => c.userId === initialUserId)
            if (existingProfile) {
              finalChats.unshift(existingProfile)
              setSelectedChatId(existingProfile.id)
            } else {
              // Create fallback chat and put it at the top
              const fallbackChat: Chat = {
                id: `chat_${initialUserId}`,
                userId: initialUserId,
                name: `User ${initialUserId.substring(0, 8)}`,
                avatar: `https://ui-avatars.com/api/?name=${initialUserId.substring(0, 2)}&background=random`,
                unreadCount: 0,
                online: true,
                messages: []
              }
              finalChats.unshift(fallbackChat)
              setSelectedChatId(fallbackChat.id)
            }
          }
        } else if (finalChats.length > 0) {
          setSelectedChatId(finalChats[0].id)
        }

        setChats(finalChats)

        // Subscribe to real-time messages
        channel = supabase
          .channel('public:messages')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const newMsg = payload.new
            if (newMsg.sender_id === myId || newMsg.receiver_id === myId) {
              setChats(prevChats => {
                return prevChats.map(chat => {
                  const otherUserId = newMsg.sender_id === myId ? newMsg.receiver_id : newMsg.sender_id
                  if (chat.userId === otherUserId) {
                    const timeString = new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

                    // Don't duplicate if we just sent it (optimistic UI)
                    if (chat.messages.some(m => m.id === newMsg.id)) return chat

                    return {
                      ...chat,
                      messages: [...chat.messages, {
                        id: newMsg.id,
                        senderId: newMsg.sender_id,
                        receiverId: newMsg.receiver_id,
                        text: newMsg.text,
                        timestamp: timeString,
                        status: newMsg.status || 'delivered',
                        created_at: newMsg.created_at
                      }],
                      lastMessage: newMsg.text,
                      lastMessageTime: timeString
                    }
                  }
                  return chat
                }).sort((a, b) => {
                  const aTime = a.messages.length ? new Date(a.messages[a.messages.length - 1].created_at!).getTime() : 0
                  const bTime = b.messages.length ? new Date(b.messages[b.messages.length - 1].created_at!).getTime() : 0
                  return bTime - aTime
                })
              })
            }
          })
          .subscribe()

      } catch (err) {
        console.error('Failed to init messages', err)
      } finally {
        setIsLoading(false)
      }
    }

    initData()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUserId])

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedChatId, chats])

  const selectedChat = chats.find(c => c.id === selectedChatId)

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedChat || !currentUserId) return

    const tempId = `temp_${Date.now()}`
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const msgText = newMessage.trim()

    // Optimistic UI update
    setNewMessage('')
    setChats(prevChats =>
      prevChats.map(chat => {
        if (chat.id === selectedChat.id) {
          return {
            ...chat,
            messages: [...chat.messages, {
              id: tempId,
              senderId: currentUserId,
              receiverId: chat.userId,
              text: msgText,
              timestamp: timeString,
              status: 'sent',
              created_at: new Date().toISOString()
            }],
            lastMessage: msgText,
            lastMessageTime: timeString
          }
        }
        return chat
      })
    )

    // Save to Supabase
    const { data, error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: selectedChat.userId,
      text: msgText,
      status: 'sent'
    }).select().single()

    if (error) {
      console.error('Error sending message:', error)
      // Ideally remove the temp message or mark as failed
    } else if (data) {
      // Replace temp ID with real ID
      setChats(prevChats =>
        prevChats.map(chat => {
          if (chat.id === selectedChat.id) {
            return {
              ...chat,
              messages: chat.messages.map(m => m.id === tempId ? { ...m, id: data.id, status: 'delivered' } : m)
            }
          }
          return chat
        })
      )
    }
  }

  const filteredChats = chats.filter(chat =>
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

      {/* ── Left Sidebar (Chats) ── */}
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
          {filteredChats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setSelectedChatId(chat.id)}
              className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-l-2 ${selectedChatId === chat.id ? 'bg-blue-500/10 border-blue-500' : 'border-transparent hover:bg-slate-800/50'
                }`}
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={chat.avatar} alt={chat.name} className="w-12 h-12 rounded-full object-cover border border-slate-700" />
                {chat.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-medium text-slate-200 truncate">{chat.name}</h3>
                  <span className="text-xs text-slate-500 shrink-0">{chat.lastMessageTime}</span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <p className="text-sm text-slate-400 truncate font-light">{chat.lastMessage || 'New connection'}</p>
                  {chat.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 shadow-lg shadow-blue-500/30">
                      {chat.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Content (Active Chat) ── */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-slate-950 relative">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedChat.avatar} alt={selectedChat.name} className="w-10 h-10 rounded-full object-cover border border-slate-700" />
                {selectedChat.online && (
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                )}
              </div>
              <div>
                <h3 className="font-medium text-white">{selectedChat.name}</h3>
                <p className="text-xs text-slate-400">{selectedChat.online ? 'Online' : 'Offline'}</p>
              </div>
            </div>

          </div>

          {/* Messages Area */}
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
                          msg.status === 'delivered' ? <CheckCheck className="w-3 h-3" /> :
                            <Check className="w-3 h-3" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
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
