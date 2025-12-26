"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

// --- Interfaces to fix TypeScript "never" errors ---
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

  // --- The Unified Sync Engine ---
  const saveData = useCallback(async (overrides: DashboardData = {}) => {
    // 1. Get latest values from LocalStorage or Current State to prevent overwriting
    const currentTodos = overrides.todos ?? JSON.parse(localStorage.getItem('study_todos') || '[]');
    const currentEvents = overrides.events ?? JSON.parse(localStorage.getItem('study_events') || '{}');
    const currentSessions = overrides.studySessions ?? JSON.parse(localStorage.getItem('study_sessions') || '{}');
    const currentStreak = overrides.loginStreak ?? Number(localStorage.getItem('study_streak') || 0);
    const currentLastLogin = overrides.lastLogin ?? (localStorage.getItem('study_last_login') || '');

    const finalData = {
      todos: currentTodos,
      events: currentEvents,
      studySessions: currentSessions,
      loginStreak: currentStreak,
      lastLogin: currentLastLogin,
    };

    // 2. Instant Local Save
    localStorage.setItem('study_todos', JSON.stringify(finalData.todos));
    localStorage.setItem('study_events', JSON.stringify(finalData.events));
    localStorage.setItem('study_sessions', JSON.stringify(finalData.studySessions));
    localStorage.setItem('study_streak', finalData.loginStreak.toString());
    localStorage.setItem('study_last_login', finalData.lastLogin);

    // 3. Background Cloud Sync
    if (session) {
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
  }, [session]);

  // --- Initial Data Load ---
  useEffect(() => {
    const load = async () => {
      if (typeof window === 'undefined') return;

      // Load local first for speed
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

      // Fetch Cloud and Merge if logged in
      if (status === 'authenticated' && session) {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            // Update state with Cloud data
            setTodos(data.todos || lTodos);
            setEvents(data.events || lEvents);
            setStudySessions(data.studySessions || lSessions);
            setLoginStreak(data.loginStreak || lStreak);
            setLastLogin(data.lastLogin || lLastLogin);
          }
        } catch (err) {
          console.error("Load Error:", err);
        } finally {
          setIsSyncing(false);
        }
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