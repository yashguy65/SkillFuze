'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getPersona, ingestTags } from '@/lib/ai-service'
import { GitBranch, Loader2, ExternalLink, Plus, X } from 'lucide-react'

export default function ProfilePage() {
  const [user, setUser] = useState<{
    id: string
    email: string | undefined
    user_metadata: Record<string, string>
  } | null>(null)

  const [skills, setSkills] = useState<string[]>([])
  const [hiddenTags, setHiddenTags] = useState<string[]>([])
  
  // Persona State
  const [personaRole, setPersonaRole] = useState<string>('')
  const [personaSummary, setPersonaSummary] = useState<string>('')
  const [personaHighlights, setPersonaHighlights] = useState<string[]>([])
  
  const [isEditingPersona, setIsEditingPersona] = useState(false)
  const [editRole, setEditRole] = useState('')
  const [editSummary, setEditSummary] = useState('')
  const [isSavingPersona, setIsSavingPersona] = useState(false)

  // Bio State
  const [bio, setBio] = useState<string>('')
  const [isEditingBio, setIsEditingBio] = useState(false)
  const [editBioVal, setEditBioVal] = useState('')
  const [isSavingBio, setIsSavingBio] = useState(false)

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
        if (user.user_metadata?.hidden_tags) {
          setHiddenTags(user.user_metadata.hidden_tags)
        }
        if (user.user_metadata?.preference) {
          setPreference(user.user_metadata.preference)
        }
        if (user.user_metadata?.bio) {
          setBio(user.user_metadata.bio)
        }

        getPersona({ user_id: user.id })
          .then(data => {
            setSkills(data.skills)
            setPersonaHighlights(data.highlights || [])
            setPersonaRole(user.user_metadata?.custom_persona_role || data.role || 'Developer')
            setPersonaSummary(user.user_metadata?.custom_persona_summary || data.summary || '')
          })
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

  const handleAddTag = async () => {
    if (!newTagVal.trim() || !user) return

    const tag = newTagVal.trim()
    const tagLower = tag.toLowerCase()

    // If exact same casing exists, do nothing
    if (customTags.includes(tag)) {
      setNewTagVal('')
      setIsAddingTag(false)
      return
    }

    // Filter out any existing case-variants and unhide if it was hidden
    const filteredCustomTags = customTags.filter(t => t.toLowerCase() !== tagLower)
    const updatedHiddenTags = hiddenTags.filter(t => t.toLowerCase() !== tagLower)
    const updatedTags = [...filteredCustomTags, tag]

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { custom_tags: updatedTags, hidden_tags: updatedHiddenTags }
    })

    if (!error) {
      setCustomTags(updatedTags)
      setHiddenTags(updatedHiddenTags)
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

    const tagToRemoveLower = tagToRemove.toLowerCase()

    // Remove from customTags regardless of casing
    const updatedCustomTags = customTags.filter(tag => tag.toLowerCase() !== tagToRemoveLower)
    const isCustomTag = updatedCustomTags.length !== customTags.length

    let updatedHiddenTags = [...hiddenTags]
    const hasSkill = skills.some(tag => tag.toLowerCase() === tagToRemoveLower)

    if (hasSkill) {
      const skillToRemove = skills.find(tag => tag.toLowerCase() === tagToRemoveLower)
      if (skillToRemove && !hiddenTags.includes(skillToRemove)) {
        updatedHiddenTags = [...hiddenTags, skillToRemove]
      }
    }

    if (!isCustomTag && !hasSkill) {
      return // Should not happen
    }

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: { custom_tags: updatedCustomTags, hidden_tags: updatedHiddenTags }
    })

    if (!error) {
      setCustomTags(updatedCustomTags)
      setHiddenTags(updatedHiddenTags)

      if (isCustomTag) {
        // Sync updated tags to embeddings database
        try {
          await ingestTags({ user_id: user.id, tags: updatedCustomTags })
        } catch (err) {
          console.error('Failed to sync tags to AI service', err)
        }
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

  const handleSavePersona = async () => {
    if (!user) return
    setIsSavingPersona(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        custom_persona_role: editRole,
        custom_persona_summary: editSummary
      }
    })
    
    if (!error) {
      setPersonaRole(editRole)
      setPersonaSummary(editSummary)
      setIsEditingPersona(false)
    }
    setIsSavingPersona(false)
  }

  const handleSaveBio = async () => {
    if (!user) return
    setIsSavingBio(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({
      data: {
        bio: editBioVal
      }
    })
    
    if (!error) {
      setBio(editBioVal)
      setIsEditingBio(false)
    }
    setIsSavingBio(false)
  }

  return (
    <div className="h-screen flex overflow-hidden bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
      <main className="flex flex-col md:flex-row w-full h-full overflow-hidden">

        {/* Left Column (Username, Avatar, Links) */}
        <aside className="w-full md:w-64 lg:w-72 shrink-0 bg-slate-900/70 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col items-center px-6 pt-12 pb-8 gap-4 h-full overflow-hidden">
          {/* Header */}
          <h1 className="text-2xl font-bold tracking-tight w-full text-center truncate">@{handle}</h1>

          {/* Avatar */}
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-800 shadow-[0_0_24px_rgba(59,130,246,0.2)] flex items-center justify-center bg-slate-800 shrink-0">
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
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors"
            >
              <GitBranch className="w-4 h-4" />
              github.com/{githubUsername}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </aside>

        {/* Right Column */}
        <section className="flex-1 h-full overflow-y-auto p-8 lg:p-12">
          {/* ── Persona Section ───────────────────────────────────── */}
          <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
                AI Persona
              </h2>
              {!isEditingPersona && (
                <button
                  onClick={() => {
                    setEditRole(personaRole)
                    setEditSummary(personaSummary)
                    setIsEditingPersona(true)
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingPersona ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block font-medium">Role</label>
                  <input
                    type="text"
                    value={editRole}
                    onChange={e => setEditRole(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block font-medium">Summary</label>
                  <textarea
                    value={editSummary}
                    onChange={e => setEditSummary(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditingPersona(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSavePersona}
                    disabled={isSavingPersona}
                    className="px-4 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50 border border-blue-500/20"
                  >
                    {isSavingPersona && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-500/10 to-teal-500/10 text-blue-400 rounded-full text-xs font-medium border border-blue-500/20 mb-3">
                  <span className="text-[10px]">✨</span> {personaRole || 'Developer'}
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4">
                  {personaSummary || "Sync your GitHub or LinkedIn to generate a rich AI persona."}
                </p>
                
                {personaHighlights.length > 0 && (
                  <div className="space-y-2.5 border-t border-slate-800/50 pt-4 mt-2">
                    {personaHighlights.map((hl, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                        <div className="w-1 h-1 rounded-full bg-blue-500/50 mt-1.5 flex-shrink-0" />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Bio Section ───────────────────────────────────── */}
          <div className="w-full mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider ml-1">
                Bio
              </h2>
              {!isEditingBio && (
                <button
                  onClick={() => {
                    setEditBioVal(bio)
                    setIsEditingBio(true)
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditingBio ? (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4">
                <div>
                  <textarea
                    value={editBioVal}
                    onChange={e => setEditBioVal(e.target.value)}
                    rows={4}
                    placeholder="Tell us about yourself, your interests, and what you are building..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors resize-none font-sans"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsEditingBio(false)}
                    className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveBio}
                    disabled={isSavingBio}
                    className="px-4 py-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50 border border-blue-500/20"
                  >
                    {isSavingBio && <Loader2 className="w-3 h-3 animate-spin" />}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 shadow-sm">
                <p className="text-sm text-slate-300 leading-relaxed font-light">
                  {bio || "Add a bio to introduce yourself to the community."}
                </p>
              </div>
            )}
          </div>

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
              {(() => {
                const uniqueTagsMap = new Map<string, string>()
                // Add skills first
                skills.forEach(tag => uniqueTagsMap.set(tag.toLowerCase(), tag))
                // Custom tags override skills (so 'Python' overrides 'python')
                customTags.forEach(tag => uniqueTagsMap.set(tag.toLowerCase(), tag))

                return Array.from(uniqueTagsMap.values())
                  .filter(tag => !hiddenTags.some(ht => ht.toLowerCase() === tag.toLowerCase()))
                  .map(tag => (
                    <span
                      key={`tag-${tag}`}
                      className="group relative px-4 py-1.5 bg-blue-500/10 text-blue-400 rounded-full text-sm font-medium border border-blue-500/20 hover:bg-blue-500/20 transition-colors flex items-center"
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
                  ))
              })()}
              {skills.length === 0 && customTags.length === 0 && (
                <span className="text-sm text-slate-500 italic ml-1">
                  Sync GitHub or upload LinkedIn PDF in Settings to add tags
                </span>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
