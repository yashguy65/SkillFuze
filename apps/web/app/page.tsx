'use client'

import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#0F1419' }}>
      {/* Header */}
      <header style={{ backgroundColor: '#1A1F2E', borderBottom: '1px solid #2D3748' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div><h1 style={{ fontFamily: 'var(--font-orbitron)', fontSize:30 }}>SkillFuze</h1></div>
          </div>
          <Link
            href="/login"
            className="px-6 py-2 rounded font-semibold transition-all"
            style={{ 
              backgroundColor: '#3c97fa', 
              color: '#FFFFFF'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#117ff7'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3c97fa'}
          >
            Login
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-2xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4" style={{ color: '#E5E7EB' }}>
              Welcome to SkillFuze
            </h1>
            <p className="text-xl mb-8" style={{ color: '#9CA3AF' }}>
              Synchronize your skills and grow together with your team
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E5E7EB' }}>
                Track Progress
              </h2>
              <p style={{ color: '#D1D5DB' }} className="text-sm">
                Monitor your skill development and set achievable goals
              </p>
            </div>

            <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E5E7EB' }}>
                Collaborate
              </h2>
              <p style={{ color: '#D1D5DB' }} className="text-sm">
                Share knowledge and learn from your teammates
              </p>
            </div>

            <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E5E7EB' }}>
                Real-time Updates
              </h2>
              <p style={{ color: '#D1D5DB' }} className="text-sm">
                Stay informed with live skill tracking and insights
              </p>
            </div>

            <div className="p-6 rounded-lg" style={{ backgroundColor: '#1F2937', borderLeft: '4px solid #3c97fa' }}>
              <h2 className="text-lg font-semibold mb-3" style={{ color: '#E5E7EB' }}>
                Analytics
              </h2>
              <p style={{ color: '#D1D5DB' }} className="text-sm">
                Get detailed reports on team skill distribution
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
