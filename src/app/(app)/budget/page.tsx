import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetContent } from "@/components/budget/budget-content";

export const metadata: Metadata = {
  title: "Budget",
};

function BudgetFallback() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>
      <Skeleton className="h-9 w-full rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[72px] rounded-xl" />
        <Skeleton className="h-[72px] rounded-xl" />
      </div>
      <Skeleton className="h-[72px] rounded-xl" />
      <Skeleton className="h-[200px] rounded-xl" />
      <Skeleton className="h-9 w-full rounded-lg" />
      <Skeleton className="h-[240px] rounded-xl" />
    </div>
  );
}

export default function BudgetPage() {
  return (
    <div className="space-y-4">
      <Suspense fallback={<BudgetFallback />}>
        <BudgetContent />
      </Suspense>
    </div>
  );
}
