import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Transactions",
};

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="All your income, expenses, and transfers"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Transactions list coming soon
      </div>
    </div>
  );
}
