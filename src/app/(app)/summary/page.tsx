// Monthly Summary Page
// ====================
// Shows income/expense totals, a pie chart, and a category breakdown
// for a selected month.
//
// Architecture note — Suspense boundary:
// The MonthlySummaryContent component uses useSearchParams() to read
// the selected month from the URL. In Next.js App Router, any
// component that reads search params must be wrapped in <Suspense>.
// Without it, Next.js would disable static optimization for the
// entire page. With Suspense, the page shell renders immediately
// and the dynamic content streams in once search params are available.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { MonthlySummaryContent } from "@/components/summary/monthly-summary-content";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Monthly Summary",
};

export default function SummaryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Summary"
        description="Monthly breakdown"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/summary/annual">Annual</Link>
        </Button>
      </PageHeader>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <MonthlySummaryContent />
      </Suspense>
    </div>
  );
}
