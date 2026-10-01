import React from "react";
import { getVehicleLoanByCode } from "@/features/vehicle-loans/repository/vehicle-loan.repository";
import { DEFAULT_VEHICLE_LOAN } from "@/features/vehicle-loans/schemas/vehicle-loan.schema";
import { BorrowerVehicleApplyForm } from "@/features/vehicle-loans/components/borrower-vehicle-apply-form";
import { AlertTriangle } from "lucide-react";

interface PageProps {
  params: Promise<{
    code: string;
  }>;
}

export default async function VehicleBorrowerApplyPage({ params }: PageProps) {
  const { code } = await params;
  
  let loan = await getVehicleLoanByCode(code);

  // If code matches the default application code or no record found in DB, fallback to default seed
  if (!loan && (code.toUpperCase().includes("DIO") || code.toUpperCase() === DEFAULT_VEHICLE_LOAN.applicationCode)) {
    loan = DEFAULT_VEHICLE_LOAN as any;
  }

  if (!loan) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-card border border-border/60 shadow-xl text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-black text-foreground">Application Not Found</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The vehicle collateral loan application code <code className="font-mono text-foreground font-bold">{code}</code> does not exist or has expired.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BorrowerVehicleApplyForm loan={loan} />
    </div>
  );
}
