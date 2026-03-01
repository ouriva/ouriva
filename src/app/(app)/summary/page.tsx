import type { Metadata } from "next";
import { Suspense } from "react";
import { SummaryNav } from "@/components/summary/summary-nav";
import { MonthlySummaryContent } from "@/components/summary/monthly-summary-content";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Monthly Summary",
};

function MonthlySummaryFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)}
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
      </div>
    </div>
  );
}

export default function SummaryPage() {
  return (
    <div className="space-y-4">
      <SummaryNav mode="monthly" />
      <Suspense fallback={<MonthlySummaryFallback />}>
        <MonthlySummaryContent />
      </Suspense>
    </div>
  );
}
