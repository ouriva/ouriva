// Dashboard Page
// ==============
// The home screen of the app. Shows account balances, current month
// income/expenses, and recent transactions. All data is fetched
// client-side in DashboardContent using parallel API calls.

import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

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
      <DashboardContent />
    </div>
  );
}
