'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0F1419' }}>
      <div className="w-full max-w-md p-8 rounded-lg" style={{ backgroundColor: '#1A1F2E' }}>
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2" style={{ color: '#E5E7EB' }}>
            Welcome
          </h1>
          <p style={{ color: '#9CA3AF' }} className="text-sm">
            Sign in with your GitHub account to continue
          </p>
        </div>

        {/* Login Card */}
        <div className="p-6 rounded-lg mb-6" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
          <p className="text-sm mb-4" style={{ color: '#D1D5DB' }}>
            Use your GitHub credentials to securely sign in to your account.
          </p>
          <button
            onClick={signIn}
            className="w-full px-4 py-3 rounded font-semibold transition-all"
            style={{ 
              backgroundColor: '#3c97fa', 
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#117ff7'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3c97fa'}
          >
            Sign in with GitHub
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-center" style={{ color: '#6B7280' }}>
          By signing in, you agree to our Terms of Service
        </p>
      </div>
    </div>
  )
}