'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Home, User, Settings, LogOut, MessageSquare, Sun, Moon } from 'lucide-react'
import { useState } from 'react'
import { useTheme } from 'next-themes'
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
  const { totalUnread } = useNotifications()
  const { theme, setTheme } = useTheme()

  const isDark = theme === 'dark' || theme === undefined

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')

  const navItems = [
    { icon: Home, label: 'Home', href: '/dashboard' },
    { icon: User, label: 'Profile', href: '/profile' },
    { icon: MessageSquare, label: 'Chat', href: '/messages', badge: totalUnread },
    { icon: Settings, label: 'Settings', href: '/settings' },
  ]

  return (
    <aside className="fixed bottom-0 left-0 right-0 w-full h-16 border-t border-slate-800/50 bg-slate-950/90 backdrop-blur-lg flex flex-row items-center justify-between px-6 z-40 md:sticky md:top-0 md:bottom-auto md:left-auto md:right-auto md:w-20 md:h-screen md:border-r md:border-t-0 md:flex-col md:py-6 md:px-0 md:justify-start md:gap-8 transition-colors duration-200">
      {/* Logo / Brand mark */}
      <Link href="/dashboard" className="mb-8 shrink-0 hidden md:block">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-teal-400 flex items-center justify-center shadow-lg shadow-blue-500/20 transition-transform hover:scale-110 active:scale-95 overflow-hidden">
          <Image
            src="/favicon.png"
            alt="SkillFuze Logo"
            width={40}
            height={40}
            className="w-full h-full object-cover"
          />
        </div>
      </Link>

      {/* Nav */}
      <nav className="flex flex-row md:flex-col items-center justify-around md:justify-start gap-1 md:gap-2 flex-1 md:flex-initial w-full md:w-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`p-3 rounded-xl transition-all group relative ${isActive
                ? 'bg-blue-500/10 text-blue-400'
                : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
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
              <span className="absolute bottom-full mb-3 md:bottom-auto md:left-full md:ml-3 px-2 py-1 bg-slate-800 border border-slate-700 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl text-slate-100">
                {item.label}
                {item.badge != null && item.badge > 0 && (
                  <span className="ml-1 text-red-400">({item.badge})</span>
                )}
              </span>
            </Link>
          )
        })}

        {/* User menu (mobile) */}
        <div className="relative md:hidden ml-2">
          {dropdownOpen && (
            <div className="absolute bottom-full right-0 mb-4 bg-slate-900 border border-slate-800 rounded-xl p-2 w-52 shadow-xl animate-in fade-in slide-in-from-bottom-2">
              <div className="px-3 py-2 border-b border-slate-800 mb-2">
                <p className="text-xs font-semibold text-slate-400">Signed in as</p>
                <p className="text-sm font-bold truncate text-slate-100">{username}</p>
              </div>

              {/* Theme toggle (mobile) */}
              <button
                onClick={toggleTheme}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/70 rounded-lg transition-colors"
              >
                {isDark
                  ? <><Sun className="w-4 h-4 text-amber-400" /><span>Light Mode</span></>
                  : <><Moon className="w-4 h-4 text-blue-400" /><span>Dark Mode</span></>
                }
              </button>

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
      </nav>


      {/* Theme toggle (desktop) */}
      <button
        onClick={toggleTheme}
        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        className="hidden md:flex p-3 rounded-xl text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-all group relative"
      >
        {isDark
          ? <Sun className="w-5 h-5 text-amber-400" />
          : <Moon className="w-5 h-5 text-blue-400" />
        }
        <span className="absolute bottom-auto left-full ml-3 px-2 py-1 bg-slate-800 border border-slate-700 text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none shadow-xl text-slate-100">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      </button>

      {/* User menu (desktop) */}
      <div className="relative hidden md:block md:mt-2">
        {dropdownOpen && (
          <div className="absolute bottom-full left-0 mb-4 bg-slate-900 border border-slate-800 rounded-xl p-2 w-52 shadow-xl animate-in fade-in slide-in-from-bottom-2">
            <div className="px-3 py-2 border-b border-slate-800 mb-2">
              <p className="text-xs font-semibold text-slate-400">Signed in as</p>
              <p className="text-sm font-bold truncate text-slate-100">{username}</p>
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
