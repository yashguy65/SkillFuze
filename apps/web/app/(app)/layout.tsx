import { ReactNode } from 'react'
import Header from '@/components/Header'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0F1419', color: '#E5E7EB' }}>
      <Header />
      {children}
    </div>
  )
}
