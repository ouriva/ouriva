// Transactions Page
// =================
// Shows the list of all transactions with a floating "+" button
// to create new ones.
//
// This page is a Server Component — it renders the layout and
// delegates interactive parts to Client Components (TransactionList).
// This is the "donut pattern": Server Component wraps Client Components.

import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { TransactionList } from "@/components/transactions/transaction-list";
import { Button } from "@/components/ui/button";
import { Plus, Upload, Loader2 } from "lucide-react";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Transactions",
};

export default async function TransactionsPage() {
  const t = await getTranslations("transactions");

  return (
    <div className="space-y-6">
      <PageHeader title={t("pageTitle")}>
        <Link href="/transactions/import">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            {t("importButton")}
          </Button>
        </Link>
      </PageHeader>

      {/* Transaction list (Client Component)
          Suspense is required because TransactionList uses useSearchParams(),
          which needs a boundary for static rendering. */}
      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }>
        <TransactionList />
      </Suspense>

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
          <span className="sr-only">{t("addAriaLabel")}</span>
        </Button>
      </Link>
    </div>
  );
}
