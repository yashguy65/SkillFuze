'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { syncGitHub, syncLinkedIn, purgeData } from '@/lib/ai-service'
import { useNotifications } from '../notifications-context'
import { GitBranch, CheckCircle2, Loader2, RefreshCw, FileUp, Bell, Shield, Trash2 } from 'lucide-react'

type SyncStatus = 'idle' | 'loading' | 'success' | 'error'

export default function SettingsPage() {
  const [user, setUser] = useState<{
    id: string
    email: string | undefined
    user_metadata: Record<string, string>
  } | null>(null)

  // Sync State
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [linkedinSyncStatus, setLinkedinSyncStatus] = useState<SyncStatus>('idle')
  const [linkedinSyncMessage, setLinkedinSyncMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Privacy State
  const [discoverable, setDiscoverable] = useState(true)
  const [isSavingPrivacy, setIsSavingPrivacy] = useState(false)

  // Purge State
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgeText, setPurgeText] = useState('')
  const [purgeStatus, setPurgeStatus] = useState<SyncStatus>('idle')
  const [purgeMessage, setPurgeMessage] = useState('')

  const { pushEnabled, pushSupported, requestPush } = useNotifications()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser(user as any)

      if (user) {
        // Load discoverable preference (default true)
        if (user.user_metadata?.discoverable !== undefined) {
          setDiscoverable(user.user_metadata.discoverable)
        } else {
          // If not set, set it to true default in DB
          supabase.auth.updateUser({ data: { discoverable: true } })
        }
      }
    })
  }, [])

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    )
  }

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

      // Auto-merge logic would typically go here if we wanted to update custom tags in settings
      // For now, we'll just show success

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
      setTimeout(() => setSyncStatus('idle'), 6000)
    }
  }

  const handleSyncLinkedIn = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setLinkedinSyncStatus('error')
      setLinkedinSyncMessage('File size exceeds 5MB limit.')
      return
    }

    if (file.type !== 'application/pdf') {
      setLinkedinSyncStatus('error')
      setLinkedinSyncMessage('Please upload a valid PDF file.')
      return
    }

    setLinkedinSyncStatus('loading')
    setLinkedinSyncMessage('')

    try {
      const result = await syncLinkedIn(user.id, file)

      setLinkedinSyncStatus('success')
      setLinkedinSyncMessage(
        result.chunks_stored === 0
          ? 'Sync complete — no data extracted.'
          : `Sync complete! LinkedIn profile indexed.`
      )
    } catch (err: unknown) {
      setLinkedinSyncStatus('error')
      setLinkedinSyncMessage(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
      setTimeout(() => setLinkedinSyncStatus('idle'), 6000)
    }
  }

  const handleToggleDiscoverable = async () => {
    setIsSavingPrivacy(true)
    const newVal = !discoverable
    
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { discoverable: newVal }
    })

    if (!error) {
      setDiscoverable(newVal)
    }
    setIsSavingPrivacy(false)
  }

  const handlePurgeData = async () => {
    if (purgeText !== 'I want to delete my data') return

    setPurgeStatus('loading')
    setPurgeMessage('')

    try {
      await purgeData({ user_id: user.id })
      
      // Clear tags in metadata to be safe
      const supabase = createClient()
      await supabase.auth.updateUser({
        data: { custom_tags: [], hidden_tags: [] }
      })

      setPurgeStatus('success')
      setPurgeMessage('AI Index successfully purged.')
      setPurgeText('')
      setShowPurgeConfirm(false)
    } catch (err: unknown) {
      setPurgeStatus('error')
      setPurgeMessage(err instanceof Error ? err.message : 'Failed to delete data.')
    } finally {
      setTimeout(() => setPurgeStatus('idle'), 6000)
    }
  }

  return (
    <div className="min-h-screen p-8 bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30 overflow-y-auto pb-24">
      <div className="max-w-2xl mx-auto space-y-8">
        
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
          <p className="text-slate-400">Manage your data, privacy, and notifications.</p>
        </div>

        {/* ── Data & Integrations ────────────────────────────────────────── */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Data &amp; Integrations</h2>
              <p className="text-sm text-slate-400">Sync your external profiles to improve your AI match score.</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* GitHub Sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <div>
                <h3 className="font-medium text-slate-200 flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-slate-400" />
                  GitHub Sync
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Indexes your public repos ({githubUsername || 'Not linked'})
                </p>
                {syncMessage && (
                  <p className={`text-xs mt-2 ${syncStatus === 'success' ? 'text-blue-400' : 'text-red-400'}`}>
                    {syncMessage}
                  </p>
                )}
              </div>
              <button
                onClick={handleSyncGitHub}
                disabled={syncStatus === 'loading' || !githubUsername}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-blue-500/20 text-slate-200 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {syncStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sync GitHub'}
              </button>
            </div>

            {/* LinkedIn Sync */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <div>
                <h3 className="font-medium text-slate-200 flex items-center gap-2">
                  <FileUp className="w-4 h-4 text-slate-400" />
                  LinkedIn Sync
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Upload your LinkedIn profile PDF to extract skills
                </p>
                {linkedinSyncMessage && (
                  <p className={`text-xs mt-2 ${linkedinSyncStatus === 'success' ? 'text-blue-400' : 'text-red-400'}`}>
                    {linkedinSyncMessage}
                  </p>
                )}
              </div>
              <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={handleSyncLinkedIn} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={linkedinSyncStatus === 'loading'}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-slate-800 hover:bg-blue-500/20 text-slate-200 hover:text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {linkedinSyncStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload PDF'}
              </button>
            </div>
          </div>
        </section>

        {/* ── Privacy & Discovery ────────────────────────────────────────── */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Privacy &amp; Discovery</h2>
              <p className="text-sm text-slate-400">Control how others see and find you on SkillFuze.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
              <div>
                <h3 className="font-medium text-slate-200">Discovery Visibility</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Allow others to find you in the Discover tab and AI matches
                </p>
              </div>
              <button
                onClick={handleToggleDiscoverable}
                disabled={isSavingPrivacy}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  discoverable ? 'bg-teal-500' : 'bg-slate-700'
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    discoverable ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* ── Notifications ──────────────────────────────────────────────── */}
        <section className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Notification Center</h2>
              <p className="text-sm text-slate-400">Manage your browser push notifications.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/50 border border-slate-800/80">
            <div>
              <h3 className="font-medium text-slate-200">Push Notifications</h3>
              <p className="text-xs text-slate-500 mt-1">
                Receive alerts for direct messages and group chats when away
              </p>
            </div>
            {pushSupported ? (
              <button
                onClick={requestPush}
                disabled={pushEnabled}
                className={`shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
                  pushEnabled 
                    ? 'bg-indigo-500/20 text-indigo-400 cursor-default'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25'
                }`}
              >
                {pushEnabled ? <><CheckCircle2 className="w-4 h-4" /> Enabled</> : 'Enable Push'}
              </button>
            ) : (
              <span className="text-xs text-slate-500 px-3 py-1.5 bg-slate-800 rounded-lg">Not Supported</span>
            )}
          </div>
        </section>

        {/* ── Danger Zone ────────────────────────────────────────────────── */}
        <section className="bg-slate-900/50 border border-red-500/20 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
              <p className="text-sm text-red-400/70">Irreversible actions for your account data.</p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-medium text-slate-200">Purge AI Index</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Permanently delete your parsed GitHub and LinkedIn data from the vector database.
                </p>
                {purgeMessage && (
                  <p className={`text-xs mt-2 ${purgeStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                    {purgeMessage}
                  </p>
                )}
              </div>
              <button
                onClick={() => setShowPurgeConfirm(!showPurgeConfirm)}
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
              >
                Purge Data
              </button>
            </div>

            {showPurgeConfirm && (
              <div className="mt-4 pt-4 border-t border-red-500/10 animate-in fade-in slide-in-from-top-2">
                <p className="text-sm text-slate-300 mb-3">
                  Type <strong className="text-red-400 select-all">I want to delete my data</strong> below to confirm.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={purgeText}
                    onChange={(e) => setPurgeText(e.target.value)}
                    placeholder="I want to delete my data"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500/50 text-slate-200"
                  />
                  <button
                    onClick={handlePurgeData}
                    disabled={purgeText !== 'I want to delete my data' || purgeStatus === 'loading'}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                  >
                    {purgeStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
