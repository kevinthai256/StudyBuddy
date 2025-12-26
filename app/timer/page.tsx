"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckSquare, Flame, Plus, Trash2, ChevronLeft, ChevronRight, Clock, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { SessionProvider, useSession } from 'next-auth/react';
import Link from 'next/link';

// --- Storage Utility ---
const storage = {
  get: async (key: string): Promise<{ value: string } | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    } catch { return null; }
  },
  set: async (key: string, value: any): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch { }
  }
};

interface DashboardData {
  studySessions: Record<string, number>;
  loginStreak: number;
  lastLogin: string;
}

function StudyTimerContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
  const [studyTimeToday, setStudyTimeToday] = useState(0);
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});

  // --- Optimized Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    const finalData = { studySessions, loginStreak, lastLogin, ...overrides };
    if (session) {
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: finalData }),
        });
        if (response.ok) {
          setLastSyncTime(new Date());
        }
      } catch (error) { console.error('Cloud Sync Error:', error); } finally { setIsSyncing(false); }
    }
    // Always save to localStorage
    storage.set('study_sessions', finalData.studySessions);
  }, [session, studySessions, loginStreak, lastLogin]);

  const startStudySession = () => {
    setIsStudying(true);
    setStudyStartTime(new Date());
  };

  const handleStopStudy = async () => {
    if (studyStartTime) {
      const duration = Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
      const today = new Date().toDateString();
      const nextSessions = { ...studySessions, [today]: (studySessions[today] || 0) + duration };
      setStudySessions(nextSessions);
      setStudyTimeToday(nextSessions[today]);
      setIsStudying(false);
      setStudyStartTime(null);
      await syncData({ studySessions: nextSessions });
    }
  };

  // --- Logic Helpers ---
  const getCurrentSessionTime = (): number => (isStudying && studyStartTime) ? Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000) : 0;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatStopwatch = (s: number) => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), isStudying ? 1000 : 60000);
    return () => clearInterval(timer);
  }, [isStudying]);

  useEffect(() => {
    const loadData = async () => {
      if (status === 'authenticated' && session) {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setStudySessions(data.studySessions || {});
            setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || '');
            setStudyTimeToday(data.studySessions?.[new Date().toDateString()] || 0);
          }
        } finally { setIsSyncing(false); }
      } else if (status === 'unauthenticated') {
        // Load from localStorage for demo mode
        const sessionsData = await storage.get('study_sessions');
        if (sessionsData?.value) {
          const sessions = JSON.parse(sessionsData.value);
          setStudySessions(sessions);
          setStudyTimeToday(sessions[new Date().toDateString()] || 0);
        }
      }
    };
    loadData();
  }, [status, session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-blue-900">Study Timer</h1>
            <div className="flex items-center gap-3">
              {session && (
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  {isSyncing ? <><Loader2 className="animate-spin text-blue-600" size={16}/><span>Syncing...</span></> : lastSyncTime ? <span className="text-green-700">✓ Synced</span> : null}
                </div>
              )}
              <div className="flex items-center gap-2 bg-orange-100 px-4 py-2 rounded-lg border border-orange-200">
                <Flame className="text-orange-600" size={20} />
                <div className="text-xl sm:text-2xl font-black text-orange-700">{loginStreak} <span className="text-xs font-bold text-gray-700">Streak</span></div>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
          <div className="text-center mb-6">
            <div className="text-6xl sm:text-8xl font-mono font-bold text-blue-600 mb-4">
              {isStudying ? formatStopwatch(getCurrentSessionTime()) : formatStopwatch(studyTimeToday)}
            </div>
            <div className="text-sm font-black text-gray-500 uppercase tracking-[0.3em] mt-3 mb-6">
              {isStudying ? 'Currently Studying' : 'Total Today'}
            </div>
            <button
              onClick={isStudying ? handleStopStudy : startStudySession}
              className={`px-8 py-4 rounded-lg font-bold text-white text-lg transition-all transform hover:scale-105 ${
                isStudying
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isStudying ? 'STOP!' : 'START!'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold uppercase text-blue-800 tracking-[0.3em] mt-3 mb-2">Today's Total</h3>
              <div className="text-2xl font-bold text-blue-600">{formatTime(studyTimeToday + getCurrentSessionTime())}</div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold uppercase text-green-800 tracking-[0.3em] mt-3 mb-2">Current Session</h3>
              <div className="text-2xl font-bold text-green-600">
                {isStudying ? formatStopwatch(getCurrentSessionTime()) : '00:00:00'}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 text-sm sm:text-base"
          >
            Dashboard
          </Link>
          <Link 
            href="/timer" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-blue-700 text-white shadow-lg shadow-blue-200 active:scale-95 text-sm sm:text-base"
          >
            Timer
          </Link>
          <Link 
            href="/todos" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 text-sm sm:text-base"
          >
            Tasks
          </Link>
          <Link 
            href="/schedule" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-white text-gray-700 border border-gray-200 shadow-sm hover:bg-gray-50 active:scale-95 text-sm sm:text-base"
          >
            Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}

// Next.js Default Export Wrapper
export default function StudyTimer() {
  return (
    <SessionProvider>
      <StudyTimerContent />
    </SessionProvider>
  );
}