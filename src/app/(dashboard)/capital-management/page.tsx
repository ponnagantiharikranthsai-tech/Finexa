import { getCapitalDataAction } from "@/features/capital/actions/get-capital-data.action";
import { CapitalManagementList } from "@/features/capital/components/capital-management-list";

export const revalidate = 0;

export default async function CapitalManagementPage() {
  const res = await getCapitalDataAction();
  const data = res.success && res.data ? res.data : {
    funders: [],
    stats: {
      totalReceived: 0,
      totalReturned: 0,
      activeCapital: 0,
      availableCapital: 0,
      activeFunders: 0,
      totalOutstandingLoansPrincipal: 0
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Capital</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track funder investments, capital returns, and capital summary stats.
          </p>
        </div>
      </div>
      <CapitalManagementList initialData={data} />
    </div>
  );
}
