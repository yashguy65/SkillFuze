'use client'

import { ReactNode, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NotificationsProvider } from './notifications-context'
import AppSidebar from './sidebar'

export default function AppLayout({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState('@user')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.user_metadata?.user_name) {
        setUsername(`@${user.user_metadata.user_name}`)
      } else if (user?.email) {
        setUsername(user.email.split('@')[0])
      }
      if (user?.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url)
      }
    }
    fetchUser()
  }, [])

  return (
    <NotificationsProvider>
      <div className="min-h-screen bg-slate-950 text-slate-50 flex selection:bg-teal-500/30 font-sans">
        <AppSidebar username={username} avatarUrl={avatarUrl} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </NotificationsProvider>
  )
}
