// All AI service calls go through Next.js API routes (server-side proxy).
// This avoids CORS issues and keeps the AI service URL private.

// ── Ingest ────────────────────────────────────────────────────────────────────

export interface IngestRequest {
  user_id: string
  github_username: string
  token?: string
}

export interface IngestResponse {
  chunks_stored: number
  extracted_tags?: string[]
}

export async function syncGitHub(payload: IngestRequest): Promise<IngestResponse> {
  const res = await fetch('/api/ai/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to sync GitHub data')
  }

  return res.json() as Promise<IngestResponse>
}

// ── LinkedIn Ingest ───────────────────────────────────────────────────────────

export async function syncLinkedIn(userId: string, file: File): Promise<IngestResponse> {
  const formData = new FormData()
  formData.append('user_id', userId)
  formData.append('file', file)

  const res = await fetch('/api/ai/linkedin', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to sync LinkedIn data')
  }

  return res.json() as Promise<IngestResponse>
}

// ── LinkedIn Profile (OIDC) Ingest ───────────────────────────────────────────

export interface LinkedInProfileRequest {
  name?: string
  headline?: string
  skills?: string[]
}

/**
 * Sync LinkedIn identity metadata (from OIDC, no PDF needed).
 * The server-side proxy always uses the authenticated session's user_id.
 */
export async function syncLinkedInProfile(
  payload: LinkedInProfileRequest = {}
): Promise<IngestResponse> {
  const res = await fetch('/api/ai/linkedin-profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to sync LinkedIn profile')
  }

  return res.json() as Promise<IngestResponse>
}

// ── Tags Ingest ───────────────────────────────────────────────────────────────

export interface TagsIngestRequest {
  user_id: string
  tags: string[]
}

export interface TagsIngestResponse {
  success: boolean
  chunks_stored: number
}

export async function ingestTags(payload: TagsIngestRequest): Promise<TagsIngestResponse> {
  const res = await fetch('/api/ai/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to ingest tags')
  }

  return res.json() as Promise<TagsIngestResponse>
}

// ── Match ─────────────────────────────────────────────────────────────────────

export interface MatchRequest {
  user_id: string
  top_k?: number
  custom_tags?: string[]
  search_query?: string
}

export interface MatchResult {
  user_id: string
  similarity: number
  github_username: string
  skills: string[]
}

export interface MatchResponse {
  matches: MatchResult[]
}

export async function findMatches(payload: MatchRequest): Promise<MatchResponse> {
  const res = await fetch('/api/ai/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to find matches')
  }

  return res.json() as Promise<MatchResponse>
}

// ── Persona ───────────────────────────────────────────────────────────────────

export interface PersonaRequest {
  user_id: string
}

export interface PersonaResponse {
  summary: string
  role: string
  skills: string[]
  highlights: string[]
  embedding: number[]
}

export async function getPersona(payload: PersonaRequest): Promise<PersonaResponse> {
  const res = await fetch('/api/ai/persona', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to fetch persona')
  }

  return res.json() as Promise<PersonaResponse>
}

// ── Purge ─────────────────────────────────────────────────────────────────────

export interface PurgeRequest {
  user_id: string
}

export interface PurgeResponse {
  success: boolean
  chunks_deleted: number
}

export async function purgeData(payload: PurgeRequest): Promise<PurgeResponse> {
  const res = await fetch('/api/ai/purge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail ?? 'Failed to purge data')
  }

  return res.json() as Promise<PurgeResponse>
}

