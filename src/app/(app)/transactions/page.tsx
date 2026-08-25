// Transactions Page
// =================
// Shows the list of all transactions, with "Import" and "Add" actions
// in the page header — Add is the primary (amber) action, matching the
// same pairing used on the dashboard, rather than a floating button
// disconnected from the rest of the header row.
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
        <div className="flex items-center gap-2">
          <Link href="/transactions/import">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              {t("importButton")}
            </Button>
          </Link>
          <Link href="/transactions/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t("addButton")}
            </Button>
          </Link>
        </div>
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
    </div>
  );
}
