'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findMatches, MatchResult } from '@/lib/ai-service'
import { Bell, Search, Sparkles, Loader2, AlertTriangle, RefreshCw, Users, Zap } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchState = 'idle' | 'loading' | 'success' | 'error'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function similarityLabel(score: number): { text: string; color: string } {
  if (score >= 0.9) return { text: 'Excellent match', color: 'text-blue-400' }
  if (score >= 0.75) return { text: 'Strong match', color: 'text-blue-400' }
  if (score >= 0.6) return { text: 'Good match', color: 'text-indigo-400' }
  return { text: 'Possible match', color: 'text-slate-400' }
}

// ─── Discover card for browse tab (static showcase) ───────────────────────────

interface DiscoverUser {
  id: string | number
  username: string
  bio: string
  skills: string[]
  avatar: string
  preference?: string
}

const PREFERENCES = [
  'Looking for a co-founder',
  'Looking for a teammate',
  'Open to collaborate',
  'Just exploring'
]

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Card used in the "Discover" tab */
function DiscoverCard({ user }: { user: DiscoverUser }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:bg-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group cursor-pointer">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300 transition-colors border border-slate-700/50 overflow-hidden">
          {user.avatar && user.avatar.startsWith('http') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
          ) : (
            user.username?.[0]?.toUpperCase() ?? 'U'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
            @{user.username}
          </h3>
        </div>
      </div>
      <p className="text-sm text-slate-400 mb-6 line-clamp-2 font-light">{user.bio}</p>
      <div className="flex flex-wrap gap-2">
        {user.skills.map(skill => (
          <span
            key={skill}
            className="px-3 py-1 bg-slate-950 text-xs text-slate-300 rounded-full font-medium border border-slate-800 group-hover:border-slate-700 transition-colors"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Card used for real AI match results */
function MatchCard({ match }: { match: MatchResult }) {
  const label = similarityLabel(match.similarity)
  const displayName = match.github_username || match.user_id.substring(0, 8)
  const avatarUrl = match.github_username
    ? `https://github.com/${match.github_username}.png?size=96`
    : null

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:bg-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group cursor-pointer">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300 transition-colors border border-slate-700/50 overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback to initial letter if GitHub avatar fails
                const el = e.currentTarget
                el.style.display = 'none'
                el.parentElement!.textContent = displayName[0]?.toUpperCase() ?? '?'
              }}
            />
          ) : (
            displayName[0]?.toUpperCase() ?? '?'
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
            {match.github_username ? (
              <a
                href={`https://github.com/${match.github_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                @{displayName}
              </a>
            ) : (
              `@${displayName}`
            )}
          </h3>
          <p className={`text-xs font-medium ${label.color} flex items-center gap-1 mt-0.5`}>
            <Zap className="w-3 h-3" />
            {label.text}
            <span className="ml-auto text-slate-500">
              {Math.round(match.similarity * 100)}%
            </span>
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-400 mb-6 line-clamp-2 font-light">

      </p>

      <div className="flex flex-wrap gap-2">
        {match.skills.length > 0 ? (
          match.skills.map(skill => (
            <span
              key={skill}
              className="px-3 py-1 bg-blue-500/10 text-xs text-blue-400 rounded-full font-medium border border-blue-500/20 group-hover:border-blue-500/40 transition-colors"
            >
              {skill}
            </span>
          ))
        ) : (
          <span className="px-3 py-1 bg-slate-950 text-xs text-slate-500 rounded-full font-medium border border-slate-800">
            No skills data
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [customTags, setCustomTags] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'discover' | 'matches'>('discover')
  const [matchState, setMatchState] = useState<MatchState>('idle')
  const [matchError, setMatchError] = useState('')
  const [matchedResults, setMatchedResults] = useState<MatchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [discoverUsers, setDiscoverUsers] = useState<DiscoverUser[]>([])
  const [isLoadingDiscover, setIsLoadingDiscover] = useState(true)

  useEffect(() => {
    // Fetch auth
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login'
      setUserId(user?.id ?? null)

      if (user?.user_metadata?.custom_tags) {
        setCustomTags(user.user_metadata.custom_tags)
      }
    })

    // Fetch dynamic discover users
    fetch('/api/users/discover')
      .then(res => res.json())
      .then(data => {
        if (data.users) setDiscoverUsers(data.users)
      })
      .catch(err => console.error('Failed to load discover users', err))
      .finally(() => setIsLoadingDiscover(false))
  }, [])

  const handleFindMatches = useCallback(async () => {
    if (!userId) return
    setMatchState('loading')
    setMatchError('')
    setActiveTab('matches')

    try {
      const { matches } = await findMatches({
        user_id: userId,
        top_k: 6,
        custom_tags: customTags.length > 0 ? customTags : undefined,
        search_query: searchQuery.trim() || undefined,
      })
      setMatchedResults(matches)
      setMatchState('success')
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : 'Could not load matches.')
      setMatchState('error')
    }
  }, [userId, customTags, searchQuery])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="flex justify-between items-center px-8 py-6 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="w-10" />
          <h1 className="text-5xl tracking-tighter text-white">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">

            {/* ── AI Search + Find Matches CTA ──────────────────────────── */}
            <div className={`relative mb-8 mx-auto group mt-4 transition-all duration-500 ease-in-out ${isSearchFocused || searchQuery.length > 0 ? 'max-w-4xl' : 'max-w-2xl'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative flex items-center bg-slate-900 border border-slate-700 hover:border-blue-500/50 rounded-full p-2 pl-6 shadow-lg transition-all">
                <input
                  type="text"
                  placeholder="I'm building…"
                  className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-500 text-lg"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFindMatches()}
                />
                <button
                  onClick={handleFindMatches}
                  className="bg-blue-500 hover:bg-blue-400 text-slate-950 p-3 rounded-full transition-colors ml-2 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 mb-6 bg-slate-900/50 p-1 rounded-xl border border-slate-800 self-start w-fit">
              {(['discover', 'matches'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); if (tab == 'matches' && matchState === 'idle') { handleFindMatches() } }}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all
                    ${activeTab === tab
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'text-slate-400 hover:text-slate-200'}
                  `}
                >
                  {tab === 'discover' ? <Users className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {tab}
                  {tab === 'matches' && matchState === 'success' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-slate-950 text-xs font-bold rounded-full">
                      {matchedResults.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Main Content ─────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row gap-8">

              {/* ── User Grid ──────────────────────────────────────────── */}
              <div className="flex-1">

                {/* DISCOVER TAB */}
                {activeTab === 'discover' && (
                  <div className="space-y-12 pb-12">
                    {isLoadingDiscover ? (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
                        <p className="font-medium">Loading network...</p>
                      </div>
                    ) : discoverUsers.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                        <Users className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No users found</p>
                        <p className="text-sm mt-1">Check back later when more people join.</p>
                      </div>
                    ) : (
                      PREFERENCES.map(pref => {
                        const users = discoverUsers.filter(u => u.preference === pref && u.id !== userId)
                        if (users.length === 0) return null

                        return (
                          <div key={pref}>
                            <h2 className="text-xl font-bold text-slate-200 mb-4 pl-2 border-l-4 border-blue-500">{pref}</h2>
                            <div className="flex overflow-x-auto pb-6 gap-6 snap-x -mx-4 px-4 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
                              {users.map(u => (
                                <div key={u.id} className="min-w-[300px] max-w-[320px] snap-start flex-none">
                                  <DiscoverCard user={u} />
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}

                {/* MATCHES TAB */}
                {activeTab === 'matches' && (
                  <>
                    {/* Idle (not yet searched) */}
                    {matchState === 'idle' && (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                        <Sparkles className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No matches yet</p>
                        <p className="text-sm mt-1">
                          Click{' '}
                          <span className="text-blue-400 font-semibold">Find AI Matches</span>{' '}
                          to get started.
                        </p>
                      </div>
                    )}

                    {/* Loading */}
                    {matchState === 'loading' && (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
                        <p className="font-medium">Scanning your profile…</p>
                        <p className="text-sm mt-1 text-slate-500">Running semantic similarity search</p>
                      </div>
                    )}

                    {/* Error */}
                    {matchState === 'error' && (
                      <div className="flex flex-col items-center justify-center py-24">
                        <AlertTriangle className="w-10 h-10 text-red-400 mb-4" />
                        <p className="font-medium text-red-400">Match failed</p>
                        <p className="text-sm text-slate-500 mt-1 text-center max-w-xs">{matchError}</p>
                        <button
                          onClick={handleFindMatches}
                          className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Try again
                        </button>
                      </div>
                    )}

                    {/* Success */}
                    {matchState === 'success' && matchedResults.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                        <Users className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No matches found</p>
                        <p className="text-sm mt-1">
                          Try syncing your GitHub data first.
                        </p>
                      </div>
                    )}

                    {matchState === 'success' && matchedResults.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs text-slate-500">
                          </p>
                          <button
                            onClick={handleFindMatches}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh Matches
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {matchedResults.map((match) => (
                            <MatchCard key={match.user_id} match={match} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main >
    </div >
  )
}