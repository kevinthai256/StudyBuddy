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

// --- Types & Utilities ---
interface Todo { id: number; text: string; completed: boolean; }
interface Event { id: number; text: string; time?: string; }
interface DashboardData {
  todos: Todo[];
  studySessions: Record<string, number>;
  events: Record<string, Event[]>;
  loginStreak: number;
  lastLogin: string;
}

const storage = {
  set: (key: string, val: any) => localStorage.setItem(key, JSON.stringify(val)),
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
  
  // Sync Status
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);

  // Timer State
  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);

  // --- Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    if (!session) return; //

    setIsSyncing(true);
    setSyncError(false);

    const finalData = {
      todos,
      studySessions,
      events,
      loginStreak,
      lastLogin,
      ...overrides // Prevents React state lag during rapid updates
    };

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });

      if (!response.ok) throw new Error('Sync failed');

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

  // --- Handlers ---
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
    const nextEvents = { ...events, [dateKey]: [...(events[dateKey] || []), { id: Date.now(), text: newEvent, time: newEventTime }] };
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

  const handleStartStudy = () => { setIsStudying(true); setStudyStartTime(new Date()); };

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

  // --- Data Visualization & Time ---
  const currentSessionSeconds = useMemo(() => {
    if (!isStudying || !studyStartTime) return 0;
    return Math.floor((currentTime.getTime() - studyStartTime.getTime()) / 1000);
  }, [isStudying, studyStartTime, currentTime]);

  const formatStopwatch = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const chartData = useMemo(() => {
    const labels = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const data = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = d.toDateString();
      return (studySessions[key] || 0) + (key === new Date().toDateString() ? currentSessionSeconds : 0);
    });
    return {
      labels,
      datasets: [{ label: 'Seconds', data, borderColor: '#4f46e5', tension: 0.4, fill: true, backgroundColor: 'rgba(79, 70, 229, 0.05)' }]
    };
  }, [studySessions, currentSessionSeconds]);

  // --- Initialization ---
  useEffect(() => {
    if (status === 'authenticated') {
      const init = async () => {
        const res = await fetch('/api/sync'); //
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

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Calendar Grid Logic ---
  const renderCalendar = () => {
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(<div key={`e-${i}`} className="h-20 border border-slate-50 bg-slate-50/20" />);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d);
      const key = date.toDateString();
      const hasEvents = (events[key] || []).length > 0;
      const isToday = key === new Date().toDateString();
      days.push(
        <div key={d} onClick={() => setSelectedDate(date)} className={`h-20 border border-slate-100 p-2 cursor-pointer transition-colors hover:bg-indigo-50 ${isToday ? 'bg-indigo-50 font-bold text-indigo-600' : ''}`}>
          <div className="text-xs">{d}</div>
          {hasEvents && <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 mx-auto" />}
        </div>
      );
    }
    return days;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Cloud Indicator */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-white px-5 py-3 rounded-2xl shadow-xl border border-slate-100 text-sm font-bold">
        {isSyncing ? <><Loader2 className="animate-spin text-indigo-500" size={18} /> Syncing...</> : syncError ? <><CloudOff className="text-rose-500" size={18} /> Error</> : <><CloudCheck className="text-emerald-500" size={18} /> Secure</>}
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-black tracking-tighter text-indigo-950">STUDYFLOW</h1>
          <nav className="flex bg-slate-200 p-1 rounded-xl gap-1">
            {['overview', 'todos', 'timer', 'calendar'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${activeTab === t ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>{t}</button>
            ))}
          </nav>
        </header>

        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
                <Flame className="mx-auto mb-2 text-orange-500" />
                <div className="text-2xl font-black">{loginStreak} Days</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Login Streak</div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
                <Clock className="mx-auto mb-2 text-indigo-500" />
                <div className="text-2xl font-black">{formatStopwatch((studySessions[new Date().toDateString()] || 0) + currentSessionSeconds)}</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Studied Today</div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center">
                <CheckSquare className="mx-auto mb-2 text-emerald-500" />
                <div className="text-2xl font-black">{todos.filter(t => t.completed).length} / {todos.length}</div>
                <div className="text-xs text-slate-400 font-bold uppercase tracking-widest">Tasks Done</div>
              </div>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-80">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Study Trends</h3>
              <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          </div>
        )}

        {activeTab === 'timer' && (
          <div className="bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm text-center max-w-2xl mx-auto">
            <div className="text-8xl font-mono font-black tracking-tighter text-slate-800 mb-12">
              {formatStopwatch(currentSessionSeconds)}
            </div>
            <button 
              onClick={isStudying ? handleStopStudy : handleStartStudy}
              className={`w-full py-6 rounded-2xl font-black text-xl transition-all ${isStudying ? 'bg-rose-500 text-white shadow-lg shadow-rose-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'}`}
            >
              {isStudying ? 'STOP SESSION' : 'START FOCUSING'}
            </button>
          </div>
        )}

        {activeTab === 'todos' && (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm max-w-xl mx-auto">
            <div className="flex gap-2 mb-6">
              <input type="text" value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddTodo()} className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2" placeholder="Task description..." />
              <button onClick={handleAddTodo} className="bg-indigo-600 text-white p-2 rounded-xl"><Plus /></button>
            </div>
            <div className="space-y-3">
              {todos.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={t.completed} onChange={() => handleToggleTodo(t.id)} className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    <span className={`text-sm font-bold ${t.completed ? 'line-through text-slate-300' : 'text-slate-700'}`}>{t.text}</span>
                  </div>
                  <button onClick={() => handleDeleteTodo(t.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800">{new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(selectedDate)}</h2>
                <div className="flex gap-1">
                  <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronLeft size={18} /></button>
                  <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))} className="p-2 hover:bg-slate-100 rounded-lg"><ChevronRight size={18} /></button>
                </div>
              </div>
              <div className="grid grid-cols-7 mb-2 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}</div>
              <div className="grid grid-cols-7 rounded-2xl overflow-hidden border border-slate-100">{renderCalendar()}</div>
            </div>
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black uppercase text-indigo-600 mb-4">Add Event</h3>
                <div className="space-y-3">
                  <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl text-xs py-2 px-3" />
                  <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl text-xs py-2 px-3" />
                  <input type="text" placeholder="Description" value={newEvent} onChange={e => setNewEvent(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl text-xs py-2 px-3" />
                  <button onClick={handleAddEvent} className="w-full bg-indigo-600 text-white font-black py-2.5 rounded-xl text-xs">ADD TO CALENDAR</button>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <h3 className="text-xs font-black uppercase text-slate-400 mb-4">{selectedDate.toLocaleDateString()}</h3>
                <div className="space-y-2">
                  {(events[selectedDate.toDateString()] || []).map(e => (
                    <div key={e.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                      <div className="text-xs font-bold text-slate-700">{e.time && <span className="text-indigo-600 mr-2">{e.time}</span>}{e.text}</div>
                      <button onClick={() => handleDeleteEvent(selectedDate.toDateString(), e.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {(events[selectedDate.toDateString()] || []).length === 0 && <div className="text-center text-[10px] text-slate-400 py-4 italic">No events</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}