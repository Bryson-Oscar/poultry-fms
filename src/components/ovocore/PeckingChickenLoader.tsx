"use client";

import React, { useState, useEffect } from 'react';

interface PeckingChickenLoaderProps {
  message?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
  showProgressTips?: boolean;
}

const POULTRY_TELEMETRY_TIPS = [
  "Auditing silo grain levels...",
  "Calibrating feed conversion ratios...",
  "Checking water line pressure...",
  "Verifying Hen-Day production...",
  "Running biosecurity health diagnostics...",
  "Syncing egg grading tiers..."
];

export function PeckingChickenLoader({
  message = "Loading...",
  subtext,
  size = 'md',
  showProgressTips = true
}: PeckingChickenLoaderProps) {
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    if (!showProgressTips) return;
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % POULTRY_TELEMETRY_TIPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [showProgressTips]);

  const dimensions = {
    sm: { container: 'w-20 h-20', scale: 'scale-75' },
    md: { container: 'w-28 h-28', scale: 'scale-100' },
    lg: { container: 'w-36 h-36', scale: 'scale-125' },
  }[size];

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-4 select-none animate-in fade-in duration-300">

      {/* Visual Animation Box */}
      <div className={`relative ${dimensions.container} flex items-end justify-center pb-3 overflow-visible`}>

        {/* Floor Shadow */}
        <div className="absolute bottom-1 w-16 h-2 bg-foreground/10 rounded-full blur-[2px] animate-shadow-pulse" />

        {/* Dynamic Grain Particles (Bouncing & Being Eaten) */}
        <div className="absolute bottom-2.5 w-16 flex justify-between items-center px-1 z-0">
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-grain-1 shadow-xs" />
          <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-grain-2 shadow-xs" />
          <div className="w-1 h-1 bg-amber-600 rounded-full animate-grain-3 shadow-xs" />
          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-grain-4 shadow-xs" />
        </div>

        {/* Custom Articulated Hen SVG */}
        <div className={`relative ${dimensions.scale} transform-gpu origin-bottom z-10 animate-hen-peck`}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="drop-shadow-xs"
          >
            {/* Legs & Claws */}
            <path
              d="M32 46V56M32 56L28 59M32 56L36 59"
              stroke="#D97706"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M26 46V55M26 55L22 58M26 55L30 58"
              stroke="#B45309"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Chicken Plump Body (Feather Layers) */}
            <path
              d="M18 34C18 26 25 21 34 21C43 21 47 27 47 34C47 41 40 46 32 46C24 46 18 41 18 34Z"
              className="fill-primary"
            />
            {/* Wing Feather Line */}
            <path
              d="M27 28C32 28 38 31 37 38C36 42 31 43 27 40"
              stroke="currentColor"
              className="stroke-primary-foreground/30"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Upright Tail Feathers */}
            <path
              d="M45 28C48 24 53 21 56 22C56 26 54 31 46 34"
              className="fill-primary"
            />
            <path
              d="M43 24C47 20 52 17 55 18C55 22 52 27 44 30"
              className="fill-primary/90"
            />

            {/* Articulated Neck & Head */}
            <g className="origin-[34px_22px] animate-head-bob">
              {/* Neck */}
              <path
                d="M22 28C22 23 25 18 28 16L33 22"
                className="fill-primary"
              />
              {/* Head */}
              <circle cx="24" cy="16" r="7" className="fill-primary" />

              {/* Eye with White Glint */}
              <circle cx="22" cy="15" r="1.75" fill="#1E293B" />
              <circle cx="21.5" cy="14.5" r="0.5" fill="#FFFFFF" />

              {/* Red Comb */}
              <path
                d="M22 9C21 7 23 5 25 6C27 4 29 6 29 9C30 9 31 10 30 11H21C21 10 21.5 9.5 22 9Z"
                fill="#EF4444"
              />

              {/* Red Wattle */}
              <path
                d="M21 21C20 23 18 22 18 20C18 19 19.5 19 21 19V21Z"
                fill="#DC2626"
              />

              {/* Sharp Yellow Beak */}
              <path
                d="M18 15L11 18L18 20Z"
                fill="#F59E0B"
                stroke="#D97706"
                strokeWidth="0.75"
                strokeLinejoin="round"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Narrative & Status Indicator */}
      <div className="text-center space-y-1 max-w-[200px]">
        <p className="text-xs sm:text-sm font-bold text-foreground tracking-tight flex items-center justify-center gap-1.5">
          <span>{message}</span>
        </p>
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider min-h-[16px] transition-all duration-300">
          {subtext || POULTRY_TELEMETRY_TIPS[tipIndex]}
        </p>
      </div>

      {/* Scoped Micro-Animations */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes hen-peck {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          15% { transform: rotate(32deg) translateY(6px); }
          25% { transform: rotate(38deg) translateY(8px); }
          35% { transform: rotate(0deg) translateY(0); }
          55% { transform: rotate(36deg) translateY(7px); }
          65% { transform: rotate(0deg) translateY(0); }
        }
        @keyframes head-bob {
          0%, 100% { transform: rotate(0deg); }
          15% { transform: rotate(18deg); }
          25% { transform: rotate(24deg); }
          35% { transform: rotate(0deg); }
          55% { transform: rotate(22deg); }
          65% { transform: rotate(0deg); }
        }
        @keyframes shadow-pulse {
          0%, 100% { transform: scaleX(1); opacity: 0.2; }
          20%, 60% { transform: scaleX(1.15) translateX(-2px); opacity: 0.35; }
        }
        @keyframes grain-eaten-1 {
          0%, 100% { transform: scale(1) translateY(0); opacity: 0.9; }
          18% { transform: scale(1.4) translateY(-2px); opacity: 1; }
          26% { transform: scale(0); opacity: 0; }
          45% { transform: scale(1) translateY(0); opacity: 0.9; }
        }
        @keyframes grain-eaten-2 {
          0%, 100% { transform: scale(1) translateY(0); opacity: 0.9; }
          50% { transform: scale(1.3) translateY(-2px); opacity: 1; }
          58% { transform: scale(0); opacity: 0; }
          75% { transform: scale(1) translateY(0); opacity: 0.9; }
        }
        .animate-hen-peck {
          animation: hen-peck 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .animate-head-bob {
          animation: head-bob 2.2s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .animate-shadow-pulse {
          animation: shadow-pulse 2.2s ease-in-out infinite;
        }
        .animate-grain-1 {
          animation: grain-eaten-1 2.2s ease-in-out infinite;
        }
        .animate-grain-2 {
          animation: grain-eaten-2 2.2s ease-in-out infinite;
        }
        .animate-grain-3 {
          animation: grain-eaten-1 2.2s ease-in-out 0.3s infinite;
        }
        .animate-grain-4 {
          animation: grain-eaten-2 2.2s ease-in-out 0.5s infinite;
        }
      `}} />
    </div>
  );
}