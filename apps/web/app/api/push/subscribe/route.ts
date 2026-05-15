import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { subscription?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.subscription) {
    return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
  }

  // Upsert — one subscription per user (latest device wins)
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      { user_id: user.id, subscription: body.subscription },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[push/subscribe]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
