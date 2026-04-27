import { NextRequest, NextResponse } from 'next/server'

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${AI_SERVICE_URL}/api/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { detail: data.detail || res.statusText },
        { status: res.status }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[API /ai/ingest] proxy error:', error)
    return NextResponse.json(
      { detail: 'AI service unreachable' },
      { status: 502 }
    )
  }
}
