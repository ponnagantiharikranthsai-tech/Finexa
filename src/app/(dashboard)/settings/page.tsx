"use client";

import React, { useState } from "react";
import { 
  Key, 
  ShieldCheck, 
  Save, 
  RefreshCw,
  Bell
} from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      toast.success("Settings saved successfully!");
    }, 1000);
  };

  return (
    <div className="space-y-8">
      
      {/* Page Header */}
      <div className="flex items-center justify-between pb-5 border-b border-border text-left">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">System Settings</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Configure compliance, API keys, and notification triggers</p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="h-10 rounded-xl px-5 bg-primary hover:opacity-90 text-primary-foreground font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 transition-all disabled:opacity-50"
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Saving" : "Save Changes"}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        
        {/* API Credentials */}
        <div className="p-6 rounded-2xl fx-glass-card space-y-5 text-left">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">API Configuration</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Fast2SMS Auth Token</label>
              <input 
                type="password" 
                value="••••••••••••••••••••••••••••••••••••••••" 
                disabled
                className="w-full h-11 px-4 rounded-xl bg-muted border border-border text-foreground text-sm outline-none opacity-60"
              />
              <p className="text-[9px] text-muted-foreground">API token utilized for borrower verification SMS dispatches</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Resend Mailer API Key</label>
              <input 
                type="password" 
                value="re_••••••••••••••••••••••••" 
                disabled
                className="w-full h-11 px-4 rounded-xl bg-muted border border-border text-foreground text-sm outline-none opacity-60"
              />
              <p className="text-[9px] text-muted-foreground">Key utilized for contract delivery via SMTP channels</p>
            </div>
          </div>
        </div>

        {/* Security Parameters */}
        <div className="p-6 rounded-2xl fx-glass-card space-y-5 text-left">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Compliance &amp; Cryptography</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">AES-256 Field Protection</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Encrypts Aadhaar and PAN columns automatically</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full">ACTIVE</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">Auto Session Lock</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Locks manager workspace after 15 minutes of idle time</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full">ENABLED</span>
            </div>
          </div>
        </div>

        {/* Notification Parameters */}
        <div className="p-6 rounded-2xl fx-glass-card space-y-5 text-left">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">System Reminders</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">SMS Alerts on Verified Application</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Notify user when borrower uploads matching KYC documents</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full">ON</span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-secondary border border-border">
              <div>
                <p className="text-xs font-bold text-foreground">Due Date Email Triggers</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">Dispatches payment schedule warnings 3 days prior to due date</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-full">ON</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

