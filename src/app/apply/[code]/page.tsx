import { getApplicationByCodeAction } from "@/features/applications/actions/get-application.action";
import { BorrowerApplyForm } from "@/features/applications/components/borrower-apply-form";
import { AlertTriangle } from "lucide-react";
import { branding } from "@/config/branding";

interface PageProps {
  params: Promise<{
    code: string;
  }>;
}

export default async function BorrowerApplyPage({ params }: PageProps) {
  const { code } = await params;
  const res = await getApplicationByCodeAction(code);

  const errorMessage = !res.success
    ? typeof res.error === "string"
      ? res.error
      : Object.values(res.error).flat().join(", ")
    : "";

  if (!res.success || !res.data) {
    return (
      <div className="dark min-h-screen bg-black text-foreground flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl text-center space-y-5">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold font-heading text-white">Link Unavailable</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {errorMessage || "The application link is invalid, expired, or has already been submitted."}
            </p>
          </div>
          <div className="pt-2">
            <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Powered by {branding.productName}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dark min-h-screen bg-black text-foreground antialiased">
      <BorrowerApplyForm application={res.data} />
    </div>
  );
}
