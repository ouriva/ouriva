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
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  bucket: "NEEDS" | "WANTS" | "SAVINGS" | null;
}

interface UnclassifiedRow {
  id: string;
  name: string;
  parentName: string | null;
}

function computeUnclassified(categories: Category[]): UnclassifiedRow[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const parentIds = new Set(categories.filter((c) => c.parentId).map((c) => c.parentId));

  const rows: UnclassifiedRow[] = [];

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
  const [rows, setRows] = useState<UnclassifiedRow[] | null>(null);
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
    <Card>
      <CardContent className="p-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 text-left">
            <div className="min-w-0">
              <p className="font-medium">{t("unclassifiedCategoriesLabel")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("unclassifiedCategoriesDescription")}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {count === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                  {count === 1 ? t("unclassifiedCountSingle") : t("unclassifiedCountPlural", { count })}
                </span>
              )}
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 space-y-2">
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">{t("unclassifiedCategoriesEmpty")}</p>
            ) : (
              <>
                <ul className="divide-y rounded-lg border">
                  {rows.map((row) => (
                    <li key={row.id} className="px-3 py-2 text-sm">
                      {row.parentName ? (
                        <span>
                          <span className="text-muted-foreground">{row.parentName}</span>
                          <span className="text-muted-foreground"> › </span>
                          {row.name}
                        </span>
                      ) : (
                        row.name
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-sm">
                  <Link href="/settings/categories" className="underline underline-offset-2">
                    {t("unclassifiedCategoriesLink")}
                  </Link>
                </p>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
