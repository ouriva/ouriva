// Dashboard Page
// ==============
// The `metadata` export sets the <title> tag for this page.
// Combined with the root layout's template, this renders as:
// "Dashboard | Budget Tracker"

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your finances"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Dashboard content coming soon
      </div>
    </div>
  );
}
