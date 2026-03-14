import type { Metadata } from "next";
import { CategoryRulesList } from "@/components/settings/category-rules-list";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Auto-Categorization",
};

export default async function AutoCategorizationPage() {
  const t = await getTranslations("settings");
  return (
    <CategoryRulesList
      pageTitle={t("autoCategorization")}
      pageDescription={t("autoCategorizationDescription")}
    />
  );
}
