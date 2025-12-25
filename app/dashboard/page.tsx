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

  // --- Sync Logic ---
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
      ...overrides // Merges updates to bypass React's async state delay
    };

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });

      if (!response.ok) throw new Error('Cloud sync failed');

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

  // --- Calendar Logic ---
  const getDaysInMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { daysInMonth: lastDay.getDate(), startingDayOfWeek: firstDay.getDay() };
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(selectedDate);
    const days = [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-20 border border-slate-100 bg-slate-50/30"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const dateKey = date.toDateString();
      const dayEvents = events[dateKey] || [];
      const isToday = dateKey === new Date().toDateString();
      const isSelected = dateKey === selectedDate.toDateString();

      days.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          className={`h-20 border border-slate-100 p-2 cursor-pointer transition-all hover:bg-indigo-50/50 ${
            isToday ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : isSelected ? 'bg-slate-50' : ''
          }`}
        >
          <div className={`text-xs font-bold ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>{day}</div>
          {dayEvents.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {dayEvents.slice(0, 2).map(e => (
                <div key={e.id} className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              ))}
              {dayEvents.length > 2 && <span className="text-[8px] font-bold text-indigo-400">+{dayEvents.length - 2}</span>}
            </div>
          )}
        </div>
      );
    }
    return days;
  };

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 font-sans">
      {/* Cloud Status */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-100 text-sm font-bold">
        {isSyncing ? (
          <><Loader2 className="animate-spin text-indigo-500" size={18} /> Syncing...</>
        ) : syncError ? (
          <><CloudOff className="text-rose-500" size={18} /> Sync Error</>
        ) : (
          <><CloudCheck className="text-emerald-500" size={18} /> Data Secured</>
        )}
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-8">
        <header className="flex justify-between items-center mb-10">
          <h1 className="text-3xl font-black tracking-tighter text-indigo-950">STUDYFLOW</h1>
          <nav className="flex bg-slate-200/50 p-1.5 rounded-2xl">
            {['overview', 'calendar'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all capitalize ${
                  activeTab === tab ? 'bg-white shadow-md text-indigo-600' : 'text-slate-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </header>

        {activeTab === 'calendar' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Calendar Controls & Grid */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-800">
                  {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(selectedDate)}
                </h2>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft size={20}/></button>
                  <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight size={20}/></button>
                </div>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 rounded-2xl overflow-hidden border border-slate-100">
                {renderCalendar()}
              </div>
            </div>

            {/* Event Manager Sidebar */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-black mb-4 uppercase tracking-widest text-indigo-600">Add Event</h3>
                <div className="space-y-3">
                  <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-sm" />
                  <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-sm" />
                  <input type="text" placeholder="Event description" value={newEvent} onChange={e => setNewEvent(e.target.value)} className="w-full bg-slate-50 border-none rounded-xl px-4 py-2 text-sm" />
                  <button onClick={handleAddEvent} className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">ADD EVENT</button>
                </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-black mb-4 uppercase tracking-widest text-slate-400">Schedule for {selectedDate.toLocaleDateString()}</h3>
                <div className="space-y-3">
                  {(events[selectedDate.toDateString()] || []).length > 0 ? (
                    events[selectedDate.toDateString()].map(event => (
                      <div key={event.id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                        <div className="text-sm">
                          {event.time && <span className="text-indigo-600 font-bold mr-2">{event.time}</span>}
                          <span className="text-slate-700 font-medium">{event.text}</span>
                        </div>
                        <button onClick={() => handleDeleteEvent(selectedDate.toDateString(), event.id)} className="text-slate-300 hover:text-rose-500 transition-colors"><Trash2 size={16}/></button>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic text-center py-4">No events scheduled</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[3rem] border border-slate-100">
            <p className="text-slate-400 font-bold">Overview Tab Ready (Insert Timer/Chart Logic Here)</p>
          </div>
        )}
      </div>
    </div>
  );
}