import type { Metadata } from "next";
import { CategoryTree } from "@/components/settings/category-tree";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function CategoriesSettingsPage() {
  const t = await getTranslations("settings");
  return (
    <CategoryTree
      pageTitle={t("categories")}
      pageDescription={t("categoriesDescription")}
    />
  );
}
