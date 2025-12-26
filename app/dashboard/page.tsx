"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, CheckSquare, Flame, Plus, Trash2, ChevronLeft, ChevronRight, Clock, CloudCheck, CloudOff, Loader2, LogIn, LogOut, User } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useSession, signIn, signOut } from 'next-auth/react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

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

interface Todo { id: number; text: string; completed: boolean; }
interface Event { id: number; text: string; time?: string; }
interface DashboardData {
  todos: Todo[];
  studySessions: Record<string, number>;
  events: Record<string, Event[]>;
  loginStreak: number;
  lastLogin: string;
}

function StudyDashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
  const [studyTimeToday, setStudyTimeToday] = useState(0);
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});

  // --- Optimized Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    const finalData = { todos, studySessions, events, loginStreak, lastLogin, ...overrides };
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
    storage.set('study_todos', finalData.todos);
    storage.set('study_events', finalData.events);
    storage.set('study_sessions', finalData.studySessions);
  }, [session, todos, studySessions, events, loginStreak, lastLogin]);

  useEffect(() => {
    const loadData = async () => {
      if (status === 'authenticated' && session) {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setTodos(data.todos || []);
            setStudySessions(data.studySessions || {});
            setEvents(data.events || {});
            setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || '');
            setStudyTimeToday(data.studySessions?.[new Date().toDateString()] || 0);
          }
        } finally { setIsSyncing(false); }
      } else if (status === 'unauthenticated') {
        // Load from localStorage for demo mode
        const todosData = await storage.get('study_todos');
        if (todosData?.value) setTodos(JSON.parse(todosData.value));
        const eventsData = await storage.get('study_events');
        if (eventsData?.value) setEvents(JSON.parse(eventsData.value));
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

  // --- Mutations ---
  const handleToggleTodo = async (id: number) => {
    const nextTodos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(nextTodos);
    await syncData({ todos: nextTodos });
  };

  const handleDeleteEvent = async (dateKey: string, eventId: number) => {
    const nextEvents = { ...events };
    nextEvents[dateKey] = nextEvents[dateKey].filter(e => e.id !== eventId);
    if (nextEvents[dateKey]?.length === 0) delete nextEvents[dateKey];
    setEvents(nextEvents);
    await syncData({ events: nextEvents });
  };

  // --- Logic Helpers ---
  const getCurrentSessionTime = (): number => (isStudying && studyStartTime) ? Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000) : 0;

  const getTimeUntilEvent = (dateStr: string, timeStr?: string) => {
    const dateKeyParts = dateStr.split(' ');
    if (dateKeyParts.length < 4) return null;
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames.indexOf(dateKeyParts[1]);
    const day = parseInt(dateKeyParts[2]);
    const year = parseInt(dateKeyParts[3]);
    const eventDate = new Date(year, month, day);
    if (timeStr) {
      const [h, m] = timeStr.split(':').map(Number);
      eventDate.setHours(h, m, 0, 0);
    }
    const diff = eventDate.getTime() - new Date().getTime();
    if (diff <= 0) return (dateStr === new Date().toDateString()) ? "TODAY" : null;
    const d = Math.floor(diff / 86400000), hr = Math.floor((diff % 86400000) / 3600000), min = Math.floor((diff % 3600000) / 60000);
    return d > 0 ? `${d}d ${hr}h` : hr > 0 ? `${hr}h ${min}m` : `${min}m`;
  };

  const chartData = useMemo(() => {
    const today = new Date().toDateString();
    return {
      labels: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: 'Seconds',
        data: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          const key = d.toDateString();
          return (studySessions[key] || 0) + (key === today ? getCurrentSessionTime() : 0);
        }),
        borderColor: 'rgba(59, 162, 246, 1)', tension: 0.4, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }]
    };
  }, [studySessions, isStudying, currentTime]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatStopwatch = (s: number) => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  function AuthControls() {
    if (status === 'loading') {
      return <div className="px-3 py-2 rounded bg-gray-100 text-sm">Loading...</div>;
    }

    if (!session) {
      return (
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          className="flex items-center gap-2 bg-[var(--color-primary)] text-white px-3 py-2 rounded-lg text-sm"
        >
          <LogIn size={16} />
          <span>Sign in</span>
        </button>
      );
    }

    const handleSwitchAccount = async () => {
      // Sign out first to clear current session
      await signOut({ redirect: false });
      // Then sign in with account selection prompt
      signIn('google', { callbackUrl: '/dashboard', prompt: 'select_account' });
    };

    const handleSignOut = async () => {
      // Clear all local storage data
      if (typeof window !== 'undefined') {
        localStorage.clear();
      }
      // Sign out
      await signOut({ callbackUrl: '/' });
    };

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={handleSwitchAccount}
          className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-3 py-2 rounded-lg text-sm"
          title="Switch"
        >
          <User size={16} />
          <span>Switch</span>
        </button>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 bg-[var(--color-surface-secondary)] px-3 py-2 rounded-lg text-sm text-[var(--color-text-accent)]"
          title="Sign out"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    );
  }

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), isStudying ? 1000 : 60000);
    return () => clearInterval(timer);
  }, [isStudying]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      (async () => {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setTodos(data.todos || []); setStudySessions(data.studySessions || {});
            setEvents(data.events || {}); setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || ''); setStudyTimeToday(data.studySessions?.[new Date().toDateString()] || 0);
          }
        } finally { setIsSyncing(false); }
      })();
    }
  }, [status, session]);

  // Helper for type-safe date comparison
  const todayStart = new Date().setHours(0, 0, 0, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-[var(--color-surface)] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <AuthControls />
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Hello {session?.user?.name?.split(' ')[0] || '!'}!</h1>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-[var(--color-surface)] rounded-lg p-6">
              <h3 className="text-xl font-black text-[var(--color-text-primary)] gap-2 mb-4 flex items-center justify-center w-ful">
                Tasks
              </h3>
              {/* Progress Bar Container */}
              <div className="mb-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-sm font-black text-[var(--color-text-primary)] uppercase">Completion</span>
                  <span className="text-sm font-black text-[var(--color-text-primary)]">
                    {todos.length > 0 
                      ? Math.round((todos.filter(t => t.completed).length / todos.length) * 100) 
                      : 0}%
                  </span>
                </div>
                
                {/* The Bar Track */}
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border-4 border-white">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      width: `${todos.length > 0 ? (todos.filter(t => t.completed).length / todos.length) * 100 : 0}%`,
                      backgroundColor: 'var(--color-primary, #3b82f6)' // Fallback to blue-500 if variable fails
                    }}
                  ></div>
                </div>  
            </div>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
              {todos.length > 0 ? (
                todos.map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={t.completed} 
                      onChange={() => handleToggleTodo(t.id)} 
                      className="w-5 h-5 border-[var(--color-border-secondary)] text-[var(--color-primary)] rounded"
                    />
                    <span className={`text-base font-bold truncate ${t.completed ? 'line-through text-[var(--color-text-blue)]' : 'text-[var(--color-text-primary)]'}`}>
                      {t.text}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-center text-sm font-bold text-[var(--color-text-secondary)] py-4">
                  No tasks for today!
                </p>
              )}
            </div>
            </div>

            <div className="bg-[var(--color-primary)] rounded-lg py-12 px-6 flex flex-col items-center justify-center w-full h-full">

            {/* Time Display Section */}
            <div className="flex flex-col items-center justify-center flex-1 w-full">
              {/* Main Text - Increased size for maximum "fill" */}
              <div className="text-7xl sm:text-8xl font-black text-[var(--color-text-primary)] tracking-tighter leading-none tabular-nums">
                {formatTime(studyTimeToday + getCurrentSessionTime())}
              </div>
              
              {/* Container must be relative so the icon stays inside */}
              <div className="relative flex items-center justify-center w-full mt-6 h-12 px-6">
                
                {/* The Text - Centered and bold */}
                <span className="text-sm font-black text-[var(--color-text-primary)] uppercase tracking-[0.3em] z-10">
                  Today's Total
                </span>
              </div>

              {/* Live Status Section */}
              {isStudying && (
                <div className="mt-8 flex justify-center w-full">
                  <div className="inline-flex items-center gap-4 px-8 py-3 bg-[var(--color-surface-secondary)] border-2 border-[var(--color-secondary)] text-[var(--color-secondary)] rounded-full font-black text-2xl animate-pulse">
                    <span className="relative flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-secondary)] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-[var(--color-secondary)]"></span>
                    </span>
                    LIVE: {formatStopwatch(getCurrentSessionTime())}
                  </div>
                </div>
              )}
            </div>
          </div>

            <div className="bg-[var(--color-surface)] rounded-lg p-6">
              <h3 className="text-xl font-black text-[var(--color-text-primary)] gap-2 mb-6 flex items-center justify-center w-ful">
                Schedule
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {Object.entries(events)
                  .sort(([a],[b]) => new Date(a).getTime() - new Date(b).getTime())
                  .filter(([d]) => new Date(d).getTime() >= todayStart) // Fix applied here
                  .slice(0, 8).flatMap(([dk, evts]) => 
                  evts.map(e => {
                    const cd = getTimeUntilEvent(dk, e.time);
                    if (!cd) return null;
                    const isToday = dk === new Date().toDateString();
                    
                    return (
                      <div 
                        key={e.id} 
                        className={`p-4 rounded-xl flex items-center justify-between gap-4 sm:gap-6 ${
                          isToday 
                            ? 'bg-[var(--color-surface-secondary)]' 
                            : 'bg-[var(--color-surface-secondary)]'
                        }`}
                      >
                        {/* Content Area: Holds Date, Countdown, and Description */}
                        <div className="flex-1 min-w-0"> 
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            {/* Date Text */}
                            <span className="text-[14px] sm:text-[16px] font-black uppercase text-[var(--color-text-secondary)] truncate">
                              {isToday ? 'Today' : new Date(dk).toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}
                            </span>
                            
                            {/* Countdown Box - flex-shrink-0 ensures it never squishes */}
                            <span className={`text-[12px] sm:text-[14px] font-black px-4 py-1.5 rounded-md shadow-sm flex-shrink-0 min-w-[70px] text-center ${
                              isToday ? 'bg-[var(--color-secondary)] text-[var(--color-text-primary)] animate-pulse' : 'bg-[var(--color-primary)] text-[var(--color-text-primary)]'
                            }`}>
                              {cd.toUpperCase()}
                            </span>
                          </div>
                          
                          {/* Description - truncate or wrap based on preference */}
                          <div className="text-lg font-black text-[var(--color-surface)] leading-tight break-words">
                            {e.text}
                          </div>
                        </div>

                        {/* Right Action: The Checkbox Button */}
                        <div className="flex-shrink-0 self-center">
                          <button 
                            onClick={() => handleDeleteEvent(dk, e.id)} 
                            className="bg-[var(--color-surface)] border-2 border-[var(--color-progress-bar)] text-[var(--color-surface)] p-2.5 rounded-full hover:bg-[var(--color-secondary)] hover:text-[var(--color-surface)] transition-all shadow-sm active:scale-90"
                          >
                          </button>
                        </div>
                      </div>
                    );
                  })
                ).filter(Boolean)}
              </div>
            </div>
            <div className="lg:col-span-3 bg-white rounded-lg p-6 h-80"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-primary)] text-[var(--color-text-primary)] active:scale-95 text-sm sm:text-base"
          >
            Dashboard
          </Link>
          <Link 
            href="/timer" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base"
          >
            Timer
          </Link>
          <Link 
            href="/todos" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base"
          >
            Tasks
          </Link>
          <Link 
            href="/schedule" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base"
          >
            Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}

// Next.js Default Export Wrapper
export default function StudyDashboard() {
  return <StudyDashboardContent />;
}