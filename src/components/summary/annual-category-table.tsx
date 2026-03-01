// Annual Category Table
// =====================
// Per-category totals with a 12-month column breakdown. Scrolls
// horizontally on mobile so all months are accessible via swipe.
//
// Heat map: each non-zero month cell gets a blue background tinted
// proportionally to the row's maximum — darker = higher spending that
// month. Makes seasonal patterns (holiday spending, annual bills)
// visible at a glance without reading every number.

"use client";

import { AlertTriangle } from "lucide-react";

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
}

export function AnnualCategoryTable({
  categories,
  emptyMessage = "No data for this year",
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
            // Per-row max used as the heat map denominator so each category's
            // busiest month is always the darkest cell — relative comparison.
            const maxInRow = Math.max(...category.months);

            return (
              <tr key={category.id} className="border-b">
                <td className="sticky left-0 bg-background px-3 py-2 font-medium">
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
                {category.months.map((amount, i) => {
                  const intensity =
                    amount > 0 && maxInRow > 0 ? amount / maxInRow : 0;
                  return (
                    <td
                      key={i}
                      className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                      style={
                        intensity > 0
                          ? {
                              backgroundColor: `rgba(59,130,246,${(intensity * 0.25).toFixed(2)})`,
                            }
                          : undefined
                      }
                    >
                      {amount > 0 ? amount.toFixed(2) : "—"}
                    </td>
                  );
                })}
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
