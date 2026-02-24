import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GeneralSettings } from "@/components/settings/general-settings";

export const metadata: Metadata = { title: "General Settings" };

export default function GeneralSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="General" />
      <GeneralSettings />
    </div>
  );
}
