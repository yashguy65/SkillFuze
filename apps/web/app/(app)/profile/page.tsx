import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Image from 'next/image'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const handle = user.user_metadata.user_name
  const avatar = user.user_metadata.avatar_url

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Profile</h1>
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          {/* Display the GitHub Photo */}
          <img
            src={avatar}
            alt="Profile Photo"
            className="w-20 h-20 bg-gray-600 rounded-full object-cover"
          />
          <div>
            <h2 className="text-xl font-semibold">{user.user_metadata.full_name || 'User'}</h2>
            <p className="text-gray-400">@{handle}</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-2 border-b border-gray-700 pb-2">Skills & Tags</h3>
            <div className="flex gap-2 flex-wrap">
              <span className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">React</span>
              <span className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">TypeScript</span>
              <span className="px-3 py-1 bg-blue-900 text-blue-200 rounded-full text-sm">Next.js</span>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2 border-b border-gray-700 pb-2">AI Persona</h3>
            <p className="text-gray-300">
              A placeholder for the AI generated summary of this user's professional persona, based on their activity and questionnaire answers.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
