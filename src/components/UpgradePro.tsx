import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Check, ShieldAlert, Sparkles, Star, Loader2, ArrowLeft, Trophy, CreditCard, RefreshCw, X } from 'lucide-react';
import { motion } from 'motion/react';

interface UpgradeProProps {
  userId: string;
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export default function UpgradePro({ userId, email, onSuccess, onBack }: UpgradeProProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const cleanupFlutterwaveDOM = () => {
    try {
      // 1. Remove Flutterwave inline container if any
      const inlineContainers = document.querySelectorAll('[id*="flwpbf"], [class*="flwpbf"], [class*="flutterwave"]');
      inlineContainers.forEach(el => el.remove());

      // 2. Remove standard container elements injected by Flutterwave v3 JS SDK
      const mainContainers = document.querySelectorAll('.main-f-container, #flwpbf-inline-container, .flwpbf-inline-container, #flutterwave-iframe, .flutterwave-iframe-wrapper');
      mainContainers.forEach(el => el.remove());

      // 3. Remove style tags injected by Flutterwave if any
      document.querySelectorAll('style').forEach(style => {
        if (style.innerHTML.includes('flwpbf') || style.innerHTML.includes('flutterwave')) {
          style.remove();
        }
      });

      // 4. Remove any iframes loading from flutterwave.com
      document.querySelectorAll('iframe').forEach(iframe => {
        try {
          if (iframe.src && (iframe.src.includes('flutterwave.com') || iframe.src.includes('checkout'))) {
            iframe.remove();
          }
        } catch (e) {
          iframe.remove();
        }
      });

      // 5. Restore background scrolling overflows
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    } catch (e) {
      console.warn('Error during Flutterwave DOM cleanup:', e);
    }
  };

  const handleManualCancel = () => {
    cleanupFlutterwaveDOM();
    setLoading(false);
  };

  // Core upgrade function matching user's exact specification
  const startUpgrade = async (paymentType = 'new') => {
    setLoading(true);
    setError(null);
    try {
      // 1. Invoke Supabase Functions
      const { data: payInfo, error: funcError } = await supabase.functions.invoke('create-payment', {
        body: { payment_type: paymentType }
      });

      if (funcError || !payInfo) {
        throw new Error(funcError?.message || 'Could not start payment. (Supabase function create-payment not found/configured)');
      }

      // 2. Open Flutterwave Checkout
      const fw = (window as any).FlutterwaveCheckout;
      if (!fw) {
        throw new Error('Flutterwave SDK not loaded properly. Check index.html imports.');
      }

      fw({
        public_key: 'FLWPUBK-65b9bdf8d573dfa12cbcfc733491ea33-X',
        tx_ref: payInfo.tx_ref,
        amount: payInfo.amount,
        currency: payInfo.currency,
        customer: { email: payInfo.email },
        customizations: { title: 'Fit21 Pro', description: 'Monthly subscription' },
        callback: async (response: any) => {
          const { data: result, error: verifyError } = await supabase.functions.invoke(
            'verify-payment',
            { body: { transaction_id: response.transaction_id, tx_ref: payInfo.tx_ref } }
          );

          if (verifyError || !result?.success) {
            setError('Payment could not be verified, please try again');
            setLoading(false);
            return;
          }

          setSuccess(true);
          setLoading(false);
          setTimeout(() => {
            onSuccess();
          }, 2000);
        },
        onclose: () => {
          cleanupFlutterwaveDOM();
          setLoading(false);
        },
        onClose: () => {
          cleanupFlutterwaveDOM();
          setLoading(false);
        },
      });
    } catch (err: any) {
      console.error(err);
      setError(
        `${err.message}. Please complete your subscription session securely.`
      );
      setLoading(false);
    }
  };

  const freePerks = [
    'Daily wellness challenges',
    'Day-to-day streak tracking',
    'Up to 10 active habits',
    'Basic community activity feed',
  ];

  const proPerks = [
    'Unlimited habit check-loops (no 10-habit cap)',
    'Advanced analytics & trend insight logs',
    'Custom challenge creation (fight your friends)',
    'Priority placement on Nigerian leaderboards',
    '100% ad-free athletic execution',
    'Verified "Pro" badge on feed activities',
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Back Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 border border-neutral-800 rounded-xl hover:bg-neutral-900 text-neutral-400 hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-lg font-extrabold text-white leading-none">Upgrade to Fit21 Pro</h3>
          <span className="text-[10px] uppercase text-neutral-500 font-bold tracking-wider">Feel 21 Again with No Limits</span>
        </div>
      </div>

      {success ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-neutral-900 border-2 border-[#00E87A] rounded-3xl p-10 text-center space-y-4"
        >
          <div className="w-16 h-16 bg-[#00E87A]/15 text-[#00E87A] rounded-full flex items-center justify-center text-3xl mx-auto animate-bounce">
            🎉
          </div>
          <h4 className="text-2xl font-black text-white">You're Pro!</h4>
          <p className="text-neutral-400 text-sm max-w-sm mx-auto leading-relaxed">
            Congratulations! All checks are cleared, your 10-habits ceiling is gone, and the PRO Circle is officially unlocked.
          </p>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* Main Comparison Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Free Tier Card */}
            <div className="bg-neutral-900/40 p-6 rounded-3xl border border-neutral-800 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase text-neutral-500 font-bold tracking-widest block mb-1">Standard</span>
                <p className="text-2xl font-extrabold text-white">Free Plan</p>
                <div className="text-neutral-400 font-bold text-sm mt-2">₦0/mo</div>
                <div className="h-[1px] bg-neutral-800/80 my-4" />
                <ul className="space-y-2.5 text-xs text-neutral-400">
                  {freePerks.map(p => (
                    <li key={p} className="flex items-start gap-2 leading-tight">
                      <span className="text-neutral-600">✕</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Pro Tier (Accentuation) Card */}
            <div className="bg-[#121212] p-6 rounded-3xl border-2 border-[#00E87A] flex flex-col justify-between relative overflow-hidden shadow-[0_4px_30px_rgba(0,232,122,0.1)]">
              {/* Stamp */}
              <div className="absolute top-4 right-4 bg-[#00E87A] text-[#0A0A0A] font-black text-[9px] uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Coach Approved
              </div>

              <div>
                <span className="text-xs uppercase text-[#00E87A] font-bold tracking-widest block mb-1">Premium Access</span>
                <p className="text-2xl font-extrabold text-white flex items-center gap-1.5">
                  Fit21 Pro Circle
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                </p>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-black text-[#00E87A]">₦1,500</span>
                  <span className="text-xs text-neutral-400 font-bold uppercase">/ month</span>
                </div>

                <div className="h-[1px] bg-neutral-800/80 my-4" />

                <ul className="space-y-2.5 text-xs text-neutral-300">
                  {proPerks.map(p => (
                    <li key={p} className="flex items-start gap-2 leading-tight">
                      <Check className="w-4 h-4 text-[#00E87A] shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Upgrade Controls */}
          {error && (
            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-400 text-xs font-semibold leading-relaxed space-y-1">
              <div className="flex items-center gap-1.5 text-sm font-bold">
                <ShieldAlert className="w-4 h-4" />
                <span>Notice on Workspace limits</span>
              </div>
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            {/* Primary Upgrade button */}
            <button
              id="start-flutterwave-btn"
              onClick={() => startUpgrade('new')}
              disabled={loading}
              className="w-full py-4 bg-[#00E87A] text-[#0A0A0A] font-black rounded-2xl hover:bg-[#00c968] hover:shadow-[0_0_20px_rgba(0,232,122,0.4)] transition duration-200 flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Initiating secure gateway checkout...
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Upgrade Now (Checkout via Flutterwave)
                </>
              )}
            </button>

            {loading && (
              <button
                id="cancel-payment-loading-btn"
                onClick={handleManualCancel}
                className="w-full py-2.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer animate-fade-in"
              >
                <X className="w-4 h-4" />
                Cancel Payment & Close Overlay
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
