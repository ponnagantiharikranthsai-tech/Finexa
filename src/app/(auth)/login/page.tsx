"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ArrowRight, ShieldCheck, TrendingUp, Users, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { branding } from "@/config/branding";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<"email" | "password" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.success) {
        sessionStorage.setItem("session_active", "true");
        toast.success("Welcome back!");
        router.push("/home");
        router.refresh();
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError(err.message || "Failed to log in");
    } finally {
      setIsPending(false);
    }
  };

  const features = [
    { icon: ShieldCheck, label: "Secure & Private", desc: "Bank-grade data protection" },
    { icon: TrendingUp,  label: "Real-time Tracking", desc: "Monitor all loans instantly" },
    { icon: Users,       label: "Borrower Management", desc: "Full KYC & history" },
  ];

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-[#0B0F19] relative overflow-hidden font-sans z-10">
      
      {/* ─── STYLING & BACKGROUND GLOW ─── */}
      <style jsx global>{`
        .login-glass-card {
          background-color: rgba(23, 24, 29, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.6);
        }
        .login-input-glass {
          background-color: rgba(0, 0, 0, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.2s ease;
        }
        .login-input-glass:focus-within {
          border-color: rgba(255, 213, 74, 0.4);
          box-shadow: 0 0 15px rgba(255, 213, 74, 0.1);
        }
        .btn-gold-action {
          background-color: #FFD54A;
          color: #0B0F19;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-gold-action:hover {
          background-color: #FFE082;
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(255, 213, 74, 0.4);
        }
      `}</style>

      {/* Gold ambient lighting */}
      <div className="absolute top-[10%] left-[10%] w-[50vw] h-[50vw] bg-[#FFD54A]/5 rounded-full pointer-events-none z-0 blur-[140px]" />
      <div className="absolute bottom-[10%] right-[10%] w-[55vw] h-[55vw] bg-[#FFD54A]/5 rounded-full pointer-events-none z-0 blur-[140px]" />

      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* ─── Left Brand Panel — visible on md+ ─── */}
      <div className="hidden md:flex md:w-[45%] lg:w-[42%] relative flex-col justify-between p-10 overflow-hidden border-r border-white/5 bg-[#17181D]/30 backdrop-blur-md">
        
        {/* Animated floating orbs */}
        <div className="absolute top-[10%] right-[15%] w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[15%] left-[10%] w-48 h-48 bg-white/3 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col items-start text-left pt-4">

          <h2 className="text-white text-3xl font-extrabold leading-tight mb-4">
            Manage your lending,<br />
            <span className="text-[#D4AF37]">professionally.</span>
          </h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
            Track borrowers, monitor repayments, and send reminders — all from one secure dashboard.
          </p>
        </div>

        <div className="relative z-10 space-y-4 text-left">
          {features.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-center gap-4 group">
              <div className="h-10 w-10 bg-white/5 rounded-xl flex items-center justify-center shrink-0 border border-white/5 group-hover:bg-white/10 transition-all duration-300">
                <Icon className="h-4 w-4 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">{label}</p>
                <p className="text-zinc-500 text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-[1] overflow-hidden">
        <div className="w-full max-w-sm">

          {/* Form Container */}
          <div className="login-glass-card p-7 md:p-8">
            
            {/* 1. Centered Official Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/logo.png" 
                alt="Finexa Logo" 
                className="w-[240px] h-auto object-contain filter drop-shadow-[0_0_15px_rgba(255,213,74,0.15)]"
              />
            </div>

            <div className="flex items-center gap-2 mb-2 justify-center">
              <Sparkles className="h-3.5 w-3.5 text-[#D4AF37]" />
              <span className="text-xs font-semibold text-[#D4AF37] tracking-wider uppercase">Welcome Back</span>
            </div>

            <form onSubmit={handleSubmit} method="POST" className="space-y-5 text-left mt-6">
              {/* Global error */}
              {error && typeof error === "string" && (
                <div className="rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive flex items-start gap-2">
                  <span className="mt-0.5 shrink-0">⚠</span>
                  {error}
                </div>
              )}

              {/* Email / Mobile Number */}
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest"
                >
                  Email / Mobile Number
                </label>
                <div className="relative rounded-xl login-input-glass">
                  <input
                    id="email"
                    name="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter email or mobile"
                    autoComplete="email"
                    autoCapitalize="none"
                    required
                    disabled={isPending}
                    onFocus={() => setFocused("email")}
                    onBlur={() => setFocused(null)}
                    className="w-full h-12 px-4 rounded-xl bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
                  />
                </div>
                {error && typeof error !== "string" && error.email && (
                  <p className="text-xs text-destructive mt-1">{error.email[0]}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest"
                >
                  Password
                </label>
                <div className="relative rounded-xl login-input-glass">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoCapitalize="none"
                    required
                    disabled={isPending}
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                    className="w-full h-12 pl-4 pr-12 rounded-xl bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowPassword((prev) => !prev);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer z-20 bg-transparent border-none outline-none focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error && typeof error !== "string" && error.password && (
                  <p className="text-xs text-destructive mt-1">{error.password[0]}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isPending}
                className="w-full h-12 rounded-xl bg-[#FFD54A] text-[#0B0F19] hover:bg-[#FFE082] active:scale-[0.98] transition-all duration-300 shadow-lg shadow-[#FFD54A]/20 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 border-2 border-[#0B0F19]/30 border-t-[#0B0F19] rounded-full animate-spin" />
                    Logging in…
                  </>
                ) : (
                  <>
                    Login
                    <ArrowRight className="h-4.5 w-4.5" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-zinc-500 mt-6 flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[#FFD54A]" />
            Secured with end-to-end encryption
          </p>
        </div>
      </div>
    </div>
  );
}
