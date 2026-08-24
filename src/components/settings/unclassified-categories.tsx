// Unclassified Categories
// =======================
// Collapsible list of active EXPENSE categories with no effective
// 50·30·20 bucket — the same categories that fall into the "unclassified"
// slice of BudgetSplit.
//
// Two different rules, matching how effectiveBucket actually resolves:
//   - Root categories with no children ("empty") — listed if their own
//     bucket is null. A root WITH children is never listed itself: its
//     own bucket only matters as a fallback for children, so it isn't
//     meaningfully "unclassified" on its own.
//   - Child categories — listed only if BOTH their own bucket AND their
//     parent's bucket are null (i.e. effectiveBucket is genuinely null,
//     not just their own field). A child with no bucket but a bucketed
//     parent already counts toward that bucket, so it's not listed.

"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CollapsibleCategoryList, type CategoryListRow } from "./collapsible-category-list";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  bucket: "NEEDS" | "WANTS" | "SAVINGS" | null;
}

function computeUnclassified(categories: Category[]): CategoryListRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parentIds = new Set(categories.filter((c) => c.parentId).map((c) => c.parentId));

  const rows: CategoryListRow[] = [];

  for (const c of categories) {
    if (c.parentId) {
      const parent = byId.get(c.parentId);
      if (c.bucket === null && (!parent || parent.bucket === null)) {
        rows.push({ id: c.id, name: c.name, parentName: parent?.name ?? null });
      }
    } else {
      const isEmpty = !parentIds.has(c.id);
      if (isEmpty && c.bucket === null) {
        rows.push({ id: c.id, name: c.name, parentName: null });
      }
    }
  }

  return rows.toSorted((a, b) => {
    const keyA = `${a.parentName ?? a.name}|${a.name}`;
    const keyB = `${b.parentName ?? b.name}|${b.name}`;
    return keyA.localeCompare(keyB);
  });
}

export function UnclassifiedCategories({ enabled }: Readonly<{ enabled: boolean }>) {
  const t = useTranslations("generalSettings");
  const [rows, setRows] = useState<CategoryListRow[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const fetchData = useCallback(() => {
    async function load() {
      const res = await fetch("/api/categories?type=EXPENSE");
      if (res.ok) {
        const json = await res.json();
        setRows(computeUnclassified(json.data as Category[]));
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (enabled) fetchData();
  }, [enabled, fetchData]);

  if (!enabled || rows === null) return null;

  const count = rows.length;

  return (
    <CollapsibleCategoryList
      label={t("unclassifiedCategoriesLabel")}
      description={t("unclassifiedCategoriesDescription")}
      rows={rows}
      countText={count === 1 ? t("unclassifiedCountSingle") : t("unclassifiedCountPlural", { count })}
      emptyMessage={t("unclassifiedCategoriesEmpty")}
      linkText={t("unclassifiedCategoriesLink")}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}
