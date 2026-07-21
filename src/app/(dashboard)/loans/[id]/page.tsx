import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LoanDetailRedirectPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`/loan-management?loanId=${id}`);
}
