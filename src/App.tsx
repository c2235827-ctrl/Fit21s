import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Profile } from './types';
import { 
  Flame, Trophy, Compass, PlusCircle, CheckSquare, User as UserIcon, 
  Dumbbell, Sparkles, MessageSquare, ExternalLink, Loader2, Play 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Subcomponents
import SignUpForm from './components/SignUpForm';
import LoginForm from './components/LoginForm';
import TodayChallenge from './components/TodayChallenge';
import SocialFeed from './components/SocialFeed';
import ChallengesTab from './components/ChallengesTab';
import HabitsJournal from './components/HabitsJournal';
import UserProfile from './components/UserProfile';
import UpgradePro from './components/UpgradePro';
import NotificationBell from './components/NotificationBell';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [screenState, setScreenState] = useState<'splash' | 'signup' | 'login' | 'app'>('splash');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'feed' | 'challenges' | 'habits' | 'profile'>('home');
  const [showPaywall, setShowPaywall] = useState(false);

  const fetchUserProfile = async (uid: string) => {
    try {
      // 1. Query registered profile
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Build Profile row on the fly if user auth exists but row doesn't
        const { data: { user } } = await supabase.auth.getUser();
        const meta = user?.user_metadata || {};
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: uid,
            name: meta.name || user?.email?.split('@')[0] || 'Fit21 Athlete',
            phone: meta.phone || '',
            country: meta.country || 'Nigeria',
            state: meta.state || 'Lagos',
            streak_count: 1,
            longest_streak: 1,
            total_challenges_completed: 0,
            bio: 'Ready to build unstoppable fitness habits! Let\'s go! 🔥'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        data = inserted;
      }

      setProfile(data);

      // 2. Query subscriptions
      const { data: subData, error: subError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (!subError && subData && subData.status === 'pro') {
        setIsPro(true);
      } else {
        setIsPro(false);
      }

      setScreenState('app');
    } catch (err) {
      console.error('Error fetching athlete profile:', err);
      // Failover safely so they can browse
      setScreenState('app');
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setLoadingAuth(false);
      }
    });

    // Handle authentication state switches
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchUserProfile(session.user.id);
      } else {
        setProfile(null);
        setIsPro(false);
        setScreenState('splash');
        setLoadingAuth(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleRefreshProfile = () => {
    if (session?.user?.id) {
      fetchUserProfile(session.user.id);
    }
  };

  if (loadingAuth) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center gap-4 text-white p-6">
        <Dumbbell className="w-12 h-12 text-[#00E87A] animate-spin" />
        <p className="text-sm font-semibold tracking-wider uppercase font-mono text-[#00E87A]">Fit21 — Mobilizing fitness...</p>
      </div>
    );
  }

  // --- Render Unauthenticated Views ---
  if (screenState === 'splash') {
    return (
      <div className="relative w-full h-screen overflow-hidden bg-[#0A0A0A] flex flex-col justify-between p-6">
        {/* Full-screen looping muted autoplay background video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 filter brightness-[0.35]"
          src="/assets/splash-bg.mp4"
          poster="https://cdn-icons-png.flaticon.com/512/12563/12563330.png"
        >
          {/* Fallback to background gradient if asset stream is not active */}
        </video>

        {/* Gradient dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/95 z-1" />

        {/* HEADER BRANDING */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
              src="https://cdn-icons-png.flaticon.com/512/12563/12563330.png" 
              alt="Logo" 
              className="w-10 h-10 object-contain hover:rotate-12 transition-transform duration-300" 
            />
            <span className="text-xl font-black text-white tracking-tight uppercase">Fit21</span>
          </div>
          <span className="text-xs font-bold text-neutral-400 capitalize tracking-wide hidden sm:block">Nigeria's active circle</span>
        </div>

        {/* MID LOGO CENTER */}
        <div className="relative z-10 text-center max-w-md mx-auto my-auto space-y-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="w-24 h-24 mx-auto rounded-3xl bg-[#00E87A]/15 border border-[#00E87A]/25 p-4 flex items-center justify-center animate-pulse"
          >
            <img 
              src="https://cdn-icons-png.flaticon.com/512/12563/12563330.png" 
              alt="Logo centered" 
              className="w-full h-full object-contain" 
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
              FEEL <span className="text-[#00E87A]">21</span> AGAIN.
            </h1>
            <p className="text-[#00E87A] text-sm font-extrabold uppercase tracking-widest mt-1">
              Guaranteed Accountability Loop
            </p>
            <p className="text-neutral-400 text-xs mt-3 leading-relaxed max-w-sm mx-auto">
              Fit21 is Nigerias primary fitness PWA. Track active streaks, defeat companions in peer duels, and lock down habits offline!
            </p>
          </motion.div>
        </div>

        {/* CONTROL DECK BUTTONS */}
        <div className="relative z-10 space-y-3.5 max-w-md w-full mx-auto pb-6">
          <a
            id="join-whatsapp-btn"
            href="https://chat.whatsapp.com/DdQZz2IWdIw8JxwWRk8tuS"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4.5 bg-neutral-900/90 border border-neutral-800 text-white font-extrabold rounded-2xl hover:bg-neutral-850 hover:border-neutral-500 transition duration-200 flex items-center justify-center gap-2 px-4 shadow-xl cursor-pointer group text-sm"
          >
            <MessageSquare className="w-5 h-5 text-[#00E87A] group-hover:scale-110 transition-transform" />
            Join WhatsApp Community
            <ExternalLink className="w-4 h-4 text-neutral-500" />
          </a>

          <button
            id="register-splash-btn"
            onClick={() => setScreenState('signup')}
            className="w-full py-4.5 bg-[#00E87A] text-[#0A0A0A] font-extrabold rounded-2xl hover:bg-[#00c968] active:translate-y-0.5 transition duration-150 flex items-center justify-center gap-2 text-sm shadow-2xl shadow-[#00E87A]/20 cursor-pointer"
          >
            Create Account
          </button>

          <div className="text-center font-semibold text-xs text-neutral-500">
            Already have an account?{' '}
            <button
              id="switch-to-login-btn"
              onClick={() => setScreenState('login')}
              className="text-[#00E87A] font-bold hover:underline focus:outline-none"
            >
              Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screenState === 'signup') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center p-4">
        <SignUpForm
          onSuccess={handleRefreshProfile}
          onNavigateToLogin={() => setScreenState('login')}
        />
      </div>
    );
  }

  if (screenState === 'login') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center p-4">
        <LoginForm
          onSuccess={handleRefreshProfile}
          onNavigateToSignUp={() => setScreenState('signup')}
        />
      </div>
    );
  }

  // --- Render Authenticated Layout ---
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-between">
      {/* Dynamic Top Bar */}
      <header className="sticky top-0 bg-[#0A0A0A]/90 backdrop-blur-md border-b border-neutral-900 py-3.5 px-4 sm:px-6 z-40">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            onClick={() => { setActiveTab('home'); setShowPaywall(false); }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <img 
              src="https://cdn-icons-png.flaticon.com/512/12563/12563330.png" 
              alt="logo icon" 
              className="w-8 h-8 object-contain group-hover:rotate-6 transition-transform" 
            />
            <span className="text-lg font-black tracking-tighter uppercase text-white flex items-center gap-1">
              FIT<span className="text-[#00E87A]">21</span>
              <span className="text-[10px] lowercase text-[#00E87A] border border-[#00E87A]/30 px-1 py-0.5 rounded ml-1 tracking-normal font-bold">pwa</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Custom Interactive Notification Bell */}
            {session?.user && (
              <NotificationBell userId={session.user.id} />
            )}
          </div>
        </div>
      </header>

      {/* Main Container Viewport Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-6 relative">
        <AnimatePresence mode="wait">
          {showPaywall ? (
            <motion.div
              key="paywall-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full"
            >
              <UpgradePro
                userId={session.user.id}
                email={session.user.email}
                onSuccess={() => {
                  setIsPro(true);
                  setShowPaywall(false);
                  handleRefreshProfile();
                }}
                onBack={() => setShowPaywall(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="w-full"
            >
              {activeTab === 'home' && (
                <TodayChallenge
                  userId={session.user.id}
                  profile={profile}
                  onRefreshProfile={handleRefreshProfile}
                  onNavigateToUpgrade={() => setShowPaywall(true)}
                  isPro={isPro}
                />
              )}

              {activeTab === 'feed' && (
                <SocialFeed
                  userId={session.user.id}
                  profile={profile}
                />
              )}

              {activeTab === 'challenges' && (
                <ChallengesTab
                  userId={session.user.id}
                  profile={profile}
                />
              )}

              {activeTab === 'habits' && (
                <HabitsJournal
                  userId={session.user.id}
                  isPro={isPro}
                  onNavigateToUpgrade={() => setShowPaywall(true)}
                />
              )}

              {activeTab === 'profile' && (
                <UserProfile
                  userId={session.user.id}
                  profile={profile}
                  onRefreshProfile={handleRefreshProfile}
                  onLogout={() => {
                    setSession(null);
                    setProfile(null);
                    setScreenState('splash');
                  }}
                  onNavigateToUpgrade={() => setShowPaywall(true)}
                  isPro={isPro}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Persistent Beautiful Responsive Bottom Navigation Rail */}
      {!showPaywall && (
        <nav className="fixed bottom-0 inset-x-0 bg-[#0A0A0A]/95 backdrop-blur-md border-t border-neutral-900 py-2 sm:py-3 z-40 shadow-xl">
          <div className="max-w-md mx-auto grid grid-cols-5 text-center text-[10px] font-bold text-neutral-400">
            {/* HOME */}
            <button
              id="nav-tab-home"
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'home' ? 'text-[#00E87A]' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <Flame className={`w-5 h-5 ${activeTab === 'home' ? 'fill-[#00E87A]/10 animate-pulse' : ''}`} />
              <span className="scale-95 leading-none mt-0.5">Home</span>
            </button>

            {/* FEED */}
            <button
              id="nav-tab-feed"
              onClick={() => setActiveTab('feed')}
              className={`flex flex-col items-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'feed' ? 'text-[#00E87A]' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <Compass className={`w-5 h-5 ${activeTab === 'feed' ? 'stroke-[2.5]' : ''}`} />
              <span className="scale-95 leading-none mt-0.5">Feed</span>
            </button>

            {/* CHALLENGES */}
            <button
              id="nav-tab-challenges"
              onClick={() => setActiveTab('challenges')}
              className={`flex flex-col items-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'challenges' ? 'text-[#00E87A]' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <Trophy className={`w-5 h-5 ${activeTab === 'challenges' ? 'stroke-[2.5]' : ''}`} />
              <span className="scale-95 leading-none mt-0.5">Challenges</span>
            </button>

            {/* HABITS */}
            <button
              id="nav-tab-habits"
              onClick={() => setActiveTab('habits')}
              className={`flex flex-col items-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'habits' ? 'text-[#00E87A]' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <CheckSquare className={`w-5 h-5 ${activeTab === 'habits' ? 'stroke-[2.5]' : ''}`} />
              <span className="scale-95 leading-none mt-0.5">Habits</span>
            </button>

            {/* PROFILE */}
            <button
              id="nav-tab-profile"
              onClick={() => setActiveTab('profile')}
              className={`flex flex-col items-center gap-1 py-1 transition cursor-pointer ${
                activeTab === 'profile' ? 'text-[#00E87A]' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <UserIcon className={`w-5 h-5 ${activeTab === 'profile' ? 'stroke-[2.5]' : ''}`} />
              <span className="scale-95 leading-none mt-0.5">Profile</span>
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
