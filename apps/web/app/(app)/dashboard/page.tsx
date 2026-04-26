import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Bell, Search, Filter } from 'lucide-react'

export const metadata = {
  title: 'Dashboard | SkillFuze',
}

export default async function Dashboard() {
  const supabase = await createClient()
  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Mock data for user cards
  const mockUsers = [
    { id: 1, username: 'alex_dev', bio: 'Full-stack builder passionate about AI and edge computing.', skills: ['React', 'Node.js', 'Python'], avatar: 'A' },
    { id: 2, username: 'sarah_design', bio: 'UX/UI designer looking to collaborate on fintech startups.', skills: ['Figma', 'CSS', 'UX Research'], avatar: 'S' },
    { id: 3, username: 'mike_data', bio: 'Data scientist building predictive models for e-commerce.', skills: ['Python', 'SQL', 'TensorFlow'], avatar: 'M' },
    { id: 4, username: 'emily_mobile', bio: 'iOS developer creating accessible applications.', skills: ['Swift', 'Objective-C', 'UI Kit'], avatar: 'E' },
    { id: 5, username: 'chris_cloud', bio: 'DevOps engineer scaling infrastructure.', skills: ['AWS', 'Docker', 'Kubernetes'], avatar: 'C' },
    { id: 6, username: 'jess_marketing', bio: 'Growth hacker connecting tech with people.', skills: ['SEO', 'Content', 'Analytics'], avatar: 'J' },
  ];

  const userInitial = user.user_metadata?.user_name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="flex h-screen bg-slate-950 text-slate-50 font-sans selection:bg-teal-500/30">
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Top Bar */}
        <header className="flex justify-between items-center px-8 py-6 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-10">
          <div className="w-10"></div> {/* Spacer for centering */}
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.8)]"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-blue-500 flex items-center justify-center text-sm font-bold shadow-md">
              {userInitial}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* AI Search Bar */}
            <div className="relative mb-12 max-w-2xl mx-auto group mt-4">
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="relative flex items-center bg-slate-900 border border-slate-700 hover:border-teal-500/50 rounded-full p-2 pl-6 shadow-lg transition-all">
                <input 
                  type="text" 
                  placeholder="I'm building..." 
                  className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-500 text-lg"
                />
                <button className="bg-teal-500 hover:bg-teal-400 text-slate-950 p-3 rounded-full transition-colors ml-2 shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row gap-8">
              {/* User Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {mockUsers.map(u => (
                  <div key={u.id} className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-6 hover:bg-slate-800 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] group cursor-pointer">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-teal-400 group-hover:bg-teal-500/10 group-hover:text-teal-300 transition-colors border border-slate-700/50">
                        {u.avatar}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-200 group-hover:text-teal-400 transition-colors">@{u.username}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mb-6 line-clamp-2 font-light">
                      {u.bio}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {u.skills.map(skill => (
                        <span key={skill} className="px-3 py-1 bg-slate-950 text-xs text-slate-300 rounded-full font-medium border border-slate-800 group-hover:border-slate-700 transition-colors">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Right Sidebar (Filters) */}
              <aside className="w-full lg:w-64 shrink-0">
                <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 sticky top-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Filter className="w-4 h-4 text-teal-400" />
                    <h3 className="font-semibold text-slate-200">Quick Filters</h3>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Roles</h4>
                      <div className="space-y-3">
                        {['Engineering', 'Design', 'Product', 'Marketing'].map(role => (
                          <label key={role} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-4 h-4 rounded border border-slate-600 bg-slate-800 group-hover:border-teal-500 transition-colors flex items-center justify-center">
                              {/* Custom checkbox styled */}
                            </div>
                            <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">{role}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Commitment</h4>
                      <div className="space-y-3">
                        {['Full-time', 'Part-time', 'Weekends'].map(time => (
                          <label key={time} className="flex items-center gap-3 cursor-pointer group">
                            <div className="w-4 h-4 rounded border border-slate-600 bg-slate-800 group-hover:border-teal-500 transition-colors flex items-center justify-center">
                            </div>
                            <span className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors">{time}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}