import type { Metadata } from "next";
import { CategoryRulesList } from "@/components/settings/category-rules-list";

export const metadata: Metadata = {
  title: "Auto-Categorization",
};

export default function AutoCategorizationPage() {
  return (
    <CategoryRulesList
      pageTitle="Auto-Categorization"
      pageDescription="Rules that auto-assign categories when importing transactions"
    />
  );
}
