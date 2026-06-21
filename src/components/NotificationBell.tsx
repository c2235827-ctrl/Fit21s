import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageSquare, Trophy, Flame, Compass, Megaphone, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Notification } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Subscribe to new notifications
    const channel = supabase
      .channel('realtime_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />;
      case 'comment':
        return <MessageSquare className="w-5 h-5 text-[#00E87A]" />;
      case 'challenge':
        return <Trophy className="w-5 h-5 text-amber-500" />;
      case 'streak_reminder':
        return <Flame className="w-5 h-5 text-orange-500" />;
      case 'leaderboard':
        return <Compass className="w-5 h-5 text-indigo-400" />;
      case 'broadcast':
        return <Megaphone className="w-5 h-5 text-sky-400" />;
      case 'achievement':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
      default:
        return <Bell className="w-5 h-5 text-gray-400" />;
    }
  };

  // Helper to insert a notification for demo/testing purposes since Supabase backend is clean
  const handleInsertDummyNotification = async () => {
    try {
      const dummyTypes = ['like', 'comment', 'challenge', 'streak_reminder', 'leaderboard', 'broadcast', 'achievement'];
      const randomType = dummyTypes[Math.floor(Math.random() * dummyTypes.length)];
      let title = '';
      let body = '';
      switch (randomType) {
        case 'like':
          title = 'New Like! ❤️';
          body = 'Chidi liked your push-ups workout completion post.';
          break;
        case 'comment':
          title = 'New Comment! 💬';
          body = 'Tunde commented: "Monster pace, bro! Keep it up!"';
          break;
        case 'challenge':
          title = 'Challenge Accepted! ⚔️';
          body = 'Amara challenged you to a 50 squat duel. Beat her score!';
          break;
        case 'streak_reminder':
          title = 'Keep the streak! 🔥';
          body = 'Only 4 hours left to mark today\'s habits and preserve your 5-day streak!';
          break;
        case 'leaderboard':
          title = 'Rank Update! 🏆';
          body = 'You just surged to #4 in the Lagos State weekly leaderboard!';
          break;
        case 'broadcast':
          title = 'Fit21 Update! 📢';
          body = 'Join our WhatsApp collective tomorrow morning at 6:00 AM for a live run.';
          break;
        case 'achievement':
          title = 'Badge unlocked! 🎖️';
          body = 'You earned the "Unstoppable" achievement for completing 7 challenges in a row.';
          break;
      }

      await supabase.from('notifications').insert({
        user_id: userId,
        type: randomType,
        title,
        body,
        is_read: false
      });
    } catch (e) {
      console.error('Could not auto-insert test notification:', e);
    }
  };

  return (
    <div className="relative">
      <button
        id="notification-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-neutral-800 transition text-gray-300 hover:text-[#00E87A] focus:outline-none"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-[#0A0A0A]">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40 bg-black/60 md:absolute md:inset-auto"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-[#121212] border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
              style={{ maxHeight: 'calc(100vh - 120px)' }}
            >
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[#00E87A]/20 text-[#00E87A]">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-neutral-400 hover:text-white transition"
                    >
                      Mark all read
                    </button>
                  )}
                  {/* Dummy generator helpful for testing during runtime */}
                  <button
                    onClick={handleInsertDummyNotification}
                    title="Send Test Notification"
                    className="text-xs px-1.5 py-0.5 bg-neutral-800 text-[#00E87A] rounded hover:bg-neutral-700 transition"
                  >
                    + Test
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto max-h-[350px] divide-y divide-neutral-800/50">
                {loading && notifications.length === 0 ? (
                  <div className="p-6 text-center text-sm text-neutral-500">
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-8 text-center">
                    <Bell className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                    <p className="text-sm font-medium text-neutral-400">All caught up!</p>
                    <p className="text-xs text-neutral-500 mt-1">
                      You will see challenges, likes, comments, and milestones here list.
                    </p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => markAsRead(notif.id)}
                      className={`p-4 flex gap-3 cursor-pointer transition ${
                        notif.is_read
                          ? 'bg-transparent hover:bg-neutral-900/50'
                          : 'bg-[#152e1f]/20 hover:bg-[#152e1f]/35 border-l-2 border-[#00E87A]'
                      }`}
                    >
                      <div className="flex-shrink-0 mt-1">
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${notif.is_read ? 'text-neutral-300' : 'text-white font-medium'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5 break-words">
                          {notif.body}
                        </p>
                        <p className="text-[10px] text-neutral-500 mt-1">
                          {notif.created_at ? new Date(notif.created_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
