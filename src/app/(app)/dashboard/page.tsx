// Dashboard Page
// ==============
// The home screen of the app. Shows account balances, current month
// income/expenses, and recent transactions. All data is fetched
// client-side in DashboardContent using parallel API calls.

import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return <DashboardContent />;
}
