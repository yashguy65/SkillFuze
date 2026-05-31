'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function CallbackImplicitPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace('/dashboard')
      } else {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (session) {
            router.replace('/dashboard')
          }
        })
        
        const timer = setTimeout(() => {
          router.replace('/login')
        }, 2500)

        return () => {
          subscription.unsubscribe()
          clearTimeout(timer)
        }
      }
    }

    checkSession()
  }, [router])

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
      <div className="space-y-4 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="text-sm text-slate-400">Authenticating developer session, please wait...</p>
      </div>
    </div>
  )
}
