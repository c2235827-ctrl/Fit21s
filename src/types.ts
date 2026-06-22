export interface Profile {
  id: string;
  name: string;
  phone?: string;
  country?: string;
  state?: string;
  streak_count: number;
  longest_streak: number;
  total_challenges_completed: number;
  avatar_url?: string;
  bio?: string;
}

export interface Challenge {
  id: string;
  title: string;
  category: 'run' | 'walk' | 'gym' | 'water' | 'sleep' | 'read' | 'pushups' | 'custom' | 'meditate' | string;
  target_value: string;
  target_unit: string;
  description: string;
  date: string; // YYYY-MM-DD
}

export interface Completion {
  id: string;
  challenge_id: string;
  user_id: string;
  actual_value?: string;
  proof_video_url?: string;
  proof_thumbnail_url?: string;
  note?: string;
  created_at: string;
}

export interface Post {
  id: string;
  user_id: string; // author id
  post_type: 'post' | 'completion' | 'achievement';
  completion_id?: string;
  content: string;
  image_url?: string;
  video_url?: string;
  share_card_data?: {
    kind: 'streak' | 'completions' | 'first_run' | 'pro' | string;
    value: number;
  };
  is_deleted?: boolean;
  is_flagged?: boolean;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    name: string;
    avatar_url?: string;
  };
}

export interface UserChallenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'completed' | 'declined';
  created_at: string;
  challenger_profile?: Profile;
  challenged_profile?: Profile;
}

export interface Habit {
  id: string;
  user_id: string;
  name: string;
  icon: string; // Emoji or icon name
  color: string; // Hex or tailwind class
  sort_order?: number;
  created_at: string;
  // Dynamic client computed
  currentStreak?: number;
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  content: string;
  mood: 'great' | 'good' | 'okay' | 'bad' | 'terrible';
  energy_level: number; // 1-10
  is_private: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  status: 'pro' | 'free' | string;
  current_period_end?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  is_read: boolean;
  type: 'like' | 'comment' | 'challenge' | 'streak_reminder' | 'leaderboard' | 'broadcast' | 'achievement' | string;
  title: string;
  body: string;
  created_at: string;
}
