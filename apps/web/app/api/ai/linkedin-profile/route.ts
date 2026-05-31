import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      user_id?: string
      name?: string
      headline?: string
      skills?: string[]
    }

    // Always use the authenticated user's ID (ignore any client-supplied user_id)
    const payload = {
      user_id: user.id,
      name: body.name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      headline: body.headline ?? null,
      skills: body.skills ?? [],
    }

    const aiServiceUrl =
      process.env.AI_SERVICE_URL ||
      process.env.NEXT_PUBLIC_AI_SERVICE_URL ||
      'http://localhost:8000'

    const response = await fetch(`${aiServiceUrl}/api/v1/ingest/linkedin-profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('AI Service Error:', response.status, errorText)
      return NextResponse.json(
        { detail: `AI service returned status ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('LinkedIn profile sync error:', error)
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    )
  }
}
