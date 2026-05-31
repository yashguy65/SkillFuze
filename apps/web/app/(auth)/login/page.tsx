'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const router = useRouter()

  const signInWithGithub = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  const signInWithGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      }
    })
  }

  const signInWithLinkedin = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
  }

  const signInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ backgroundColor: '#020617', fontFamily: 'var(--font-open-sans, Open Sans), sans-serif' }}
    >
      {/* Abstract background blobs for startup aesthetic */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md px-4 relative z-10">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-semibold mt-3 mb-1" style={{ color: '#ffffff' }}>
            Welcome to SkillFuze!
          </h1>
        </div>

        <div className="rounded-xl p-8" style={{ backgroundColor: '#1A1F2E', border: '1px solid #2D3748' }}>
          <p className="text-sm text-center mb-6" style={{ color: '#9CA3AF' }}>
            Sign in to continue to your dashboard
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* GitHub Button */}
          <button
            id="login-github-btn"
            disabled={loading}
            onClick={signInWithGithub}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all mb-4"
            style={{ backgroundColor: '#24292F', color: '#FFFFFF', border: '1px solid #444C56', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333B44')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#24292F')}
          >
            <GithubIcon className="w-5 h-5" />
            Continue with GitHub
          </button>

          {/* Google Button */}
          <button
            id="login-google-btn"
            disabled={loading}
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all mb-4"
            style={{ backgroundColor: '#24292F', color: '#FFFFFF', border: '1px solid #444C56', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333B44')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#24292F')}
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>

          {/* LinkedIn Button */}
          <button
            id="login-linkedin-btn"
            disabled={loading}
            onClick={signInWithLinkedin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all mb-6"
            style={{ backgroundColor: '#0A66C2', color: '#FFFFFF', border: '1px solid #004182', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#004182')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#0A66C2')}
          >
            <LinkedinIcon className="w-5 h-5" />
            Continue with LinkedIn
          </button>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t" style={{ borderColor: '#2D3748' }}></div>
            <span className="px-3 text-xs" style={{ color: '#4B5563' }}>OR</span>
            <div className="flex-1 border-t" style={{ borderColor: '#2D3748' }}></div>
          </div>

          {/* Email Form */}
          <form onSubmit={signInWithEmail} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#9CA3AF' }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border text-white text-sm"
                style={{ borderColor: '#334155' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#9CA3AF' }}>Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded bg-slate-800 border text-white text-sm"
                style={{ borderColor: '#334155' }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded font-semibold text-sm transition-all"
              style={{ backgroundColor: '#3b82f6', color: '#ffffff', cursor: 'pointer' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
            >
              {loading ? 'Signing in...' : 'Sign In with Email'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-xs text-center mt-6" style={{ color: '#6B7280' }}>
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  )
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
    </svg>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.247 0-13.632 3.842-17.694 9.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C10.193 39.353 16.634 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  )
}

function LinkedinIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  )
}