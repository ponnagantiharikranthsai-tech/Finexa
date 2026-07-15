import { getApplicationsAction } from "@/features/applications/actions/get-applications.action";
import { ApplicationsList } from "@/features/applications/components/applications-list";

export const revalidate = 0;

export default async function ApplicationsPage() {
  const res = await getApplicationsAction({});

  const apps = res.success ? res.data.data : [];
  const total = res.success ? res.data.pagination.total : 0;
  const totalPages = res.success ? res.data.pagination.totalPages : 0;

  return (
    <div className="space-y-6 text-left">
      
      {/* 5. Link Generator Header Branding */}
      <div className="flex flex-col items-start gap-3 p-6 rounded-2xl fx-glass-card">
        <img 
          src="/logo-icon.png" 
          alt="Finexa Logo" 
          className="h-10 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(212,175,55,0.4)]"
        />
        <h1 className="text-lg font-black tracking-wider text-foreground uppercase mt-1">
          FINEXA Smart Loan Management
        </h1>
        
        {/* Professional Gold Divider */}
        <div className="h-[2px] bg-primary w-full my-1 opacity-50 shadow-[0_0_8px_rgba(184,134,11,0.25)]" />
        
        <p className="text-xs text-muted-foreground">
          Generate secure loan application links for borrowers and verify submitted profiles.
        </p>
      </div>

      <ApplicationsList initialApps={apps} total={total} totalPages={totalPages} />
    </div>
  );
}
