"use client";

import React, { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/features/auth/actions/logout.action";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Users,
  BarChart3,
  LogOut,
  Plus,
  ClipboardList,
  Home,
  Coins,
} from "lucide-react";

const navItems = [
  { label: "Home",               href: "/home",             icon: Home },
  { label: "Loan Management",    href: "/loan-management",  icon: CreditCard },
  { label: "Capital Management", href: "/capital-management", icon: Coins },
  { label: "Applications",       href: "/applications",     icon: ClipboardList },
  { label: "Reports",            href: "/reports",          icon: BarChart3 },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/home");
    router.prefetch("/loan-management");
    router.prefetch("/capital-management");
    router.prefetch("/applications");
    router.prefetch("/reports");
  }, [router]);

  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isLoggingOut, startTransition] = useTransition();

  const handleLogoutConfirm = () => {
    startTransition(async () => {
      await logoutAction();
      try {
        sessionStorage.clear();
        localStorage.clear();
      } catch (e) {}
      window.location.replace("/login");
    });
  };

  // ── Click Ripple Effect ──────────────────────────────────────────────────
  useEffect(() => {
    const handleRipple = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const pressable = target.closest("button, a, .fx-pressable, [role='button']");
      if (!pressable) return;

      const rect = pressable.getBoundingClientRect();
      const circle = document.createElement("span");
      const diameter = Math.max(rect.width, rect.height);
      const radius = diameter / 2;

      circle.style.width = circle.style.height = `${diameter}px`;
      circle.style.left = `${e.clientX - rect.left - radius}px`;
      circle.style.top  = `${e.clientY - rect.top  - radius}px`;
      circle.classList.add("fx-ripple-span");

      const existing = pressable.getElementsByClassName("fx-ripple-span")[0];
      if (existing) existing.remove();

      pressable.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    };

    document.addEventListener("click", handleRipple);
    return () => document.removeEventListener("click", handleRipple);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground fx-mesh-bg">

      {/* ─── SIDEBAR — DESKTOP (≥ 1024px) ───────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-60 fx-glass-sidebar shrink-0 relative z-10">

        {/* Brand */}
        <Link
          href="/home"
          className="h-16 flex items-center gap-3 px-5 border-b border-border/40 shrink-0 hover:opacity-90 transition-opacity"
        >
          <img
            src="/logo-icon.png"
            alt="Finexa"
            className="h-8 w-8 object-contain filter drop-shadow-[0_0_10px_rgba(212,175,55,0.45)]"
          />
          <span className="font-black text-sm tracking-[0.15em] text-foreground uppercase">FINEXA</span>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/home" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "fx-nav-active"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0">
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* New Loan CTA */}
        <div className="px-3 pb-3">
          <Link href="/loans/new">
            <button className="w-full flex items-center justify-center gap-2 h-10 rounded-xl fx-brand-gradient text-white text-sm font-semibold fx-cta-glow fx-pressable">
              <Plus className="h-4 w-4" />
              New Loan
            </button>
          </Link>
        </div>

        {/* Sign Out + Theme Toggle */}
        <div className="p-3 border-t border-border/50 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="flex-1 flex items-center justify-center h-9 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </button>
          <ThemeToggle />
        </div>
      </aside>

      {/* ─── SIDEBAR — TABLET (768px – 1023px) ──────────────────────────── */}
      <aside className="hidden md:flex lg:hidden flex-col w-16 fx-glass-sidebar shrink-0 relative z-10 border-r border-border/40">

        {/* Compact Brand */}
        <Link
          href="/home"
          className="h-16 flex items-center justify-center border-b border-border/40 shrink-0 hover:opacity-90 transition-opacity"
        >
          <img
            src="/logo-icon.png"
            alt="Finexa"
            className="h-8 w-8 object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
          />
        </Link>

        {/* Compact Nav */}
        <nav className="flex-1 flex flex-col items-center px-2 py-4 gap-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/home" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                title={item.label}
                className={`flex items-center justify-center h-11 w-11 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "fx-nav-active"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              </Link>
            );
          })}
        </nav>

        {/* Compact New Loan */}
        <div className="px-2 pb-2">
          <Link href="/loans/new" prefetch={true} title="New Loan">
            <button className="flex items-center justify-center h-11 w-11 rounded-xl fx-brand-gradient text-white fx-cta-glow fx-pressable">
              <Plus className="h-5 w-5" />
            </button>
          </Link>
        </div>

        {/* Compact Sign Out + Theme */}
        <div className="p-2 border-t border-border/40 flex flex-col items-center gap-2 shrink-0">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            title="Sign Out"
            className="h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* ─── MAIN WORKSPACE ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">

        {/* Top Header Bar — Logo, Search/Controls, Theme */}
        <header className="h-14 fx-glass-header flex items-center justify-between px-4 shrink-0 border-b border-border/40">
          <div className="flex items-center gap-2 md:hidden">
            <Link href="/home" prefetch={true} className="flex items-center gap-2">
              <img
                src="/logo-icon.png"
                alt="Finexa"
                className="h-7 w-7 object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
              />
              <span className="font-black text-xs tracking-[0.15em] text-foreground uppercase">FINEXA</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-2 font-bold text-xs text-muted-foreground">
            <span>SMART LOAN MANAGEMENT SYSTEM</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Link href="/loans/new" prefetch={true}>
              <button className="flex items-center gap-1.5 h-8 px-3 rounded-lg fx-brand-gradient text-white text-xs font-semibold fx-cta-glow fx-pressable">
                <Plus className="h-3.5 w-3.5" />
                New Loan
              </button>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
          <div key={pathname} className="mx-auto max-w-5xl fx-slide-up page-transition">
            {children}
          </div>
        </main>
      </div>

      {/* ─── MOBILE BOTTOM TAB BAR (LinkedIn-style) — < 768px ───────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 fx-glass-header border-t border-border/40">
        <div className="flex items-stretch justify-around h-16 px-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/home" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={true}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 px-1 py-2 transition-all duration-200 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {/* Active top-bar indicator */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
                )}
                <div className={`flex items-center justify-center h-6 w-6 rounded-lg transition-all duration-200 ${
                  isActive ? "scale-110" : ""
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={`text-[10px] font-semibold tracking-wide leading-none ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          {/* Sign Out tab */}
          <button
            type="button"
            onClick={() => setLogoutOpen(true)}
            className="relative flex flex-col items-center justify-center gap-0.5 flex-1 px-1 py-2 text-muted-foreground hover:text-destructive transition-all duration-200"
          >
            <div className="flex items-center justify-center h-6 w-6">
              <LogOut className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-semibold tracking-wide leading-none">Logout</span>
          </button>
        </div>
      </nav>

      {/* ─── LOGOUT CONFIRMATION POPUP ──────────────────────────────────── */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl border border-border/50 p-6 text-center bg-white dark:bg-card">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-lg font-bold text-foreground">Confirm Logout</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Are you sure you want to log out of Finexa?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-3">
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={() => setLogoutOpen(false)}
              className="px-4 py-2 text-xs font-bold bg-secondary hover:bg-accent/40 rounded-xl transition-colors border border-border/50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLoggingOut}
              onClick={handleLogoutConfirm}
              className="px-5 py-2 text-xs font-bold fx-brand-gradient text-white rounded-xl fx-pressable shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {isLoggingOut ? "Logging out..." : "Log Out"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
