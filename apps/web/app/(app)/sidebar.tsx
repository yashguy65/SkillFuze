'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Home, User, Settings, LogOut, MessageSquare, Bell } from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNotifications } from './notifications-context'

type SidebarProps = {
  username: string
  avatarUrl: string | null
}

export default function AppSidebar({ username, avatarUrl }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { totalUnread, pushEnabled, pushSupported, requestPush } = useNotifications()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const navItems = [
    { icon: Home, label: 'Home', href: '/dashboard' },
    { icon: User, label: 'Profile', href: '/profile' },
    { icon: MessageSquare, label: 'Chat', href: '/messages', badge: totalUnread },
    { icon: Settings, label: 'Settings', href: '#' },
  ]

  return (
    <aside className="w-20 border-r border-slate-800/50 bg-slate-950/80 backdrop-blur-lg flex flex-col items-center py-6 sticky top-0 h-screen z-40">
      {/* Logo / Brand mark */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center mb-8 shadow-lg shadow-blue-500/20 shrink-0">
        <span className="text-white font-black text-sm">SF</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`p-3 rounded-xl transition-all group relative ${
                isActive
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
              title={item.label}
            >
              <item.icon className="w-6 h-6" />

              {/* Unread badge */}
              {item.badge != null && item.badge > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-red-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold px-0.5 shadow shadow-red-500/40 animate-pulse">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}

              {/* Tooltip */}
              <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 border border-slate-700 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-1 text-red-400">({item.badge})</span>
                )}
              </span>
            </Link>
          )
        })}

        {/* Push notification toggle */}
        {pushSupported && (
          <button
            onClick={requestPush}
            disabled={pushEnabled}
            className={`p-3 rounded-xl transition-all group relative ${
              pushEnabled
                ? 'text-teal-400 bg-teal-500/10 cursor-default'
                : 'text-slate-500 hover:bg-slate-800 hover:text-white'
            }`}
            title={pushEnabled ? 'Push notifications on' : 'Enable push notifications'}
          >
            <Bell className="w-6 h-6" />
            {pushEnabled && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-teal-400 rounded-full border-2 border-slate-950" />
            )}
            <span className="absolute left-full ml-3 px-2 py-1 bg-slate-800 border border-slate-700 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl">
              {pushEnabled ? 'Notifications on ✓' : 'Enable notifications'}
            </span>
          </button>
        )}
      </nav>

      {/* User menu */}
      <div className="relative">
        {dropdownOpen && (
          <div className="absolute bottom-full left-0 mb-4 bg-slate-900 border border-slate-800 rounded-xl p-2 w-48 shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="px-3 py-2 border-b border-slate-800 mb-2">
              <p className="text-xs font-semibold text-slate-400">Signed in as</p>
              <p className="text-sm font-bold truncate">{username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        )}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-slate-950 hover:ring-teal-500/50 transition-all uppercase overflow-hidden"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={username}
              width={40}
              height={40}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            username.charAt(username.startsWith('@') ? 1 : 0)
          )}
        </button>
      </div>
    </aside>
  )
}
