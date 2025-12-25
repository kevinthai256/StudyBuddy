"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, CheckSquare, Flame, Plus, Trash2, 
  ChevronLeft, ChevronRight, Clock, CloudCheck, 
  CloudOff, Loader2 
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SessionProvider, useSession } from 'next-auth/react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// --- Types ---
interface Todo { id: number; text: string; completed: boolean; }
interface Event { id: number; text: string; time?: string; }
interface DashboardData {
  todos: Todo[];
  studySessions: Record<string, number>;
  events: Record<string, Event[]>;
  loginStreak: number;
  lastLogin: string;
}

// --- Utilities ---
const storage = {
  set: async (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val)),
  get: (key: string) => {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : null;
  }
};

export default function StudyDashboard() {
  return (
    <SessionProvider>
      <StudyDashboardContent />
    </SessionProvider>
  );
}

function StudyDashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // --- State ---
  const [activeTab, setActiveTab] = useState('overview');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  
  // UI State
  const [newTodo, setNewTodo] = useState('');
  const [newEvent, setNewEvent] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Sync State
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  // Timer State
  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);

  // --- Optimized Sync Logic ---
  // Uses the "Override Pattern" to prevent stale state bugs during rapid updates
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    if (!session) return;

    setIsSyncing(true);
    setSyncError(false);

    const finalData = {
      todos,
      studySessions,
      events,
      loginStreak,
      lastLogin,
      ...overrides
    };

    try {
      // 1. Sync to Cloud
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });

      if (!response.ok) throw new Error('Cloud sync failed');

      // 2. Sync to Local Storage as backup
      storage.set('study_todos', finalData.todos);
      storage.set('study_events', finalData.events);
      storage.set('study_sessions', finalData.studySessions);
    } catch (error) {
      console.error("Sync Error:", error);
      setSyncError(true);
    } finally {
      setIsSyncing(false);
    }
  }, [session, todos, studySessions, events, loginStreak, lastLogin]);

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

  const handleAddEvent = async () => {
    if (!newEvent.trim()) return;
    const dateKey = new Date(newEventDate).toDateString();
    const nextEvents = {
      ...events,
      [dateKey]: [...(events[dateKey] || []), { id: Date.now(), text: newEvent, time: newEventTime }]
    };
    setEvents(nextEvents);
    setNewEvent('');
    await syncData({ events: nextEvents });
  };

  const handleDeleteEvent = async (dateKey: string, eventId: number) => {
    const nextEvents = { ...events };
    nextEvents[dateKey] = nextEvents[dateKey].filter(e => e.id !== eventId);
    if (nextEvents[dateKey].length === 0) delete nextEvents[dateKey];
    
    setEvents(nextEvents);
    await syncData({ events: nextEvents });
  };

  const handleStopStudy = async () => {
    if (!studyStartTime) return;
    const duration = Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
    const today = new Date().toDateString();
    const nextSessions = { ...studySessions, [today]: (studySessions[today] || 0) + duration };
    
    setStudySessions(nextSessions);
    setIsStudying(false);
    setStudyStartTime(null);
    await syncData({ studySessions: nextSessions });
  };

  // --- Initialization ---
  useEffect(() => {
    if (status === 'authenticated') {
      const init = async () => {
        const res = await fetch('/api/sync');
        const { data } = await res.json();
        if (data) {
          setTodos(data.todos || []);
          setEvents(data.events || {});
          setStudySessions(data.studySessions || {});
          setLoginStreak(data.loginStreak || 0);
          setLastLogin(data.lastLogin || '');
        }
      };
      init();
    }
  }, [status]);

  // Clock tick for timer display
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- View Helper ---
  const currentSessionSeconds = useMemo(() => {
    if (!isStudying || !studyStartTime) return 0;
    return Math.floor((currentTime.getTime() - studyStartTime.getTime()) / 1000);
  }, [isStudying, studyStartTime, currentTime]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      {/* Sync Notification */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-100 text-sm font-bold animate-in fade-in slide-in-from-bottom-4">
        {isSyncing ? (
          <><Loader2 className="animate-spin text-indigo-500" size={18} /> Saving Changes...</>
        ) : syncError ? (
          <><CloudOff className="text-rose-500" size={18} /> Connection Lost</>
        ) : (
          <><CloudCheck className="text-emerald-500" size={18} /> Cloud Sync Active</>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-indigo-950">STUDYFLOW</h1>
            <p className="text-slate-500 font-medium">Welcome back, {session?.user?.name?.split(' ')[0] || 'Student'}</p>
          </div>
          
          <nav className="flex bg-slate-200/50 p-1.5 rounded-2xl backdrop-blur-sm">
            {['overview', 'calendar'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${
                  activeTab === tab ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {activeTab === 'overview' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Timer Module */}
            <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-8">
                <span className="bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">Focus Session</span>
                <div className="flex items-center gap-2 text-orange-600 font-bold">
                  <Flame size={20} /> {loginStreak} Day Streak
                </div>
              </div>

              <div className="text-8xl font-mono text-center my-16 font-bold tracking-tighter text-slate-800">
                {new Date(currentSessionSeconds * 1000).toISOString().substr(11, 8)}
              </div>

              <button 
                onClick={isStudying ? handleStopStudy : () => { setIsStudying(true); setStudyStartTime(new Date()); }}
                className={`w-full py-6 rounded-3xl font-black text-xl transition-all active:scale-[0.97] shadow-xl ${
                  isStudying 
                  ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-200 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200 text-white'
                }`}
              >
                {isStudying ? 'STOP SESSION' : 'START STUDYING'}
              </button>
            </div>

            {/* Todo Sidebar */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                <CheckSquare size={22} className="text-indigo-600" /> TOP PRIORITIES
              </h3>
              
              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newTodo}
                  onChange={(e) => setNewTodo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                  placeholder="New task..."
                  className="flex-1 bg-slate-50 border-none rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-indigo-500"
                />
                <button onClick={handleAddTodo} className="bg-indigo-600 text-white p-3 rounded-2xl hover:bg-indigo-700 transition-colors">
                  <Plus size={22} />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[400px] pr-2">
                {todos.map(todo => (
                  <div key={todo.id} className="flex items-center justify-between group p-3 bg-slate-50/50 hover:bg-slate-50 rounded-2xl transition-all">
                    <div className="flex items-center gap-4">
                      <input 
                        type="checkbox" 
                        checked={todo.completed} 
                        onChange={() => handleToggleTodo(todo.id)} 
                        className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className={`text-sm font-semibold ${todo.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                        {todo.text}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteTodo(todo.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
            {/* Calendar grid logic goes here - ensure it uses handleDeleteEvent(dateKey, event.id) */}
            <p className="text-slate-400 font-medium text-center">Calendar Module Loaded</p>
          </div>
        )}
      </div>
    </div>
  );
}