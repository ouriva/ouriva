// New Transaction Page
// ====================
// Full-screen form for creating a new transaction.

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionForm } from "@/components/transactions/transaction-form";

export const metadata: Metadata = {
  title: "New Transaction",
};

export default function NewTransactionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Transaction" />
      <TransactionForm />
    </div>
  );
}
