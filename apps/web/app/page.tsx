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

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-50 selection:bg-teal-500/30" style={{ fontFamily: 'var(--font-fira-code), monospace' }}>
      {/* Navbar */}
      <header className="border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-4xl tracking-tighter text-white">SkillFuze</h1>
          </div>
          <div className="flex items-center gap-4">
            <SystemStatus />

            <Link
              href="/login"
              className="px-5 py-2 rounded-full font-semibold text-sm transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: '#232323ff', color: '#fff' }}
            >
              Get Started
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

          <h1 className="text-4xl md:text-7xl lg:text-8xl tracking-tight mb-8 leading-[1.1]">
            Find your next <br />
            <span
              className={`text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 inline-block min-w-[300px] md:min-w-[400px] transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              {WORDS[wordIndex]}
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-slate-400 mb-12 max-w-2xl leading-relaxed font-light">
            A platform made for you to synchronize your skills, discover amazing projects, and connect with builders who complement your strengths.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              onClick={handleGithubLogin}
              className="group flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full font-semibold text-lg border border-slate-700 hover:bg-slate-800 transition-all shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:-translate-y-1"
            >
              <GithubIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
              Continue with GitHub
            </button>
            <button
              onClick={handleGoogleLogin}
              className="group flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full font-semibold text-lg border border-slate-700 hover:bg-slate-800 transition-all shadow-[0_0_40px_rgba(255,255,255,0.05)] hover:-translate-y-1"
            >
              <GoogleIcon className="w-6 h-6 transition-transform group-hover:scale-110" />
              Continue with Google
            </button>
          </div>
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

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.247 0-13.632 3.842-17.694 9.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C10.193 39.353 16.634 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
