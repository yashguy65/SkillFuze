'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, Home, User, Settings, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, usePathname } from 'next/navigation'

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [username, setUsername] = useState('@user');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.user_name) {
        setUsername(`@${user.user_metadata.user_name}`);
      } else if (user?.email) {
        setUsername(user.email.split('@')[0]);
      }
      if (user?.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const navItems = [
    { icon: Home, label: 'Home', href: '/dashboard' },
    { icon: User, label: 'Profile', href: '/profile' },
    { icon: Settings, label: 'Your Teams', href: '#' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex selection:bg-teal-500/30 font-sans">
      {/* Sidebar */}
      <aside className="w-20 border-r border-slate-800/50 bg-slate-950/80 backdrop-blur-lg flex flex-col items-center py-6 sticky top-0 h-screen z-40">
        <button className="p-3 mb-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all">
          <Menu className="w-6 h-6" />
        </button>

        <nav className="flex-1 flex flex-col gap-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`p-3 rounded-xl transition-all group relative ${isActive ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                title={item.label}
              >
                <item.icon className="w-6 h-6" />
                <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-xs font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </nav>

        {/* User Menu */}
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
              <img src={avatarUrl} alt={username} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              username.charAt(username.startsWith('@') ? 1 : 0)
            )}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
