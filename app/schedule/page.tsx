"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Flame, Plus, Trash2, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useStudyData } from '@/app/hooks/useStudyData';

function StudyScheduleContent() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // CENTRALIZED HOOK LOGIC
  const { 
    events, setEvents, 
    loginStreak, 
    saveData, 
    isSyncing, 
    lastSyncTime 
  } = useStudyData();

  // Local UI State
  const [newEvent, setNewEvent] = useState('');
  const [newEventTime, setNewEventTime] = useState('');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time for live countdowns
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- Mutations ---
  const handleAddEvent = async () => {
    if (!newEvent.trim()) return;
    const [year, month, day] = newEventDate.split('-').map(Number);
    const eventDate = new Date(year, month - 1, day); 
    const dateKey = eventDate.toDateString();
    
    const nextEvents = { 
      ...events, 
      [dateKey]: [...(events[dateKey] || []), { id: Date.now(), text: newEvent, time: newEventTime }] 
    };

    setEvents(nextEvents);
    setNewEvent('');
    setNewEventTime('');
    
    // Hook ensures todos/sessions aren't deleted
    await saveData({ events: nextEvents });
  };

  const handleDeleteEvent = async (dateKey: string, eventId: number) => {
  const nextEvents = { ...events };
  if (nextEvents[dateKey]) {
    nextEvents[dateKey] = nextEvents[dateKey].filter(e => e.id !== eventId);
    if (nextEvents[dateKey].length === 0) {
      delete nextEvents[dateKey];
    }
  }
  // Update local state and save
  setEvents(nextEvents);
  await saveData({ events: nextEvents });
  };

  // --- Logic Helpers ---
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

    const diff = eventDate.getTime() - currentTime.getTime();
    if (diff <= 0) return (dateStr === new Date().toDateString()) ? "TODAY" : null;
    
    const d = Math.floor(diff / 86400000);
    const hr = Math.floor((diff % 86400000) / 3600000);
    const min = Math.floor((diff % 3600000) / 60000);
    
    return d > 0 ? `${d}d ${hr}h` : hr > 0 ? `${hr}h ${min}m` : `${min}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--color-gradient-start)] to-[var(--color-gradient-end)] p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <header className="bg-[var(--color-surface)] rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-[var(--color-text-primary)]">Countdown Schedule</h1>
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

        <div className="bg-[var(--color-surface)] rounded-lg p-6">
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
                        className="p-4 rounded-xl flex items-center justify-between gap-4 sm:gap-6 bg-[var(--color-surface-secondary)]"
                      >
                        <div className="flex-1 min-w-0"> 
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <span className="text-[14px] sm:text-[16px] font-black uppercase text-[var(--color-text-secondary)] truncate">
                              {isToday ? 'Today' : new Date(dk).toLocaleDateString('en-US', {month: 'long', day: 'numeric'})}
                            </span>
                            
                            <span className={`text-[12px] sm:text-[14px] font-black px-4 py-1.5 rounded-md shadow-sm flex-shrink-0 min-w-[70px] text-center ${
                              isToday ? 'bg-[var(--color-secondary)] text-[var(--color-text-primary)] animate-pulse' : 'bg-[var(--color-primary)] text-[var(--color-text-primary)]'
                            }`}>
                              {cd.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="text-lg font-black text-[var(--color-surface)] leading-tight break-words">
                            {e.text}
                          </div>
                        </div>

                        <div className="flex-shrink-0 self-center">
                          <button 
                            onClick={() => handleDeleteEvent(dk, e.id)} 
                            className="bg-[var(--color-surface)] text-[var(--color-surface)] p-2.5 rounded-full hover:bg-[var(--color-secondary)] hover:text-[var(--color-surface)] transition-all shadow-sm active:scale-90"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
              ).filter(Boolean)}
            </div>
          </div>

          <div className="mt-8">
            <button onClick={() => setIsAddingEvent(!isAddingEvent)} className="w-full flex items-center justify-center gap-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--color-text-primary)] py-3 px-4 rounded-lg transition-colors font-medium">
              <Plus size={20} />
              {isAddingEvent ? 'Hide Add Event' : 'Add Event'}
            </button>
            
            {isAddingEvent && (
              <div className="bg-[var(--color-surface-secondary)] p-6 rounded-xl mt-4">
                <h3 className="text-xl font-black text-[var(--color-text-primary)] mb-4">Add Event</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-black uppercase text-[var(--color-text-secondary)] mb-1">Date</label>
                    <input type="date" value={newEventDate} onChange={e => setNewEventDate(e.target.value)} className="w-full px-3 py-3 bg-[var(--color-surface)] rounded-lg text-[var(--color-text-primary)] font-bold outline-none"/>
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase text-[var(--color-text-secondary)] mb-1">Time</label>
                    <input type="time" value={newEventTime} onChange={e => setNewEventTime(e.target.value)} className="w-full px-3 py-3 bg-[var(--color-surface)] rounded-lg text-[var(--color-text-primary)] font-bold outline-none"/>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-black uppercase text-[var(--color-text-secondary)] mb-1">Event</label>
                    <input type="text" value={newEvent} onChange={e => setNewEvent(e.target.value)} placeholder="Description..." className="w-full px-3 py-3 bg-[var(--color-surface)] rounded-lg text-[var(--color-text-primary)] font-bold outline-none"/>
                  </div>
                </div>
                <button onClick={handleAddEvent} className="bg-[var(--color-primary)] text-[var(--color-text-primary)] px-10 py-3 rounded-lg font-black transition hover:bg-[var(--color-primary-hover)] active:scale-95">Add Event</button>
              </div>
            )}
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

export default function StudySchedule() {
  return <StudyScheduleContent />;
}