import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { branding } from "@/config/branding";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { RealtimeSyncProvider } from "@/components/realtime-sync-provider";
import { SessionTimeoutProvider } from "@/components/session-timeout-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: {
    default: "FINEXA – Smart Loan Management System",
    template: "%s | FINEXA",
  },
  description: "FINEXA – Smart Loan Management System for secure loan, borrower, payment and financial record management.",
  keywords: ["FINEXA", "Loan Management System", "FinTech", "Borrower Management", "Payment Tracking", "Financial Records"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FINEXA",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "FINEXA – Smart Loan Management System",
    description: "FINEXA – Smart Loan Management System for secure loan, borrower, payment and financial record management.",
    siteName: "FINEXA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FINEXA – Smart Loan Management System",
    description: "FINEXA – Smart Loan Management System for secure loan, borrower, payment and financial record management.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/icon-192.png",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

import { StartupPerformanceTracker } from "@/components/startup-performance-tracker";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <RealtimeSyncProvider>
              <SessionTimeoutProvider>
                {children}
                <PwaRegister />
                <StartupPerformanceTracker />
              </SessionTimeoutProvider>
            </RealtimeSyncProvider>
          </ErrorBoundary>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
