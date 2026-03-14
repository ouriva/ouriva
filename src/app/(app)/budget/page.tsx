import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BudgetContent } from "@/components/budget/budget-content";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Budget",
};

function BudgetFallback() {
  return (
    <div className="space-y-6">
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

export default async function BudgetPage() {
  const t = await getTranslations("nav");
  return (
    <div className="space-y-4">
      <PageHeader title={t("budget")} />
      <Suspense fallback={<BudgetFallback />}>
        <BudgetContent />
      </Suspense>
    </div>
  );
}
