"use client";

import React, { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface SignaturePadProps {
  onSave?: (signatureDataUrl: string | null) => void;
}

export function SignaturePad({ onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#cbd5e1"; // slate-300
      }
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { offsetX, offsetY } = getCoordinates(e, canvas);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    triggerSave();
  };

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    setIsDrawing(false);
  };

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement
  ) => {
    if ("touches" in e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top,
      };
    }
    return {
      offsetX: e.nativeEvent.offsetX,
      offsetY: e.nativeEvent.offsetY,
    };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (onSave) onSave(null);
  };

  const triggerSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !onSave) return;
    onSave(canvas.toDataURL());
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="relative w-full h-32 bg-background border border-slate-800 rounded-lg overflow-hidden group">
        <canvas
          ref={canvasRef}
          width={400}
          height={128}
          className="w-full h-full touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <Button 
          variant="ghost" 
          size="icon"
          onClick={clear}
          className="absolute top-2 right-2 h-8 w-8 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="absolute bottom-2 left-2 pointer-events-none">
          <span className="text-xs font-mono text-slate-600">Sign Here (X)</span>
        </div>
      </div>
    </div>
  );
}
