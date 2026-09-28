"use client";

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Smartphone,
  X,
  Sparkles,
  Share,
  PlusSquare,
  CheckCircle2
} from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('OvoCore Service Worker registered:', reg.scope))
        .catch((err) => console.warn('Service Worker registration failed:', err));
    }

    // 2. Check if already running in standalone mode (installed PWA)
    if (typeof window !== 'undefined') {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);

      // Check iOS user agent
      const ua = window.navigator.userAgent;
      const isIosDevice = /iphone|ipad|ipod/i.test(ua);
      setIsIos(isIosDevice);
    }

    // 3. Listen for browser install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setIsInstalledSuccess(true);
      setDeferredPrompt(null);
      setTimeout(() => setIsDismissed(true), 4000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalledSuccess(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || isDismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in slide-in-from-bottom-5">
      <Card className="bg-slate-900/95 border-amber-500/40 text-white rounded-3xl p-4 shadow-2xl backdrop-blur-xl border flex flex-col space-y-3">
        
        {/* Header Bar */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Smartphone className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-black text-white">Install OvoCore App</h4>
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] uppercase font-mono font-bold">
                  PWA
                </Badge>
              </div>
              <p className="text-[11px] text-slate-400">
                Instant 1-click home screen access & offline farm log telemetry.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success State */}
        {isInstalledSuccess ? (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> OvoCore App Installed on Home Screen!
          </div>
        ) : showIosGuide ? (
          /* iOS Installation Instructions */
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Share className="w-4 h-4" /> iOS Installation Steps:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400">
              <li>Tap the <strong className="text-white">Share button</strong> at the bottom of Safari.</li>
              <li>Scroll down & tap <strong className="text-white">Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline text-amber-400" />.</li>
              <li>Tap <strong className="text-white">Add</strong> to launch OvoCore from your apps.</li>
            </ol>
            <Button
              onClick={() => setShowIosGuide(false)}
              size="sm"
              variant="outline"
              className="w-full border-slate-800 text-slate-300 text-xs rounded-xl mt-1 h-8"
            >
              Got it
            </Button>
          </div>
        ) : (
          /* Main Action Button */
          <div className="flex gap-2">
            <Button
              onClick={handleInstallClick}
              size="sm"
              className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs h-10 shadow-lg shadow-amber-500/20"
            >
              <Download className="w-4 h-4 mr-1.5" /> Install Application
            </Button>
            <Button
              onClick={() => setIsDismissed(true)}
              size="sm"
              variant="outline"
              className="border-slate-800 text-slate-400 hover:bg-slate-800 rounded-xl text-xs h-10"
            >
              Later
            </Button>
          </div>
        )}

      </Card>
    </div>
  );
}
