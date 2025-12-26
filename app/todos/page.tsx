"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Plus, Trash2, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useStudyData } from '@/app/hooks/useStudyData';

function StudyTodosContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // CENTRALIZED HOOK LOGIC
  const { 
    todos, setTodos, 
    loginStreak, 
    saveData, 
    isSyncing, 
    lastSyncTime 
  } = useStudyData();

  // Local UI State for the input field
  const [newTodo, setNewTodo] = useState('');

  // --- Mutations ---
  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    const nextTodos = [...todos, { id: Date.now(), text: newTodo, completed: false }];
    setTodos(nextTodos); // Instant UI update
    setNewTodo('');
    // Use saveData to ensure other data (events/sessions) is preserved
    await saveData({ todos: nextTodos });
  };

  const handleToggleTodo = async (id: number) => {
    const nextTodos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(nextTodos);
    await saveData({ todos: nextTodos });
  };

  const handleDeleteTodo = async (id: number) => {
    const nextTodos = todos.filter(t => t.id !== id);
    setTodos(nextTodos);
    await saveData({ todos: nextTodos });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-[var(--color-surface)] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Tasks</h1>
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

        <div className="bg-[var(--color-surface)] rounded-lg p-8 max-w-2xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-2 mb-6">
            <input 
              type="text" 
              value={newTodo} 
              onChange={e => setNewTodo(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleAddTodo()} 
              placeholder="New task..." 
              className="flex-1 px-4 py-3 text-[var(--color-text-primary)] border-2 border-[var(--color-background)] rounded-lg text-base font-bold outline-none"
            />
            <button 
              onClick={handleAddTodo} 
              className="bg-[var(--color-primary)] text-[var(--color-text-primary)] px-8 py-3 sm:py-0 rounded-lg font-black hover:bg-[var(--color-primary-hover)] transition-colors"
            >
              Add
            </button>
          </div>
          <div className="space-y-3">
            {todos.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 bg-[var(--color-surface-secondary)] rounded-lg">
                <input 
                  type="checkbox" 
                  checked={t.completed} 
                  onChange={() => handleToggleTodo(t.id)} 
                  className="w-5 h-5 border-[var(--color-surface-secondary)] text-[var(--color-primary)] rounded cursor-pointer"
                />
                <span className={`flex-1 font-bold ${t.completed ? 'line-through text-[var(--color-surface-hover)]' : 'text-[var(--color-surface)]'}`}>
                  {t.text}
                </span>
                <button 
                  onClick={() => handleDeleteTodo(t.id)} 
                  className="text-[var(--color-error)] p-1 hover:text-[var(--color-error-hover)] transition-colors"
                >
                  <Trash2 size={18}/>
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Link href="/dashboard" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Overview</Link>
          <Link href="/timer" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Timer</Link>
          <Link href="/todos" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Tasks</Link>
          <Link href="/schedule" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-primary)] text-[var(--color-text-primary)] active:scale-95 text-sm sm:text-base">Schedule</Link>
        </div>
      </div>
    </div>
  );
}

export default function StudyTodos() {
  return <StudyTodosContent />;
}