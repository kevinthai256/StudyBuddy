"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckSquare, Flame, Plus, Trash2, ChevronLeft, ChevronRight, Clock, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SessionProvider, useSession } from 'next-auth/react';

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
  
  const [activeTab, setActiveTab] = useState('overview');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [newEvent, setNewEvent] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
  const [studyTimeToday, setStudyTimeToday] = useState(0);
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});

  // --- Optimized Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    if (!session) return;
    setIsSyncing(true);
    const finalData = { todos, studySessions, events, loginStreak, lastLogin, ...overrides };
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });
      if (response.ok) {
        setLastSyncTime(new Date());
        storage.set('study_todos', finalData.todos);
        storage.set('study_events', finalData.events);
        storage.set('study_sessions', finalData.studySessions);
      }
    } catch (error) { console.error('Cloud Sync Error:', error); } finally { setIsSyncing(false); }
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
    // Fix: Parse date parts to avoid UTC shift
    const [year, month, day] = newEventDate.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day); 
    const dateKey = eventDate.toDateString();
    const nextEvents = { ...events, [dateKey]: [...(events[dateKey] || []), { id: Date.now(), text: newEvent, time: newEventTime }] };
    setEvents(nextEvents);
    setNewEvent('');
    setNewEventTime('');
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
    if (studyStartTime) {
      const duration = Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
      const today = new Date().toDateString();
      const nextSessions = { ...studySessions, [today]: (studySessions[today] || 0) + duration };
      setStudySessions(nextSessions);
      setStudyTimeToday(nextSessions[today]);
      setIsStudying(false);
      setStudyStartTime(null);
      await syncData({ studySessions: nextSessions });
    }
  };

  // --- Utilities & Logic ---
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
    const days = Math.floor(diff / 86400000), hrs = Math.floor((diff % 86400000) / 3600000), mins = Math.floor((diff % 3600000) / 60000);
    return days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
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
        borderColor: 'rgb(59, 130, 246)', tension: 0.4, fill: true, backgroundColor: 'rgba(59, 130, 246, 0.1)'
      }]
    };
  }, [studySessions, isStudying, currentTime]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const formatStopwatch = (s: number) => `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const renderCalendar = () => {
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const days = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(<div key={`e-${i}`} className="h-16 sm:h-20 border border-gray-200 bg-gray-50"></div>);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d);
      const key = date.toDateString();
      const isToday = key === new Date().toDateString();
      const hasEvents = (events[key] || []).length;
      days.push(
        <div key={d} onClick={() => setSelectedDate(date)} className={`h-16 sm:h-20 border border-gray-200 p-1 cursor-pointer transition-colors hover:bg-blue-50 ${isToday ? 'bg-blue-100 ring-2 ring-inset ring-blue-500' : 'bg-white'}`}>
          <div className={`font-black text-sm sm:text-base ${isToday ? 'text-blue-800' : 'text-gray-900'}`}>{d}</div>
          {hasEvents > 0 && <div className="text-[10px] sm:text-xs font-black text-blue-700">{hasEvents} Event(s)</div>}
        </div>
      );
    }
    return days;
  };

  // --- Effects ---
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

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-200">
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
                <div className="text-xl sm:text-2xl font-black text-orange-700">{loginStreak} <span className="text-xs font-bold text-gray-700">Day Streak</span></div>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          {['overview', 'todos', 'timer', 'calendar'].map(id => (
            <button key={id} onClick={() => setActiveTab(id)} className={`px-6 py-3 rounded-lg font-black transition-all capitalize ${activeTab === id ? 'bg-blue-700 text-white shadow-lg scale-105' : 'bg-white text-gray-700 border border-gray-200'}`}>
              {id === 'todos' ? 'To-Do List' : id === 'timer' ? 'Study Timer' : id}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900"><CheckSquare className="text-blue-700"/>Quick Tasks</h3>
              <div className="space-y-3">
                {todos.slice(0, 5).map(t => (
                  <div key={t.id} className="flex items-center gap-3">
                    <input type="checkbox" checked={t.completed} onChange={() => handleToggleTodo(t.id)} className="w-5 h-5 border-gray-400 text-blue-700 rounded"/>
                    <span className={`text-base font-bold ${t.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200 text-center">
              <h3 className="text-lg font-black mb-4 flex items-center justify-center gap-2 text-gray-900"><Clock className="text-blue-700"/>Focused Time</h3>
              <div className="text-5xl font-black text-blue-800 mb-1">{formatTime(studyTimeToday + getCurrentSessionTime())}</div>
              {isStudying && <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full font-black text-xs animate-pulse">LIVE: {formatStopwatch(getCurrentSessionTime())}</div>}
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h3 className="text-lg font-black mb-4 flex items-center gap-2 text-gray-900"><Calendar className="text-blue-700"/>Upcoming</h3>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {Object.entries(events).sort(([a],[b]) => new Date(a).getTime() - new Date(b).getTime()).filter(([d]) => new Date(d) >= new Date().setHours(0,0,0,0)).slice(0, 5).flatMap(([dk, evts]) => 
                  evts.map(e => {
                    const cd = getTimeUntilEvent(dk, e.time);
                    if (!cd) return null;
                    const isToday = dk === new Date().toDateString();
                    return (
                      <div key={e.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${isToday ? 'bg-blue-50 border-blue-300 border-l-8' : 'bg-gray-50 border-gray-200 border-l-4'}`}>
                        <div className="flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black uppercase text-gray-600">{isToday ? 'Today' : new Date(dk).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${isToday ? 'bg-blue-700 text-white animate-pulse' : 'bg-orange-200 text-orange-900'}`}>{cd.toUpperCase()}</span>
                          </div>
                          <div className="text-sm font-black text-gray-900">{e.text}</div>
                        </div>
                        <button onClick={() => handleDeleteEvent(dk, e.id)} className="bg-white border-2 border-emerald-500 text-emerald-600 p-2 rounded-full hover:bg-emerald-500 hover:text-white transition-all shadow-sm flex-shrink-0"><CheckSquare size={18}/></button>
                      </div>
                    );
                  })
                ).filter(Boolean)}
              </div>
            </div>
            <div className="lg:col-span-3 bg-white rounded-lg shadow-md p-6 border border-gray-200 h-80"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} /></div>
          </div>
        )}

        {activeTab === 'timer' && (
          <div className="bg-white rounded-lg shadow-md p-10 border border-gray-200 text-center max-w-2xl mx-auto">
            <div className="text-8xl font-mono font-black text-blue-700 mb-8">{isStudying ? formatStopwatch(getCurrentSessionTime()) : formatStopwatch(studyTimeToday)}</div>
            <button onClick={isStudying ? handleStopStudy : () => { setIsStudying(true); setStudyStartTime(new Date()); }} className={`px-12 py-5 rounded-full font-black text-white text-2xl shadow-xl transform transition hover:scale-105 ${isStudying ? 'bg-red-600' : 'bg-green-600'}`}>{isStudying ? 'Stop' : 'Start Focus'}</button>
          </div>
        )}

        {activeTab === 'todos' && (
          <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200 max-w-2xl mx-auto">
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
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
              <h3 className="text-xl font-black mb-4">Add Event</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div><label className="block text-xs font-black uppercase text-gray-700 mb-1">Date</label><input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full px-3 py-3 border border-gray-400 bg-white rounded-lg text-base font-bold"/></div>
                <div><label className="block text-xs font-black uppercase text-gray-700 mb-1">Time</label><input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full px-3 py-3 border border-gray-400 bg-white rounded-lg text-base font-bold"/></div>
                <div className="lg:col-span-2"><label className="block text-xs font-black uppercase text-gray-700 mb-1">Event</label><input type="text" value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="Description..." className="w-full px-3 py-3 border border-gray-400 bg-white rounded-lg text-base font-bold"/></div>
              </div>
              <button onClick={handleAddEvent} className="bg-blue-700 text-white px-10 py-3 rounded-lg font-black shadow-md transition hover:bg-blue-800 active:scale-95">Add Event</button>
            </div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">{monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}</h2>
              <div className="flex gap-2">
                <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))} className="p-2 border border-gray-300 rounded-lg"><ChevronLeft/></button>
                <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))} className="p-2 border border-gray-300 rounded-lg"><ChevronRight/></button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-2 bg-gray-100 text-center font-black py-2 uppercase text-xs">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid grid-cols-7 border-l border-t border-gray-200">{renderCalendar()}</div>
            <div className="mt-8 border-t-4 border-gray-200 pt-6">
              <h3 className="font-black text-xl mb-4 uppercase">Schedule for {selectedDate.toDateString()}</h3>
              <div className="space-y-3">
                {(events[selectedDate.toDateString()] || []).sort((a,b) => (a.time||'').localeCompare(b.time||'')).map(e => (
                  <div key={e.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition hover:bg-white">
                    <span className="text-base font-bold text-gray-900">{e.time && <span className="text-blue-700 font-black mr-2">{e.time} —</span>}{e.text}</span>
                    <button onClick={() => handleDeleteEvent(selectedDate.toDateString(), e.id)} className="text-red-600 p-1"><Trash2 size={20}/></button>
                  </div>
                ))}
                {!(events[selectedDate.toDateString()] || []).length && <p className="text-gray-500 font-black text-center py-6 italic border-2 border-dashed border-gray-200 rounded-xl">Nothing scheduled</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}