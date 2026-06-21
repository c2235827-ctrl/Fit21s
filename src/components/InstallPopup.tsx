import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, HelpCircle, ArrowUp, Share, Smartphone, Plus } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function InstallPopup() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const isAppStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;
    
    setIsStandalone(isAppStandalone);

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const detectIOS = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(detectIOS);

    // 3. Handle standard Chrome / Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Only show the pop-up if the user hasn't explicitly dismissed it in this session
      const promptDismissed = sessionStorage.getItem('fit21_install_popup_dismissed') === 'true';
      if (!promptDismissed && !isAppStandalone) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS and other browsers: If standalone is false, let's prompt iOS users after 3 seconds of load time
    const timer = setTimeout(() => {
      const promptDismissed = sessionStorage.getItem('fit21_install_popup_dismissed') === 'true';
      if (detectIOS && !isAppStandalone && !promptDismissed) {
        setIsVisible(true);
      }
    }, 3500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the browser install sheet
    await deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    
    // Clear prompt and close modal
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('fit21_install_popup_dismissed', 'true');
    setIsVisible(false);
  };

  // If already running inside standalone app, don't show prompt
  if (isStandalone || !isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center p-4">
        {/* Backdrop close */}
        <div className="absolute inset-0" onClick={handleDismiss} />

        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className="relative bg-[#121212] border border-neutral-800 rounded-t-[2.5rem] sm:rounded-[2rem] w-full max-w-sm p-6 overflow-hidden shadow-2xl text-center self-end sm:self-center"
        >
          {/* Subtle Background Glow Accent matching Fit21 Theme */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00E87A] to-transparent" />
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#00E87A]/5 rounded-full blur-2xl pointer-events-none" />

          {/* Close button */}
          <button
            id="install-popup-close-btn"
            onClick={handleDismiss}
            className="absolute top-4 right-4 p-2 text-neutral-500 hover:text-white hover:bg-neutral-900 rounded-full transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* App Logo */}
          <div className="relative mt-2 mb-4 inline-block">
            <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-[#00E87A]/20 flex items-center justify-center p-3.5 mx-auto">
              <img
                src="https://cdn-icons-png.flaticon.com/512/12563/12563330.png"
                alt="Fit21 App Logo"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-[#00E87A] text-[#0A0A0A] rounded-full p-1 border border-[#121212]">
              <Download className="w-3 h-3 stroke-[2.5]" />
            </span>
          </div>

          <h3 className="text-lg font-black text-white tracking-tight">
            Install Fit21 App
          </h3>
          <p className="text-xs text-[#00E87A] font-extrabold uppercase tracking-wider mt-0.5">
            Add to your Home Screen
          </p>
          <p className="text-neutral-400 text-xs mt-3 leading-relaxed max-w-[270px] mx-auto">
            Install the application on your device to enjoy offline habit trackers, full-screen accountability feeds, and direct home access.
          </p>

          <div className="mt-6 space-y-3">
            {isIOS ? (
              /* iOS Instructions layout */
              <div className="p-4 bg-neutral-900 rounded-2xl border border-neutral-800 text-left space-y-3 text-xs">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#00E87A]" />
                  Setup Steps for iPhone/iPad:
                </p>
                <ol className="space-y-2 text-neutral-400 font-semibold list-decimal list-inside pl-1">
                  <li>
                    Tap Safari's <span className="inline-flex items-center text-white bg-neutral-850 px-1.5 py-0.5 rounded leading-none gap-1"><Share className="w-3.5 h-3.5 text-[#00E87A]" /> Share</span> button.
                  </li>
                  <li>
                    Scroll down and select <span className="inline-flex items-center text-white bg-neutral-850 px-1.5 py-0.5 rounded leading-none gap-1"><Plus className="w-3.5 h-3.5 text-[#00E87A]" /> Add to Home Screen</span>.
                  </li>
                  <li>
                    Tap <span className="text-white font-black">Add</span> in the top right to launch.
                  </li>
                </ol>
              </div>
            ) : deferredPrompt ? (
              /* Standard Android / Chrome Trigger button */
              <button
                id="install-popup-action-btn"
                onClick={handleInstallClick}
                className="w-full py-3.5 bg-[#00E87A] text-[#0A0A0A] font-black rounded-xl hover:bg-[#00c968] active:scale-[0.98] transition hover:shadow-[0_0_15px_rgba(0,232,122,0.3)] text-xs uppercase tracking-wider cursor-pointer"
              >
                Install Application
              </button>
            ) : (
              /* General browser alternative guidance */
              <div className="p-3 bg-neutral-900 rounded-2xl border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2 text-left">
                <HelpCircle className="w-4 h-4 text-[#00E87A] shrink-0 mt-0.5" />
                <p className="leading-normal">
                  To install, tap your browser's menu button <span className="text-white font-semibold">⋮</span> or share button, and click <strong>"Install app"</strong> or <strong>"Add to home screen"</strong>.
                </p>
              </div>
            )}

            <button
              id="install-popup-dismiss-btn"
              onClick={handleDismiss}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 font-bold underline cursor-pointer hover:no-underline transition"
            >
              Maybe Later
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
