// Non-tracked Categories
// ======================
// Collapsible list of active categories with excludeFromStats: true — the
// same set whose combined balance feeds the Non-tracked Balance figure.
//
// Unlike the 50·30·20 bucket, excludeFromStats has no parent/child
// inheritance — it's a flat per-category flag (see getExcludedCategoryIds
// in src/lib/settings.ts, and the balance computation in
// src/app/api/settings/route.ts, neither of which look at the parent).
// So the rule here is simply: list any active category whose own flag is
// set, regardless of type or whether it has children.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CollapsibleCategoryList, type CategoryListRow } from "./collapsible-category-list";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  excludeFromStats: boolean;
}

function computeNonTracked(categories: Category[]): CategoryListRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));

  const rows: CategoryListRow[] = categories
    .filter((c) => c.excludeFromStats)
    .map((c) => ({
      id: c.id,
      name: c.name,
      parentName: c.parentId ? (byId.get(c.parentId)?.name ?? null) : null,
    }));

  return rows.toSorted((a, b) => {
    const keyA = `${a.parentName ?? a.name}|${a.name}`;
    const keyB = `${b.parentName ?? b.name}|${b.name}`;
    return keyA.localeCompare(keyB);
  });
}

export function NonTrackedCategories() {
  const t = useTranslations("generalSettings");
  const [rows, setRows] = useState<CategoryListRow[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchData = useCallback(() => {
    async function load() {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const json = await res.json();
        setRows(computeNonTracked(json.data as Category[]));
      }
    }
    load();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (rows === null) return null;

  const count = rows.length;

  return (
    <CollapsibleCategoryList
      label={t("nonTrackedCategoriesLabel")}
      description={t("nonTrackedCategoriesDescription")}
      rows={rows}
      countText={count === 1 ? t("nonTrackedCountSingle") : t("nonTrackedCountPlural", { count })}
      emptyMessage={t("nonTrackedCategoriesEmpty")}
      linkText={t("nonTrackedLink")}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}
