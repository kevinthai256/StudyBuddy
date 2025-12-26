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

interface Todo { id: number; text: string; completed: boolean; }
interface DashboardData {
  todos: Todo[];
  loginStreak: number;
  lastLogin: string;
}

function StudyTodosContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // --- Optimized Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    if (!session) return;
    setIsSyncing(true);
    const finalData = { todos, loginStreak, lastLogin, ...overrides };
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });
      if (response.ok) {
        setLastSyncTime(new Date());
        storage.set('study_todos', finalData.todos);
      }
    } catch (error) { console.error('Cloud Sync Error:', error); } finally { setIsSyncing(false); }
  }, [session, todos, loginStreak, lastLogin]);

  // --- Mutations ---
  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    const nextTodos = [...todos, { id: Date.now(), text: newTodo, completed: false }];
    setTodos(nextTodos);
    setNewTodo('');
    await syncData({ todos: nextTodos });
  };

  const handleToggleTodo = async (id: number) => {
    const nextTodos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(nextTodos);
    await syncData({ todos: nextTodos });
  };

  const handleDeleteTodo = async (id: number) => {
    const nextTodos = todos.filter(t => t.id !== id);
    setTodos(nextTodos);
    await syncData({ todos: nextTodos });
  };

  useEffect(() => {
    if (status === 'authenticated' && session) {
      (async () => {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setTodos(data.todos || []);
            setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || '');
          }
        } finally { setIsSyncing(false); }
      })();
    }
  }, [status, session]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">Hello {session?.user?.name?.split(' ')[0] || '!'}</h1>
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

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <Link href="/dashboard" className="px-6 py-3 rounded-lg font-black transition-all bg-white text-gray-700 border border-gray-200">Overview</Link>
          <Link href="/timer" className="px-6 py-3 rounded-lg font-black transition-all bg-white text-gray-700 border border-gray-200">Timer</Link>
          <Link href="/todos" className="px-6 py-3 rounded-lg font-black transition-all bg-blue-700 text-white shadow-lg scale-105">Tasks</Link>
          <Link href="/schedule" className="px-6 py-3 rounded-lg font-black transition-all bg-white text-gray-700 border border-gray-200">Schedule</Link>
        </div>

        <div className="bg-white rounded-lg p-8 border border-gray-200 max-w-2xl mx-auto">
          <div className="flex gap-2 mb-6">
            <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTodo()} placeholder="New task..." className="flex-1 px-4 py-3 border border-gray-400 rounded-lg text-base font-bold"/>
            <button onClick={handleAddTodo} className="bg-blue-700 text-white px-8 rounded-lg font-black">Add</button>
          </div>
          <div className="space-y-3">
            {todos.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <input type="checkbox" checked={t.completed} onChange={() => handleToggleTodo(t.id)} className="w-5 h-5 border-gray-400 text-blue-700 rounded"/>
                <span className={`flex-1 font-bold ${t.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.text}</span>
                <button onClick={() => handleDeleteTodo(t.id)} className="text-red-500 p-1"><Trash2 size={18}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Next.js Default Export Wrapper
export default function StudyTodos() {
  return (
    <SessionProvider>
      <StudyTodosContent />
    </SessionProvider>
  );
}