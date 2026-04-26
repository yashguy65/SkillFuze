import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export const metadata = {
  title: 'My Profile | SkillFuze',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const handle = user.user_metadata?.user_name || user.email?.split('@')[0] || 'user'
  const avatar = user.user_metadata?.avatar_url

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-50 font-sans selection:bg-teal-500/30">
      <main className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] flex flex-col items-center">
        {/* Header */}
        <h1 className="text-3xl font-bold tracking-tight mb-6">@{handle}</h1>
        
        <div className="w-32 h-32 rounded-full overflow-hidden mb-10 border-4 border-slate-800 shadow-[0_0_20px_rgba(20,184,166,0.15)] flex items-center justify-center bg-slate-800">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt={`@${handle}`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl">🍄</span>
          )}
        </div>

        {/* Skills Section */}
        <div className="w-full mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">Skills</h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-4 py-1.5 bg-teal-500/10 text-teal-400 rounded-full text-sm font-medium border border-teal-500/20">React</span>
            <span className="px-4 py-1.5 bg-teal-500/10 text-teal-400 rounded-full text-sm font-medium border border-teal-500/20">TypeScript</span>
            <span className="px-4 py-1.5 bg-teal-500/10 text-teal-400 rounded-full text-sm font-medium border border-teal-500/20">Next.js</span>
            <span className="px-4 py-1.5 bg-teal-500/10 text-teal-400 rounded-full text-sm font-medium border border-teal-500/20">UI/UX</span>
          </div>
        </div>

        {/* Tags Section */}
        <div className="w-full mb-10">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 ml-1">Tags</h2>
          <div className="flex flex-wrap gap-2">
            <span className="px-4 py-1.5 bg-transparent text-slate-300 rounded-full text-sm font-medium border border-slate-700">Looking for Co-founder</span>
            <span className="px-4 py-1.5 bg-transparent text-slate-300 rounded-full text-sm font-medium border border-slate-700">Night Owl</span>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full space-y-3 pt-6 border-t border-slate-800">
          <button className="flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors group w-full text-left text-sm font-medium">
            <span className="text-teal-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span> Change Password
          </button>
          <button className="flex items-center gap-2 text-slate-400 hover:text-teal-400 transition-colors group w-full text-left text-sm font-medium">
            <span className="text-teal-500 font-bold group-hover:translate-x-1 transition-transform">&gt;</span> Add LinkedIn
          </button>
        </div>
      </main>
    </div>
  )
}
