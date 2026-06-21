import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader2, Dumbbell, MapPin, Phone, Mail, User, Lock, Globe } from 'lucide-react';
import { motion } from 'motion/react';

interface SignUpFormProps {
  onSuccess: () => void;
  onNavigateToLogin: () => void;
}

const NIGERIAN_STATES = [
  'Lagos', 'Abuja (FCT)', 'Rivers', 'Oyo', 'Kano', 'Kaduna', 'Delta', 'Enugu', 
  'Anambra', 'Abia', 'Edo', 'Ogun', 'Ondo', 'Kwara', 'Akwa Ibom', 'Cross River', 
  'Imo', 'Plateau', 'Bauchi', 'Borno', 'Adamawa', 'Gombe', 'Taraba', 'Yobe', 
  'Jigawa', 'Katsina', 'Kebbi', 'Sokoto', 'Zamfara', 'Benue', 'Kogi', 'Nasarawa', 
  'Niger', 'Ekiti', 'Osun', 'Bayelsa', 'Ebonyi'
];

export default function SignUpForm({ onSuccess, onNavigateToLogin }: SignUpFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('Nigeria');
  const [state, setState] = useState('Lagos');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    if (!name || !phone || !email || !password || !country || !state) {
      setErrorMessage('Please fill in all fields.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            phone,
            country,
            state,
            streak_count: 1, // initialize with 1 streak for signing up!
            longest_streak: 1,
            total_challenges_completed: 0,
            bio: 'Ready to build unstoppable fitness habits! Let\'s go! 🔥'
          }
        }
      });

      if (error) throw error;
      
      // Attempt to immediately seed the profile row since auth.signUp might not triggers
      try {
        if (data?.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            name,
            phone,
            country,
            state,
            streak_count: 1,
            longest_streak: 1,
            total_challenges_completed: 0,
            bio: 'Ready to build unstoppable fitness habits! Let\'s go! 🔥'
          });
        }
      } catch (upsertError) {
        console.warn('Profile upsert warning (usually handled by DB triggers):', upsertError);
      }

      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md bg-[#121212] border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
    >
      {/* Visual background glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E87A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-[#00E87A]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-[#00E87A]/10 text-[#00E87A] mb-3">
          <Dumbbell className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Join Fit21</h2>
        <p className="text-neutral-400 text-sm mt-1">Start your 21-day accountability spark</p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSignUp} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
              <User className="w-5 h-5" />
            </span>
            <input
              id="signup-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chukwuma Obi"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
            />
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
            Email Address
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
              <Mail className="w-5 h-5" />
            </span>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
            />
          </div>
        </div>

        {/* Phone number & State side-by-side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Phone Number
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                <Phone className="w-4 h-4" />
              </span>
              <input
                id="signup-phone"
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+234 801..."
                className="w-full pl-9 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              State (Nigeria)
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                <MapPin className="w-4 h-4" />
              </span>
              <select
                id="signup-state"
                value={state}
                onChange={e => setState(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-[#00E87A] transition text-sm appearance-none cursor-pointer"
              >
                {NIGERIAN_STATES.map(st => (
                  <option key={st} value={st} className="bg-neutral-950">
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Country & Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Country
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                <Globe className="w-4 h-4" />
              </span>
              <input
                id="signup-country"
                type="text"
                required
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="Nigeria"
                className="w-full pl-9 pr-3 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-[#00E87A] transition text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                <Lock className="w-4 h-4" />
              </span>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••"
                className="w-full pl-9 pr-10 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <button
          id="signup-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#00c968] active:translate-y-0.5 transition flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <button
          id="btn-switch-to-login"
          onClick={onNavigateToLogin}
          className="text-[#00E87A] font-medium hover:underline focus:outline-none"
        >
          Log in
        </button>
      </div>
    </motion.div>
  );
}
