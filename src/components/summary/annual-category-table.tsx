// Annual Category Table
// =====================
// Per-category totals with a 12-month column breakdown. Scrolls
// horizontally on mobile so all months are accessible via swipe.
//
// Rows are clickable: selecting a category highlights the row and
// updates the chart above (via onSelect) to show that category's
// monthly breakdown. Clicking the same row again resets to overview.

"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface Category {
  id: string;
  name: string;
  total: number;
  months: number[];
  children: { id: string; name: string; total: number }[];
}

interface AnnualCategoryTableProps {
  categories: Category[];
  emptyMessage?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
}

export function AnnualCategoryTable({
  categories,
  emptyMessage = "No data for this year",
  selectedId,
  onSelect,
}: AnnualCategoryTableProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const monthlyTotals = new Array(12).fill(0);
  for (const cat of categories) {
    for (let i = 0; i < 12; i++) monthlyTotals[i] += cat.months[i];
  }
  const grandTotal = monthlyTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium">
              Category
            </th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="px-3 py-2 text-right font-medium">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const isSelected = selectedId === category.id;

            return (
              <tr
                key={category.id}
                className={cn(
                  "border-b transition-colors",
                  onSelect && "cursor-pointer hover:bg-muted/30",
                  isSelected && "bg-muted/50"
                )}
                onClick={() =>
                  onSelect?.(isSelected ? null : category.id)
                }
              >
                <td className={cn(
                  "sticky left-0 px-3 py-2 font-medium transition-colors",
                  isSelected ? "bg-muted/50" : "bg-background"
                )}>
                  {category.id === "__uncategorized__" ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {category.name}
                    </span>
                  ) : (
                    category.name
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold">
                  {category.total.toFixed(2)}
                </td>
                {category.months.map((amount, i) => (
                  <td
                    key={i}
                    className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                  >
                    {amount > 0 ? amount.toFixed(2) : "—"}
                  </td>
                ))}
              </tr>
            );
          })}

          {/* Grand total row */}
          <tr className="bg-muted/50 font-semibold">
            <td className="sticky left-0 bg-muted/50 px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right tabular-nums">
              {grandTotal.toFixed(2)}
            </td>
            {monthlyTotals.map((amount, i) => (
              <td key={i} className="px-3 py-2 text-right tabular-nums">
                {amount > 0 ? amount.toFixed(2) : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
