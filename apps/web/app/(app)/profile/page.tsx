'use client'

import { useState, useEffect } from 'react'
import { useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { syncGitHub, getPersona, ingestTags, syncLinkedIn } from '@/lib/ai-service'
import { GitBranch, CheckCircle2, AlertCircle, Loader2, RefreshCw, ExternalLink, Plus, X, FileUp } from 'lucide-react'

type SyncStatus = 'idle' | 'loading' | 'success' | 'error'

export default function ProfilePage() {
  const [user, setUser] = useState<{
    id: string
    email: string | undefined
    user_metadata: Record<string, string>
  } | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  
  // LinkedIn Sync State
  const [linkedinSyncStatus, setLinkedinSyncStatus] = useState<SyncStatus>('idle')
  const [linkedinSyncMessage, setLinkedinSyncMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [skills, setSkills] = useState<string[]>([])

  // Custom Tags State
  const [customTags, setCustomTags] = useState<string[]>([])
  const [isAddingTag, setIsAddingTag] = useState(false)
  const [newTagVal, setNewTagVal] = useState('')
  const [preference, setPreference] = useState<string>('Just exploring')
  const [isSavingPref, setIsSavingPref] = useState(false)

  const PREFERENCES = [
    'Looking for a co-founder',
    'Looking for a teammate',
    'Open to collaborate',
    'Just exploring'
  ]

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser(user as any)

      if (user) {
        // Load custom tags and preference from metadata
        if (user.user_metadata?.custom_tags) {
          setCustomTags(user.user_metadata.custom_tags)
        }
        if (user.user_metadata?.preference) {
          setPreference(user.user_metadata.preference)
        }

        getPersona({ user_id: user.id })
          .then(data => setSkills(data.skills))
          .catch(() => setSkills([]))
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

      // Refresh persona to get updated languages
      const persona = await getPersona({ user_id: user.id }).catch(() => null)
      if (persona) setSkills(persona.skills)

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

  const handleSyncLinkedIn = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 5MB limit
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

      // Refresh persona to get updated skills from LinkedIn
      const persona = await getPersona({ user_id: user.id }).catch(() => null)
      if (persona) setSkills(persona.skills)
      
      // Auto-add extracted tags to custom tags
      if (result.extracted_tags && result.extracted_tags.length > 0) {
        const newTags = result.extracted_tags.filter(tag => !customTags.includes(tag))
        if (newTags.length > 0) {
          const updatedTags = [...customTags, ...newTags]
          const supabase = createClient()
          const { error } = await supabase.auth.updateUser({
            data: { custom_tags: updatedTags }
          })
          if (!error) {
            setCustomTags(updatedTags)
            try {
              await ingestTags({ user_id: user.id, tags: updatedTags })
            } catch (err) {
              console.error('Failed to sync tags to AI service', err)
            }
          }
        }
      }

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
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      setTimeout(() => setLinkedinSyncStatus('idle'), 6000)
    }
  }

  const handleAddTag = async () => {
    if (!newTagVal.trim() || !user) return

    const tag = newTagVal.trim()
    if (customTags.includes(tag)) {
      setNewTagVal('')
      setIsAddingTag(false)
      return
    }

    const updatedTags = [...customTags, tag]
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { custom_tags: updatedTags }
    })

    if (!error) {
      setCustomTags(updatedTags)
      setNewTagVal('')
      setIsAddingTag(false)

      // Sync tags to embeddings database
      try {
        await ingestTags({ user_id: user.id, tags: updatedTags })
      } catch (err) {
        console.error('Failed to sync tags to AI service', err)
      }
    }
  }

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!user) return

    const updatedTags = customTags.filter(tag => tag !== tagToRemove)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { custom_tags: updatedTags }
    })

    if (!error) {
      setCustomTags(updatedTags)
      setSkills(prev => prev.filter(s => s !== tagToRemove))

      // Sync updated tags to embeddings database
      try {
        await ingestTags({ user_id: user.id, tags: updatedTags })
      } catch (err) {
        console.error('Failed to sync tags to AI service', err)
      }
    }
  }

  const handlePreferenceChange = async (newPref: string) => {
    if (!user || newPref === preference) return
    setIsSavingPref(true)
    
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { preference: newPref }
    })

    if (!error) {
      setPreference(newPref)
    }
    setIsSavingPref(false)
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
    idle: 'bg-slate-800 hover:bg-blue-500/10 text-slate-200 hover:text-blue-300 border border-slate-700 hover:border-blue-500/40',
    loading: 'bg-slate-800/60 text-slate-400 border border-slate-700 cursor-not-allowed',
    success: 'bg-blue-500/10 text-blue-300 border border-blue-500/40',
    error: 'bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500/20',
  }[syncStatus]

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
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

        {githubUsername && (
          <a
            href={`https://github.com/${githubUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors mb-8"
          >
            <GitBranch className="w-4 h-4" />
            github.com/{githubUsername}
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleSyncLinkedIn}
        />

        {/* ── Sync Source ───────────────────────────────────────────────── */}
        {githubUsername ? (
          <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                GitHub Sync
              </h2>
              {syncStatus === 'success' && (
                <span className="text-xs text-blue-400 font-medium">
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
                className={`mt-3 text-xs text-center font-medium px-3 py-2 rounded-lg ${syncMessage.includes('complete') || syncStatus === 'success'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
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
        ) : (
          <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                LinkedIn Sync
              </h2>
              {linkedinSyncStatus === 'success' && (
                <span className="text-xs text-blue-400 font-medium">
                  ✓ Up to date
                </span>
              )}
            </div>

            <button
              id="sync-linkedin-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={linkedinSyncStatus === 'loading'}
              className={`
                w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                text-sm font-semibold transition-all duration-300
                ${linkedinSyncStatus === 'idle' ? 'bg-slate-800 hover:bg-blue-500/10 text-slate-200 hover:text-blue-300 border border-slate-700 hover:border-blue-500/40' : ''}
                ${linkedinSyncStatus === 'loading' ? 'bg-slate-800/60 text-slate-400 border border-slate-700 cursor-not-allowed' : ''}
                ${linkedinSyncStatus === 'success' ? 'bg-blue-500/10 text-blue-300 border border-blue-500/40' : ''}
                ${linkedinSyncStatus === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500/20' : ''}
                disabled:cursor-not-allowed
              `}
            >
              {linkedinSyncStatus === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
              ) : linkedinSyncStatus === 'success' ? (
                <><CheckCircle2 className="w-4 h-4" /> Synced!</>
              ) : linkedinSyncStatus === 'error' ? (
                <><AlertCircle className="w-4 h-4" /> Retry Upload</>
              ) : (
                <><FileUp className="w-4 h-4" /> Upload Profile PDF</>
              )}
            </button>

            {/* Status message */}
            {linkedinSyncMessage && (
              <p
                className={`mt-3 text-xs text-center font-medium px-3 py-2 rounded-lg ${linkedinSyncMessage.includes('complete') || linkedinSyncStatus === 'success'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
              >
                {linkedinSyncMessage}
              </p>
            )}

            <p className="mt-2 text-xs text-slate-600 text-center">
              Go to <a href="https://www.linkedin.com/in/me/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">your LinkedIn profile</a>, click <strong>More</strong> → <strong>Save to PDF</strong>, then upload it here.
            </p>
          </div>
        )}

        {/* ── Collaboration Preference ───────────────────────────────────── */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
              Collaboration Preference
            </h2>
            {isSavingPref && (
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            )}
          </div>
          
          <select
            value={preference}
            onChange={(e) => handlePreferenceChange(e.target.value)}
            disabled={isSavingPref}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500/50 appearance-none disabled:opacity-50 transition-colors"
          >
            {PREFERENCES.map(pref => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div className="w-full mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
              Tags
            </h2>
            {!isAddingTag && (
              <button
                onClick={() => setIsAddingTag(true)}
                className="text-slate-400 hover:text-blue-400 transition-colors bg-slate-800 rounded-full p-1 border border-slate-700 hover:border-blue-500/40"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          {isAddingTag && (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={newTagVal}
                onChange={e => setNewTagVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                autoFocus
                placeholder="New custom tag..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500/50 text-slate-200"
              />
              <button
                onClick={handleAddTag}
                className="bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-500/30 transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setIsAddingTag(false)}
                className="text-slate-500 hover:text-slate-300 px-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {customTags.map(tag => (
              <span
                key={`custom-${tag}`}
                className="group relative px-4 py-1.5 bg-slate-800 text-slate-300 rounded-full text-sm font-medium border border-slate-700 hover:border-white/50 hover:bg-slate-800/80 transition-colors flex items-center"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="absolute -top-1 -right-1 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white hover:border-red-500/50 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  aria-label={`Remove ${tag} tag`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            {skills.length > 0 ? (
              [...skills]
                .filter(skill => !customTags.includes(skill))
                .reverse()
                .map(skill => (
                  <span
                    key={skill}
                    className="px-4 py-1.5 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20"
                  >
                    {skill}
                  </span>
                ))
            ) : (
              customTags.length === 0 && (
                <span className="text-sm text-slate-500 italic ml-1">
                  Sync GitHub to view languages
                </span>
              )
            )}
          </div>
        </div>



        {/* Quick Actions */}
        <div className="w-full space-y-3 pt-6 border-t border-slate-800">
          <button className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors group w-full text-left text-sm font-medium">
            <span className="text-blue-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span>
            Change Password
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={linkedinSyncStatus === 'loading'}
            className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors group w-full text-left text-sm font-medium disabled:opacity-50"
          >
            {linkedinSyncStatus === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : linkedinSyncStatus === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-blue-400" />
            ) : linkedinSyncStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <span className="text-blue-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span>
            )}
            Add LinkedIn (PDF)
          </button>
          {githubUsername && linkedinSyncMessage && (
            <p className={`text-xs ${linkedinSyncStatus === 'error' ? 'text-red-400' : 'text-blue-400'} ml-6`}>
              {linkedinSyncMessage}
            </p>
          )}
          <button
            onClick={handleSyncGitHub}
            disabled={syncStatus === 'loading'}
            className="flex items-center gap-2 text-slate-400 hover:text-blue-400 transition-colors group w-full text-left text-sm font-medium disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-blue-500 ${syncStatus === 'loading' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Re-sync GitHub Data
          </button>
        </div>
      </main>
    </div>
  )
}
