import { createClient } from '@/lib/supabase/server'
import UserDropdown from './UserDropdown'
import Link from 'next/link'

export default async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <header style={{ backgroundColor: '#1A1F2E', borderBottom: '1px solid #2D3748' }}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <Link href="/dashboard" className="hover:opacity-80 transition-opacity flex items-center gap-3">
          <div><h1 style={{ fontFamily: 'var(--font-orbitron)', fontSize: 30, color: '#E5E7EB' }}>SkillFuze</h1></div>
        </Link>
        {user ? <UserDropdown user={user} /> : null}
      </div>
    </header>
  )
}
