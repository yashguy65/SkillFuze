import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Dashboard() {
  const supabase = await createClient()

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user)
    redirect('/login')

  return (
    <div className="p-10">
      <h1>Dashboard</h1>
      <p>{user.email}</p>
    </div>
  )
}