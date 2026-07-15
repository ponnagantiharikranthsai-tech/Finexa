import { getBorrowersAction } from "@/features/borrowers/actions/get-borrowers.action";
import { Users, ChevronRight } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function BorrowersPage() {
  const res = await getBorrowersAction();
  const borrowers = res.success ? res.data.data : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-left">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Borrowers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identity records, KYC, and loan history for all borrowers.
          </p>
        </div>
      </div>

      {borrowers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center fx-glass-card rounded-2xl">
          <div className="h-14 w-14 bg-secondary rounded-2xl flex items-center justify-center mb-4">
            <Users className="h-7 w-7 text-primary" />
          </div>
          <p className="font-bold text-foreground">No borrowers yet</p>
          <p className="text-xs text-muted-foreground mt-1">Borrowers are auto-registered when you create a loan.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:hidden">
          {borrowers.map((b) => (
            <Link key={b.borrowerId} href={`/borrowers/${b.borrowerId}`}>
              <div className="flex items-center justify-between fx-glass-card rounded-2xl p-4 fx-3d-hover">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl fx-brand-gradient flex items-center justify-center text-white font-bold text-sm shrink-0 fx-shadow-glow-sm">
                    {b.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.mobile}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Desktop table */}
      {borrowers.length > 0 && (
        <div className="hidden md:block rounded-2xl fx-glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-accent/20">
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Borrower</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mobile</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {borrowers.map((b) => (
                <tr key={b.borrowerId} className="fx-row-hover">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg fx-brand-gradient flex items-center justify-center text-white font-bold text-xs shrink-0 fx-shadow-glow-sm">
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-foreground">{b.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-muted-foreground">{b.mobile}</td>
                  <td className="px-5 py-3.5 text-muted-foreground">{b.email}</td>
                  <td className="px-5 py-3.5 text-right">
                    <Link href={`/borrowers/${b.borrowerId}`}>
                      <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-primary bg-secondary hover:bg-accent transition-all duration-200">
                        View Profile <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
