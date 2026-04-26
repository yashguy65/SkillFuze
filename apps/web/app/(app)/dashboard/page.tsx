'use client'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded hover:opacity-90"
            style={{ backgroundColor: '#b00236', color: '#FFFFFF' }}
          >
            Log out
          </button>
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