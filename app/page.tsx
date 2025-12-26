"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signIn, useSession } from 'next-auth/react';
import { BookOpen, LogIn, ArrowRight } from 'lucide-react';

function LoginPageContent() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push('/dashboard');
    }
  }, [status, session, router]);

  const handleContinueWithoutSaving = () => {
    router.push('/dashboard');
  };

  const handleSignInWithGoogle = () => {
    signIn('google', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="rounded-full flex items-center justify-center">
              <Image 
                src="/icon0.svg" 
                alt="Icon" 
                width={64} 
                height={64} 
                className="invert-0" // Use 'invert' if you need to turn a black SVG white
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">Study Buddy</h1>
          <p className="text-[var(--color-text-secondary)]">Say hello to your study companion!</p>
        </div>

        {/* Login Options */}
        <div className="bg-[var(--color-surface)] rounded-lg shadow-md p-6 space-y-4">
          <button
            onClick={handleSignInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-surface)] py-3 px-4 rounded-lg transition-colors font-medium"
          >
            <LogIn size={20} />
            Sign in with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[var(--color-border)]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[var(--color-surface)] text-[var(--color-text-muted)]">or</span>
            </div>
          </div>

          <button
            onClick={handleContinueWithoutSaving}
            className="w-full flex items-center justify-center gap-3 bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface)] text-[var(--color-text-primary)] py-3 px-4 rounded-lg transition-colors font-medium"
          >
            <ArrowRight size={20} />
            Continue with Demo Mode
          </button>

          <div className="mt-6 p-4 bg-[var(--color-surface-secondary)] rounded-lg">
            <p className="text-xs text-[var(--color-text-secondary)]">
              Sign in with Google to sync your progress across devices. Continue in Demo Mode to use the app locally without saving progress.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-[var(--color-text-muted)]">
          Prioritize consistency with your study buddy!
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
