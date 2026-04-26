'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function UserDropdown({ user }: { user: User }) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="relative">
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
        style={{ color: '#E5E7EB' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user?.user_metadata?.avatar_url || 'https://github.com/identicons/default.png'}
          alt="Avatar"
          className="w-8 h-8 rounded-full bg-gray-700 object-cover"
        />
        <span className="font-medium">{user?.user_metadata?.user_name || 'Account'}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg py-1 z-10" style={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}>
          <Link
            href="/profile"
            className="block px-4 py-2 text-sm transition-colors"
            style={{ color: '#E5E7EB' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            onClick={() => setDropdownOpen(false)}
          >
            My Profile
          </Link>
          <div className="border-t my-1" style={{ borderColor: '#374151' }}></div>
          <button
            onClick={handleLogout}
            className="block w-full text-left px-4 py-2 text-sm transition-colors"
            style={{ color: '#F87171' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#374151'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}
