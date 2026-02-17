// Transactions Page
// =================
// Shows the list of all transactions with a floating "+" button
// to create new ones.
//
// This page is a Server Component — it renders the layout and
// delegates interactive parts to Client Components (TransactionList).
// This is the "donut pattern": Server Component wraps Client Components.

import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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

      {/* Transaction list (Client Component) */}
      <TransactionList />

      {/* Floating Action Button (FAB)
          Fixed position at bottom-right, above the nav bar.
          The "asChild" pattern isn't needed here since we wrap
          the Button in a Link — we use the button as a Link child. */}
      <Link href="/transactions/new">
        <Button
          size="icon"
          className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Add transaction</span>
        </Button>
      </Link>
    </div>
  );
}
