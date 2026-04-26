'use client'

import { useState, useEffect } from 'react';
import Link from "next/link";
import SystemStatus from "./components/SystemStatus";
import { createClient } from '@/lib/supabase/client';

const WORDS = ["co-founder", "team", "project", "mentor"];

export default function Home() {
  const [wordIndex, setWordIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % WORDS.length);
        setIsVisible(true);
      }, 300); // 300ms fade out
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleGithubLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50 font-sans selection:bg-teal-500/30">
      {/* Navbar */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-black tracking-tighter text-white">SkillFuze</h1>
          </div>
          <div className="flex items-center gap-6">
            <SystemStatus />
            <Link
              href="/login"
              className="px-5 py-2 rounded-full font-medium border border-slate-700 hover:border-slate-500 hover:bg-slate-800 transition-all text-sm"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-20 relative overflow-hidden">
        {/* Abstract background blobs for startup aesthetic */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="max-w-4xl w-full text-center relative z-10 flex flex-col items-center">

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight mb-8 leading-[1.1]">
            Find your next <br />
            <span
              className={`text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 inline-block min-w-[300px] md:min-w-[400px] transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {WORDS[wordIndex]}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl leading-relaxed font-light">
            The intelligent platform to synchronize your skills, discover amazing projects, and connect with builders who complement your strengths.
          </p>

          <button
            onClick={handleGithubLogin}
            className="group flex items-center gap-3 bg-white text-slate-950 px-8 py-4 rounded-full font-semibold text-lg hover:bg-slate-200 transition-all shadow-[0_0_40px_rgba(45,212,191,0.2)] hover:shadow-[0_0_60px_rgba(45,212,191,0.4)] hover:-translate-y-1"
          >
            <GithubIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
            Continue with GitHub
          </button>
        </div>
      </main>
    </div>
  );
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}
