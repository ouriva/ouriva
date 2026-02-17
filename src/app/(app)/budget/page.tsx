import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

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
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Budget management coming soon
      </div>
    </div>
  );
}
