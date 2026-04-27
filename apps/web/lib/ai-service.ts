const AI_SERVICE_URL =
  process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000'

// ── Ingest ────────────────────────────────────────────────────────────────────

export interface IngestRequest {
  user_id: string
  github_username: string
  token?: string
}

export interface IngestResponse {
  chunks_stored: number
}

export async function syncGitHub(payload: IngestRequest): Promise<IngestResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/api/v1/ingest`, {
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

// ── Match ─────────────────────────────────────────────────────────────────────

export interface MatchRequest {
  user_id: string
  top_k?: number
}

export interface MatchResult {
  user_id: string
  similarity: number
}

export interface MatchResponse {
  matches: MatchResult[]
}

export async function findMatches(payload: MatchRequest): Promise<MatchResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/api/v1/match`, {
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
  skills: string[]
  embedding: number[]
}

export async function getPersona(payload: PersonaRequest): Promise<PersonaResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/api/v1/persona`, {
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
