"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

interface Event {
  id: number;
  text: string;
  time?: string;
}

interface DashboardData {
  todos?: Todo[];
  studySessions?: Record<string, number>;
  events?: Record<string, Event[]>;
  loginStreak?: number;
  lastLogin?: string;
}

export function useStudyData() {
  const { data: session, status } = useSession();

  // State with explicit types
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});
  const [loginStreak, setLoginStreak] = useState<number>(0);
  const [lastLogin, setLastLogin] = useState<string>('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // The Safety Gate Ref
  const hasLoadedFromCloud = useRef(false);

  // --- The Unified Sync Engine ---
  const saveData = useCallback(async (overrides: DashboardData = {}) => {
    // 1. Get latest values from LocalStorage or Overrides
    const currentTodos = overrides.todos ?? JSON.parse(localStorage.getItem('study_todos') || '[]');
    const currentEvents = overrides.events ?? JSON.parse(localStorage.getItem('study_events') || '{}');
    const currentSessions = overrides.studySessions ?? JSON.parse(localStorage.getItem('study_sessions') || '{}');
    const currentStreak = overrides.loginStreak ?? Number(localStorage.getItem('study_streak') || 0);
    const currentLastLogin = overrides.lastLogin ?? (localStorage.getItem('study_last_login') || '');

    // 2. Instant Local Save
    localStorage.setItem('study_todos', JSON.stringify(currentTodos));
    localStorage.setItem('study_events', JSON.stringify(currentEvents));
    localStorage.setItem('study_sessions', JSON.stringify(currentSessions));
    localStorage.setItem('study_streak', currentStreak.toString());
    localStorage.setItem('study_last_login', currentLastLogin);

    // 3. Cloud Sync (Only if gate is open)
    if (session && status === 'authenticated') {
      if (!hasLoadedFromCloud.current) {
        console.warn("Sync blocked: Waiting for initial cloud data pull.");
        return;
      }

      setIsSyncing(true);
      try {
        const finalData = {
          todos: currentTodos,
          events: currentEvents,
          studySessions: currentSessions,
          loginStreak: currentStreak,
          lastLogin: currentLastLogin,
        };

        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: finalData }),
        });
        if (response.ok) setLastSyncTime(new Date());
      } catch (error) {
        console.error("Sync Error:", error);
      } finally {
        setIsSyncing(false);
      }
    }
  }, [session, status]);

  // --- Initial Data Load ---
  useEffect(() => {
    const load = async () => {
      if (typeof window === 'undefined') return;

      // Load local first
      const lTodos = JSON.parse(localStorage.getItem('study_todos') || '[]');
      const lEvents = JSON.parse(localStorage.getItem('study_events') || '{}');
      const lSessions = JSON.parse(localStorage.getItem('study_sessions') || '{}');
      const lStreak = Number(localStorage.getItem('study_streak') || 0);
      const lLastLogin = localStorage.getItem('study_last_login') || '';
      
      setTodos(lTodos);
      setEvents(lEvents);
      setStudySessions(lSessions);
      setLoginStreak(lStreak);
      setLastLogin(lLastLogin);

      if (status === 'authenticated' && session) {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setTodos(data.todos || lTodos);
            setEvents(data.events || lEvents);
            setStudySessions(data.studySessions || lSessions);
            setLoginStreak(data.loginStreak || lStreak);
            setLastLogin(data.lastLogin || lLastLogin);
          }
          // OPEN THE GATE
          hasLoadedFromCloud.current = true;
          setLastSyncTime(new Date());
        } catch (err) {
          console.error("Load Error:", err);
        } finally {
          setIsSyncing(false);
        }
      } else if (status === 'unauthenticated') {
        hasLoadedFromCloud.current = true;
      }
    };
    load();
  }, [status, session]);

  return { 
    todos, setTodos, 
    events, setEvents, 
    studySessions, setStudySessions, 
    loginStreak, setLoginStreak,
    lastLogin, setLastLogin,
    saveData, 
    isSyncing, 
    lastSyncTime 
  };
}