import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Habit, HabitLog, JournalEntry, Profile } from '../types';
import { Check, Flame, Plus, Sparkles, Smile, Battery, ListPlus, Lock, Unlock, Loader2, BookOpen, Trash2, Edit3, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HabitsJournalProps {
  userId: string;
  isPro: boolean;
  onNavigateToUpgrade: () => void;
}

const HABIT_EMOJIS = ['🏃‍♂️', '🏋️‍♂️', '💧', '🥗', '🛌', '📚', '🧘‍♂️', '⏰', '🍎', '👣', '🚴', '🏊'];
const HABIT_COLORS = [
  { name: 'Fit21 Green', value: '#00E87A', class: 'bg-[#00E87A] text-[#0A0A0A]' },
  { name: 'Vibrant Orange', value: '#f97316', class: 'bg-orange-500 text-white' },
  { name: 'Neon Blue', value: '#3b82f6', class: 'bg-blue-500 text-white' },
  { name: 'Purple Dream', value: '#a855f7', class: 'bg-purple-500 text-white' },
  { name: 'Heart Rose', value: '#ec4899', class: 'bg-pink-500 text-white' },
];

const MOODS = [
  { val: 'great', emoji: '🤩', label: 'Great' },
  { val: 'good', emoji: '😊', label: 'Good' },
  { val: 'okay', emoji: '😐', label: 'Okay' },
  { val: 'bad', emoji: '😔', label: 'Bad' },
  { val: 'terrible', emoji: '😫', label: 'Terrible' },
];

export default function HabitsJournal({ userId, isPro, onNavigateToUpgrade }: HabitsJournalProps) {
  const [activeTab, setActiveTab] = useState<'habits' | 'journal'>('habits');

  // Habits State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loadingHabits, setLoadingHabits] = useState(false);

  // New Habit Drawer/Form
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitIcon, setNewHabitIcon] = useState('🏃‍♂️');
  const [newHabitColor, setNewHabitColor] = useState('#00E87A');

  // Journal State
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loadingJournal, setLoadingJournal] = useState(false);

  // New Journal Entry Drawer/Modal
  const [showAddJournal, setShowAddJournal] = useState(false);
  const [journalContent, setJournalContent] = useState('');
  const [journalMood, setJournalMood] = useState<'great' | 'good' | 'okay' | 'bad' | 'terrible'>('good');
  const [journalEnergy, setJournalEnergy] = useState(7);
  const [journalIsPrivate, setJournalIsPrivate] = useState(true);
  const [savingJournal, setSavingJournal] = useState(false);

  // Edit Journal Entry State
  const [editingJournal, setEditingJournal] = useState<JournalEntry | null>(null);

  const getLocalDateString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split('T')[0];
  };

  // --- HABITS FLOW ---
  const fetchHabitsAndLogs = async () => {
    setLoadingHabits(true);
    try {
      // 1. Fetch user's habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (habitsError) throw habitsError;
      const currentHabits = habitsData || [];

      if (currentHabits.length > 0) {
        // 2. Fetch all logs for these habits
        const habitIds = currentHabits.map(h => h.id);
        const { data: logsData, error: logsError } = await supabase
          .from('habit_logs')
          .select('*')
          .in('habit_id', habitIds);

        if (logsError) throw logsError;
        setLogs(logsData || []);
      } else {
        setLogs([]);
      }

      setHabits(currentHabits);
    } catch (err) {
      console.error('Error fetching habits:', err);
    } finally {
      setLoadingHabits(false);
    }
  };

  const handleToggleHabitLog = async (habitId: string) => {
    const todayStr = getLocalDateString();
    const existingLog = logs.find(l => l.habit_id === habitId && l.log_date === todayStr);

    try {
      if (existingLog) {
        // Uncheck - remove from database
        const { error } = await supabase
          .from('habit_logs')
          .delete()
          .eq('id', existingLog.id);

        if (error) throw error;
        setLogs(prev => prev.filter(l => l.id !== existingLog.id));
      } else {
        // Check - create log
        const { data, error } = await supabase
          .from('habit_logs')
          .insert({
            habit_id: habitId,
            log_date: todayStr,
            completed: true
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setLogs(prev => [...prev, data]);
        }
      }
    } catch (err) {
      console.error('Error toggling habit log:', err);
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    // Free users are limited to 10 active habits
    if (habits.length >= 10 && !isPro) {
      setShowAddHabit(false);
      onNavigateToUpgrade();
      return;
    }

    try {
      const { error } = await supabase
        .from('habits')
        .insert({
          user_id: userId,
          name: newHabitName.trim(),
          icon: newHabitIcon,
          color: newHabitColor,
          sort_order: habits.length + 1
        });

      if (error) throw error;

      setNewHabitName('');
      setShowAddHabit(false);
      fetchHabitsAndLogs();
    } catch (err: any) {
      alert(`Could not insert habit: ${err.message}`);
    }
  };

  // Compute consecutive completion streak going backwards
  const getHabitStreak = (habitId: string): number => {
    const habitLogs = logs
      .filter(l => l.habit_id === habitId && l.completed)
      .map(l => l.log_date)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()); // descending (newest first)

    if (habitLogs.length === 0) return 0;

    let streak = 0;
    const todayStr = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // If neither today nor yesterday has a completion log, streak is broken / 0
    if (!habitLogs.includes(todayStr) && !habitLogs.includes(yesterdayStr)) {
      return 0;
    }

    let checkDate = new Date();
    // Start check from today or yesterday depending on completion of today
    if (!habitLogs.includes(todayStr)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0];
      if (habitLogs.includes(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  };

  // --- JOURNAL FLOW ---
  const fetchJournals = async () => {
    setLoadingJournal(true);
    try {
      const { data, error } = await supabase
        .from('journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJournals(data || []);
    } catch (err) {
      console.error('Error fetching journals:', err);
    } finally {
      setLoadingJournal(false);
    }
  };

  const handleSaveJournal = async () => {
    if (!journalContent.trim()) return;
    setSavingJournal(true);

    try {
      const { error } = await supabase
        .from('journal_entries')
        .insert({
          user_id: userId,
          content: journalContent,
          mood: journalMood,
          energy_level: journalEnergy,
          is_private: journalIsPrivate
        });

      if (error) throw error;

      setJournalContent('');
      setShowAddJournal(false);
      fetchJournals();
    } catch (err: any) {
      alert(`Journals error: ${err.message}`);
    } finally {
      setSavingJournal(false);
    }
  };

  const handleUpdateJournal = async () => {
    if (!editingJournal || !editingJournal.content.trim()) return;
    setSavingJournal(true);

    try {
      const { error } = await supabase
        .from('journal_entries')
        .update({
          content: editingJournal.content,
          mood: editingJournal.mood,
          energy_level: editingJournal.energy_level,
          is_private: editingJournal.is_private
        })
        .eq('id', editingJournal.id);

      if (error) throw error;
      setEditingJournal(null);
      fetchJournals();
    } catch (err: any) {
      alert(`Failed updating journal: ${err.message}`);
    } finally {
      setSavingJournal(false);
    }
  };

  const handleDeleteJournal = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this entry?')) return;
    try {
      const { error } = await supabase
        .from('journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setEditingJournal(null);
      setJournals(prev => prev.filter(j => j.id !== id));
    } catch (err: any) {
      alert(`Fail delete: ${err.message}`);
    }
  };

  useEffect(() => {
    if (userId) {
      if (activeTab === 'habits') {
        fetchHabitsAndLogs();
      } else {
        fetchJournals();
      }
    }
  }, [userId, activeTab]);

  const todayStr = getLocalDateString();

  return (
    <div className="space-y-6 pb-24">
      {/* Tab select head */}
      <div className="bg-neutral-900/60 p-1 rounded-2xl border border-neutral-800 flex">
        <button
          id="tab-btn-habits"
          onClick={() => setActiveTab('habits')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'habits'
              ? 'bg-[#00E87A] text-[#0A0A0A] shadow-md'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
          }`}
        >
          <Plus className="w-4 h-4" />
          Habits
        </button>
        <button
          id="tab-btn-journal"
          onClick={() => setActiveTab('journal')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'journal'
              ? 'bg-[#00E87A] text-[#0A0A0A] shadow-md'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          My Journal
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'habits' ? (
          <motion.div
            key="habits-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Header section with add button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                  Daily Checkboxes
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Unchecked loops break streaks. Keep items checked!
                </p>
              </div>

              <button
                id="btn-trigger-add-habit"
                onClick={() => setShowAddHabit(true)}
                className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:text-[#00E87A] hover:bg-neutral-850 rounded-xl text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer"
              >
                + Add Habit
              </button>
            </div>

            {loadingHabits ? (
              <div className="bg-neutral-900/40 p-12 rounded-3xl border border-neutral-850 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#00E87A] mx-auto mb-3" />
                <p className="text-xs text-neutral-400">Loading daily habits tracker list...</p>
              </div>
            ) : habits.length === 0 ? (
              <div className="border border-dashed border-neutral-850 rounded-3xl p-12 text-center">
                <Sparkles className="w-8 h-8 text-[#00E87A]/20 mx-auto mb-2" />
                <p className="text-sm font-semibold text-neutral-300">No active habits</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  You haven't setup any custom tracking loops yet. Hit "+ Add Habit" to design your routine!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {habits.map(habit => {
                  const isCompletedToday = logs.some(l => l.habit_id === habit.id && l.log_date === todayStr && l.completed);
                  const streakNum = getHabitStreak(habit.id);

                  return (
                    <div
                      key={habit.id}
                      className="bg-[#121212] border border-neutral-800 rounded-2xl p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Status Checkbox */}
                        <button
                          id={`btn-toggle-habit-${habit.id}`}
                          onClick={() => handleToggleHabitLog(habit.id)}
                          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition cursor-pointer flex-shrink-0 ${
                            isCompletedToday
                              ? 'bg-[#00E87A] border-[#00E87A] text-[#0A0A0A]'
                              : 'border-neutral-700 hover:border-[#00E87A]/50 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
                            <span className="text-lg">{habit.icon || '🔥'}</span>
                            <span className={isCompletedToday ? 'line-through text-neutral-500' : ''}>
                              {habit.name}
                            </span>
                          </p>
                          {streakNum > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-orange-400 font-bold mt-1">
                              <Flame className="w-3.5 h-3.5 fill-orange-400/20" />
                              {streakNum} Days Streak
                            </span>
                          )}
                        </div>
                      </div>

                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: habit.color || '#00E87A' }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="journal-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Header and Add button */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">
                  Daily logs journal
                </h4>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Lock down thoughts, energy rates, and mood scales.
                </p>
              </div>

              <button
                id="btn-trigger-add-journal"
                onClick={() => setShowAddJournal(true)}
                className="px-4 py-2 bg-neutral-900 border border-neutral-800 hover:text-[#00E87A] hover:bg-neutral-850 rounded-xl text-xs font-bold transition duration-200 flex items-center gap-1.5 cursor-pointer"
              >
                + New Entry
              </button>
            </div>

            {loadingJournal ? (
              <div className="bg-neutral-900/40 p-12 rounded-3xl border border-neutral-850 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#00E87A] mx-auto mb-3" />
                <p className="text-xs text-neutral-400">Loading daily journal reflections list...</p>
              </div>
            ) : journals.length === 0 ? (
              <div className="border border-dashed border-neutral-850 rounded-3xl p-12 text-center">
                <BookOpen className="w-8 h-8 text-neutral-700 mx-auto mb-2 animate-bounce" />
                <p className="text-sm font-semibold text-neutral-300">No entries recorded</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  Keep records of mental and physical energy thresholds. Tap "+ New Entry" now!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {journals.map(entry => (
                  <div
                    key={entry.id}
                    onClick={() => setEditingJournal(entry)}
                    className="p-4 bg-[#121212] border border-neutral-800 rounded-2xl hover:border-neutral-700 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {MOODS.find(m => m.val === entry.mood)?.emoji || '😊'}
                        </span>
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-[#00E87A]" />
                          {entry.created_at ? new Date(entry.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          }) : ''}
                        </span>
                        {entry.is_private ? (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-500 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Private
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-[10px] text-neutral-500 flex items-center gap-1">
                            <Unlock className="w-2.5 h-2.5" /> Shared
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-white line-clamp-2 leading-relaxed">
                        {entry.content}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-xl flex items-center gap-1.5">
                        <Battery className="w-3.5 h-3.5 text-[#00E87A] fill-[#00E87A]/20" />
                        <span className="text-xs font-black text-white">E-rate: {entry.energy_level}/10</span>
                      </div>
                      <Edit3 className="w-4 h-4 text-neutral-500" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* NEW HABIT MODAL */}
      <AnimatePresence>
        {showAddHabit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddHabit(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ListPlus className="w-5 h-5 text-[#00E87A]" />
                Instantiate New Habit
              </h4>

              <form onSubmit={handleAddHabit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Habit Name
                  </label>
                  <input
                    id="new-habit-name-input"
                    type="text"
                    required
                    value={newHabitName}
                    onChange={e => setNewHabitName(e.target.value)}
                    placeholder="e.g. Morning jogging 5km"
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-[#00E87A] transition text-sm"
                  />
                </div>

                {/* Emoji Select */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Visual Anchor Icon
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {HABIT_EMOJIS.map(em => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setNewHabitIcon(em)}
                        className={`p-2.5 rounded-xl text-lg hover:bg-neutral-850 flex items-center justify-center transition cursor-pointer ${
                          newHabitIcon === em ? 'bg-neutral-800 border border-[#00E87A]' : 'bg-neutral-900 border border-transparent'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color select */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Color Accent Code
                  </label>
                  <div className="flex gap-2.5">
                    {HABIT_COLORS.map(c => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setNewHabitColor(c.value)}
                        className={`w-7 h-7 rounded-full border-2 transition cursor-pointer ${
                          newHabitColor === c.value ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAddHabit(false)}
                    className="flex-1 py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 rounded-xl text-xs text-neutral-400 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    id="submit-new-habit-btn"
                    type="submit"
                    className="flex-1 py-3 bg-[#00E87A] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#00c968] text-xs transition"
                  >
                    Add Habit Loop
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW JOURNAL ENTRY DIALOG */}
      <AnimatePresence>
        {showAddJournal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddJournal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[#00E87A]" />
                Commit New Journal reflection
              </h4>

              <div className="space-y-4">
                {/* Content */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Write down current reflections
                  </label>
                  <textarea
                    id="new-journal-caption"
                    value={journalContent}
                    onChange={e => setJournalContent(e.target.value)}
                    placeholder="e.g. Energy thresholds are surging. I completed my workout routine before 6 AM in Lagos weather. Kept form tight..."
                    rows={4}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-[#00E87A] resize-none"
                  />
                </div>

                {/* Mood Select */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    How is your Mood profile?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {MOODS.map(md => (
                      <button
                        key={md.val}
                        type="button"
                        onClick={() => setJournalMood(md.val as any)}
                        className={`p-2 rounded-xl text-center flex flex-col items-center justify-center transition border cursor-pointer ${
                          journalMood === md.val
                            ? 'bg-[#152e1f]/20 border-[#00E87A] text-white'
                            : 'bg-neutral-900 border-transparent text-neutral-400'
                        }`}
                      >
                        <span className="text-xl mb-1">{md.emoji}</span>
                        <span className="text-[10px] font-bold">{md.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Energy Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    <span>Physical Energy level</span>
                    <span className="text-[#00E87A] font-black">{journalEnergy} / 10</span>
                  </div>
                  <input
                    id="journal-energy-slider"
                    type="range"
                    min="1"
                    max="10"
                    value={journalEnergy}
                    onChange={e => setJournalEnergy(parseInt(e.target.value))}
                    className="w-full accent-[#00E87A]"
                  />
                </div>

                {/* Private Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-neutral-900/40 border border-neutral-850 rounded-2xl">
                  <div>
                    <label className="block text-xs font-bold text-white">Private reflection</label>
                    <p className="text-[10px] text-neutral-500">Only visible to your local journal screen</p>
                  </div>
                  <input
                    id="checkbox-journal-private"
                    type="checkbox"
                    checked={journalIsPrivate}
                    onChange={e => setJournalIsPrivate(e.target.checked)}
                    className="w-5 h-5 rounded-md border-neutral-800 text-[#00E87A] focus:ring-[#00E87A] bg-neutral-950 cursor-pointer"
                  />
                </div>

                {/* Submit */}
                <button
                  id="submit-journal-btn"
                  onClick={handleSaveJournal}
                  disabled={savingJournal || !journalContent.trim()}
                  className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] transition duration-150 cursor-pointer flex items-center justify-center disabled:opacity-50 text-xs"
                >
                  {savingJournal ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Commit Journal entry'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT JOURNAL ENTRY MODAL (FULL SCREEN INTERACTIVE REFLECTOR) */}
      <AnimatePresence>
        {editingJournal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingJournal(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-md font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-[#00E87A]" />
                  Modify reflection
                </h4>
                <button
                  onClick={() => handleDeleteJournal(editingJournal.id)}
                  className="text-stone-500 hover:text-red-400 p-1.5 transition text-xs flex items-center gap-1 hover:bg-red-500/10 rounded-xl"
                  title="Remove permanently"
                >
                  <Trash2 className="w-4 h-4" />
                  Trash
                </button>
              </div>

              <div className="space-y-4">
                <textarea
                  id="edit-journal-content"
                  value={editingJournal.content}
                  onChange={e => setEditingJournal(prev => prev ? { ...prev, content: e.target.value } : null)}
                  rows={4}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-[#00E87A] resize-none"
                />

                {/* Mood Select */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    How is your Mood profile?
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {MOODS.map(md => (
                      <button
                        key={md.val}
                        type="button"
                        onClick={() => setEditingJournal(prev => prev ? { ...prev, mood: md.val as any } : null)}
                        className={`p-2 rounded-xl text-center flex flex-col items-center justify-center transition border cursor-pointer ${
                          editingJournal.mood === md.val
                            ? 'bg-[#152e1f]/20 border-[#00E87A] text-white'
                            : 'bg-neutral-900 border-transparent text-neutral-400'
                        }`}
                      >
                        <span className="text-xl mb-1">{md.emoji}</span>
                        <span className="text-[10px] font-bold">{md.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Energy Slider */}
                <div>
                  <div className="flex justify-between text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    <span>Physical Energy level</span>
                    <span className="text-[#00E87A] font-black">{editingJournal.energy_level} / 10</span>
                  </div>
                  <input
                    id="edit-journal-energy-slider"
                    type="range"
                    min="1"
                    max="10"
                    value={editingJournal.energy_level}
                    onChange={e => setEditingJournal(prev => prev ? { ...prev, energy_level: parseInt(e.target.value) } : null)}
                    className="w-full accent-[#00E87A]"
                  />
                </div>

                {/* Private Toggle */}
                <div className="flex items-center justify-between p-3.5 bg-neutral-900/40 border border-neutral-850 rounded-2xl">
                  <div>
                    <label className="block text-xs font-bold text-white">Private reflection</label>
                    <span className="text-[10px] text-neutral-500">Only visible to your local journal screen</span>
                  </div>
                  <input
                    id="edit-checkbox-journal-private"
                    type="checkbox"
                    checked={editingJournal.is_private}
                    onChange={e => setEditingJournal(prev => prev ? { ...prev, is_private: e.target.checked } : null)}
                    className="w-5 h-5 rounded-md border-neutral-800 text-[#00E87A] focus:ring-[#00E87A] bg-neutral-950 cursor-pointer"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingJournal(null)}
                    className="flex-1 py-3 bg-neutral-900 border border-neutral-800 hover:bg-neutral-850 rounded-xl text-xs text-neutral-400 font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    id="btn-edit-journal-save"
                    onClick={handleUpdateJournal}
                    disabled={savingJournal || !editingJournal.content.trim()}
                    className="flex-1 py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] transition duration-150 cursor-pointer text-xs flex items-center justify-center"
                  >
                    {savingJournal ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
