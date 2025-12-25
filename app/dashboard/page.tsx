"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckSquare, Upload, Flame, Plus, Trash2, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
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
  
  // --- State ---
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
    if (!session) return; //

    setIsSyncing(true);
    const finalData = {
      todos,
      studySessions,
      events,
      loginStreak,
      lastLogin,
      ...overrides // Overrides bypass state staleness
    };

    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });

      if (response.ok) {
        setLastSyncTime(new Date());
        // Backup to local storage
        storage.set('study_todos', finalData.todos);
        storage.set('study_events', finalData.events);
        storage.set('study_sessions', finalData.studySessions);
      }
    } catch (error) {
      console.error('Failed to save to cloud:', error);
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
    await syncData({ events: nextEvents }); // Correctly syncs deleted state
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

  // --- Lifecycle & Initialization ---
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), isStudying ? 1000 : 60000);
    return () => clearInterval(timer);
  }, [isStudying]);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      const loadCloud = async () => {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setTodos(data.todos || []);
            setStudySessions(data.studySessions || {});
            setEvents(data.events || {});
            setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || '');
            setStudyTimeToday(data.studySessions?.[new Date().toDateString()] || 0);
          }
        } finally { setIsSyncing(false); }
      };
      loadCloud();
    }
  }, [status, session]);

  // --- UI Helpers ---
  const getCurrentSessionTime = (): number => {
    if (!isStudying || !studyStartTime) return 0;
    return Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
  };

  const chartData = useMemo(() => {
    const today = new Date().toDateString();
    const curTime = getCurrentSessionTime();
    return {
      labels: Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: 'Time Studied',
        data: Array.from({ length: 7 }, (_, i) => {
          const d = new Date(); d.setDate(d.getDate() - (6 - i));
          const key = d.toDateString();
          return (studySessions[key] || 0) + (key === today ? curTime : 0);
        }),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }]
    };
  }, [studySessions, isStudying, currentTime]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}hr ${minutes}min ${secs}sec`;
    if (minutes > 0) return `${minutes}min ${secs}sec`;
    return `${secs}sec`;
  };

  const formatStopwatch = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderCalendar = () => {
    const firstDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const lastDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    const days = [];
    for (let i = 0; i < startingDay; i++) days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 border border-gray-200"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const key = date.toDateString();
      const dayEvents = events[key] || [];
      const isToday = key === new Date().toDateString();
      days.push(
        <div key={day} onClick={() => setSelectedDate(date)} className={`h-16 sm:h-20 border border-gray-200 p-1 cursor-pointer hover:bg-blue-50 ${isToday ? 'bg-blue-100' : ''}`}>
          <div className="font-semibold text-xs sm:text-sm">{day}</div>
          {dayEvents.length > 0 && <div className="text-[10px] sm:text-xs text-blue-600 truncate">{dayEvents.length} event(s)</div>}
        </div>
      );
    }
    return days;
  };

  const getTimeUntilEvent = (dateStr: string, timeStr?: string) => {
    const d = new Date(dateStr);
    if (timeStr) { const [h, m] = timeStr.split(':').map(Number); d.setHours(h, m, 0, 0); }
    const diff = d.getTime() - new Date().getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const firstName = session?.user?.name?.split(' ')[0] || '!';
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Hello {firstName}!</h1>
            <div className="flex items-center gap-3">
              {session && (
                <div className="flex items-center gap-2 text-sm text-gray-800">
                  {isSyncing ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div><span>Syncing...</span></>
                  ) : lastSyncTime ? (
                    <span className="text-green-600">✓ Synced</span>
                  ) : null}
                </div>
              )}
              <div className="flex items-center gap-2 bg-orange-100 px-3 sm:px-4 py-2 rounded-lg">
                <Flame className="text-orange-500" size={20} />
                <div><div className="text-xl sm:text-2xl font-bold text-orange-600">{loginStreak}</div><div className="text-xs text-gray-600">Day Streak</div></div>
              </div>
            </div>
          </div>
          {session && <div className="mt-2 text-sm text-gray-600">Signed in as {session.user?.email}</div>}
        </header>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
          {[
            { id: 'overview', icon: CheckSquare, label: 'Overview' },
            { id: 'todos', icon: CheckSquare, label: 'To-Do List' },
            { id: 'timer', icon: Clock, label: 'Study Timer' },
            { id: 'calendar', icon: Calendar, label: 'Calendar' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              <tab.icon size={18} className="sm:w-5 sm:h-5" />{tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2"><CheckSquare className="text-blue-600" size={18} />Quick Tasks</h3>
              {todos.length > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{todos.filter(t => t.completed).length} of {todos.length} done</span>
                    <span>{Math.round((todos.filter(t => t.completed).length / (todos.length || 1)) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${(todos.filter(t => t.completed).length / (todos.length || 1)) * 100}%` }}></div>
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm sm:text-base">
                {todos.slice(0, 5).map(todo => (
                  <div key={todo.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={todo.completed} onChange={() => handleToggleTodo(todo.id)} className="w-4 h-4" />
                    <span className={`${todo.completed ? 'line-through text-gray-600' : ''} break-words`}>{todo.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2"><Clock className="text-blue-600" size={18} />Study Time Today</h3>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600">{formatTime(studyTimeToday + getCurrentSessionTime())}</div>
                <div className="text-sm sm:text-base text-gray-600">Time Studied</div>
                {isStudying && <div className="mt-2 text-green-600 font-medium">Currently studying: {formatStopwatch(getCurrentSessionTime())}</div>}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2"><Calendar className="text-blue-600" size={18} />Upcoming Events</h3>
              <div className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(events)
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                  .filter(([d]) => new Date(d) >= new Date(new Date().setHours(0,0,0,0)))
                  .slice(0, 10).flatMap(([d, evts]) =>
                    evts.sort((a,b) => (a.time || '').localeCompare(b.time || '')).map(e => {
                      const cd = getTimeUntilEvent(d, e.time);
                      return cd ? (
                        <div key={e.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="text-xs sm:text-sm font-semibold text-gray-600">{new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                            <div className="text-lg sm:text-xl font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-lg">{cd}</div>
                          </div>
                          <div className="text-base sm:text-lg font-semibold text-gray-800 mb-1">{e.text}</div>
                          {e.time && <div className="text-sm sm:text-base text-blue-600 font-medium">{e.time}</div>}
                        </div>
                      ) : null;
                    })
                  ).filter(Boolean)}
                {Object.entries(events).filter(([d]) => new Date(d) >= new Date().setHours(0,0,0,0)).length === 0 && <div className="text-gray-600 text-center py-8 text-base">No upcoming events</div>}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mt-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Time Studied - Last 7 Days</h3>
            <div className="h-64 sm:h-80"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { callback: (v) => { const s = Number(v); return s >= 3600 ? `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m` : s >= 60 ? `${Math.floor(s/60)}m` : `${s}s`; } } } } }} /></div>
          </div>
        )}

        {activeTab === 'timer' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Study Timer</h2>
            <div className="text-center mb-6">
              <div className="text-6xl sm:text-8xl font-mono font-bold text-blue-600 mb-4">{isStudying ? formatStopwatch(getCurrentSessionTime()) : formatStopwatch(studyTimeToday)}</div>
              <div className="text-lg sm:text-xl text-gray-600 mb-6">{isStudying ? 'Currently Studying' : 'Total Today'}</div>
              <button onClick={isStudying ? handleStopStudy : () => { setIsStudying(true); setStudyStartTime(new Date()); }} className={`px-8 py-4 rounded-full font-bold text-white text-lg transition-all transform hover:scale-105 ${isStudying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                {isStudying ? 'Stop Studying' : 'Start Studying'}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">Today's Progress</h3>
                <div className="text-2xl font-bold text-blue-600">{formatTime(studyTimeToday + getCurrentSessionTime())}</div>
                <div className="text-sm text-blue-600">Time spent studying</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">Current Session</h3>
                <div className="text-2xl font-bold text-green-600">{isStudying ? formatStopwatch(getCurrentSessionTime()) : '00:00:00'}</div>
                <div className="text-sm text-green-600">{isStudying ? 'Active' : 'Not studying'}</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'todos' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">To-Do List</h2>
            {todos.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium text-gray-700">Progress</span><span className="text-sm font-medium text-gray-700">{todos.filter(t => t.completed).length} / {todos.length} completed</span></div>
                <div className="w-full bg-gray-200 rounded-full h-3"><div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${(todos.filter(t => t.completed).length / todos.length) * 100}%` }}></div></div>
                <div className="text-center mt-2"><span className="text-lg font-bold text-blue-600">{Math.round((todos.filter(t => t.completed).length / todos.length) * 100)}%</span><span className="text-sm text-gray-600 ml-1">Complete</span></div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
              <input type="text" value={newTodo} onChange={(e) => setNewTodo(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddTodo()} placeholder="Add a new task..." className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base" />
              <button onClick={handleAddTodo} className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"><Plus size={18} />Add</button>
            </div>
            <div className="space-y-2">
              {todos.map(todo => (
                <div key={todo.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg text-sm sm:text-base">
                  <input type="checkbox" checked={todo.completed} onChange={() => handleToggleTodo(todo.id)} className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  <span className={`flex-1 break-words ${todo.completed ? 'line-through text-gray-600' : ''}`}>{todo.text}</span>
                  <button onClick={() => handleDeleteTodo(todo.id)} className="text-red-500 hover:text-red-700 flex-shrink-0"><Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-xl font-bold mb-4">Add New Event</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Date</label><input type="date" value={newEventDate} onChange={(e) => setNewEventDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Time</label><input type="time" value={newEventTime} onChange={(e) => setNewEventTime(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div className="sm:col-span-2 lg:col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Event</label><input type="text" value={newEvent} onChange={(e) => setNewEvent(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddEvent()} placeholder="Event description..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <button onClick={handleAddEvent} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium">Add Event</button>
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold">Calendar View</h2>
              <div className="flex items-center gap-2 sm:gap-4">
                <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))} className="p-2 hover:bg-gray-100 rounded"><ChevronLeft size={18} /></button>
                <span className="font-semibold text-sm sm:text-base">{monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}</span>
                <button onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))} className="p-2 hover:bg-gray-100 rounded"><ChevronRight size={18} /></button>
              </div>
            </div>
            <div className="grid grid-cols-7 mb-2 sm:mb-4">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="text-center font-semibold p-1 sm:p-2 bg-gray-100 text-xs sm:text-sm">{day}</div>))}</div>
            <div className="grid grid-cols-7 mb-4 sm:mb-6">{renderCalendar()}</div>
            <div className="border-t pt-4 sm:pt-6">
              <h3 className="font-bold mb-3 text-sm sm:text-base">Events for {selectedDate.toDateString()}</h3>
              <div className="space-y-2">
                {(events[selectedDate.toDateString()] || []).sort((a, b) => (a.time || '').localeCompare(b.time || '')).map(e => (
                  <div key={e.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg text-sm sm:text-base">
                    <span className="break-words flex-1 mr-2">{e.time && <span className="text-blue-600 font-medium">{e.time} - </span>}{e.text}</span>
                    <button onClick={() => handleDeleteEvent(selectedDate.toDateString(), e.id)} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                  </div>
                ))}
                {(events[selectedDate.toDateString()] || []).length === 0 && <p className="text-gray-700 text-center py-4">No events for this date</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudyDashboard() {
  return (
    <SessionProvider>
      <StudyDashboardContent />
    </SessionProvider>
  );
}