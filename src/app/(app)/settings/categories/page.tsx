import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { CategoryTree } from "@/components/settings/category-tree";

export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Categories" description="Organize with parent and subcategories" />
      <CategoryTree />
    </div>
  );
}
