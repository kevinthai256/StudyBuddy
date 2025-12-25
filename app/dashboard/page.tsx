"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckSquare, Upload, Flame, Plus, Trash2, ChevronLeft, ChevronRight, X, Clock } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import { SessionProvider, useSession } from 'next-auth/react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

// Storage utility for client-side storage
const storage = {
  get: async (key: string): Promise<{ value: string } | null> => {
    if (typeof window === 'undefined') return null;
    try {
      const value = localStorage.getItem(key);
      return value ? { value } : null;
    } catch {
      return null;
    }
  },
  set: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Handle storage errors silently
    }
  }
};

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

  // Study timer state
  const [isStudying, setIsStudying] = useState(false);
  const [studyStartTime, setStudyStartTime] = useState<Date | null>(null);
  const [studyTimeToday, setStudyTimeToday] = useState(0);
  const [studySessions, setStudySessions] = useState<Record<string, number>>({});

  // Update current time every minute for countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Update study timer every second when active
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isStudying) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStudying]);

  // Redirect to login if not authenticated and no local storage data exists
  useEffect(() => {
    if (status === 'unauthenticated') {
      // Check if user has any local data (meaning they used "continue without saving")
      const hasLocalData = localStorage.getItem('study_todos') || 
                          localStorage.getItem('study_sessions') || 
                          localStorage.getItem('study_events');
      
      if (!hasLocalData) {
        // No local data and not authenticated - redirect to login
        router.push('/');
      } else {
        // Has local data, load it
        loadFromLocal();
      }
    } else if (status === 'authenticated' && session) {
      loadFromCloud();
    }
  }, [status, session, router]);

  const loadFromLocal = async () => {
    try {
      const [todosRes, studySessionsRes, streakRes, lastLoginRes, eventsRes] = await Promise.all([
        storage.get('study_todos').catch(() => null),
        storage.get('study_sessions').catch(() => null),
        storage.get('study_streak').catch(() => null),
        storage.get('study_last_login').catch(() => null),
        storage.get('study_events').catch(() => null)
      ]);

      if (todosRes?.value) setTodos(JSON.parse(todosRes.value));
      if (studySessionsRes?.value) setStudySessions(JSON.parse(studySessionsRes.value));
      if (eventsRes?.value) setEvents(JSON.parse(eventsRes.value));
      
      handleLoginStreak(streakRes, lastLoginRes);
    } catch (error) {
      console.error('Error loading local data:', error);
    }
  };

  const loadFromCloud = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync');
      const { data } = await response.json();
      
      if (data) {
        // User has existing data
        setTodos(data.todos || []);
        setStudySessions(data.studySessions || {});
        setEvents(data.events || {});
        setLoginStreak(data.loginStreak || 0);
        setLastLogin(data.lastLogin || '');
        
        // Calculate today's study time
        const today = new Date().toDateString();
        const todayStudyTime = data.studySessions?.[today] || 0;
        setStudyTimeToday(todayStudyTime);
        
        // Also save to local storage as backup
        await storage.set('study_todos', JSON.stringify(data.todos || []));
        await storage.set('study_sessions', JSON.stringify(data.studySessions || {}));
        await storage.set('study_events', JSON.stringify(data.events || {}));
        
        setLastSyncTime(new Date());
      } else {
        // New user - initialize with empty data (0 minutes of studying)
        setTodos([]);
        setStudySessions({});
        setEvents({});
        setLoginStreak(0);
        setLastLogin('');
        setStudyTimeToday(0);
        
        // Clear any local storage to start fresh
        await storage.set('study_todos', JSON.stringify([]));
        await storage.set('study_sessions', JSON.stringify({}));
        await storage.set('study_events', JSON.stringify({}));
        
        setLastSyncTime(new Date());
      }
    } catch (error) {
      console.error('Failed to load from cloud:', error);
      // On error, initialize with empty data for new users
      setTodos([]);
      setStudySessions({});
      setEvents({});
      setLoginStreak(0);
      setLastLogin('');
      setStudyTimeToday(0);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLoginStreak = async (streakRes: any, lastLoginRes: any) => {
    const today = new Date().toDateString();
    const savedLastLogin = lastLoginRes?.value || '';
    const savedStreak = streakRes?.value ? parseInt(streakRes.value) : 0;
    
    if (savedLastLogin !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (savedLastLogin === yesterday.toDateString()) {
        const newStreak = savedStreak + 1;
        setLoginStreak(newStreak);
        await storage.set('study_streak', newStreak.toString());
      } else {
        setLoginStreak(1);
        await storage.set('study_streak', '1');
      }
      
      setLastLogin(today);
      await storage.set('study_last_login', today);
    } else {
      setLoginStreak(savedStreak);
      setLastLogin(savedLastLogin);
    }

    // Calculate today's study time
    const today2 = new Date().toDateString();
    const todayStudyTime = studySessions[today2] || 0;
    setStudyTimeToday(todayStudyTime);
  };

  const saveToCloud = async () => {
    if (!session) return;
    
    setIsSyncing(true);
    try {
      const data = {
        todos,
        studySessions,
        events,
        loginStreak,
        lastLogin,
      };
      
      await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });
      
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Failed to save to cloud:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-save to cloud whenever data changes (debounced)
  useEffect(() => {
    if (session) {
      const timeoutId = setTimeout(() => {
        saveToCloud();
      }, 2000); // Debounce for 2 seconds
      
      return () => clearTimeout(timeoutId);
    }
  }, [todos, studySessions, events, loginStreak, session]);

  const getCurrentSessionTime = (): number => {
    if (!isStudying || !studyStartTime) return 0;
    return Math.floor((new Date().getTime() - studyStartTime.getTime()) / 1000);
  };

  const chartData = useMemo(() => {
    const today = new Date().toDateString();
    const currentSessionTime = getCurrentSessionTime();
    
    return {
      labels: Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }),
      datasets: [{
        label: 'Time Studied',
        data: Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          const dateKey = date.toDateString();
          let totalSeconds = studySessions[dateKey] || 0;
          
          if (dateKey === today) {
            totalSeconds += currentSessionTime;
          }
          
          return totalSeconds;
        }),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
        fill: true,
      }]
    };
  }, [studySessions, isStudying, currentTime]);

  const addTodo = async () => {
    if (!newTodo.trim()) return;
    const newTodos = [...todos, { id: Date.now(), text: newTodo, completed: false }];
    setTodos(newTodos);
    setNewTodo('');
    await storage.set('study_todos', JSON.stringify(newTodos));
  };

  const toggleTodo = async (id: number) => {
    const newTodos = todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTodos(newTodos);
    await storage.set('study_todos', JSON.stringify(newTodos));
  };

  const deleteTodo = async (id: number) => {
    const newTodos = todos.filter(t => t.id !== id);
    setTodos(newTodos);
    await storage.set('study_todos', JSON.stringify(newTodos));
  };

  const startStudySession = () => {
    setIsStudying(true);
    setStudyStartTime(new Date());
  };

  const stopStudySession = async () => {
    if (studyStartTime) {
      const endTime = new Date();
      const sessionDuration = Math.floor((endTime.getTime() - studyStartTime.getTime()) / 1000);
      
      const today = new Date().toDateString();
      const updatedSessions = {
        ...studySessions,
        [today]: (studySessions[today] || 0) + sessionDuration
      };
      
      setStudySessions(updatedSessions);
      setStudyTimeToday(updatedSessions[today]);
      setIsStudying(false);
      setStudyStartTime(null);
      
      await storage.set('study_sessions', JSON.stringify(updatedSessions));
    }
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      if (minutes > 0 && secs > 0) {
        return `${hours}hr ${minutes}min ${secs}sec`;
      } else if (minutes > 0) {
        return `${hours}hr ${minutes}min`;
      } else if (secs > 0) {
        return `${hours}hr ${secs}sec`;
      }
      return `${hours}hr`;
    } else if (minutes > 0) {
      if (secs > 0) {
        return `${minutes}min ${secs}sec`;
      }
      return `${minutes}min`;
    }
    return `${secs}sec`;
  };

  const formatStopwatch = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const addEvent = async () => {
    if (!newEvent.trim()) return;
    const eventDate = new Date(newEventDate);
    const dateKey = eventDate.toDateString();
    const updatedEvents = {
      ...events,
      [dateKey]: [...(events[dateKey] || []), { id: Date.now(), text: newEvent, time: newEventTime }]
    };
    setEvents(updatedEvents);
    setNewEvent('');
    setNewEventTime('');
    await storage.set('study_events', JSON.stringify(updatedEvents));
  };

  const deleteEvent = async (dateKey: string, eventId: number) => {
    const updatedEvents = {
      ...events,
      [dateKey]: events[dateKey].filter(e => e.id !== eventId)
    };
    if (updatedEvents[dateKey].length === 0) delete updatedEvents[dateKey];
    setEvents(updatedEvents);
    await storage.set('study_events', JSON.stringify(updatedEvents));
  };

  const renderCalendar = () => {
    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(selectedDate);
    const days = [];
    
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 border border-gray-200"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day);
      const dateKey = date.toDateString();
      const dayEvents = events[dateKey] || [];
      const isToday = dateKey === new Date().toDateString();
      
      days.push(
        <div
          key={day}
          className={`h-16 sm:h-20 border border-gray-200 p-1 cursor-pointer hover:bg-blue-50 ${
            isToday ? 'bg-blue-100' : ''
          }`}
          onClick={() => setSelectedDate(date)}
        >
          <div className="font-semibold text-xs sm:text-sm">{day}</div>
          {dayEvents.length > 0 && (
            <div className="text-[10px] sm:text-xs text-blue-600 truncate">{dayEvents.length} event(s)</div>
          )}
        </div>
      );
    }
    
    return days;
  };

  const getTimeUntilEvent = (dateStr: string, timeStr?: string) => {
    const dateParts = dateStr.split(' ');
    if (dateParts.length >= 4) {
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const month = monthNames.indexOf(dateParts[1]);
      const day = parseInt(dateParts[2]);
      const year = parseInt(dateParts[3]);

      const eventDate = new Date(year, month, day);

      if (timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        eventDate.setHours(hours, minutes, 0, 0);
      } else {
        eventDate.setHours(0, 0, 0, 0);
      }

      const now = new Date();
      const diff = eventDate.getTime() - now.getTime();

      if (diff <= 0) return null;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        return `${days}d ${hours}h`;
      } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${minutes}m`;
      }
    }

    return null;
  };
  const firstName = session?.user?.name ? session.user.name.split(' ')[0] : '!';
  const monthNames = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-white rounded-lg shadow-md p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Hey there {firstName}!</h1>
            <div className="flex items-center gap-3">
              {/* Sync Status */}
              {session && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  {isSyncing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                      <span>Syncing...</span>
                    </>
                  ) : lastSyncTime ? (
                    <span className="text-green-600">✓ Synced</span>
                  ) : null}
                </div>
              )}
              
              {/* Login Streak */}
              <div className="flex items-center gap-2 bg-orange-100 px-3 sm:px-4 py-2 rounded-lg">
                <Flame className="text-orange-500" size={20} />
                <div>
                  <div className="text-xl sm:text-2xl font-bold text-orange-600">{loginStreak}</div>
                  <div className="text-xs text-gray-600">Day Streak</div>
                </div>
              </div>
            </div>
          </div>
          
          {session && (
            <div className="mt-2 text-sm text-gray-600">
              Signed in as {session.user?.email}
            </div>
          )}
        </header>

        {/* Rest of your existing dashboard code remains exactly the same */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
          {[
            { id: 'overview', icon: CheckSquare, label: 'Overview' },
            { id: 'todos', icon: CheckSquare, label: 'To-Do List' },
            { id: 'timer', icon: Clock, label: 'Study Timer' },
            { id: 'calendar', icon: Calendar, label: 'Calendar' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center sm:justify-start gap-2 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-medium transition-all text-sm sm:text-base ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={18} className="sm:w-5 sm:h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <CheckSquare className="text-blue-600" size={18} />
                Quick Tasks
              </h3>
              {todos.length > 0 && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{todos.filter(t => t.completed).length} of {todos.length} done</span>
                    <span>{Math.round((todos.filter(t => t.completed).length / todos.length) * 100)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${(todos.filter(t => t.completed).length / todos.length) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
              <div className="space-y-2 text-sm sm:text-base">
                {todos.slice(0, 5).map(todo => (
                  <div key={todo.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => toggleTodo(todo.id)}
                      className="w-4 h-4"
                    />
                    <span className={`${todo.completed ? 'line-through text-gray-400' : ''} break-words`}>
                      {todo.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <Clock className="text-blue-600" size={18} />
                Study Time Today
              </h3>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600">{formatTime(studyTimeToday + getCurrentSessionTime())}</div>
                <div className="text-sm sm:text-base text-gray-600">Time Studied</div>
                {isStudying && (
                  <div className="mt-2 text-green-600 font-medium">
                    Currently studying: {formatStopwatch(getCurrentSessionTime())}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
                <Calendar className="text-blue-600" size={18} />
                Upcoming Events
              </h3>
              <div className="space-y-2 sm:space-y-3 max-h-64 overflow-y-auto">
                {Object.entries(events)
                  .sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime())
                  .filter(([date]) => new Date(date) >= new Date(new Date().setHours(0, 0, 0, 0)))
                  .slice(0, 10)
                  .flatMap(([date, dateEvents]) =>
                    dateEvents
                      .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                      .map(event => {
                        const countdown = getTimeUntilEvent(date, event.time);
                        if (!countdown) return null;
                        return (
                          <div key={event.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 sm:p-4 rounded-lg border border-blue-200">
                            <div className="flex items-center justify-between gap-3 mb-2">
                              <div className="text-xs sm:text-sm font-semibold text-gray-600">
                                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                              </div>
                              <div className="text-lg sm:text-xl font-bold bg-orange-100 text-orange-700 px-3 py-1 rounded-lg">
                                {countdown}
                              </div>
                            </div>
                            <div className="text-base sm:text-lg font-semibold text-gray-800 mb-1">
                              {event.text}
                            </div>
                            {event.time && (
                              <div className="text-sm sm:text-base text-blue-600 font-medium">
                                {event.time}
                              </div>
                            )}
                          </div>
                        );
                      })
                    ).filter(Boolean)}
                  {Object.entries(events).filter(([date]) => new Date(date) >= new Date(new Date().setHours(0, 0, 0, 0))).length === 0 && (
                    <div className="text-gray-400 text-center py-8 text-base">No upcoming events</div>
                  )}
                </div>
              </div>
            </div>
          )}
          {activeTab === 'overview' && (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mt-6">
        <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Time Studied - Last 7 Days</h3>
        <div className="h-64 sm:h-80">
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  display: false,
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: function(value) {
                      const seconds = Number(value);
                      if (seconds >= 3600) {
                        const hours = Math.floor(seconds / 3600);
                        const mins = Math.floor((seconds % 3600) / 60);
                        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                      } else if (seconds >= 60) {
                        const mins = Math.floor(seconds / 60);
                        const secs = seconds % 60;
                        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
                      } else {
                        return `${seconds}s`;
                      }
                    }
                  }
                }
              }
            }}
          />
        </div>
      </div>
    )}

    {activeTab === 'timer' && (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Study Timer</h2>

        <div className="text-center mb-6">
          <div className="text-6xl sm:text-8xl font-mono font-bold text-blue-600 mb-4">
            {isStudying ? formatStopwatch(getCurrentSessionTime()) : formatStopwatch(studyTimeToday)}
          </div>
          <div className="text-lg sm:text-xl text-gray-600 mb-6">
            {isStudying ? 'Currently Studying' : 'Total Today'}
          </div>

          <button
            onClick={isStudying ? stopStudySession : startStudySession}
            className={`px-8 py-4 rounded-full font-bold text-white text-lg transition-all transform hover:scale-105 ${
              isStudying
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-green-500 hover:bg-green-600'
            }`}
          >
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
            <div className="text-2xl font-bold text-green-600">
              {isStudying ? formatStopwatch(getCurrentSessionTime()) : '00:00:00'}
            </div>
            <div className="text-sm text-green-600">
              {isStudying ? 'Active' : 'Not studying'}
            </div>
          </div>
        </div>
      </div>
    )}

    {activeTab === 'todos' && (
      <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">To-Do List</h2>
        
        {todos.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">Progress</span>
              <span className="text-sm font-medium text-gray-700">
                {todos.filter(t => t.completed).length} / {todos.length} completed
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-in-out"
                style={{ width: `${todos.length > 0 ? (todos.filter(t => t.completed).length / todos.length) * 100 : 0}%` }}
              ></div>
            </div>
            <div className="text-center mt-2">
              <span className="text-lg font-bold text-blue-600">
                {Math.round(todos.length > 0 ? (todos.filter(t => t.completed).length / todos.length) * 100 : 0)}%
              </span>
              <span className="text-sm text-gray-600 ml-1">Complete</span>
            </div>
          </div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-2 mb-4 sm:mb-6">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addTodo()}
            placeholder="Add a new task..."
            className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
          />
          <button
            onClick={addTodo}
            className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            <Plus size={18} />
            Add
          </button>
        </div>
        <div className="space-y-2">
          {todos.map(todo => (
            <div key={todo.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gray-50 rounded-lg text-sm sm:text-base">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
              />
              <span className={`flex-1 break-words ${todo.completed ? 'line-through text-gray-400' : ''}`}>
                {todo.text}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="text-red-500 hover:text-red-700 flex-shrink-0"
              >
                <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={newEventDate}
                onChange={(e) => setNewEventDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={newEventTime}
                onChange={(e) => setNewEventTime(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Event</label>
              <input
                type="text"
                value={newEvent}
                onChange={(e) => setNewEvent(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addEvent()}
                placeholder="Enter event description..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>
          <button
            onClick={addEvent}
            className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Add Event
          </button>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">Calendar View</h2>
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1))}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
            </button>
            <span className="font-semibold text-sm sm:text-base">
              {monthNames[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </span>
            <button
              onClick={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1))}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight size={18} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 gap-0 mb-2 sm:mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-semibold p-1 sm:p-2 bg-gray-100 text-xs sm:text-sm">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-0 mb-4 sm:mb-6">
          {renderCalendar()}
        </div>

        <div className="border-t pt-4 sm:pt-6">
          <h3 className="font-bold mb-3 text-sm sm:text-base">
            Events for {selectedDate.toDateString()}
          </h3>
          <div className="space-y-2">
            {(events[selectedDate.toDateString()] || [])
              .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
              .map(event => (
                <div key={event.id} className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded-lg text-sm sm:text-base">
                  <span className="break-words flex-1 mr-2">
                    {event.time && <span className="text-blue-600 font-medium">{event.time}</span>}
                    {event.time && ' - '}
                    {event.text}
                  </span>
                  <button
                    onClick={() => deleteEvent(selectedDate.toDateString(), event.id)}
                    className="text-red-500 hover:text-red-700 flex-shrink-0"
                  >
                    <Trash2 size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </button>
                </div>
              ))}
            {(events[selectedDate.toDateString()] || []).length === 0 && (
              <p className="text-gray-500 text-center py-4">No events for this date</p>
            )}
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

