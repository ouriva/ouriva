// Budget Page
// ===========
// Shows annual budget targets with actual spending comparison.
// Each category has an editable budget amount, actual YTD total,
// remaining amount, and a color-coded progress bar.
//
// Same Suspense pattern as the summary pages — BudgetContent
// uses useSearchParams() to read the year from the URL.

import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { BudgetContent } from "@/components/budget/budget-content";

export const metadata: Metadata = {
  title: "Budget",
};

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description="Annual budget targets and tracking"
      />

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <BudgetContent />
      </Suspense>
    </div>
  );
}
