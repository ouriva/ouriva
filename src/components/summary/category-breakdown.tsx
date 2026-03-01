// Category Breakdown
// ==================
// Compact list replacing the old pie chart + breakdown combo.
// Each category gets a colored left border and a thin progress bar
// showing its share of the total — the same information a pie chart
// conveys but in a scannable list that works better on mobile.
//
// Colors are index-based so the top category is always blue, second
// always violet, etc. — consistent across months.

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Matches the color palette used in the old pie chart
const PALETTE = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#f43f5e", // rose-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#ec4899", // pink-500
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
  emptyMessage = "No data for this period",
}: CategoryBreakdownProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {emptyMessage}
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
                  {isUncategorized && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
                  {category.name}
                </span>
                <div className="flex shrink-0 items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="font-semibold tabular-nums">
                    €{category.total.toFixed(2)}
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
                            €{child.total.toFixed(2)}
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
