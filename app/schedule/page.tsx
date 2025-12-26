"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckSquare, Flame, Plus, Trash2, ChevronLeft, ChevronRight, Clock, CloudCheck, CloudOff, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
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

function StudyScheduleContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [loginStreak, setLoginStreak] = useState(0);
  const [lastLogin, setLastLogin] = useState('');
  const [events, setEvents] = useState<Record<string, Event[]>>({});
  const [newEvent, setNewEvent] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  // --- Optimized Sync Engine ---
  const syncData = useCallback(async (overrides: Partial<DashboardData> = {}) => {
    const finalData = { events, loginStreak, lastLogin, ...overrides };
    if (session) {
      setIsSyncing(true);
      try {
        const response = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: finalData }),
        });
        if (response.ok) {
          setLastSyncTime(new Date());
        }
      } catch (error) { console.error('Cloud Sync Error:', error); } finally { setIsSyncing(false); }
    }
    // Always save to localStorage
    storage.set('study_events', finalData.events);
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

  useEffect(() => {
    const loadData = async () => {
      if (status === 'authenticated' && session) {
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
      } else if (status === 'unauthenticated') {
        // Load from localStorage for demo mode
        const eventsData = await storage.get('study_events');
        if (eventsData?.value) setEvents(JSON.parse(eventsData.value));
      }
    };
    loadData();
  }, [status, session]);

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-[var(--color-surface)] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-[var(--color-border)]">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Countdown Schedule</h1>
            <div className="flex items-center gap-3">
              {session && (
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-primary)]">
                  {isSyncing ? <><Loader2 className="animate-spin text-[var(--color-sync-loading)]" size={16}/><span>Syncing...</span></> : lastSyncTime ? <span className="text-[var(--color-sync-success)]">✓ Synced</span> : null}
                </div>
              )}
              <div className="flex items-center gap-2 bg-[var(--color-streak-bg)] px-4 py-2 rounded-lg border border-[var(--color-border)]">
                <Flame className="text-[var(--color-accent)]" size={20} />
                <div className="text-xl sm:text-2xl font-black text-[var(--color-streak-text)]">{loginStreak}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-[var(--color-surface)] rounded-lg p-6 border border-[var(--color-border)]">
          <div className="mb-8">
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {Object.entries(events)
                .sort(([a],[b]) => new Date(a).getTime() - new Date(b).getTime())
                .filter(([d]) => new Date(d).getTime() >= new Date().setHours(0, 0, 0, 0))
                .slice(0, 8).flatMap(([dk, evts]) => 
                evts.map(e => {
                                    const cd = getTimeUntilEvent(dk, e.time);
                                    if (!cd) return null;
                                    const isToday = dk === new Date().toDateString();
                                    
                                    return (
                                      <div 
                                        key={e.id} 
                                        className={`p-4 rounded-xl border flex items-center justify-between gap-4 sm:gap-6 ${
                                          isToday 
                                            ? 'bg-[var(--color-surface-secondary)] border-[var(--color-primary)] border-l-[10px]' 
                                            : 'bg-[var(--color-surface-secondary)] border-[var(--color-border)] border-l-[6px]'
                                        }`}
                                      >
                                        {/* Left Content Area: Holds Date, Countdown, and Description */}
                                        <div className="flex-1 min-w-0"> 
                                          <div className="flex flex-wrap items-center gap-3 mb-2">
                                            {/* Date Text */}
                                            <span className="text-[14px] sm:text-[16px] font-black uppercase text-[var(--color-text-secondary)] truncate">
                                              {isToday ? 'Today' : new Date(dk).toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}
                                            </span>
                                            
                                            {/* Countdown Box - flex-shrink-0 ensures it never squishes */}
                                            <span className={`text-[12px] sm:text-[14px] font-black px-4 py-1.5 rounded-md shadow-sm flex-shrink-0 min-w-[70px] text-center ${
                                              isToday ? 'bg-[var(--color-primary)] text-[var(--color-surface)] animate-pulse' : 'bg-[var(--color-accent)] text-[var(--color-surface)]'
                                            }`}>
                                              {cd.toUpperCase()}
                                            </span>
                                          </div>
                                          
                                          {/* Description - truncate or wrap based on preference */}
                                          <div className="text-lg font-black text-[var(--color-text-primary)] leading-tight break-words">
                                            {e.text}
                                          </div>
                                        </div>
                
                                        {/* Right Action: The Checkbox Button */}
                                        <div className="flex-shrink-0 self-center">
                                          <button 
                                            onClick={() => handleDeleteEvent(dk, e.id)} 
                                            className="bg-[var(--color-surface)] border-2 border-[var(--color-secondary)] text-[var(--color-secondary)] p-2.5 rounded-full hover:bg-[var(--color-secondary)] hover:text-[var(--color-surface)] transition-all shadow-sm active:scale-90"
                                          >
                                            <CheckSquare size={13}/>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
              ).filter(Boolean)}
            </div>
          </div>
          <div className="mt-8">
            <button onClick={() => setIsAddingEvent(!isAddingEvent)} className="w-full flex items-center justify-center gap-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-surface)] py-3 px-4 rounded-lg transition-colors font-medium">
              <Plus size={20} />
              {isAddingEvent ? 'Hide Add Event' : 'Add Event'}
            </button>
            {isAddingEvent && (
              <div className="bg-[var(--color-surface-secondary)] p-6 rounded-xl border border-[var(--color-border)] mt-4">
                <h3 className="text-xl font-black text-[var(--color-text-primary)] mb-4">Add Event</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div><label className="block text-xs font-black uppercase text-[var(--color-text-secondary)] mb-1">Date</label><input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full px-3 py-3 border border-[var(--color-border-secondary)] bg-[var(--color-surface)] rounded-lg text-[var(--color-text-primary)] font-bold"/></div>
                  <div><label className="block text-xs font-black uppercase text-[var(--color-text-secondary)] mb-1">Time</label><input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full px-3 py-3 border border-[var(--color-border-secondary)] bg-[var(--color-surface)] rounded-lg text-[var(--color-text-primary)] font-bold"/></div>
                  <div className="lg:col-span-2"><label className="block text-xs font-black uppercase text-[var(--color-text-secondary)] mb-1">Event</label><input type="text" value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="Description..." className="w-full px-3 py-3 border border-[var(--color-border-secondary)] bg-[var(--color-surface)] rounded-lg text-[var(--color-text-primary)] font-bold"/></div>
                </div>
                <button onClick={handleAddEvent} className="bg-[var(--color-primary)] text-[var(--color-surface)] px-10 py-3 rounded-lg font-black transition hover:bg-[var(--color-primary-hover)] active:scale-95">Add Event</button>
              </div>
            )}
          </div>
        </div>
        {/* --- OPTIMIZED NAVIGATION BUTTONS --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <Link 
            href="/dashboard" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-surface-secondary)] active:scale-95 text-sm sm:text-base"
          >
            Overview
          </Link>
          <Link 
            href="/timer" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-surface-secondary)] active:scale-95 text-sm sm:text-base"
          >
            Timer
          </Link>
          <Link 
            href="/todos" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-surface-secondary)] active:scale-95 text-sm sm:text-base"
          >
            Tasks
          </Link>
          <Link 
            href="/schedule" 
            className="flex items-center justify-center px-4 py-4 rounded-xl font-black transition-all bg-[var(--color-primary)] text-[var(--color-surface)] shadow-lg shadow-blue-200 active:scale-95 text-sm sm:text-base"
          >
            Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}

// Next.js Default Export Wrapper
export default function StudySchedule() {
  return <StudyScheduleContent />;
}