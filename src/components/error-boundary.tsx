"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("FINEXA Uncaught UI Error:", error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  private handleClearCacheAndRetry = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
        sessionStorage.clear();
        try {
          const { del } = await import("idb-keyval");
          await del("FINEXA_APP_OFFLINE_CACHE");
        } catch {}
      }
    } catch (e) {
      console.error("Failed to clear cache:", e);
    }
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV !== "production";

      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="max-w-md w-full p-8 rounded-2xl border border-destructive/20 bg-destructive/5 backdrop-blur-md space-y-4">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6" />
            </div>
            
            <h3 className="text-lg font-bold text-foreground">
              Unable to load this section
            </h3>
            
            <p className="text-xs text-muted-foreground leading-relaxed">
              FINEXA encountered a temporary rendering issue. Your data and session remain completely secure.
            </p>

            {isDev && this.state.error && (
              <div className="text-left p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive font-mono text-[11px] overflow-auto max-h-40">
                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="mt-1 text-[10px] text-muted-foreground whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <button
                onClick={this.handleRetry}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-opacity cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>

              <button
                onClick={this.handleClearCacheAndRetry}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-secondary text-secondary-foreground font-bold text-xs uppercase tracking-wider hover:bg-secondary/80 transition-colors cursor-pointer border border-border"
              >
                Clear Cache & Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
