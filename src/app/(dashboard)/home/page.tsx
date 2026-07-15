"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CreditCard,
  Users,
  ClipboardList,
  BarChart3,
  ArrowUpRight
} from "lucide-react";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // 1. Loading Screen Timeline
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = ((clientX / innerWidth) - 0.5) * 16;
    const y = ((clientY / innerHeight) - 0.5) * -16;
    setTilt({ x, y });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const navCards = [
    {
      label: "Loans",
      desc: "Manage profiles & repayment schedules",
      href: "/loans",
      icon: CreditCard,
      accent: "group-hover:text-emerald-400"
    },
    {
      label: "Borrowers",
      desc: "Manage KYC records & loan histories",
      href: "/borrowers",
      icon: Users,
      accent: "group-hover:text-sky-400"
    },
    {
      label: "Applications",
      desc: "Verify codes & approve submissions",
      href: "/applications",
      icon: ClipboardList,
      accent: "group-hover:text-[#FFD54A]"
    },
    {
      label: "Reports",
      desc: "Analyze business performance stats",
      href: "/reports",
      icon: BarChart3,
      accent: "group-hover:text-indigo-400"
    }
  ];

  // ─── RENDER LOADING SCREEN ───
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center select-none overflow-hidden">
        <style>{`
          .loading-logo-glow {
            filter: drop-shadow(0 0 35px rgba(255, 213, 74, 0.45));
            animation: pulse-glow 2s infinite ease-in-out;
          }
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.85; transform: scale(0.98); }
            50% { opacity: 1; transform: scale(1.02); }
          }
          
          .shine-slider {
            position: absolute;
            top: 0;
            left: -150%;
            width: 50%;
            height: 100%;
            background: linear-gradient(
              to right,
              transparent,
              rgba(255, 255, 255, 0.25) 50%,
              transparent
            );
            transform: skewX(-25deg);
            animation: shine-slide 1.8s infinite ease-in-out;
          }
          @keyframes shine-slide {
            0% { left: -150%; }
            100% { left: 150%; }
          }
        `}</style>
        
        <div className="relative max-w-sm sm:max-w-md px-6 loading-logo-glow">
          <div className="relative overflow-hidden rounded-[20px]">
            <img 
              src="/logo.png" 
              alt="Finexa Logo" 
              className="w-[280px] h-auto object-contain" 
            />
            {/* Animated gold shine */}
            <div className="shine-slider" />
          </div>
        </div>
      </div>
    );
  }

  // ─── RENDER LUXURIOUS HOME ───
  return (
    <div 
      className="min-h-[85vh] flex flex-col justify-center items-center py-10 relative overflow-hidden bg-background animate-in fade-in duration-500"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <style>{`
        .floating-logo-img-large {
          animation: logo-float-large 8s ease-in-out infinite;
          filter: drop-shadow(0 25px 45px rgba(184, 134, 11, 0.28));
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .dark .floating-logo-img-large {
          filter: drop-shadow(0 25px 45px rgba(255, 213, 74, 0.28));
        }
        @keyframes logo-float-large {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(0.6deg); }
        }

        .nav-card-luxury {
          background-color: var(--card);
          border: 1px solid var(--border);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .nav-card-luxury:hover {
          transform: translateY(-8px);
          border-color: rgba(184, 134, 11, 0.4);
          box-shadow: 0 25px 50px -15px rgba(184, 134, 11, 0.15);
        }
        .dark .nav-card-luxury {
          background-color: rgba(23, 24, 29, 0.65);
          border-color: rgba(255, 255, 255, 0.04);
        }
        .dark .nav-card-luxury:hover {
          border-color: rgba(255, 213, 74, 0.35);
          background-color: rgba(23, 24, 29, 0.85);
          box-shadow: 0 25px 50px -15px rgba(255, 213, 74, 0.18);
        }
      `}</style>

      {/* Gold custom light orbs */}
      <div className="absolute top-[35%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[45vw] h-[45vw] bg-gradient-to-br from-[#FFD54A]/8 to-transparent rounded-full pointer-events-none z-0 blur-[120px]" />

      {/* ─── 1. LARGE FINEXA HERO LOGO ─── */}
      <div 
        className="flex flex-col items-center justify-center text-center pb-12 cursor-default transition-all duration-300 relative z-10 w-full select-none"
        style={{ perspective: "1000px" }}
      >
        <div
          style={{
            transform: `rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translateZ(50px)`,
            transition: tilt.x === 0 && tilt.y === 0 ? "transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)" : "none"
          }}
          className="floating-logo-img-large mb-6 w-[280px] sm:w-[480px] px-6"
        >
          <img 
            src="/logo.png" 
            alt="Finexa Logo Center" 
            className="w-full h-auto object-contain" 
          />
        </div>

        <blockquote className="text-zinc-550 italic text-sm tracking-widest text-zinc-400 font-medium">
          &gt; SMART LOAN MANAGEMENT
        </blockquote>
      </div>

      {/* ─── 2. FOUR PREMIUM NAVIGATION CARDS ─── */}
      <div className="w-full max-w-4xl px-6 relative z-10 mt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
          {navCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                href={card.href}
                className="p-6 rounded-[20px] border nav-card-luxury text-left flex flex-col justify-between h-48 group relative overflow-hidden"
              >
                {/* Glowing light trail corner on hover */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[#FFD54A]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                <div className="flex items-start justify-between">
                  <div className={`h-11 w-11 rounded-xl bg-primary/8 border border-border flex items-center justify-center text-muted-foreground group-hover:bg-primary/15 transition-colors ${card.accent}`}>
                    <Icon className="h-5 w-5 transition-transform group-hover:scale-[1.1]" />
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-zinc-650 group-hover:text-[#FFD54A] transition-colors" />
                </div>

                <div className="space-y-1 mt-auto">
                  <h3 className="text-base font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                    {card.label}
                  </h3>
                  <p className="text-[10px] text-muted-foreground leading-normal font-medium">
                    {card.desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

    </div>
  );
}
