import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Dashboard | SkillFuze',
}

export default async function Dashboard() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
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
  )
}