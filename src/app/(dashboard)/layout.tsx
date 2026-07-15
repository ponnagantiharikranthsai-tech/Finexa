"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/features/auth/actions/logout.action";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  CreditCard,
  Users,
  BarChart3,
  LogOut,
  Plus,
  ClipboardList,
  Home,
  Settings,
  Menu,
  X
} from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const navItems = [
    { label: "Home", href: "/home", icon: Home },
    { label: "Loans", href: "/loans", icon: CreditCard },
    { label: "Borrowers", href: "/borrowers", icon: Users },
    { label: "Applications", href: "/applications", icon: ClipboardList },
    { label: "Reports", href: "/reports", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  // Users must return to Home to change modules in sub-routes
  const visibleNavItems = pathname === "/home" ? navItems : [navItems[0]!];

  // Click Ripple Effect
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
      circle.style.top = `${e.clientY - rect.top - radius}px`;
      circle.classList.add("fx-ripple-span");

      const existing = pressable.getElementsByClassName("fx-ripple-span")[0];
      if (existing) {
        existing.remove();
      }

      pressable.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    };

    document.addEventListener("click", handleRipple);
    return () => document.removeEventListener("click", handleRipple);
  }, []);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground fx-mesh-bg">

      {/* ─── 1. SIDEBAR — DESKTOP ONLY (>= 1024px) ─── */}
      <aside className="hidden lg:flex flex-col w-64 fx-glass-sidebar shrink-0 relative z-10">
        {/* Logo + Brand */}
        <Link href="/home" className="h-20 flex items-center gap-3 px-5 border-b border-border/40 shrink-0 hover:opacity-90 transition-opacity">
          <img 
            src="/logo-icon.png" 
            alt="Finexa Icon" 
            className="h-9 w-9 object-contain filter drop-shadow-[0_0_10px_rgba(212,175,55,0.45)]" 
          />
          <span className="font-black text-sm tracking-[0.15em] text-foreground uppercase">FINEXA</span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "fx-nav-active text-primary"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200">
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* New Loan CTA */}
        {pathname === "/home" && (
          <div className="px-3 pb-3">
            <Link href="/loans/new">
              <button className="w-full flex items-center justify-center gap-2 h-10 rounded-xl fx-brand-gradient text-white text-sm font-semibold fx-cta-glow fx-pressable">
                <Plus className="h-4 w-4" />
                New Loan
              </button>
            </Link>
          </div>
        )}

        {/* Sign Out & Theme Toggle */}
        <div className="p-3 border-t border-border/50 flex items-center justify-between gap-3 shrink-0">
          <form action={logoutAction} className="flex-1">
            <button
              type="submit"
              className="w-full flex items-center justify-center h-10 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </form>
          <ThemeToggle />
        </div>
      </aside>

      {/* ─── 2. SIDEBAR — TABLET ONLY (768px - 1023px) ─── */}
      <aside className="hidden md:flex lg:hidden flex-col w-20 fx-glass-sidebar shrink-0 relative z-10 border-r border-white/5">
        {/* Compact Logo */}
        <Link href="/home" className="h-20 flex items-center justify-center border-b border-white/5 shrink-0 hover:opacity-90 transition-opacity">
          <img 
            src="/logo-icon.png" 
            alt="Finexa Icon" 
            className="h-8 w-8 object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" 
          />
        </Link>

        {/* Compact Navigation */}
        <nav className="flex-1 px-2 py-5 space-y-2 flex flex-col items-center">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-center h-12 w-12 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "fx-nav-active text-primary"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
                title={item.label}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
              </Link>
            );
          })}
        </nav>

        {/* Compact Sign Out */}
        <div className="p-3 border-t border-white/5 flex flex-col items-center gap-4 shrink-0">
          <form action={logoutAction}>
            <button
              type="submit"
              className="h-10 w-10 flex items-center justify-center rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
          <ThemeToggle />
        </div>
      </aside>

      {/* ─── 3. MOBILE MENU DRAWER BACKDROP & PANEL (< 768px) ─── */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 transition-opacity duration-300 md:hidden"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      <div 
        className={`fixed inset-y-0 left-0 w-64 fx-glass-sidebar z-50 transform transition-transform duration-300 md:hidden flex flex-col ${
          isDrawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/5 shrink-0">
          <Link href="/home" className="flex items-center gap-2" onClick={() => setIsDrawerOpen(false)}>
            <img 
              src="/logo-icon.png" 
              alt="Finexa" 
              className="h-8 w-8 object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" 
            />
            <span className="font-bold text-sm tracking-widest text-white uppercase">FINEXA</span>
          </Link>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            className="text-muted-foreground hover:text-white p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Links */}
        <nav className="flex-1 px-3 py-5 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsDrawerOpen(false)}
                className={`flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "fx-nav-active text-primary"
                    : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                }`}
              >
                <span className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg">
                  <Icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign Out & Theme Toggle */}
        <div className="p-3 border-t border-white/5 flex items-center justify-between gap-3 shrink-0">
          <form action={logoutAction} className="flex-1">
            <button
              type="submit"
              className="w-full flex items-center justify-center h-10 px-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </button>
          </form>
          <ThemeToggle />
        </div>
      </div>

      {/* ─── 4. MAIN WORKSPACE ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 relative z-[1]">

        {/* Header — Mobile only */}
        <header className="md:hidden h-14 fx-glass-header flex items-center justify-between px-4 shrink-0 z-10 border-b border-border/40">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDrawerOpen(true)}
              className="text-muted-foreground hover:text-foreground p-1 mr-1"
              title="Open Navigation Menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/home" className="flex items-center gap-2">
              <img 
                src="/logo-icon.png" 
                alt="Finexa Icon" 
                className="h-6 w-6 object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]" 
              />
              <span className="font-black text-xs tracking-widest text-foreground uppercase">FINEXA</span>
            </Link>
          </div>
          <div className="flex items-center gap-2.5">
            <ThemeToggle />
          </div>
        </header>

        {/* Desktop sub-header with page title */}
        <header className="hidden md:flex h-14 fx-glass-header items-center justify-between px-6 shrink-0 z-10 border-b border-border/40">
          <div className="flex items-center gap-2.5 text-left">
            <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
              <img 
                src="/logo-icon.png" 
                alt="Finexa Icon" 
                className="h-4 w-4 object-contain filter drop-shadow-[0_0_6px_rgba(212,175,55,0.4)]" 
              />
            </div>
            <h1 className="text-sm font-semibold capitalize tracking-tight text-foreground">
              {pathname === "/" ? "Dashboard" : pathname.split("/").filter(Boolean)[0]}
            </h1>
          </div>
          <ThemeToggle />
        </header>

        {/* Page Content Wrapper with fluid layout */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-6">
          <div key={pathname} className="mx-auto max-w-5xl fx-slide-up page-transition">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
