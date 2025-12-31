"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useStudyData } from '@/app/hooks/useStudyData';

function StudyTimerContent() {
  const { data: session } = useSession();
  
  // CENTRALIZED HOOK LOGIC
  const { 
    studySessions, setStudySessions,
    loginStreak, 
    saveData, 
    isSyncing, 
    lastSyncTime 
  } = useStudyData();

  // Local UI State for Timer
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);

  const todayKey = new Date().toDateString();

  // --- Mutations ---
  const startStudySession = () => {
    setIsStudying(true);
    setStudyStartTime(new Date());
  };

  const handleStopStudy = async () => {
    if (studyStartTime) {
      const duration = Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
      const nextSessions = { 
        ...studySessions, 
        [todayKey]: (studySessions[todayKey] || 0) + duration 
      };
      
      setStudySessions(nextSessions);
      setIsStudying(false);
      setStudyStartTime(null);
      
      // Use saveData to ensure todos/events aren't overwritten
      await saveData({ studySessions: nextSessions });
    }
  };

  // --- Logic Helpers ---
  const getCurrentSessionTime = (): number => 
    (isStudying && studyStartTime) ? Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000) : 0;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatStopwatch = (s: number) => 
    `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Update clock every second when studying, every minute otherwise
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), isStudying ? 1000 : 60000);
    return () => clearInterval(timer);
  }, [isStudying]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-[var(--color-surface)] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Study Timer</h1>
            <div className="flex items-center gap-3">
              {session && (
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  {isSyncing ? <><Loader2 className="animate-spin text-[var(--color-sync-loading)]" size={16}/><span>Syncing...</span></> : lastSyncTime ? <span className="text-[var(--color-sync-success)]">✓ Synced</span> : null}
                </div>
              )}
              <div className="flex items-center gap-2 bg-[var(--color-streak-bg)] px-4 py-2 rounded-lg">
                <Flame className="text-[var(--color-background)]" size={20} />
                <div className="text-xl sm:text-2xl font-black text-[var(--color-streak-text)]">{loginStreak}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-[var(--color-surface)] rounded-lg shadow-md p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
            <div className="flex-1 text-center mb-4 sm:mb-0">
              <div className="text-6xl sm:text-8xl font-mono font-bold text-[var(--color-text-primary)] mb-4">
                {isStudying ? formatStopwatch(getCurrentSessionTime()) : formatStopwatch(studySessions[todayKey] || 0)}
              </div>
              <div className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-[0.3em] mt-3 mb-6">
                {isStudying ? 'Currently Studying' : "Today's Total"}
              </div>
            </div>
            <div className="sm:ml-6">
              <button
                onClick={isStudying ? handleStopStudy : startStudySession}
                className={`px-10 py-5 rounded-lg font-bold text-[var(--color-text-primary)] text-xl transition-all transform hover:scale-105 active:scale-95 ${
                  isStudying
                    ? 'bg-[var(--color-error)] hover:bg-[var(--color-error-hover)]'
                    : 'bg-[var(--color-secondary)] hover:bg-[var(--color-secondary-hover)]'
                }`}
              >
                {isStudying ? 'STOP!' : 'START!'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[var(--color-surface-secondary)] p-4 rounded-lg">
              <h3 className="font-semibold uppercase text-[var(--color-text-secondary)] tracking-[0.3em] mt-3 mb-2">Today's Total</h3>
              <div className="text-2xl font-bold text-[var(--color-primary)]">
                {formatTime((studySessions[todayKey] || 0) + getCurrentSessionTime())}
              </div>
            </div>

            <div className="bg-[var(--color-surface-secondary)] p-4 rounded-lg">
              <h3 className="font-semibold uppercase text-[var(--color-text-secondary)] tracking-[0.3em] mt-3 mb-2">Current Session</h3>
              <div className="text-2xl font-bold text-[var(--color-secondary)]">
                {isStudying ? formatStopwatch(getCurrentSessionTime()) : '00:00:00'}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Link href="/dashboard" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Overview</Link>
          <Link href="/timer" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-primary)] text-[var(--color-text-primary)] active:scale-95 text-sm sm:text-base">Timer</Link>
          <Link href="/todos" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Tasks</Link>
          <Link href="/schedule" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Schedule</Link>
        </div>
      </div>
    </div>
  );
}

export default function StudyTimer() {
  return <StudyTimerContent />;
}