import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') || 'signup'
  const next = searchParams.get('next') ?? '/dashboard'

  const errorUrl = new URL('/auth/auth-code-error', origin)

  const supabase = await createClient()

  // 1. Try PKCE Code Exchange if 'code' is present
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    // If it's a PKCE error, we don't return immediately, we try the token_hash if available
    console.error('PKCE Exchange failed:', error.message)
    
    // If no token_hash is available to fall back on, redirect to error
    if (!token_hash) {
      errorUrl.searchParams.set('error', error.message)
      return NextResponse.redirect(errorUrl)
    }
  } 
  
  // 2. Try OTP/Token Verification if 'token_hash' is present
  if (token_hash) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email',
      token_hash,
    })
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    console.error('OTP Verification failed:', error.message)
    errorUrl.searchParams.set('error', error.message)
    return NextResponse.redirect(errorUrl)
  }

  errorUrl.searchParams.set('error', 'No valid verification code or token found')
  return NextResponse.redirect(errorUrl)
}
