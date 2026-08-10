"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  ClipboardList,
  BarChart3,
  ArrowUpRight
} from "lucide-react";
import { FinexaCard3D, FinexaStaggerContainer, FinexaStaggerItem } from "@/components/motion/finexa-motion";

export default function HomePage() {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

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
      label: "Loan Management",
      desc: "Manage profiles, KYC records & repayment schedules",
      href: "/loan-management",
      icon: CreditCard,
      accent: "group-hover:text-emerald-400"
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

  return (
    <div 
      className="min-h-[85vh] flex flex-col justify-center items-center py-10 relative overflow-hidden bg-background animate-in fade-in duration-300"
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

      {/* ─── 2. PREMIUM NAVIGATION CARDS WITH STAGGERED 3D ─── */}
      <FinexaStaggerContainer className="w-full max-w-4xl px-6 relative z-10 mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
          {navCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <FinexaStaggerItem key={card.label} index={idx}>
                <Link href={card.href} className="block h-full">
                  <FinexaCard3D className="p-6 rounded-[20px] border nav-card-luxury text-left flex flex-col justify-between h-48 group relative overflow-hidden">
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
                  </FinexaCard3D>
                </Link>
              </FinexaStaggerItem>
            );
          })}
        </div>
      </FinexaStaggerContainer>

    </div>
  );
}
