"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Cloud, Droplets, ThermometerSun, AlertTriangle, Wind } from 'lucide-react';

interface WeatherWidgetProps {
  location?: string;
  flockType?: 'Broilers' | 'Layers' | 'Breeders' | 'Kienyeji';
}

export function WeatherWidget({ location = "Local Farm", flockType = "Layers" }: WeatherWidgetProps) {
  // Mock weather state that updates slightly to simulate live telemetry
  const [temperature, setTemperature] = useState(28);
  const [humidity, setHumidity] = useState(65);

  useEffect(() => {
    const interval = setInterval(() => {
      setTemperature(prev => prev + (Math.random() > 0.5 ? 0.5 : -0.5));
      setHumidity(prev => prev + (Math.random() > 0.5 ? 1 : -1));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const getHeatStressRisk = () => {
    if (temperature > 32 || (temperature > 29 && humidity > 70)) {
      return { 
        level: 'High Risk', 
        color: 'text-rose-500', 
        bg: 'bg-rose-500/10',
        advice: 'Increase ventilation immediately and ensure cool drinking water.'
      };
    }
    if (temperature < 20) {
      return { 
        level: 'Cold Stress', 
        color: 'text-blue-500', 
        bg: 'bg-blue-500/10',
        advice: 'Check brooder heating. Young birds are susceptible to huddling.'
      };
    }
    return { 
      level: 'Optimal', 
      color: 'text-emerald-500', 
      bg: 'bg-emerald-500/10',
      advice: 'Climate conditions are within optimal parameters for bird welfare.'
    };
  };

  const risk = getHeatStressRisk();

  return (
    <div className="rounded-2xl border border-dashed border-slate-800 bg-transparent flex flex-col justify-between h-full p-4 relative overflow-hidden group">
      {/* Subtle animated background gradient for optimal state */}
      {risk.level === 'Optimal' && (
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-50 pointer-events-none" />
      )}

      <div className="relative z-10 flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xs font-bold flex items-center gap-1.5 text-slate-400">
            <Cloud className="w-3.5 h-3.5" /> Micro-Climate
          </h3>
          <p className="text-[9px] text-slate-500 mt-0.5 uppercase tracking-wider">{location}</p>
        </div>
        <div className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-wider border ${risk.bg} ${risk.color} border-current/20`}>
          {risk.level}
        </div>
      </div>
      
      <div className="relative z-10 grid grid-cols-2 gap-2 mb-3">
        <div className="flex flex-col">
          <p className="text-[10px] text-slate-500 font-semibold mb-0.5 flex items-center gap-1">
            <ThermometerSun className="w-3 h-3" /> Temp
          </p>
          <p className="text-xl font-black text-slate-200">{temperature.toFixed(1)}°</p>
        </div>

        <div className="flex flex-col">
          <p className="text-[10px] text-slate-500 font-semibold mb-0.5 flex items-center gap-1">
            <Droplets className="w-3 h-3" /> Humidity
          </p>
          <p className="text-xl font-black text-slate-200">{humidity.toFixed(0)}%</p>
        </div>
      </div>

      <div className="relative z-10 mt-auto">
        {risk.level !== 'Optimal' ? (
          <p className={`text-[9px] font-medium leading-relaxed ${risk.color}`}>
            <AlertTriangle className="w-3 h-3 inline mr-1 mb-0.5" />
            {risk.advice}
          </p>
        ) : (
          <p className="text-[9px] font-medium leading-relaxed text-emerald-600/70">
            <Wind className="w-3 h-3 inline mr-1 mb-0.5" />
            {risk.advice}
          </p>
        )}
      </div>
    </div>
  );
}
