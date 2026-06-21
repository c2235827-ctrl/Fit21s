import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UserChallenge, Profile } from '../types';
import { Trophy, Users, Search, HelpCircle, ArrowRight, ShieldAlert, Check, X, ShieldCheck, Flame, Loader2, Sparkles, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChallengesTabProps {
  userId: string;
  profile: Profile | null;
}

export default function ChallengesTab({ userId, profile }: ChallengesTabProps) {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'duel'>('leaderboard');
  const [leaderboardView, setLeaderboardView] = useState<'weekly' | 'all-time'>('weekly');
  
  // Leaderboard lists
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Duel lists
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loadingDuels, setLoadingDuels] = useState(false);

  // Search/Duel Friend Modal
  const [showNewDuelModal, setShowNewDuelModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Profile | null>(null);
  const [duelMessage, setDuelMessage] = useState('');
  const [sendingDuel, setSendingDuel] = useState(false);

  const fetchLeaderboard = async () => {
    setLoadingLeaderboard(true);
    try {
      if (leaderboardView === 'weekly') {
        // Query weekly_leaderboard view
        const { data, error } = await supabase
          .from('weekly_leaderboard')
          .select('*')
          .limit(50);
        
        if (error) {
          console.warn('weekly_leaderboard view might not exist yet, trying aggregation fallback...', error);
          await fetchFallbackWeeklyLeaderboard();
        } else {
          setLeaders(data || []);
        }
      } else {
        // Query leaderboard view
        const { data, error } = await supabase
          .from('leaderboard')
          .select('*')
          .limit(50);

        if (error) {
          console.warn('leaderboard view might not exist yet, trying profiles fallback...', error);
          await fetchFallbackAllTimeLeaderboard();
        } else {
          setLeaders(data || []);
        }
      }
    } catch (err) {
      console.error('Error fetching leaderboard target views:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  // Fallback 1: Calculate weekly champions on client/profiles
  const fetchFallbackWeeklyLeaderboard = async () => {
    try {
      // Get all completions from the last 7 days grouped by user_id
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: completions, error } = await supabase
        .from('completions')
        .select(`
          user_id,
          profiles:user_id (
            name,
            avatar_url,
            state,
            streak_count
          )
        `)
        .gt('created_at', sevenDaysAgo);

      if (error) throw error;

      if (!completions || completions.length === 0) {
        // Fallback to active streaks if completions are completely clean
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url, state, streak_count')
          .order('streak_count', { ascending: false })
          .limit(20);

        const mapped = (profiles || []).map((p, idx) => ({
          user_id: p.id,
          name: p.name,
          avatar_url: p.avatar_url,
          score: p.streak_count,
          completed_count: p.streak_count,
          state: p.state || 'Lagos'
        }));
        setLeaders(mapped);
      } else {
        const counts: Record<string, { name: string; avatar_url: any; state: string; count: number }> = {};
        completions.forEach((c: any) => {
          if (!c.user_id) return;
          const prof = c.profiles || {};
          if (!counts[c.user_id]) {
            counts[c.user_id] = {
              name: prof.name || 'Fit21 Athlete',
              avatar_url: prof.avatar_url,
              state: prof.state || 'Lagos',
              count: 0
            };
          }
          counts[c.user_id].count += 1;
        });

        const sorted = Object.entries(counts)
          .map(([uid, info]) => ({
            user_id: uid,
            name: info.name,
            avatar_url: info.avatar_url,
            score: info.count,
            completed_count: info.count,
            state: info.state
          }))
          .sort((a, b) => b.score - a.score);

        setLeaders(sorted);
      }
    } catch (e) {
      console.error('All fallbacks failed:', e);
      setLeaders([]);
    }
  };

  const fetchFallbackAllTimeLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, state, total_challenges_completed, streak_count')
        .order('total_challenges_completed', { ascending: false })
        .limit(30);

      if (error) throw error;
      const mapped = (data || []).map(p => ({
        user_id: p.id,
        name: p.name,
        avatar_url: p.avatar_url,
        score: p.total_challenges_completed || 0,
        completed_count: p.total_challenges_completed || 0,
        state: p.state || 'Lagos'
      }));
      setLeaders(mapped);
    } catch (e) {
      console.warn(e);
    }
  };

  const fetchUserChallenges = async () => {
    setLoadingDuels(true);
    try {
      const { data, error } = await supabase
        .from('user_challenges')
        .select(`
          *,
          challenger_profile:challenger_id(*),
          challenged_profile:challenged_id(*)
        `)
        .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserChallenges(data || []);
    } catch (err) {
      console.error('Error fetching user duels:', err);
    } finally {
      setLoadingDuels(false);
    }
  };

  useEffect(() => {
    if (userId) {
      if (activeTab === 'leaderboard') {
        fetchLeaderboard();
      } else {
        fetchUserChallenges();
      }
    }
  }, [userId, activeTab, leaderboardView]);

  const searchFriends = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('name', `%${query}%`)
        .neq('id', userId) // exclude self
        .limit(10);

      if (error) throw error;
      setSearchResults(data || []);
    } catch (err) {
      console.error('Error searching friends:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateDuel = async () => {
    if (!selectedFriend) return;
    setSendingDuel(true);
    try {
      const { error } = await supabase
        .from('user_challenges')
        .insert({
          challenger_id: userId,
          challenged_id: selectedFriend.id,
          message: duelMessage || 'Can you beat my intense running routine today? Show me what you got! ⚔️',
          status: 'pending'
        });

      if (error) throw error;

      // Notify the recipient friends profile
      await supabase.from('notifications').insert({
        user_id: selectedFriend.id,
        type: 'challenge',
        title: 'New Duel Challenge! ⚔️',
        body: `${profile?.name || 'Someone'} challenged you: "${duelMessage || 'Beat my fitness scores!'}"`,
        is_read: false
      });

      setSelectedFriend(null);
      setDuelMessage('');
      setShowNewDuelModal(false);
      fetchUserChallenges(); // reload duels
    } catch (err: any) {
      alert(`Could not pitch duel: ${err.message}`);
    } finally {
      setSendingDuel(false);
    }
  };

  const handleUpdateDuelStatus = async (challengeId: string, challengerId: string, action: 'accepted' | 'declined' | 'completed') => {
    try {
      const { error } = await supabase
        .from('user_challenges')
        .update({ status: action })
        .eq('id', challengeId);

      if (error) throw error;

      // Notify opponent challenger
      let title = '';
      let body = '';
      if (action === 'accepted') {
        title = 'Duel Pitch Accepted! ⚔️';
        body = `${profile?.name || 'Your friend'} accepted your fitness challenge. Duel is now active!`;
      } else if (action === 'declined') {
        title = 'Duel Declined 🛡️';
        body = `${profile?.name || 'Your friend'} declined your duel proposal. Shake it off.`;
      } else if (action === 'completed') {
        title = 'Duel Completed! 🏆';
        body = `${profile?.name || 'Your friend'} marked their workout complete. Tap to review scores!`;
      }

      await supabase.from('notifications').insert({
        user_id: challengerId,
        type: 'challenge',
        title,
        body,
        is_read: false
      });

      fetchUserChallenges();
    } catch (err: any) {
      alert(`Error updating duel status: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Screens Top Double Tab Switcher */}
      <div className="bg-neutral-900/60 p-1 rounded-2xl border border-neutral-800 flex">
        <button
          id="btn-tab-leaderboard"
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'leaderboard'
              ? 'bg-[#00E87A] text-[#0A0A0A] shadow-md'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
          }`}
        >
          <Trophy className="w-4 h-4" />
          Leaderboard
        </button>
        <button
          id="btn-tab-duel"
          onClick={() => setActiveTab('duel')}
          className={`flex-1 py-3 text-sm font-extrabold rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'duel'
              ? 'bg-[#00E87A] text-[#0A0A0A] shadow-md'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-800/40'
          }`}
        >
          <Users className="w-4 h-4" />
          Challenge a Friend
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'leaderboard' ? (
          <motion.div
            key="leaderboard-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Weekly vs All-Time Toggle */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest">
                Ranking Standings
              </span>
              <div className="bg-neutral-900 border border-neutral-850 p-1 rounded-xl flex">
                <button
                  id="btn-leaderboard-weekly"
                  onClick={() => setLeaderboardView('weekly')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition ${
                    leaderboardView === 'weekly'
                      ? 'bg-neutral-800 text-[#00E87A]'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  Weekly
                </button>
                <button
                  id="btn-leaderboard-all-time"
                  onClick={() => setLeaderboardView('all-time')}
                  className={`px-3 py-1 text-xs font-extrabold rounded-lg transition ${
                    leaderboardView === 'all-time'
                      ? 'bg-neutral-800 text-[#00E87A]'
                      : 'text-neutral-500 hover:text-white'
                  }`}
                >
                  All-Time
                </button>
              </div>
            </div>

            {loadingLeaderboard ? (
              <div className="bg-neutral-900/60 p-12 rounded-3xl border border-neutral-850 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#00E87A] mx-auto mb-3" />
                <p className="text-xs text-neutral-400 font-medium">Sifting stats and ranks...</p>
              </div>
            ) : leaders.length === 0 ? (
              <div className="bg-[#121212] border border-neutral-800 rounded-3xl p-12 text-center text-neutral-500 text-sm">
                No scores recorded for this period yet. Complete today's challenge to set the benchmark!
              </div>
            ) : (
              <div className="space-y-3">
                {/* Top 3 Podium Cards */}
                {leaders.length >= 3 && (
                  <div className="grid grid-cols-3 gap-3">
                    {/* 2nd Place */}
                    {leaders[1] && (
                      <div className="bg-neutral-900/40 hover:bg-[#121212] transition border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center justify-center relative">
                        <span className="absolute top-2 left-2 text-md">🥈</span>
                        <div className="w-12 h-12 rounded-full border border-neutral-700 overflow-hidden mb-2 bg-neutral-800 flex items-center justify-center text-white">
                          {leaders[1].avatar_url ? (
                            <img src={leaders[1].avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-sm">{leaders[1].name[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-xs font-extrabold text-white truncate max-w-full">
                          {leaders[1].name}
                        </p>
                        <p className="text-[10px] text-[#00E87A] font-black mt-1">
                          {leaders[1].score} 🔥
                        </p>
                      </div>
                    )}

                    {/* 1st Place */}
                    {leaders[0] && (
                      <div className="bg-neutral-900/40 hover:bg-[#121212] transition border-2 border-[#00E87A] rounded-2xl p-4 text-center flex flex-col items-center justify-center relative -translate-y-2 shadow-[0_4px_15px_rgba(0,232,122,0.15)] bg-gradient-to-b from-[#152e1f]/35 to-transparent">
                        <span className="absolute top-2 left-2 text-lg">🥇</span>
                        <div className="w-14 h-14 rounded-full border-2 border-[#00E87A] overflow-hidden mb-2 bg-neutral-800 flex items-center justify-center text-white shadow-xl">
                          {leaders[0].avatar_url ? (
                            <img src={leaders[0].avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-md">{leaders[0].name[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-xs font-black text-white truncate max-w-full">
                          {leaders[0].name}
                        </p>
                        <p className="text-xs text-[#00E87A] font-black mt-1">
                          {leaders[0].score} ⭐
                        </p>
                      </div>
                    )}

                    {/* 3rd Place */}
                    {leaders[2] && (
                      <div className="bg-neutral-900/40 hover:bg-[#121212] transition border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center justify-center relative">
                        <span className="absolute top-2 left-2 text-md">🥉</span>
                        <div className="w-12 h-12 rounded-full border border-neutral-700 overflow-hidden mb-2 bg-neutral-800 flex items-center justify-center text-white">
                          {leaders[2].avatar_url ? (
                            <img src={leaders[2].avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-sm">{leaders[2].name[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <p className="text-xs font-extrabold text-white truncate max-w-full">
                          {leaders[2].name}
                        </p>
                        <p className="text-[10px] text-[#00E87A] font-black mt-1">
                          {leaders[2].score} 🔥
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Leaderboard Table List */}
                <div className="bg-[#121212] border border-neutral-800 rounded-2xl overflow-hidden divide-y divide-neutral-850">
                  {leaders.map((leader, index) => {
                    const isCurrentUser = leader.user_id === userId;
                    return (
                      <div
                        key={leader.user_id || index}
                        className={`p-4 flex items-center justify-between transition ${
                          isCurrentUser ? 'bg-[#152e1f]/20 border-l-4 border-[#00E87A]' : 'hover:bg-neutral-900/45'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-6 text-xs font-bold text-neutral-500 text-center">
                            {index + 1}
                          </span>
                          <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-750 overflow-hidden flex-shrink-0 flex items-center justify-center text-white">
                            {leader.avatar_url ? (
                              <img src={leader.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span className="text-xs font-extrabold uppercase">{leader.name[0]}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
                              {leader.name}
                              {isCurrentUser && (
                                <span className="text-[9px] px-1.5 py-0.5 bg-[#00E87A]/20 text-[#00E87A] rounded-md font-bold uppercase tracking-wider">
                                  You
                                </span>
                              )}
                            </p>
                            <span className="text-[10px] text-neutral-500">
                              {leader.state || 'Nigeria'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-black text-[#00E87A]">
                            {leader.score} {leaderboardView === 'weekly' ? 'challenges' : 'total'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="duels-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Challenges / Duel Header bar */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-neutral-400 uppercase tracking-widest">
                Active Duels ({userChallenges.length})
              </span>
              <button
                id="btn-trigger-new-duel"
                onClick={() => setShowNewDuelModal(true)}
                className="px-4 py-2 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl text-xs hover:bg-[#00c968] transition duration-150 cursor-pointer flex items-center gap-1 shadow-lg shadow-[#00E87A]/15"
              >
                + New Duel
              </button>
            </div>

            {loadingDuels ? (
              <div className="bg-neutral-900/60 p-12 rounded-3xl border border-neutral-850 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#00E87A] mx-auto mb-3" />
                <p className="text-xs text-neutral-400 font-medium font-mono">Drawing duel schedules...</p>
              </div>
            ) : userChallenges.length === 0 ? (
              <div className="border border-dashed border-neutral-850 p-12 text-center rounded-3xl">
                <Users className="w-10 h-10 text-neutral-700 mx-auto mb-3 animate-pulse" />
                <p className="text-sm font-semibold text-neutral-300">No active duels</p>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  You are not in any fitness duels. Propose a workout duel to a friend to see who rules the week!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userChallenges.map(duel => {
                  const isChallenger = duel.challenger_id === userId;
                  const opponent = isChallenger ? duel.challenged_profile : duel.challenger_profile;
                  const opponentName = opponent?.name || 'Fit21 Athlete';
                  const opponentAvatar = opponent?.avatar_url;

                  return (
                    <div
                      key={duel.id}
                      className="bg-[#121212] border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden flex-shrink-0 flex items-center justify-center text-white mt-1">
                          {opponentAvatar ? (
                            <img src={opponentAvatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-extrabold uppercase">{opponentName[0]}</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-white">
                              {opponentName}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-extrabold ${
                              duel.status === 'pending'
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                : duel.status === 'accepted'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {duel.status}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1 italic break-words">
                            "{duel.message || 'Beat my scores!'}"
                          </p>
                          <p className="text-[10px] text-neutral-500 mt-1">
                            {isChallenger ? 'You initiated this duel' : 'Received challenge proposal'}
                          </p>
                        </div>
                      </div>

                      {/* Duel Control Actions */}
                      <div className="flex items-center gap-2 self-end md:self-center">
                        {!isChallenger && duel.status === 'pending' && (
                          <>
                            <button
                              id={`btn-accept-duel-${duel.id}`}
                              onClick={() => handleUpdateDuelStatus(duel.id, duel.challenger_id, 'accepted')}
                              className="px-3.5 py-1.5 bg-[#00E87A] text-[#0A0A0A] text-xs font-black rounded-lg hover:bg-[#00c968] transition cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Accept
                            </button>
                            <button
                              id={`btn-decline-duel-${duel.id}`}
                              onClick={() => handleUpdateDuelStatus(duel.id, duel.challenger_id, 'declined')}
                              className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 text-rose-400 text-xs font-bold rounded-lg hover:border-rose-500/30 transition cursor-pointer"
                            >
                              Decline
                            </button>
                          </>
                        )}

                        {duel.status === 'accepted' && (
                          <button
                            id={`btn-complete-duel-${duel.id}`}
                            onClick={() => handleUpdateDuelStatus(duel.id, duel.challenger_id, 'completed')}
                            className="px-4 py-1.5 bg-[#00E87A]/10 border border-[#00E87A]/30 text-[#00E87A] text-xs font-black rounded-lg hover:bg-[#00E87A] hover:text-[#0A0A0A] transition cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Finish Duel
                          </button>
                        )}

                        {duel.status === 'completed' && (
                          <div className="text-xs text-emerald-400 font-bold flex items-center gap-1 px-2.5 py-1 bg-emerald-500/10 rounded-lg">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            Finished
                          </div>
                        )}

                        {duel.status === 'declined' && (
                          <span className="text-xs text-neutral-500 font-bold uppercase p-1">
                            Declined
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Duel Setup Modal */}
      <AnimatePresence>
        {showNewDuelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowNewDuelModal(false);
                setSelectedFriend(null);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
                  Initiate Duel Challenge
                </h4>
                <button
                  onClick={() => {
                    setShowNewDuelModal(false);
                    setSelectedFriend(null);
                  }}
                  className="text-neutral-500 hover:text-white transition p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Search Athlete Friend */}
                {!selectedFriend ? (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      Search Athlete
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500">
                        <Search className="w-4 h-4" />
                      </span>
                      <input
                        id="friend-search-input"
                        type="text"
                        placeholder="Search by name (e.g. Amara, Tunde)"
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          searchFriends(e.target.value);
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-[#00E87A] transition"
                      />
                    </div>

                    {/* Results dropdown list */}
                    <div className="mt-3 max-h-48 overflow-y-auto divide-y divide-neutral-850 bg-neutral-900 border border-neutral-800 rounded-xl">
                      {searching ? (
                        <p className="text-xs text-neutral-500 p-4 text-center">Searching athletes...</p>
                      ) : searchResults.length === 0 ? (
                        <p className="text-xs text-neutral-500 p-4 text-center">
                          {searchQuery ? 'No athletes match this search Query' : 'Type to start querying registered names'}
                        </p>
                      ) : (
                        searchResults.map(friend => (
                          <div
                            key={friend.id}
                            onClick={() => setSelectedFriend(friend)}
                            className="p-3 flex items-center justify-between hover:bg-neutral-850 cursor-pointer transition text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center border border-neutral-700">
                                {friend.avatar_url ? (
                                  <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="font-bold">{friend.name[0]}</span>
                                )}
                              </div>
                              <div>
                                <p className="font-extrabold text-white">{friend.name}</p>
                                <span className="text-[10px] text-neutral-500">{friend.state || 'Lagos'}</span>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-neutral-500" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  // Selected state
                  <div className="p-4 bg-[#152e1f]/20 border border-[#00E87A]/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden border border-[#00E87A]/30">
                        {selectedFriend.avatar_url ? (
                          <img src={selectedFriend.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-bold flex h-full items-center justify-center text-white">{selectedFriend.name[0]}</span>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-white">{selectedFriend.name}</p>
                        <p className="text-xs text-neutral-400">{selectedFriend.state || 'Lagos'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedFriend(null)}
                      className="text-xs text-neutral-500 hover:text-rose-400"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Personal Duel Proposition
                  </label>
                  <textarea
                    id="duel-caption"
                    value={duelMessage}
                    onChange={e => setDuelMessage(e.target.value)}
                    placeholder="e.g. Can you beat my 5km run workout this week? Show me your stamina! ⚔️"
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-3.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] resize-none"
                  />
                </div>

                <button
                  id="duel-submit-btn"
                  onClick={handleCreateDuel}
                  disabled={sendingDuel || !selectedFriend}
                  className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] hover:shadow-[0_0_15px_rgba(0,232,122,0.35)] transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sendingDuel ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Proposing duel schedule...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Engage Duel Pitch
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
