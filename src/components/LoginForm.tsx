import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Eye, EyeOff, Loader2, Dumbbell, Mail, Lock } from 'lucide-react';
import { motion } from 'motion/react';

interface LoginFormProps {
  onSuccess: () => void;
  onNavigateToSignUp: () => void;
}

export default function LoginForm({ onSuccess, onNavigateToSignUp }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    if (!email || !password) {
      setErrorMessage('Please enter both your email and password.');
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Incorrect email or password.');
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
      {/* Background radial glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00E87A]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="text-center mb-6">
        <div className="inline-flex p-3 rounded-2xl bg-[#00E87A]/10 text-[#00E87A] mb-3">
          <Dumbbell className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
        <p className="text-neutral-400 text-sm mt-1">Unlock your fitness momentum</p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
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
              id="login-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="yourname@gmail.com"
              className="w-full pl-10 pr-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
            Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
              <Lock className="w-5 h-5" />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full pl-10 pr-10 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-white placeholder-neutral-600 focus:outline-none focus:border-[#00E87A] transition text-sm"
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

        <button
          id="login-submit-btn"
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#00E87A] text-[#0A0A0A] font-bold rounded-xl hover:bg-[#00c968] active:translate-y-0.5 transition flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Log In'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-neutral-500">
        Don't have an account?{' '}
        <button
          id="btn-switch-to-signup"
          onClick={onNavigateToSignUp}
          className="text-[#00E87A] font-medium hover:underline focus:outline-none"
        >
          Sign up
        </button>
      </div>
    </motion.div>
  );
}
