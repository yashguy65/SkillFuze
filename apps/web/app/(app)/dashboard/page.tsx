'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { findMatches, MatchResult } from '@/lib/ai-service'
import Link from 'next/link'
import { Bell, Search, Sparkles, Loader2, AlertTriangle, RefreshCw, Users, Zap, Filter, MessageSquare, X } from 'lucide-react'
import { useNotifications } from '../notifications-context'

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
  'Just exploring',
  'Looking for a co-founder',
  'Looking for a teammate',
  'Open to collaborate'
]

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Card used in the "Discover" tab */
function DiscoverCard({ user, onClick }: { user: DiscoverUser; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:bg-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group cursor-pointer"
    >
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
        <Link
          href={`/messages?user_id=${user.id}`}
          onClick={(e) => e.stopPropagation()}
          className="p-2 text-slate-400 hover:text-blue-400 bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors self-start shrink-0"
        >
          <MessageSquare className="w-4 h-4" />
        </Link>
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

/** Expanded modal overlay shown when a DiscoverCard is clicked */
function UserModal({ user, onClose }: { user: DiscoverUser; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_30px_80px_-10px_rgba(0,0,0,0.7)] p-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Avatar + name */}
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-blue-400 overflow-hidden shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            {user.avatar && user.avatar.startsWith('http') ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
            ) : (
              user.username?.[0]?.toUpperCase() ?? 'U'
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">@{user.username}</h2>
            {user.preference && (
              <span className="inline-flex items-center gap-1.5 mt-1 px-3 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full text-xs font-medium">
                {user.preference}
              </span>
            )}
          </div>
        </div>

        {/* Bio / Persona */}
        {user.bio && (
          <div className="mb-6">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">About</p>
            <p className="text-sm text-slate-300 leading-relaxed">{user.bio}</p>
          </div>
        )}

        {/* Tags / Skills */}
        {user.skills.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Skills &amp; Tags</p>
            <div className="flex flex-wrap gap-2">
              {user.skills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/messages?user_id=${user.id}`}
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold rounded-xl transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]"
        >
          <MessageSquare className="w-4 h-4" />
          Send a message
        </Link>
      </div>
    </div>
  )
}

/** Card used for real AI match results */
function MatchCard({ match, discoverUsers, onClick }: { match: MatchResult; discoverUsers: DiscoverUser[]; onClick: () => void }) {
  const label = similarityLabel(match.similarity)

  const matchedUser = discoverUsers.find(u => u.id === match.user_id)

  // If github_username is a UUID, it means it's a fallback to the user_id (since python ai-service returns github_username = username_map.get(uid, uid))
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

  const rawGithubUsername = match.github_username && !isUuid(match.github_username) ? match.github_username : null
  const displayName = matchedUser?.username || rawGithubUsername || match.user_id.substring(0, 8)

  const avatarUrl = matchedUser?.avatar || (rawGithubUsername ? `https://github.com/${rawGithubUsername}.png?size=96` : null)

  return (
    <div
      onClick={onClick}
      className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:bg-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group cursor-pointer"
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-blue-400 group-hover:bg-blue-500/10 group-hover:text-blue-300 transition-colors border border-slate-700/50 overflow-hidden">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-full h-full object-cover"
              onError={(e) => {
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
            {rawGithubUsername ? (
              <a
                href={`https://github.com/${rawGithubUsername}`}
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
        <Link
          href={`/messages?user_id=${match.user_id}`}
          onClick={(e) => e.stopPropagation()}
          className="p-2 text-slate-400 hover:text-blue-400 bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors self-start shrink-0"
        >
          <MessageSquare className="w-4 h-4" />
        </Link>
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

/** Expanded modal for AI match results */
function MatchModal({ match, discoverUsers, onClose }: { match: MatchResult; discoverUsers: DiscoverUser[]; onClose: () => void }) {
  const label = similarityLabel(match.similarity)

  const matchedUser = discoverUsers.find(u => u.id === match.user_id)

  // If github_username is a UUID, it means it's a fallback to the user_id (since python ai-service returns github_username = username_map.get(uid, uid))
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)

  const rawGithubUsername = match.github_username && !isUuid(match.github_username) ? match.github_username : null
  const displayName = matchedUser?.username || rawGithubUsername || match.user_id.substring(0, 8)

  const avatarUrl = matchedUser?.avatar || (rawGithubUsername ? `https://github.com/${rawGithubUsername}.png?size=96` : null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-[0_30px_80px_-10px_rgba(0,0,0,0.7)] p-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Avatar + name + score */}
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-2xl font-bold text-blue-400 overflow-hidden shrink-0 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget
                  el.style.display = 'none'
                  el.parentElement!.textContent = displayName[0]?.toUpperCase() ?? '?'
                }}
              />
            ) : (
              displayName[0]?.toUpperCase() ?? '?'
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-bold text-white truncate">
              {rawGithubUsername ? (
                <a
                  href={`https://github.com/${rawGithubUsername}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-400 transition-colors"
                >
                  @{displayName}
                </a>
              ) : (
                `@${displayName}`
              )}
            </h2>
            <p className={`text-sm font-medium ${label.color} flex items-center gap-1.5 mt-1`}>
              <Zap className="w-3.5 h-3.5" />
              {label.text}
              <span className="ml-1 text-slate-500 font-normal">{Math.round(match.similarity * 100)}% match</span>
            </p>
          </div>
        </div>

        {/* Skills / Tags */}
        {match.skills.length > 0 && (
          <div className="mb-8">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Skills &amp; Tags</p>
            <div className="flex flex-wrap gap-2">
              {match.skills.map(skill => (
                <span
                  key={skill}
                  className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-full border border-blue-500/20"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <Link
          href={`/messages?user_id=${match.user_id}`}
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full py-3 bg-blue-500 hover:bg-blue-400 text-slate-950 font-semibold rounded-xl transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]"
        >
          <MessageSquare className="w-4 h-4" />
          Send a message
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { totalUnread } = useNotifications()
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
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([])
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)
  const [isActivityOpen, setIsActivityOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<DiscoverUser | null>(null)
  const [selectedMatch, setSelectedMatch] = useState<MatchResult | null>(null)

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
        top_k: 100,
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
      {/* User detail modal */}
      {selectedUser && <UserModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
      {/* Match detail modal */}
      {selectedMatch && <MatchModal match={selectedMatch} discoverUsers={discoverUsers} onClose={() => setSelectedMatch(null)} />}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <header className="flex justify-between items-center px-8 py-6 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="w-10" />
          <h1 className="text-5xl tracking-tighter text-white">Dashboard</h1>
          <div className="flex items-center gap-4 relative">
            <button
              onClick={() => setIsActivityOpen((open) => !open)}
              className="p-2 text-slate-400 hover:text-white transition-colors relative"
              title="Activity"
            >
              <Bell className="w-5 h-5" />
              {(totalUnread > 0 || matchState === 'success') && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
              )}
            </button>

            {isActivityOpen && (
              <div className="absolute right-0 top-10 w-80 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden z-20">
                <div className="px-4 py-3 border-b border-slate-800">
                  <p className="text-sm font-semibold text-slate-100">Activity</p>
                </div>
                <div className="p-2 space-y-1">
                  <Link
                    href="/messages"
                    className="flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-slate-800 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-200">
                        {totalUnread > 0 ? `${totalUnread} unread message${totalUnread === 1 ? '' : 's'}` : 'No unread messages'}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Chat alerts and browser push notifications live here.
                      </span>
                    </span>
                  </Link>
                  <button
                    onClick={() => {
                      setIsActivityOpen(false)
                      void handleFindMatches()
                    }}
                    className="w-full flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-slate-800 transition-colors text-left"
                  >
                    <Sparkles className="w-4 h-4 mt-0.5 text-blue-400 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-200">
                        {matchState === 'success' ? `${matchedResults.length} AI matches ready` : 'Find fresh AI matches'}
                      </span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Uses your GitHub, LinkedIn, and tag signals.
                      </span>
                    </span>
                  </button>
                  <div className="flex items-start gap-3 rounded-lg px-3 py-3">
                    <Users className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-400">Community activity soon</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Shared tags, filters, and collaboration updates will land here.
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full min-w-0 overflow-x-hidden">
          <div className="max-w-6xl mx-auto w-full min-w-0">

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
            <div className="flex flex-col lg:flex-row gap-8 w-full min-w-0">

              {/* ── User Grid ──────────────────────────────────────────── */}
              <div className="flex-1 min-w-0">

                {/* DISCOVER TAB */}
                {activeTab === 'discover' && (
                  <div className="pb-12">
                    {!isLoadingDiscover && discoverUsers.length > 0 && (
                      <div className="mb-8">
                        <button
                          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${isFiltersOpen || selectedPreferences.length > 0
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-300'
                            }`}
                        >
                          <Filter className="w-4 h-4" />
                          Filters {selectedPreferences.length > 0 && `(${selectedPreferences.length})`}
                        </button>

                        <div className={`grid transition-all duration-300 ease-in-out ${isFiltersOpen ? 'grid-rows-[1fr] opacity-100 mt-4' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="flex flex-wrap items-center gap-2 p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
                              <span className="text-sm text-slate-400 font-medium mr-2">Filter by:</span>
                              {PREFERENCES.map(pref => {
                                const isSelected = selectedPreferences.includes(pref)
                                return (
                                  <button
                                    key={pref}
                                    onClick={() => {
                                      setSelectedPreferences(prev =>
                                        prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref]
                                      )
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${isSelected
                                      ? 'bg-blue-500/20 text-blue-400 border-blue-500/50'
                                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-slate-600 hover:text-slate-300'
                                      }`}
                                  >
                                    {pref}
                                  </button>
                                )
                              })}
                              {selectedPreferences.length > 0 && (
                                <button
                                  onClick={() => setSelectedPreferences([])}
                                  className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-300 transition-colors ml-2"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-12">
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
                        (selectedPreferences.length > 0 ? selectedPreferences : PREFERENCES).map(pref => {
                          const users = discoverUsers.filter(u => u.preference === pref && u.id !== userId)
                          if (users.length === 0) return null

                          return (
                            <div key={pref} className="mb-10">
                              <h2 className="text-xl font-bold text-slate-200 mb-6 pl-2 border-l-4 border-blue-500">{pref}</h2>
                              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                                {users.map(u => (
                                  <DiscoverCard key={u.id} user={u} onClick={() => setSelectedUser(u)} />
                                ))}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
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
                        <p className="font-medium">Generating Matches…</p>
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
                            <MatchCard key={match.user_id} match={match} discoverUsers={discoverUsers} onClick={() => setSelectedMatch(match)} />
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


