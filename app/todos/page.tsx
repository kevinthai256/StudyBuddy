"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Plus, Trash2, Loader2, GripVertical } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useStudyData } from '@/app/hooks/useStudyData';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

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
  const [priority, setPriority] = useState('Low');
  const [enabled, setEnabled] = React.useState(false);
  React.useEffect(() => {
    setEnabled(true);
  }, []);

  const priorityWeight: Record<string, number> = {
    'Critical': 0,
    'High': 1,
    'Medium': 2,
    'Low': 3
  };

  const priorities = [
    { label: 'Low', color: 'bg-white text-blue-500' },
    { label: 'Medium', color: 'bg-white text-yellow-500' },
    { label: 'High', color: 'bg-white text-orange-500' },
    { label: 'Critical', color: 'bg-white text-red-500' }
  ];

  const priorityStyles: Record<string, string> = {
    'Critical': 'bg-red-500/20 text-red-500 border-red-500/20',
    'High': 'bg-orange-500/20 text-orange-500 border-orange-500/20',
    'Medium': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/20',
    'Low': 'bg-blue-500/20 text-blue-500 border-blue-500/20',
  };

  const onDragEnd = async (result: any) => {
    if (!result.destination) return;

    const items = Array.from(todos);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setTodos(items); // Update UI immediately
    await saveData({ todos: items }); // Save to database/hook
  };

  // --- Mutations ---
  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;

    const newTodoItem = {
      id: Date.now(),
      text: newTodo,
      completed: false,
      priority: priority
    };

    // Find where to insert based on priority weight
    let insertionIndex = todos.findIndex(
      (t: any) => priorityWeight[t.priority || 'Medium'] > priorityWeight[priority]
    );

    if (insertionIndex === -1) insertionIndex = todos.length;

    const nextTodos = [...todos];
    nextTodos.splice(insertionIndex, 0, newTodoItem);

    setTodos(nextTodos);
    setNewTodo('');
    setPriority('Medium'); // Reset to default after adding

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
                  {isSyncing ? <><Loader2 className="animate-spin text-[var(--color-sync-loading)]" size={16} /><span>Syncing...</span></> : lastSyncTime ? <span className="text-[var(--color-sync-success)]">✓ Synced</span> : null}
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
          <div className="flex items-center gap-3 mb-6">
            {priorities.map((p) => (
              <button
                key={p.label}
                onClick={() => setPriority(p.label)}
                className={`px-3 py-1 rounded-md text-xs font-black transition-all ${priority === p.label
                  ? `${p.color} ring-2 ring-offset-2 ring-offset-[var(--color-surface)] ring-current`
                  : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-muted)] opacity-60'
                  }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* DRAG AND DROP SECTION START */}
          {enabled && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="todos-list">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-3"
                  >
                    {todos.map((t, index) => (
                      <Draggable key={t.id} draggableId={t.id.toString()} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`group flex items-center gap-3 p-1 rounded-lg transition-all ${snapshot.isDragging
                              ? 'bg-[var(--color-surface-hover)] shadow-2xl scale-[1.02] z-50'
                              : 'bg-[var(--color-surface-secondary)] hover:bg-[var(--color-surface-hover)]'
                              }`}
                          >
                            {/* Drag Handle Icon */}
                            <div
                              {...provided.dragHandleProps}
                              className="pl-3 text-[var(--color-text-muted)] cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical size={20} />
                            </div>

                            <label className="flex flex-1 items-center gap-4 p-3 cursor-pointer min-w-0">
                              <input
                                type="checkbox"
                                checked={t.completed}
                                onChange={() => handleToggleTodo(t.id)}
                                className="w-6 h-6 border-[var(--color-surface-secondary)] text-[var(--color-primary)] rounded cursor-pointer accent-[var(--color-primary)] shrink-0"
                              />

                              <div className="flex flex-col gap-1 min-w-0">
                                {/* The Task Text */}
                                <span className={`font-bold text-lg select-none break-words leading-tight ${t.completed
                                    ? 'line-through text-[var(--color-text-muted)] opacity-50'
                                    : 'text-[var(--color-text-secondary)]'
                                  }`}>
                                  {t.text}
                                </span>
                              </div>
                            </label>
                            <div className={`w-fit px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${priorityStyles[t.priority] || priorityStyles['Medium']
                                  } ${t.completed ? 'opacity-40 grayscale' : ''}`}>
                                  {t.priority || 'Medium'}
                                </div>
                            <button
                              onClick={() => handleDeleteTodo(t.id)}
                              className="text-[var(--color-error)] pr-3 hover:text-[var(--color-error-hover)] transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
          {/* DRAG AND DROP SECTION END */}

        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Link href="/dashboard" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Overview</Link>
          <Link href="/timer" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Timer</Link>
          <Link href="/todos" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-primary)] text-[var(--color-text-primary)] active:scale-95 text-sm sm:text-base">Tasks</Link>
          <Link href="/schedule" className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] active:scale-95 text-sm sm:text-base">Schedule</Link>
        </div>
      </div>
    </div>
  );
}

export default function StudyTodos() {
  return <StudyTodosContent />;
}