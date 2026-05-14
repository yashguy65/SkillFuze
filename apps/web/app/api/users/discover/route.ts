import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY! // service role key
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    if (authError) throw authError

    const { data: chunks, error: chunksError } = await supabase
      .from('github_chunks')
      .select('user_id, metadata')

    if (chunksError) throw chunksError

    // Aggregate skills from chunks
    const userSkills: Record<string, Record<string, number>> = {}
    chunks?.forEach(chunk => {
      const langs = chunk.metadata?.languages || []
      if (!userSkills[chunk.user_id]) userSkills[chunk.user_id] = {}
      langs.forEach((lang: string) => {
        userSkills[chunk.user_id][lang] = (userSkills[chunk.user_id][lang] || 0) + 1
      })
    })

    const discoverUsers = authData.users.map((u) => {
      // Get top 3-5 skills
      const skillCounts = userSkills[u.id] || {}
      const sortedSkills = Object.entries(skillCounts)
        .sort((a, b) => b[1] - a[1])
        .map(entry => entry[0])
        .slice(0, 5)

      const fallbackSkills = u.user_metadata?.custom_tags || []
      const finalSkills = sortedSkills.length > 0 ? sortedSkills : fallbackSkills

      return {
        id: u.id, // Using string id instead of number now
        username: u.user_metadata?.user_name || u.email?.split('@')[0] || 'user',
        bio: u.user_metadata?.bio || 'Exploring new opportunities and building awesome projects.',
        skills: finalSkills,
        avatar: u.user_metadata?.avatar_url || '',
        preference: u.user_metadata?.preference || 'Just exploring'
      }
    })

    return NextResponse.json({ users: discoverUsers })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
