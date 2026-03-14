import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { GeneralSettings } from "@/components/settings/general-settings";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = { title: "General Settings" };

export default async function GeneralSettingsPage() {
  const t = await getTranslations("settings");
  return (
    <div className="space-y-6">
      <PageHeader title={t("general")} />
      <GeneralSettings />
    </div>
  );
}
