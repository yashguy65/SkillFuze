'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const signUpWithGithub = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const signUpWithGoogle = async () => {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#0F1419', fontFamily: 'var(--font-open-sans, Open Sans), sans-serif' }}
    >
      <div className="w-full max-w-md px-4">
        {/* Brand */}
        <div className="mb-8 text-center">
          <Link href="/" className="text-3xl font-bold" style={{ color: '#3c97fa', textDecoration: 'none' }}>
            SkillFuze
          </Link>
          <h1 className="text-2xl font-semibold mt-3 mb-1" style={{ color: '#E5E7EB' }}>
            Create your account
          </h1>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            Join thousands of builders finding their next collaboration
          </p>
        </div>

        <div className="rounded-xl p-8" style={{ backgroundColor: '#1A1F2E', border: '1px solid #2D3748' }}>
          {/* GitHub */}
          <button
            id="signup-github-btn"
            onClick={signUpWithGithub}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all mb-4"
            style={{ backgroundColor: '#24292F', color: '#FFFFFF', border: '1px solid #444C56', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333B44')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#24292F')}
          >
            <GithubIcon className="w-5 h-5" />
            Continue with GitHub
          </button>

          {/* Google */}
          <button
            id="signup-google-btn"
            onClick={signUpWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-semibold transition-all"
            style={{ backgroundColor: '#24292F', color: '#FFFFFF', border: '1px solid #444C56', cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFFFF')}
          >
            <GoogleIcon className="w-5 h-5" />
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <p className="text-xs text-center mt-6" style={{ color: '#6B7280' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#3c97fa', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
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
