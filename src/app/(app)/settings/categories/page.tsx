import type { Metadata } from "next";
import { CategoryTree } from "@/components/settings/category-tree";

export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesSettingsPage() {
  return (
    <CategoryTree
      pageTitle="Categories"
      pageDescription="Organize with parent and subcategories"
    />
  );
}
