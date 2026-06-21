import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Challenge, Profile, Completion } from '../types';
import { Trophy, Flame, Check, Sparkles, Upload, Loader2, ArrowRight, Activity, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TodayChallengeProps {
  userId: string;
  profile: Profile | null;
  onRefreshProfile: () => void;
  onNavigateToUpgrade: () => void;
  isPro: boolean;
}

export default function TodayChallenge({
  userId,
  profile,
  onRefreshProfile,
  onNavigateToUpgrade,
  isPro,
}: TodayChallengeProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [completedToday, setCompletedToday] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // Modal Form State
  const [uploading, setUploading] = useState(false);
  const [actualValue, setActualValue] = useState('');
  const [note, setNote] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [shareToFeed, setShareToFeed] = useState(true);

  const getLocalDateString = () => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localDate = new Date(today.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split('T')[0];
  };

  const fetchChallenge = async () => {
    setLoading(true);
    const todayStr = getLocalDateString();
    try {
      // 1. Fetch challenge for today's date
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('challenge_date', todayStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setChallenge(data);
        checkIfCompleted(data.id);
      } else {
        // No challenge for today. Let's create/seed one dynamically, real row insert
        const defaultChallenges = [
          {
            title: '21-Minute Burnout Run',
            category_icon: 'run',
            target_value: '5',
            target_unit: 'km',
            description: 'Feel the morning cold and crush a steady, fast-paced cardio run to elevate your high energy limits!',
            challenge_date: todayStr
          },
          {
            title: 'Hydration Anchor',
            category_icon: 'water',
            target_value: '4',
            target_unit: 'Liters',
            description: 'Drink 4 liters of clean spring water today. Track every glass!',
            challenge_date: todayStr
          },
          {
            title: 'Push-up Avalanche',
            category_icon: 'pushups',
            target_value: '100',
            target_unit: 'Reps',
            description: 'Do 100 pushups in as few sets as possible. Quality form is paramount.',
            challenge_date: todayStr
          },
          {
            title: 'Golden Hour Sleep Routine',
            category_icon: 'sleep',
            target_value: '8',
            target_unit: 'Hours',
            description: 'Wind down by 10 PM. Block blue light screens and lock in a deep recuperative cycle.',
            challenge_date: todayStr
          }
        ];

        const chosen = defaultChallenges[Math.floor(Math.random() * defaultChallenges.length)];
        const { data: inserted, error: insertError } = await supabase
          .from('challenges')
          .insert(chosen)
          .select()
          .single();

        if (!insertError && inserted) {
          setChallenge(inserted);
          checkIfCompleted(inserted.id);
        } else {
          // If insert fails (due to DB constraints or read-only), fallback on UI safely
          setChallenge({
            id: 'dummy-challenge-id',
            ...chosen
          });
        }
      }
    } catch (err) {
      console.error('Error in challenge flow:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkIfCompleted = async (challengeId: string) => {
    try {
      const { data, error } = await supabase
        .from('completions')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCompletedToday(true);
      }
    } catch (err) {
      console.error('Error checking completion:', err);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchChallenge();
    }
  }, [userId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setMediaFile(file);
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitCompletion = async () => {
    if (!challenge) return;
    setUploading(true);

    let mediaUrl = '';
    try {
      // 1. Upload proof media file if selected
      if (mediaFile) {
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `${userId}-${challenge.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('proof-videos')
          .upload(filePath, mediaFile);

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('proof-videos')
          .getPublicUrl(filePath);

        mediaUrl = publicUrlData.publicUrl;
      }

      // 2. Insert into completions table
      const { data: completionData, error: completionError } = await supabase
        .from('completions')
        .insert({
          challenge_id: challenge.id,
          user_id: userId,
          actual_value: actualValue || challenge.target_value,
          proof_video_url: mediaUrl,
          proof_thumbnail_url: mediaUrl, // can use the same image/video link
          note: note || 'Completed today\'s challenge! Let\'s go! 🔥'
        })
        .select()
        .single();

      if (completionError) throw completionError;

      // 3. Increment streak & completed count in user profiles
      const currentStreak = (profile?.streak_count || 0) + 1;
      const longestStreak = Math.max(profile?.longest_streak || 0, currentStreak);
      const totalCompleted = (profile?.total_challenges_completed || 0) + 1;

      await supabase
        .from('profiles')
        .update({
          streak_count: currentStreak,
          longest_streak: longestStreak,
          total_challenges_completed: totalCompleted,
        })
        .eq('id', userId);

      // Create a notification for streak increase / daily complete
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'achievement',
          title: `Streak Update 🔥 ${currentStreak} Days`,
          body: `Superb! You completed ${challenge.title} and advanced your daily habit lock!`,
          is_read: false
        });
      } catch (e) {
        console.warn('Failed to insert streak notification:', e);
      }

      // 4. Share to posts feed if selected
      if (shareToFeed) {
        await supabase
          .from('posts')
          .insert({
            user_id: userId,
            post_type: 'completion',
            completion_id: completionData.id,
            content: note || `Just finished today's challenge: ${challenge.title}! My output: ${actualValue || challenge.target_value} ${challenge.target_unit}. 🔥`,
            image_url: mediaUrl, // share the proof photo
            video_url: mediaUrl
          });
      }

      setCompletedToday(true);
      setShowModal(false);
      onRefreshProfile(); // trigger profile update
    } catch (err: any) {
      alert(`Upsert completion exception: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat?.toLowerCase()) {
      case 'run': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
      case 'walk': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/25';
      case 'gym': return 'bg-purple-500/10 text-purple-400 border-purple-500/25';
      case 'water': return 'bg-blue-500/10 text-blue-400 border-blue-500/25';
      case 'sleep': return 'bg-indigo-300/10 text-indigo-400 border-indigo-300/25';
      case 'read': return 'bg-amber-500/10 text-amber-400 border-amber-500/25';
      case 'pushups': return 'bg-red-500/10 text-red-400 border-red-500/25';
      default: return 'bg-[#00E87A]/10 text-[#00E87A] border-[#00E87A]/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900/40 p-5 rounded-3xl border border-neutral-800/60 relative overflow-hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Welcome back, {profile?.name || 'Champ'} 👋
            </h1>
            {isPro ? (
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0A0A0A] uppercase tracking-wider animate-pulse">
                PRO Member
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
                Free Tier
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Build unstoppable fitness accountability today. Nigeria is training!
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center gap-2.5 shadow-md">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-bounce" />
            <div className="text-left">
              <span className="block text-xs text-neutral-400 leading-none">Your Streak</span>
              <span className="text-sm font-extrabold text-white">
                {profile?.streak_count || 0} Days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Pro Banner Upgrade Promo */}
      {!isPro && (
        <motion.div
          id="pro-upgrade-banner"
          whileHover={{ scale: 1.01 }}
          onClick={onNavigateToUpgrade}
          className="cursor-pointer bg-gradient-to-r from-[#00E87A]/20 to-[#0A0A0A] p-4 rounded-2xl border border-[#00E87A]/30 flex items-center justify-between gap-4 group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00E87A]/10 text-[#00E87A] rounded-xl group-hover:scale-110 transition-transform">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Unlock unlimited habits & advanced analytics</p>
              <p className="text-xs text-[#00E87A] font-medium mt-0.5">Upgrade to Pro for just ₦1,500/month →</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-neutral-500 group-hover:text-[#00E87A] transition-colors" />
        </motion.div>
      )}

      {/* Today's Challenge Section */}
      <div className="relative">
        <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#00E87A]" />
          Today's Core Challenge
        </h3>

        {loading ? (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#00E87A] mx-auto mb-3" />
            <p className="text-sm text-neutral-400">Drawing today's active challenge...</p>
          </div>
        ) : challenge ? (
          <motion.div
            id="today-challenge-card"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#121212] border border-neutral-800 rounded-3xl p-6 relative overflow-hidden"
          >
            {/* Corner category stamp */}
            <div className={`absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full border ${getCategoryColor(challenge.category_icon)} uppercase tracking-wider flex items-center gap-1`}>
              <Activity className="w-3.5 h-3.5" />
              {challenge.category_icon}
            </div>

            <div className="max-w-xl">
              <h4 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-2">
                {challenge.title}
              </h4>

              <div className="flex items-baseline gap-1 mt-3">
                <span className="text-4xl font-black text-[#00E87A]">
                  {challenge.target_value}
                </span>
                <span className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
                  {challenge.target_unit}
                </span>
              </div>

              <p className="text-neutral-400 text-sm mt-3 leading-relaxed">
                {challenge.description}
              </p>
            </div>

            <div className="mt-6 pt-5 border-t border-neutral-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-xs text-neutral-500">
                Deadline: Today, 11:59 PM (WAT)
              </div>

              {completedToday ? (
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/25 font-bold text-sm">
                  <Check className="w-5 h-5 text-emerald-400" />
                  Completed & Verified!
                </div>
              ) : (
                <button
                  id="mark-complete-btn"
                  onClick={() => setShowModal(true)}
                  className="px-6 py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] hover:shadow-[0_0_15px_rgba(0,232,122,0.4)] transition duration-300 flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Trophy className="w-4 h-4" />
                  Mark Complete
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 text-center text-neutral-400 text-sm">
            No active challenge found for today. Tap the button above to retry.
          </div>
        )}
      </div>

      {/* completion modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Dialog Panel */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl z-10 overflow-y-auto max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-bold text-white flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-[#00E87A]" />
                  Prove Your Challenge Row
                </h4>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-neutral-500 hover:text-white transition p-1.5 hover:bg-neutral-800 rounded-xl"
                >
                  ✕
                </button>
              </div>

              {challenge && (
                <div className="mb-4 p-3 bg-neutral-900 border border-neutral-850 rounded-2xl">
                  <p className="text-xs text-neutral-500 uppercase font-semibold">Active Objective</p>
                  <p className="text-sm font-bold text-white">{challenge.title}</p>
                  <p className="text-xs text-[#00E87A] font-medium mt-0.5">
                    Target: {challenge.target_value} {challenge.target_unit}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {/* Optional actual output */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Your Actual Output (Optional)
                  </label>
                  <input
                    id="completion-actual-value"
                    type="text"
                    value={actualValue}
                    onChange={e => setActualValue(e.target.value)}
                    placeholder={`e.g. ${challenge?.target_value || '5'}`}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
                  />
                  <p className="text-[10px] text-neutral-500 mt-1">
                    Leave blank to automatically default to the target value.
                  </p>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Add a victorious caption / note
                  </label>
                  <textarea
                    id="completion-note"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="e.g. Lagos weather could not stop me today! 5km done in 22 mins. Unstoppable! 🔥"
                    rows={3}
                    className="w-full px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm resize-none"
                  />
                </div>

                {/* Upload Section */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
                    Proof Media: Photo or Video (Recommended)
                  </label>

                  <div className="relative border border-dashed border-neutral-800 rounded-2xl p-4 text-center hover:border-[#00E87A]/50 transition bg-neutral-900/50">
                    <input
                      id="completion-file-input"
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    />
                    {mediaPreview ? (
                      <div className="space-y-2">
                        {mediaFile?.type.startsWith('video') ? (
                          <video
                            src={mediaPreview}
                            className="w-full max-h-40 object-cover rounded-xl mx-auto"
                            controls
                            muted
                          />
                        ) : (
                          <img
                            src={mediaPreview}
                            alt="Preview proof"
                            className="w-full max-h-40 object-cover rounded-xl mx-auto"
                          />
                        )}
                        <p className="text-xs text-neutral-400">{mediaFile?.name}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setMediaFile(null);
                            setMediaPreview(null);
                          }}
                          className="text-xs text-rose-400 hover:underline z-20 relative"
                        >
                          Remove Photo/Video
                        </button>
                      </div>
                    ) : (
                      <div className="py-2">
                        <Upload className="w-8 h-8 text-neutral-500 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-neutral-300">Choose File or Drag/Drop</p>
                        <p className="text-[10px] text-neutral-500 mt-1">Supports active camera snaps or video up to 50MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Social Share toggle */}
                <div className="flex items-center justify-between p-3.5 bg-neutral-900/40 border border-neutral-850 rounded-2xl">
                  <div>
                    <p className="text-xs font-bold text-white">Share victory to Feed</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">Let the Nigerian WhatsApp & Fit21 circle back you up!</p>
                  </div>
                  <input
                    id="checkbox-share-feed"
                    type="checkbox"
                    checked={shareToFeed}
                    onChange={e => setShareToFeed(e.target.checked)}
                    className="w-5 h-5 rounded-md border-neutral-800 text-[#00E87A] focus:ring-[#00E87A] bg-neutral-950 cursor-pointer"
                  />
                </div>

                {/* Submit */}
                <button
                  id="completion-submit-btn"
                  onClick={handleSubmitCompletion}
                  disabled={uploading}
                  className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-xl hover:bg-[#00c968] shadow-lg hover:shadow-[0_0_15px_rgba(0,232,122,0.3)] transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Uploading & processing workouts...
                    </>
                  ) : (
                    'Claim Completion !'
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
