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
      const avatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || user?.user_metadata?.picture_url
      if (avatar) {
        setAvatarUrl(avatar)
      }
    }
    fetchUser()
  }, [])

  return (
    <NotificationsProvider>
      <div className="h-screen overflow-hidden bg-slate-950 text-slate-50 flex flex-col md:flex-row selection:bg-teal-500/30 font-sans transition-colors duration-200">
        <AppSidebar username={username} avatarUrl={avatarUrl} />
        <main className="flex-1 min-h-0 overflow-hidden pb-16 md:pb-0">{children}</main>
      </div>
    </NotificationsProvider>
  )
}
