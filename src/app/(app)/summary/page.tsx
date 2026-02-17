import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Summary",
};

export default function SummaryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Summary"
        description="Monthly and annual breakdowns"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Summary charts and tables coming soon
      </div>
    </div>
  );
}
