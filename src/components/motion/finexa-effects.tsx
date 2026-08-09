"use client";

import React, { useEffect, useRef } from "react";

interface FinexaMoneyEffectProps {
  active: boolean;
  onComplete?: () => void;
  count?: number;
}

export function FinexaMoneyEffect({ active, onComplete, count = 24 }: FinexaMoneyEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    type Coin = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      rotation: number;
      vRot: number;
      opacity: number;
    };

    const coins: Coin[] = [];
    for (let i = 0; i < count; i++) {
      coins.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.3 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 6,
        vy: Math.random() * 3 + 2,
        size: Math.random() * 8 + 12,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let animationFrameId: number;
    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = now - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      let activeCoinsCount = 0;

      coins.forEach((coin) => {
        coin.x += coin.vx;
        coin.y += coin.vy;
        coin.vy += 0.25; // Gravity
        coin.rotation += coin.vRot;

        if (elapsed > 600) {
          coin.opacity = Math.max(0, coin.opacity - 0.03);
        }

        if (coin.opacity > 0) {
          activeCoinsCount++;
          ctx.save();
          ctx.translate(coin.x, coin.y);
          ctx.rotate(coin.rotation);
          ctx.globalAlpha = coin.opacity;

          // Outer Gold Ring
          ctx.beginPath();
          ctx.arc(0, 0, coin.size, 0, Math.PI * 2);
          const gradient = ctx.createLinearGradient(-coin.size, -coin.size, coin.size, coin.size);
          gradient.addColorStop(0, "#FFE082");
          gradient.addColorStop(0.5, "#D4AF37");
          gradient.addColorStop(1, "#8C6D13");
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "#FFF9C4";
          ctx.stroke();

          // Inner Rupee Symbol "₹"
          ctx.fillStyle = "#5D4037";
          ctx.font = `bold ${Math.round(coin.size * 0.9)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("₹", 0, 1);

          ctx.restore();
        }
      });

      if (elapsed < 1200 && activeCoinsCount > 0) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (onComplete) onComplete();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [active, count, onComplete]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}

export function FinexaCycleEffect({ active, text = "Cycle Extended" }: { active: boolean; text?: string }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-4 p-8 rounded-2xl bg-black/80 border border-[#D4AF37]/30 shadow-2xl text-center fx-slide-up">
        <div className="relative flex items-center justify-center w-20 h-20">
          <div className="absolute inset-0 rounded-full border-4 border-dashed border-[#D4AF37] animate-spin" style={{ animationDuration: "3s" }} />
          <span className="text-3xl">🔄</span>
        </div>
        <p className="text-base font-extrabold tracking-wider text-white uppercase">{text}</p>
        <span className="text-xs text-[#D4AF37] font-semibold">Timeline & Interest Settled</span>
      </div>
    </div>
  );
}

export function FinexaDocumentEffect({ active, text = "Generating PDF..." }: { active: boolean; text?: string }) {
  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="flex flex-col items-center space-y-3 p-6 rounded-2xl bg-[#17181D] border border-white/10 shadow-2xl text-center fx-slide-up">
        <div className="h-14 w-14 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] text-2xl animate-pulse">
          📄
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-white">{text}</p>
      </div>
    </div>
  );
}
