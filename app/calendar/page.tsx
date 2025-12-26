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

interface Event { id: number; text: string; time?: string; }
interface DashboardData {
  events: Record<string, Event[]>;
  loginStreak: number;
  lastLogin: string;
}

function StudyCalendarContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [newEvent, setNewEvent] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // --- Optimized Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    if (!session) return;
    setIsSyncing(true);
    const finalData = { events, loginStreak, lastLogin, ...overrides };
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: finalData }),
      });
      if (response.ok) {
        setLastSyncTime(new Date());
        storage.set('study_events', finalData.events);
      }
    } catch (error) { console.error('Cloud Sync Error:', error); } finally { setIsSyncing(false); }
  }, [session, events, loginStreak, lastLogin]);

  const handleAddEvent = async () => {
    if (!newEvent.trim()) return;
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
    if (nextEvents[dateKey]?.length === 0) delete nextEvents[dateKey];
    setEvents(nextEvents);
    await syncData({ events: nextEvents });
  };

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
    const d = Math.floor(diff / 86400000), hr = Math.floor((diff % 86400000) / 3600000), min = Math.floor((diff % 3600000) / 60000);
    return d > 0 ? `${d}d ${hr}h` : hr > 0 ? `${hr}h ${min}m` : `${min}m`;
  };

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

  useEffect(() => {
    if (status === 'authenticated' && session) {
      (async () => {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/sync');
          const { data } = await res.json();
          if (data) {
            setEvents(data.events || {});
            setLoginStreak(data.loginStreak || 0);
            setLastLogin(data.lastLogin || '');
          }
        } finally { setIsSyncing(false); }
      })();
    }
  }, [status, session]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

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
          <Link href="/todos" className="px-6 py-3 rounded-lg font-black transition-all bg-white text-gray-700 border border-gray-200">Tasks</Link>
          <Link href="/calendar" className="px-6 py-3 rounded-lg font-black transition-all bg-blue-700 text-white shadow-lg scale-105">Calendar</Link>
        </div>

        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <div className="mb-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
            <h3 className="text-xl font-black mb-4">Add Event</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div><label className="block text-xs font-black uppercase text-gray-700 mb-1">Date</label><input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full px-3 py-3 border border-gray-400 bg-white rounded-lg text-base font-bold"/></div>
              <div><label className="block text-xs font-black uppercase text-gray-700 mb-1">Time</label><input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full px-3 py-3 border border-gray-400 bg-white rounded-lg text-base font-bold"/></div>
              <div className="lg:col-span-2"><label className="block text-xs font-black uppercase text-gray-700 mb-1">Event</label><input type="text" value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="Description..." className="w-full px-3 py-3 border border-gray-400 bg-white rounded-lg text-base font-bold"/></div>
            </div>
            <button onClick={handleAddEvent} className="bg-blue-700 text-white px-10 py-3 rounded-lg font-black transition hover:bg-blue-800 active:scale-95">Add Event</button>
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
                <div key={e.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 transition hover:bg-white">
                  <span className="text-base font-bold text-gray-900">{e.time && <span className="text-blue-700 font-black mr-2">{e.time} —</span>}{e.text}</span>
                  <button onClick={() => handleDeleteEvent(selectedDate.toDateString(), e.id)} className="text-red-600 p-1"><Trash2 size={20}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Next.js Default Export Wrapper
export default function StudyCalendar() {
  return (
    <SessionProvider>
      <StudyCalendarContent />
    </SessionProvider>
  );
}