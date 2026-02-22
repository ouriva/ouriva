// Category Breakdown
// ==================
// Displays expense categories as a list with amounts and percentages.
// Parent categories show their total, and child categories are nested
// below with smaller text and indentation.
//
// Percentages are computed client-side by dividing each category's
// total by the overall expense total. This keeps the API focused on
// raw data while the UI handles presentation concerns.

"use client";

import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

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
  totalExpense: number;
}

export function CategoryBreakdown({
  categories,
  totalExpense,
}: CategoryBreakdownProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No expense data for this period
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {categories.map((category) => {
        // Percentage of total expenses this category represents
        const percentage =
          totalExpense > 0
            ? ((category.total / totalExpense) * 100).toFixed(1)
            : "0.0";

        return (
          <Card key={category.id}>
            <CardContent className="py-3">
              {/* Parent category row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${category.id === "__uncategorized__" ? "inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" : ""}`}>
                    {category.id === "__uncategorized__" && (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {category.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {percentage}%
                  </span>
                </div>
                <span className="font-semibold tabular-nums">
                  €{category.total.toFixed(2)}
                </span>
              </div>

              {/* Child categories — only shown if the parent has children */}
              {category.children.length > 0 && (
                <div className="mt-2 space-y-1 border-t pt-2">
                  {category.children.map((child) => {
                    const childPct =
                      totalExpense > 0
                        ? ((child.total / totalExpense) * 100).toFixed(1)
                        : "0.0";

                    return (
                      <div
                        key={child.id}
                        className="flex items-center justify-between pl-4 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">
                            {child.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {childPct}%
                          </span>
                        </div>
                        <span className="tabular-nums text-muted-foreground">
                          €{child.total.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
