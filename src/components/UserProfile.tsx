import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { User, Camera, Trophy, Flame, Sparkles, MessageSquare, Bell, LogOut, Loader2, Link, Save, HelpCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UserProfileProps {
  userId: string;
  profile: Profile | null;
  onRefreshProfile: () => void;
  onLogout: () => void;
  onNavigateToUpgrade: () => void;
  isPro: boolean;
  renewalDate?: string;
}

export default function UserProfile({
  userId,
  profile,
  onRefreshProfile,
  onLogout,
  onNavigateToUpgrade,
  isPro,
  renewalDate,
}: UserProfileProps) {
  const [editing, setEditing] = useState(false);
  const [userName, setUserName] = useState(profile?.name || '');
  const [userBio, setUserBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local Settings
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    return localStorage.getItem('fit21_notifications') !== 'disabled';
  });

  const handleUpdateProfile = async () => {
    if (!userName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: userName.trim(),
          bio: userBio.trim(),
        })
        .eq('id', userId);

      if (error) throw error;
      setEditing(false);
      onRefreshProfile();
    } catch (err: any) {
      alert(`Could not save profile details: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingAvatar(true);
      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        // Upload to supabase storage 'avatars' bucket
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Get public link
        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        const avatarPublicUrl = publicUrlData.publicUrl;

        // Update profiles table or metadata
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            avatar_url: avatarPublicUrl,
          })
          .eq('id', userId);

        if (updateError) throw updateError;

        // Update auth user image
        await supabase.auth.updateUser({
          data: { avatar_url: avatarPublicUrl }
        });

        onRefreshProfile();
      } catch (err: any) {
        alert(`Avatar upload failed: ${err.message}`);
      } finally {
        setUploadingAvatar(false);
      }
    }
  };

  const handleToggleNotifications = () => {
    const nextVal = !notificationsEnabled;
    setNotificationsEnabled(nextVal);
    localStorage.setItem('fit21_notifications', nextVal ? 'enabled' : 'disabled');
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      onLogout();
    } catch (err: any) {
      alert(`Logout error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Profile Header Card */}
      <div className="bg-[#121212] border border-neutral-800 rounded-3xl p-6 relative overflow-hidden text-center">
        {/* Background glow lines */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-[#00E87A]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Interactive Avatar */}
        <div className="relative inline-block mx-auto mb-4 group cursor-pointer" onClick={handleAvatarClick}>
          <div className="w-24 h-24 rounded-full bg-neutral-800 border-2 border-[#00E87A] overflow-hidden flex items-center justify-center text-white relative">
            {uploadingAvatar ? (
              <Loader2 className="w-8 h-8 animate-spin text-[#00E87A]" />
            ) : profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-10 h-10 text-neutral-500" />
            )}
          </div>
          <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#00E87A] text-[#0A0A0A] hover:bg-white transition duration-150">
            <Camera className="w-4 h-4" />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>

        {/* Profile edit toggle or text display */}
        {editing ? (
          <div className="space-y-3 max-w-sm mx-auto">
            <input
              id="profile-edit-name"
              type="text"
              required
              value={userName}
              onChange={e => setUserName(e.target.value)}
              placeholder="Your Full Name"
              className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-[#00E87A] transition text-center"
            />
            <textarea
              id="profile-edit-bio"
              value={userBio}
              onChange={e => setUserBio(e.target.value)}
              placeholder="Tell your accountability circle your goals..."
              rows={2}
              className="w-full px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-[#00E87A] transition text-center resize-none"
            />
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setEditing(false)}
                className="px-4 py-1.5 bg-neutral-900 border border-neutral-800 text-xs text-neutral-400 font-bold rounded-lg hover:bg-neutral-800 transition"
              >
                Cancel
              </button>
              <button
                id="btn-save-profile-edit"
                onClick={handleUpdateProfile}
                disabled={saving}
                className="px-4 py-1.5 bg-[#00E87A] text-[#0A0A0A] text-xs font-black rounded-lg hover:bg-[#00c968] transition hover:shadow-[0_0_10px_rgba(0,232,122,0.3)] flex items-center gap-1"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="text-xl font-extrabold text-white tracking-tight">
              {profile?.name || 'Fit21 Athlete'}
            </h3>
            <p className="text-xs text-[#00E87A] font-semibold mt-0.5">
              {profile?.state ? `${profile.state}, Nigeria` : 'Nigeria'}
            </p>
            <p className="text-neutral-400 text-xs max-w-sm mx-auto mt-2 italic leading-relaxed whitespace-pre-wrap">
              "{profile?.bio || 'Ready to build unstoppable fitness habits! Let\'s go! 🔥'}"
            </p>

            <button
              id="btn-trigger-edit-profile"
              onClick={() => {
                setUserName(profile?.name || '');
                setUserBio(profile?.bio || '');
                setEditing(true);
              }}
              className="mt-3.5 px-3 py-1 bg-neutral-900 border border-neutral-800 hover:text-[#00E87A] hover:bg-neutral-850 rounded-xl text-[11px] font-bold transition duration-200"
            >
              Edit Profile Info
            </button>
          </div>
        )}
      </div>

      {/* Stats Row */}
      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-2 mb-1">
        Personal statistics
      </h3>
      <div className="grid grid-cols-3 gap-3 bg-[#121212] border border-neutral-800 rounded-3xl p-5 text-center">
        <div className="space-y-1">
          <div className="inline-flex p-2 bg-orange-500/10 text-orange-400 rounded-xl mb-1">
            <Flame className="w-5 h-5 fill-orange-400/10" />
          </div>
          <span className="block text-lg font-black text-white">{profile?.streak_count || 0}</span>
          <span className="block text-[10px] text-neutral-500 font-semibold uppercase leading-none">Streak</span>
        </div>

        <div className="space-y-1 border-x border-neutral-800/80 px-2">
          <div className="inline-flex p-2 bg-amber-500/10 text-amber-500 rounded-xl mb-1">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="block text-lg font-black text-white">{profile?.longest_streak || 0}</span>
          <span className="block text-[10px] text-neutral-500 font-semibold uppercase leading-none">Longest</span>
        </div>

        <div className="space-y-1">
          <div className="inline-flex p-2 bg-[#00E87A]/10 text-[#00E87A] rounded-xl mb-1">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="block text-lg font-black text-white">{profile?.total_challenges_completed || 0}</span>
          <span className="block text-[10px] text-neutral-500 font-semibold uppercase leading-none">Complets</span>
        </div>
      </div>

      {/* Subscription Card block */}
      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-2 mb-1">
        Fit21 membership
      </h3>
      <div className="bg-[#121212] border border-neutral-800 rounded-3xl p-5 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="block text-xs font-bold text-neutral-400">Membership tier</span>
          <span className={`block text-md font-black uppercase tracking-wide leading-none ${isPro ? 'text-amber-400' : 'text-neutral-305'}`}>
            {isPro ? 'Fit21 PRO Circle' : 'Free Member'}
          </span>
          {isPro && renewalDate && (
            <span className="block text-[10px] text-neutral-500 mt-0.5">
              Renews: {new Date(renewalDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {!isPro ? (
          <button
            id="profile-upgrade-btn"
            onClick={onNavigateToUpgrade}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-[#0A0A0A] font-extrabold rounded-xl text-xs hover:shadow-[0_0_12px_rgba(245,158,11,0.3)] hover:scale-101 active:scale-99 transition cursor-pointer"
          >
            Upgrade to Pro
          </button>
        ) : (
          <div className="px-3.5 py-1.5 bg-[#00E87A]/5 border border-[#00E87A]/20 text-[#00E87A] text-xs font-bold rounded-xl uppercase tracking-wider">
            Active
          </div>
        )}
      </div>

      {/* Settings Options */}
      <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest pl-2 mb-1">
        General Configuration
      </h3>
      <div className="bg-[#121212] border border-neutral-800 rounded-3xl divide-y divide-neutral-850 overflow-hidden">
        {/* Toggle Notifications */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <span className="p-2 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-xl">
              <Bell className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-white leading-none">Notifications & Alerts</p>
              <span className="text-[10px] text-neutral-500">Enable streak warning alarms</span>
            </div>
          </div>
          <input
            id="checkbox-settings-notif"
            type="checkbox"
            checked={notificationsEnabled}
            onChange={handleToggleNotifications}
            className="w-5 h-5 rounded-md border-neutral-800 text-[#00E87A] focus:ring-[#00E87A] bg-neutral-950 cursor-pointer"
          />
        </div>

        {/* WhatsApp Button */}
        <a
          id="btn-settings-whatsapp"
          href="https://chat.whatsapp.com/DdQZz2IWdIw8JxwWRk8tuS"
          target="_blank"
          rel="noopener noreferrer"
          className="p-4 flex items-center justify-between hover:bg-neutral-900/40 transition group cursor-pointer"
        >
          <div className="flex items-center gap-3.5">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl group-hover:bg-[#00E87A] group-hover:text-[#0A0A0A] transition duration-200">
              <MessageSquare className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-white group-hover:text-[#00E87A] transition leading-none">WhatsApp Circle</p>
              <span className="text-[10px] text-neutral-500">Connect with coaches & peers</span>
            </div>
          </div>
          <Link className="w-4 h-4 text-neutral-600 group-hover:text-[#00E87A] transition" />
        </a>

        {/* Log Out */}
        <button
          id="profile-logout-btn"
          onClick={handleSignOut}
          className="w-full text-left p-4 flex items-center justify-between hover:bg-rose-500/5 transition cursor-pointer group"
        >
          <div className="flex items-center gap-3.5">
            <span className="p-2 bg-rose-500/10 text-rose-500 rounded-xl group-hover:bg-rose-500 group-hover:text-white transition duration-200">
              <LogOut className="w-4 h-4" />
            </span>
            <div>
              <p className="text-sm font-bold text-rose-400 group-hover:text-rose-500 transition leading-none">Power Off / Log Out</p>
              <span className="text-[10px] text-neutral-500">Sign out of active account</span>
            </div>
          </div>
          <LogOut className="w-4 h-4 text-neutral-600 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
