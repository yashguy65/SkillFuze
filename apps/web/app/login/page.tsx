'use client'

import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const signIn = async () => {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: 'http://localhost:3000/dashboard'
      }
    })
  }

  return (
    <div className="p-10">
      <button
        onClick={signIn}
        className="px-4 py-2 bg-black text-white rounded"
      >
        Sign in with GitHub
      </button>
    </div>
  )
}