// Category Breakdown
// ==================
// Compact list replacing the old pie chart + breakdown combo.
// Each category gets a colored left border and a thin progress bar
// showing its share of the total — the same information a pie chart
// conveys but in a scannable list that works better on mobile.
//
// Colors are index-based so the top category is always blue, second
// always violet, etc. — consistent across months.

"use client";

import { useTranslations, useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";
import { TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Muted, nature-toned rotation — matches the --cat-* category picker
// palette in spirit (same hue families, desaturated) without being tied
// to it, since this rotates by list position, not by chosen color.
const PALETTE = [
  "#5c7a9e", // dusty blue
  "#8471a8", // dusty violet
  "#b58a3e", // muted gold
  "#4f9c82", // muted emerald
  "#b0637a", // dusty rose
  "#4e92a3", // muted teal
  "#bc7346", // muted terracotta-orange
  "#bd6e93", // dusty pink
];

const UNCATEGORIZED_COLOR = "#f59e0b"; // amber — matches existing warning treatment

interface ChildCategory {
  id: string;
  name: string;
  total: number;
}

interface Category {
  id: string;
  name: string;
  total: number;
  children: ChildCategory[];
}

interface CategoryBreakdownProps {
  categories: Category[];
  total: number;
  emptyMessage?: string;
}

export function CategoryBreakdown({
  categories,
  total,
  emptyMessage,
}: Readonly<CategoryBreakdownProps>) {
  const t = useTranslations("summary");
  const locale = useLocale();
  const resolvedEmptyMessage = emptyMessage ?? t("noDataPeriod");
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {resolvedEmptyMessage}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {categories.map((category, index) => {
          const isUncategorized = category.id === "__uncategorized__";
          const color = isUncategorized
            ? UNCATEGORIZED_COLOR
            : PALETTE[index % PALETTE.length];
          const pct = total > 0 ? (category.total / total) * 100 : 0;

          return (
            <div
              key={category.id}
              className={cn(
                "border-l-4 px-4 py-3",
                index < categories.length - 1 && "border-b border-b-border"
              )}
              style={{ borderLeftColor: color }}
            >
              {/* Category header: name left, amount + pct right */}
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "truncate font-medium",
                    isUncategorized &&
                      "inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
                  )}
                >
                  {isUncategorized && <TriangleAlert className="h-3.5 w-3.5 shrink-0" />}
                  {category.name}
                </span>
                <div className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="font-semibold tabular-nums">
                    €{formatAmount(category.total, locale)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(pct, 100)}%`,
                    backgroundColor: color,
                    opacity: 0.7,
                  }}
                />
              </div>

              {/* Child categories — indented, no progress bar */}
              {category.children.length > 0 && (
                <div className="mt-2 space-y-1 pt-1">
                  {category.children.map((child) => {
                    const childPct = total > 0 ? (child.total / total) * 100 : 0;
                    return (
                      <div
                        key={child.id}
                        className="flex items-center justify-between pl-2 text-sm"
                      >
                        <span className="truncate text-muted-foreground">
                          {child.name}
                        </span>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">
                            {childPct.toFixed(1)}%
                          </span>
                          <span className="tabular-nums text-muted-foreground">
                            €{formatAmount(child.total, locale)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
