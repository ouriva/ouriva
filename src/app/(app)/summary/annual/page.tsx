import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { SummaryNav } from "@/components/summary/summary-nav";
import { AnnualSummaryContent } from "@/components/summary/annual-summary-content";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Annual Summary",
};

function AnnualSummaryFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-[200px] rounded-xl" />
    </div>
  );
}

export default function AnnualSummaryPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Summary" />
      <SummaryNav mode="annual" />
      <Suspense fallback={<AnnualSummaryFallback />}>
        <AnnualSummaryContent />
      </Suspense>
    </div>
  );
}
