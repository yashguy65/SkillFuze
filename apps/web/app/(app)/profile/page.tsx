'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { syncGitHub } from '@/lib/ai-service'
import { GitBranch, CheckCircle2, AlertCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react'

type SyncStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ProfilePage() {
  const [user, setUser] = useState<{
    id: string
    email: string | undefined
    user_metadata: Record<string, string>
  } | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser(user as any)
    })
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    )
  }

  const handle = user.user_metadata?.user_name || user.email?.split('@')[0] || 'user'
  const avatar = user.user_metadata?.avatar_url
  const githubUsername = user.user_metadata?.user_name

  const handleSyncGitHub = async () => {
    if (!githubUsername) {
      setSyncStatus('error')
      setSyncMessage('No GitHub username found on your account.')
      return
    }

    setSyncStatus('loading')
    setSyncMessage('')

    try {
      const result = await syncGitHub({
        user_id: user.id,
        github_username: githubUsername,
      })
      setSyncStatus('success')
      setSyncMessage(
        result.chunks_stored === 0
          ? 'Sync complete — no new data found.'
          : `Sync complete! ${result.chunks_stored} code chunks indexed.`
      )
    } catch (err: unknown) {
      setSyncStatus('error')
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed. Please try again.')
    } finally {
      // Reset after 6 s so the button is usable again
      setTimeout(() => setSyncStatus('idle'), 6000)
    }
  }

  const syncButtonContent = () => {
    switch (syncStatus) {
      case 'loading':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Syncing…
          </>
        )
      case 'success':
        return (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Synced!
          </>
        )
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            Retry Sync
          </>
        )
      default:
        return (
          <>
            <GitBranch className="w-4 h-4" />
            Sync GitHub
          </>
        )
    }
  }

  const syncButtonClass = {
    idle:    'bg-slate-800 hover:bg-teal-500/10 text-slate-200 hover:text-teal-300 border border-slate-700 hover:border-teal-500/40',
    loading: 'bg-slate-800/60 text-slate-400 border border-slate-700 cursor-not-allowed',
    success: 'bg-teal-500/10 text-teal-300 border border-teal-500/40',
    error:   'bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500/20',
  }[syncStatus]

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-50 font-sans selection:bg-teal-500/30">
      <main className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center">

        {/* Header */}
        <h1 className="text-3xl font-bold tracking-tight mb-6">@{handle}</h1>

        {/* Avatar */}
        <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-4 border-slate-800 shadow-[0_0_20px_rgba(20,184,166,0.15)] flex items-center justify-center bg-slate-800">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={`@${handle}`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl">🍄</span>
          )}
        </div>

        {/* GitHub link */}
        {githubUsername && (
          <a
            href={`https://github.com/${githubUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-400 transition-colors mb-8"
          >
            <GitBranch className="w-4 h-4" />
            github.com/{githubUsername}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* ── Sync GitHub ───────────────────────────────────────────────── */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
              GitHub Sync
            </h2>
            {syncStatus === 'success' && (
              <span className="text-xs text-teal-400 font-medium">
                ✓ Up to date
              </span>
            )}
          </div>

          <button
            id="sync-github-btn"
            onClick={handleSyncGitHub}
            disabled={syncStatus === 'loading'}
            className={`
              w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              text-sm font-semibold transition-all duration-300
              ${syncButtonClass}
              disabled:cursor-not-allowed
            `}
          >
            {syncButtonContent()}
          </button>

          {/* Status message */}
          {syncMessage && (
            <p
              className={`mt-3 text-xs text-center font-medium px-3 py-2 rounded-lg ${
                syncStatus === 'success'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {syncMessage}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-600 text-center">
            Indexes your public repos &amp; activity for AI matching
          </p>
        </div>

        {/* Skills */}
        <div className="w-full mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">
            Skills
          </h2>
          <div className="flex flex-wrap gap-2">
            {['React', 'TypeScript', 'Next.js', 'UI/UX'].map(skill => (
              <span
                key={skill}
                className="px-4 py-1.5 bg-teal-500/10 text-teal-400 rounded-full text-sm font-medium border border-teal-500/20"
              >
                {skill}
              </span>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="w-full mb-10">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">
            Tags
          </h2>
          <div className="flex flex-wrap gap-2">
            {['Looking for Co-founder', 'Night Owl'].map(tag => (
              <span
                key={tag}
                className="px-4 py-1.5 bg-transparent text-slate-300 rounded-full text-sm font-medium border border-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="w-full space-y-3 pt-6 border-t border-slate-800">
          <button className="flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors group w-full text-left text-sm font-medium">
            <span className="text-teal-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span>
            Change Password
          </button>
          <button className="flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors group w-full text-left text-sm font-medium">
            <span className="text-teal-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span>
            Add LinkedIn
          </button>
          <button
            onClick={handleSyncGitHub}
            disabled={syncStatus === 'loading'}
            className="flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors group w-full text-left text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-teal-500 ${syncStatus === 'loading' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Re-sync GitHub Data
          </button>
        </div>
      </main>
    </div>
  )
}
