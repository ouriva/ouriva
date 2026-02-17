import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Accounts, categories, and currencies"
      />
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Settings management coming soon
      </div>
    </div>
  );
}
