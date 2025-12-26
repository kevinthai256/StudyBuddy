"use client";

import React from 'react';
import { SessionProvider, useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import { LogIn, LogOut, User } from 'lucide-react';

function AuthControls() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div className="px-3 py-2 rounded bg-gray-100 text-sm">Loading...</div>;
  }

  if (!session) {
    return (
      <button
        onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm sm:text-base touch-none"
      >
        <LogIn size={16} />
        <span className="font-semibold">Sign in</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => signIn('google')}
        className="flex items-center gap-2 bg-amber-600 text-white px-3 py-2 rounded-lg text-sm"
        title="Switch Google account"
      >
        <User size={16} />
        <span className="hidden sm:inline">Switch account</span>
      </button>

      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg text-sm text-gray-800"
        title="Sign out"
      >
        <LogOut size={16} />
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-14">
              <Link href="/" className="flex items-center gap-3">
                <img src="/icon0.svg" alt="StudyBuddy" className="w-8 h-8" />
                <span className="font-bold text-gray-800">StudyBuddy</span>
              </Link>
              <div className="flex items-center gap-2">
                <AuthControls />
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 pt-14">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
