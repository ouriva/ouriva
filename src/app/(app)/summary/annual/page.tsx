// Annual Summary Page
// ===================
// Shows yearly income/expense totals, a 12-month bar chart, and
// a category breakdown table with per-month columns.
//
// This is a nested route under /summary. In Next.js App Router,
// placing page.tsx inside summary/annual/ creates the /summary/annual
// route. It shares the same (app) layout (with bottom nav) because
// it's still inside the (app) route group.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AnnualSummaryContent } from "@/components/summary/annual-summary-content";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Annual Summary",
};

export default function AnnualSummaryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Summary"
        description="Annual overview"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/summary">Monthly</Link>
        </Button>
      </PageHeader>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AnnualSummaryContent />
      </Suspense>
    </div>
  );
}
