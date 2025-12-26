"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Todo { id: number; text: string; completed: boolean; }
interface Event { id: number; text: string; time?: string; }
interface DashboardData {
  todos?: Todo[];
  studySessions?: Record<string, number>;
  events?: Record<string, Event[]>;
  loginStreak?: number;
  lastLogin?: string;
}

export function useStudyData() {
  const { data: session, status } = useSession();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});
  const [loginStreak, setLoginStreak] = useState<number>(0);
  const [lastLogin, setLastLogin] = useState<string>('');
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // This ensures we don't push until we've pulled
  const hasLoadedFromCloud = useRef(false);

  const saveData = useCallback(async (overrides: DashboardData = {}) => {
    // 1. BLOCK PUSHING IF NOT LOADED: On a new device, this prevents 
    // empty local state from overwriting cloud data.
    if (status === 'authenticated' && !hasLoadedFromCloud.current) {
      console.warn("Sync blocked: Initial cloud data not yet merged.");
      return;
    }

    // 2. GET LATEST: Prefer overrides, then state, then localStorage
    const currentTodos = overrides.todos ?? todos;
    const currentEvents = overrides.events ?? events;
    const currentSessions = overrides.studySessions ?? studySessions;
    const currentStreak = overrides.loginStreak ?? loginStreak;
    const currentLastLogin = overrides.lastLogin ?? lastLogin;

    const finalData = {
      todos: currentTodos,
      events: currentEvents,
      studySessions: currentSessions,
      loginStreak: currentStreak,
      lastLogin: currentLastLogin,
    };

    // 3. PERSIST LOCAL
    localStorage.setItem('study_todos', JSON.stringify(finalData.todos));
    localStorage.setItem('study_events', JSON.stringify(finalData.events));
    localStorage.setItem('study_sessions', JSON.stringify(finalData.studySessions));
    localStorage.setItem('study_streak', finalData.loginStreak.toString());
    localStorage.setItem('study_last_login', finalData.lastLogin);

    // 4. PERSIST CLOUD
    if (session && status === 'authenticated') {
      setIsSyncing(true);
      try {
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
  }, [session, status, todos, events, studySessions, loginStreak, lastLogin]);

  useEffect(() => {
    const load = async () => {
      if (typeof window === 'undefined') return;

      // STEP 1: Load Local Storage immediately (Fast UI)
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

      // STEP 2: If logged in, fetch from Cloud (The Source of Truth)
      if (status === 'authenticated' && session) {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          
          if (data) {
            // STEP 3: OVERWRITE LOCAL WITH CLOUD (Critical for new devices)
            setTodos(data.todos || []);
            setEvents(data.events || {});
            setStudySessions(data.studySessions || {});
            setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || '');

            // Update LocalStorage immediately so subsequent saves are accurate
            localStorage.setItem('study_todos', JSON.stringify(data.todos || []));
            localStorage.setItem('study_events', JSON.stringify(data.events || {}));
            localStorage.setItem('study_sessions', JSON.stringify(data.studySessions || {}));
            localStorage.setItem('study_streak', (data.loginStreak || 0).toString());
            localStorage.setItem('study_last_login', data.lastLogin || '');
          }
          
          // STEP 4: OPEN THE GATE
          hasLoadedFromCloud.current = true;
          setLastSyncTime(new Date());
        } catch (err) {
          console.error("Cloud Load Error:", err);
        } finally {
          setIsSyncing(false);
        }
      } else if (status === 'unauthenticated') {
        hasLoadedFromCloud.current = true;
      }
    };
    load();
  }, [status, session]);

  return { todos, setTodos, events, setEvents, studySessions, setStudySessions, loginStreak, setLoginStreak, lastLogin, setLastLogin, saveData, isSyncing, lastSyncTime };
}