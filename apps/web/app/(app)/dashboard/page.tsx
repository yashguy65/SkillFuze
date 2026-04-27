'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findMatches, MatchResult } from '@/lib/ai-service'
import { Bell, Search, Filter, Sparkles, Loader2, AlertTriangle, RefreshCw, Users, Zap } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MockUser {
  id: number
  username: string
  bio: string
  skills: string[]
  avatar: string
}

type MatchState = 'idle' | 'loading' | 'success' | 'error'

// ─── Mock user lookup (mirrors the stub data in the AI service) ───────────────

const MOCK_USER_DB: Record<string, MockUser> = {
  user_123: { id: 101, username: 'alex_dev',       bio: 'Full-stack builder passionate about AI and edge computing.',       skills: ['React', 'Node.js', 'Python'],           avatar: 'A' },
  user_456: { id: 102, username: 'sarah_design',   bio: 'UX/UI designer looking to collaborate on fintech startups.',      skills: ['Figma', 'CSS', 'UX Research'],          avatar: 'S' },
  user_789: { id: 103, username: 'mike_data',      bio: 'Data scientist building predictive models for e-commerce.',       skills: ['Python', 'SQL', 'TensorFlow'],          avatar: 'M' },
  user_321: { id: 104, username: 'emily_mobile',   bio: 'iOS developer creating accessible applications for everyone.',    skills: ['Swift', 'Objective-C', 'UI Kit'],       avatar: 'E' },
  user_654: { id: 105, username: 'chris_cloud',    bio: 'DevOps engineer scaling infrastructure for high-growth startups.',skills: ['AWS', 'Docker', 'Kubernetes'],          avatar: 'C' },
  user_987: { id: 106, username: 'jess_marketing', bio: 'Growth hacker bridging the gap between tech products and users.', skills: ['SEO', 'Content', 'Analytics'],          avatar: 'J' },
}

function resolveUser(matchResult: MatchResult): MockUser {
  return (
    MOCK_USER_DB[matchResult.user_id] ?? {
      id:       parseInt(matchResult.user_id.replace(/\D/g, '')) || 999,
      username: matchResult.user_id,
      bio:      'AI-matched collaborator.',
      skills:   [],
      avatar:   matchResult.user_id[0]?.toUpperCase() ?? '?',
    }
  )
}

function similarityLabel(score: number): { text: string; color: string } {
  if (score >= 0.9) return { text: 'Excellent match', color: 'text-teal-400' }
  if (score >= 0.75) return { text: 'Strong match',   color: 'text-blue-400'  }
  if (score >= 0.6)  return { text: 'Good match',     color: 'text-indigo-400' }
  return                     { text: 'Possible match', color: 'text-slate-400'  }
}

// ─── Discover card for browse/mock tab ───────────────────────────────────────

const DISCOVER_USERS: MockUser[] = [
  { id: 1,  username: 'alex_dev',       bio: 'Full-stack builder passionate about AI and edge computing.',       skills: ['React', 'Node.js', 'Python'],           avatar: 'A' },
  { id: 2,  username: 'sarah_design',   bio: 'UX/UI designer looking to collaborate on fintech startups.',      skills: ['Figma', 'CSS', 'UX Research'],          avatar: 'S' },
  { id: 3,  username: 'mike_data',      bio: 'Data scientist building predictive models for e-commerce.',       skills: ['Python', 'SQL', 'TensorFlow'],          avatar: 'M' },
  { id: 4,  username: 'emily_mobile',   bio: 'iOS developer creating accessible applications.',                  skills: ['Swift', 'Objective-C', 'UI Kit'],       avatar: 'E' },
  { id: 5,  username: 'chris_cloud',    bio: 'DevOps engineer scaling infrastructure.',                          skills: ['AWS', 'Docker', 'Kubernetes'],          avatar: 'C' },
  { id: 6,  username: 'jess_marketing', bio: 'Growth hacker connecting tech with people.',                       skills: ['SEO', 'Content', 'Analytics'],          avatar: 'J' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserCard({ user, similarity }: { user: MockUser; similarity?: number }) {
  const label = similarity !== undefined ? similarityLabel(similarity) : null

  return (
    <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:bg-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group cursor-pointer">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-teal-400 group-hover:bg-teal-500/10 group-hover:text-teal-300 transition-colors border border-slate-700/50">
          {user.avatar}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-200 group-hover:text-teal-400 transition-colors truncate">
            @{user.username}
          </h3>
          {label && (
            <p className={`text-xs font-medium ${label.color} flex items-center gap-1 mt-0.5`}>
              <Zap className="w-3 h-3" />
              {label.text}
              <span className="ml-auto text-slate-500">
                {Math.round(similarity! * 100)}%
              </span>
            </p>
          )}
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [userId, setUserId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'discover' | 'matches'>('discover')
  const [matchState, setMatchState] = useState<MatchState>('idle')
  const [matchError, setMatchError] = useState('')
  const [matchedUsers, setMatchedUsers] = useState<Array<{ user: MockUser; similarity: number }>>([])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) window.location.href = '/login'
      setUserId(user?.id ?? null)
    })
  }, [])

  const handleFindMatches = useCallback(async () => {
    if (!userId) return
    setMatchState('loading')
    setMatchError('')
    setActiveTab('matches')

    try {
      const { matches } = await findMatches({ user_id: userId, top_k: 6 })
      setMatchedUsers(
        matches.map(m => ({ user: resolveUser(m), similarity: m.similarity }))
      )
      setMatchState('success')
    } catch (err: unknown) {
      setMatchError(err instanceof Error ? err.message : 'Could not load matches.')
      setMatchState('error')
    }
  }, [userId])

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-sans selection:bg-teal-500/30">
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="flex justify-between items-center px-8 py-6 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="w-10" />
          <h1 className="text-5xl tracking-tighter text-white">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.8)]" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">

            {/* ── AI Search + Find Matches CTA ──────────────────────────── */}
            <div className="relative mb-8 max-w-2xl mx-auto group mt-4">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative flex items-center bg-slate-900 border border-slate-700 hover:border-teal-500/50 rounded-full p-2 pl-6 shadow-lg transition-all">
                <input
                  type="text"
                  placeholder="I'm building…"
                  className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-500 text-lg"
                />
                <button className="bg-teal-500 hover:bg-teal-400 text-slate-950 p-3 rounded-full transition-colors ml-2 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* ── Find Matches Hero Button ──────────────────────────────── */}
            <div className="mb-10 max-w-2xl mx-auto">
              <button
                id="find-matches-btn"
                onClick={handleFindMatches}
                disabled={matchState === 'loading' || !userId}
                className="
                  w-full relative overflow-hidden flex items-center justify-center gap-3
                  px-6 py-4 rounded-2xl font-semibold text-base
                  bg-gradient-to-r from-teal-600 to-blue-600
                  hover:from-teal-500 hover:to-blue-500
                  disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed
                  text-white shadow-[0_4px_32px_-4px_rgba(20,184,166,0.4)]
                  hover:shadow-[0_4px_40px_-4px_rgba(20,184,166,0.6)]
                  transition-all duration-300 group
                "
              >
                {/* Shimmer layer */}
                <span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                {matchState === 'loading' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Finding your matches…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Find AI Matches
                    <span className="text-white/60 text-sm font-normal">— powered by embeddings</span>
                  </>
                )}
              </button>
            </div>

            {/* ── Tabs ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-1 mb-6 bg-slate-900/50 p-1 rounded-xl border border-slate-800 self-start w-fit">
              {(['discover', 'matches'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all
                    ${activeTab === tab
                      ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                      : 'text-slate-400 hover:text-slate-200'}
                  `}
                >
                  {tab === 'discover' ? <Users className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                  {tab}
                  {tab === 'matches' && matchState === 'success' && (
                    <span className="ml-1 px-1.5 py-0.5 bg-teal-500 text-slate-950 text-xs font-bold rounded-full">
                      {matchedUsers.length}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {DISCOVER_USERS.map(u => (
                      <UserCard key={u.id} user={u} />
                    ))}
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
                          <span className="text-teal-400 font-semibold">Find AI Matches</span>{' '}
                          to get started.
                        </p>
                      </div>
                    )}

                    {/* Loading */}
                    {matchState === 'loading' && (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-400">
                        <Loader2 className="w-10 h-10 text-teal-400 animate-spin mb-4" />
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
                    {matchState === 'success' && matchedUsers.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                        <Users className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No matches found</p>
                        <p className="text-sm mt-1">
                          Try syncing your GitHub data first.
                        </p>
                      </div>
                    )}

                    {matchState === 'success' && matchedUsers.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500 mb-4">
                          {matchedUsers.length} collaborators ranked by embedding similarity
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                          {matchedUsers.map(({ user, similarity }) => (
                            <UserCard key={user.id} user={user} similarity={similarity} />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* ── Right Sidebar (Filters) ────────────────────────────── */}
              <aside className="w-full lg:w-64 shrink-0">
                <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 sticky top-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Filter className="w-4 h-4 text-teal-400" />
                    <h3 className="font-semibold text-slate-200">Quick Filters</h3>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Roles
                      </h4>
                      <div className="space-y-3">
                        {['Engineering', 'Design', 'Product', 'Marketing'].map(role => (
                          <label key={role} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-4 h-4 rounded border border-slate-600 bg-slate-800 group-hover:border-teal-500 transition-colors flex items-center justify-center" />
                            <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                              {role}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                        Commitment
                      </h4>
                      <div className="space-y-3">
                        {['Full-time', 'Part-time', 'Weekends'].map(time => (
                          <label key={time} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-4 h-4 rounded border border-slate-600 bg-slate-800 group-hover:border-teal-500 transition-colors" />
                            <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">
                              {time}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Shortcut to re-run matching */}
                  <div className="mt-8 pt-6 border-t border-slate-800">
                    <button
                      onClick={handleFindMatches}
                      disabled={matchState === 'loading' || !userId}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 text-teal-400 rounded-xl text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {matchState === 'loading' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      Find My Matches
                    </button>
                  </div>
                </div>
              </aside>

            </div>
          </div>
        </div>
      </main>
    </div>
  )
}