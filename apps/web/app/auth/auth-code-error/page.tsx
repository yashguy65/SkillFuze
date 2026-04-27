'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'The authentication link is invalid or has expired.'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        
        <h1 className="text-3xl font-bold mb-3">Authentication Error</h1>
        <p className="text-slate-400 mb-8">
          {error}
        </p>

        <div className="flex flex-col gap-3">
          <Link 
            href="/login" 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
          >
            Back to Login
          </Link>
          <Link 
            href="/" 
            className="text-slate-400 hover:text-slate-200 text-sm py-2"
          >
            Return to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function AuthCodeError() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <ErrorContent />
    </Suspense>
  )
}
