'use client'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient()
      const {
        data: { user }
      } = await supabase.auth.getUser()

      if (!user) {
        redirect('/login')
      }
      setUser(user)
      setLoading(false)
    }

    getUser()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (loading) {
    return <div className="p-10">Loading...</div>
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1419' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#1A1F2E', borderBottom: '1px solid #2D3748' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold" style={{ color: '#E5E7EB' }}>Dashboard</h1>
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
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* User Info */}
        <div className="mb-8">
          <p style={{ color: '#9CA3AF' }}>Logged in as: <span className="font-semibold" style={{ color: '#E5E7EB' }}>{user?.email}</span></p>
        </div>

        {/* Content Areas - Wireframe */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
            <div className="h-40 rounded mb-4 flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
              <span style={{ color: '#6B7280' }}>Content Area 1</span>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#E5E7EB' }}>Section 1</h2>
            <p style={{ color: '#D1D5DB' }} className="text-sm">Add your content here</p>
          </div>

          <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
            <div className="h-40 rounded mb-4 flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
              <span style={{ color: '#6B7280' }}>Content Area 2</span>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#E5E7EB' }}>Section 2</h2>
            <p style={{ color: '#D1D5DB' }} className="text-sm">Add your content here</p>
          </div>

          <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
            <div className="h-40 rounded mb-4 flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
              <span style={{ color: '#6B7280' }}>Content Area 3</span>
            </div>
            <h2 className="text-lg font-semibold mb-2" style={{ color: '#E5E7EB' }}>Section 3</h2>
            <p style={{ color: '#D1D5DB' }} className="text-sm">Add your content here</p>
          </div>
        </div>
      </main>
    </div>
  )
}