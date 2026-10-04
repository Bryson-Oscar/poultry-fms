'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, CheckCircle2, ChevronRight, Sparkles, Map, Target, X, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { claimFarmInvite, getFarmInvite, FarmInviteRecord } from '@/services/farmService';
import { updateUserOnboardingStatus } from '@/services/userService';
import { useToast } from '@/hooks/use-toast';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types/user';

interface AITutorOnboardingWidgetProps {
  userProfile?: UserProfile | null;
  onOnboardingComplete?: () => void;
}

export default function AITutorOnboardingWidget({ userProfile, onOnboardingComplete }: AITutorOnboardingWidgetProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();

  const token = searchParams?.get('tutorToken');

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [inviteData, setInviteData] = useState<FarmInviteRecord | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [farmCapacity, setFarmCapacity] = useState('5000');
  const [analyzedTier, setAnalyzedTier] = useState<string | null>('Tier 2: Pro Elite');

  // Voice Assistant Controls
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleCapacityChange = (val: string) => {
    setFarmCapacity(val);
    const num = parseInt(val, 10);
    if (isNaN(num)) {
      setAnalyzedTier(null);
    } else if (num < 2000) {
      setAnalyzedTier('Tier 1: OvoCore Operator');
    } else if (num <= 10000) {
      setAnalyzedTier('Tier 2: Pro Elite');
    } else {
      setAnalyzedTier('Tier 3: Sovereign Syndicate');
    }
  };

  useEffect(() => {
    if (token) {
      loadTokenData(token);
    } else if (userProfile && userProfile.hasCompletedOnboarding !== true) {
      setIsOpen(true);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [token, userProfile]);

  const loadTokenData = async (code: string) => {
    try {
      const data = await getFarmInvite(code);
      if (data && data.status === 'pending') {
        setInviteData(data);
        setIsOpen(true);
      } else if (data && data.status === 'accepted') {
        toast({ title: 'Already Onboarded', description: 'This invite link has already been used.' });
        if (userProfile && userProfile.hasCompletedOnboarding !== true) {
          setIsOpen(true);
        }
      } else {
        toast({ variant: 'destructive', title: 'Invalid Link', description: 'This AI Tutor link is invalid or expired.' });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const steps = inviteData ? [
    {
      title: `Welcome to OvoCore, ${inviteData.ownerName}!`,
      content: `I'm your AI Tutor. You've been invited as a ${inviteData.role} for ${inviteData.farmName}. Let's get you up to speed!`,
      icon: <Bot className="w-12 h-12 text-indigo-500" />
    },
    {
      title: "Master the Territory",
      content: "Use the Territory Map to track all active leads, plan your daily routes, and see geographical pipeline value at a glance.",
      icon: <Map className="w-12 h-12 text-emerald-500" />
    },
    {
      title: "Command Center",
      content: "Your Action Queue tells you exactly who to follow up with each day. Never let a prospect slip through the cracks again.",
      icon: <Target className="w-12 h-12 text-rose-500" />
    },
    {
      title: "Ready to Start?",
      content: "You're all set! Click the button below to finalize your account and access your new workspace.",
      icon: <Sparkles className="w-12 h-12 text-amber-500" />
    }
  ] : [
  {
    title: `Hi, I'm Ovo AI | Smart Farm Assistant`,
    content: `To navigate your application and pinpoint actionable areas for operational improvement, you will follow a structured onboarding process that combines performance metrics and systematic review of all farm functionality. Let's run this evaluation effectively.`,
    icon: <Bot className="w-12 h-12 text-indigo-500" />
  },
  {
    title: "Automated Infrastructure Readiness Audit",
    content: "Before we begin, Ella needs to evaluate your farm's scale. Input your current or target bird capacity below to automatically unlock the appropriate operational features.",
    icon: <Sparkles className="w-12 h-12 text-indigo-400" />,
    inputType: 'capacity'
  },
  {
    title: "Baseline Navigation Walkthrough",
    content: "Start by mapping the full end-to-end journey for your core tasks (e.g., daily logs, feed restocking, compliance). Document every interaction path to create a consistent reference for later testing.",
    icon: <Map className="w-12 h-12 text-emerald-500" />
  },
  {
    title: "Collect Quantitative Performance Metrics",
    content: "Run controlled farm navigation tests and aggregate real-flock behavioral data to measure concrete performance: task completion rates, average completion time, and drop-off points.",
    icon: <Target className="w-12 h-12 text-rose-500" />
  },
  {
    title: "Gather Qualitative User Insight",
    content: "Observe as farm operators navigate the application without guidance, and note where they hesitate or get frustrated around ambiguous icons, unclear menu labels, or hidden features.",
    icon: <Sparkles className="w-12 h-12 text-amber-500" />
  },
  {
    title: "Run a Full Application Audit",
    content: "Expand your review beyond just navigation to cover all core Farm performance dimensions: Usability, Functionality, Technical health, and Accessibility.",
    icon: <CheckCircle2 className="w-12 h-12 text-blue-500" />
  }
];

const currentStep = steps[step];

// Automated Voice Speech Effect
useEffect(() => {
  if (!isOpen || isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Stop any previous speech
  const textToSpeak = `${currentStep.title}. ${currentStep.content.replace(/\*\*/g, '')}`;
  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;

  utterance.onstart = () => setIsSpeaking(true);
  utterance.onend = () => setIsSpeaking(false);
  utterance.onerror = () => setIsSpeaking(false);

  speechRef.current = utterance;
  window.speechSynthesis.speak(utterance);

  return () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };
}, [step, isOpen, isMuted]);

const toggleMute = () => {
  if (isMuted) {
    setIsMuted(false);
  } else {
    setIsMuted(true);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }
};

const replayVoice = () => {
  if ('speechSynthesis' in window && speechRef.current) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speechRef.current);
  }
};

const handleNext = () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (step < steps.length - 1) {
    setStep(prev => prev + 1);
  } else {
    handleComplete();
  }
};

const finalizeOnboardingState = async () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (auth.currentUser) {
    await updateUserOnboardingStatus(auth.currentUser.uid);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const userRef = doc(db, 'users', auth.currentUser.uid);
      let plan = 'trial';
      if (analyzedTier?.includes('Operator')) plan = 'operator';
      else if (analyzedTier?.includes('Pro Elite')) plan = 'pro';
      else if (analyzedTier?.includes('Sovereign')) plan = 'syndicate';

      await updateDoc(userRef, { plan });
    } catch (e) {
      console.error("Failed to update user tier plan", e);
    }
  }
  if (onOnboardingComplete) {
    onOnboardingComplete();
  }
  setIsOpen(false);
  if (token) {
    router.replace('/admin/dashboard/01-dashboard');
  }
};

const handleComplete = async () => {
  if (!auth.currentUser) return;
  setClaiming(true);
  try {
    if (inviteData) {
      await claimFarmInvite(inviteData.code, auth.currentUser.uid, auth.currentUser.email || '');
    }
    await finalizeOnboardingState();

    toast({
      title: "Onboarding Complete! 🎉",
      description: inviteData ? "You've successfully joined the farm team." : "Welcome aboard! Let's get to work.",
    });
  } catch (error: any) {
    toast({ variant: 'destructive', title: 'Failed to complete', description: error.message });
  } finally {
    setClaiming(false);
  }
};

const handleSkip = async () => {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  if (!auth.currentUser) return;
  try {
    if (inviteData) {
      await claimFarmInvite(inviteData.code, auth.currentUser.uid, auth.currentUser.email || '');
      toast({ title: "Invite Claimed!", description: "You've successfully joined the farm team." });
    }
    await finalizeOnboardingState();
  } catch (error: any) {
    toast({ variant: 'destructive', title: 'Failed to skip', description: error.message });
  }
};

if (loading || !isOpen) return null;

return (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 ">
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 1.05, y: -20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-lg bg-card border border-border/50 shadow-2xl rounded-3xl p-8 overflow-hidden mx-4"
      >
        {/* Top Control Bar: Voice Assistant Toggle & Skip */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleMute}
            className={`h-8 px-2.5 text-[10px] font-bold rounded-full gap-1.5 transition-all ${isMuted ? 'bg-muted text-muted-foreground' : 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30'}`}
            title={isMuted ? "Unmute Voice Assistant" : "Mute Voice Assistant"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className={`w-3.5 h-3.5 ${isSpeaking ? 'animate-bounce text-indigo-500' : ''}`} />}
            <span>{isMuted ? 'Muted' : isSpeaking ? 'Speaking...' : 'Voice On'}</span>
          </Button>

          {!isMuted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={replayVoice}
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/50"
              title="Replay Audio"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="h-8 px-3 text-[10px] font-bold text-muted-foreground hover:bg-muted/50 rounded-full"
          >
            Skip <X className="w-3 h-3 ml-1" />
          </Button>
        </div>

        {/* Decorative background glow */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col items-center text-center space-y-6 relative z-10 pt-4">
          <motion.div
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className="p-4 bg-muted/50 rounded-2xl shadow-sm border border-border/50 relative"
          >
            {currentStep.icon}
            {isSpeaking && !isMuted && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            )}
          </motion.div>

          <div className="space-y-3 w-full">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">{currentStep.title}</h2>
            <p className="text-muted-foreground leading-relaxed text-sm">
              {currentStep.content.split('**').map((part, i) =>
                i % 2 === 1 ? <strong key={i} className="text-foreground font-bold">{part}</strong> : part
              )}
            </p>

            {(currentStep as any).inputType === 'capacity' && (
              <div className="pt-4 space-y-3 px-4">
                <input
                  type="number"
                  value={farmCapacity}
                  onChange={(e) => handleCapacityChange(e.target.value)}
                  className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-lg font-bold text-center placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="E.g. 5000"
                />
                <AnimatePresence>
                  {analyzedTier && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 text-left mt-2"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Audit Result
                      </p>
                      <p className="text-sm font-medium leading-tight">
                        Based on a capacity of {parseInt(farmCapacity).toLocaleString() || 0} birds, Ella has unlocked <strong className="text-indigo-700 dark:text-indigo-300">{analyzedTier}</strong> features for your workspace.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="w-full pt-6 flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-indigo-500' : 'w-1.5 bg-border'}`}
                />
              ))}
            </div>

            <Button
              onClick={handleNext}
              disabled={claiming}
              className="h-11 px-6 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-105"
            >
              {claiming ? (
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
              ) : step === steps.length - 1 ? (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Start Working</>
              ) : (
                <>Next Step <ChevronRight className="w-4 h-4 ml-1" /></>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  </div>
);
}