// Annual Category Table
// =====================
// Per-category totals with a 12-month column breakdown. Scrolls
// horizontally on mobile so all months are accessible via swipe.
//
// Rows are clickable: selecting a category highlights the row and
// updates the chart above (via onSelect) to show that category's
// monthly breakdown. Clicking the same row again resets to overview.
//
// Categories with subcategories show a chevron on the left. Clicking
// the chevron expands the row to reveal indented subcategory rows,
// each with their own totals and monthly breakdown. Subcategory rows
// are also selectable for the chart.

"use client";

import { Fragment, useState } from "react";
import { TriangleAlert, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { formatAmount } from "@/lib/formatters";

interface Child {
  id: string;
  name: string;
  total: number;
  months: number[];
}

interface Category {
  id: string;
  name: string;
  total: number;
  months: number[];
  children: Child[];
}

interface AnnualCategoryTableProps {
  categories: Category[];
  emptyMessage?: string;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  // When true: month cells show any non-zero value (including negative net amounts)
  // and the Total column is colored green (net income) or red (net expense).
  signedValues?: boolean;
}

export function AnnualCategoryTable({
  categories,
  emptyMessage = "No data for this year",
  selectedId,
  onSelect,
  signedValues = false,
}: Readonly<AnnualCategoryTableProps>) {
  const locale = useLocale();
  const t = useTranslations("summary");
  const monthLabels = t.raw("monthNames") as string[];

  // Track which parent rows are expanded
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string, e: React.MouseEvent) {
    // Prevent the row click from also firing (chart selection)
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
              {t("tableCategory")}
            </th>
            <th className="px-3 py-2 text-right font-medium">{t("tableTotal")}</th>
            {monthLabels.map((m) => (
              <th key={m} className="px-3 py-2 text-right font-medium">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((category) => {
            const isSelected = selectedId === category.id;
            const hasChildren = category.children.length > 0;
            const isExpanded = expandedIds.has(category.id);

            return (
              <Fragment key={category.id}>
                {/* ── Parent row ─────────────────────────────────────────── */}
                <tr
                  className={cn(
                    "border-b transition-colors",
                    onSelect && "cursor-pointer hover:bg-muted/30",
                    isSelected && "bg-muted/50"
                  )}
                  onClick={() => onSelect?.(isSelected ? null : category.id)}
                >
                  <td className={cn(
                    "sticky left-0 px-3 py-2 font-medium transition-colors",
                    isSelected ? "bg-muted/50" : "bg-background"
                  )}>
                    <span className="flex items-center gap-1">
                      {/* Expand chevron — only shown when children exist */}
                      {hasChildren ? (
                        <button
                          onClick={(e) => toggleExpand(category.id, e)}
                          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          {isExpanded
                            ? <ChevronDown className="h-3.5 w-3.5" />
                            : <ChevronRight className="h-3.5 w-3.5" />
                          }
                        </button>
                      ) : (
                        // Spacer keeps alignment consistent for rows without children
                        <span className="w-3.5 shrink-0" />
                      )}
                      {category.id === "__uncategorized__" ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <TriangleAlert className="h-3.5 w-3.5" />
                          {category.name}
                        </span>
                      ) : (
                        category.name
                      )}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right tabular-nums font-semibold",
                      signedValues && category.total >= 0 && "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {signedValues && category.total >= 0 ? "+" : signedValues ? "−" : ""}
                    {formatAmount(Math.abs(category.total), locale)}
                  </td>
                  {monthLabels.map((monthLabel, i) => (
                    <td
                      key={monthLabel}
                      className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                    >
                      {(signedValues ? category.months[i] !== 0 : category.months[i] > 0)
                        ? `${signedValues ? (category.months[i] >= 0 ? "+" : "−") : ""}${formatAmount(Math.abs(category.months[i]), locale)}`
                        : "—"}
                    </td>
                  ))}
                </tr>

                {/* ── Child rows (shown when expanded) ────────────────────── */}
                {isExpanded && category.children.map((child) => {
                  const isChildSelected = selectedId === child.id;
                  return (
                    <tr
                      key={child.id}
                      className={cn(
                        "border-b transition-colors",
                        onSelect && "cursor-pointer hover:bg-muted/30",
                        isChildSelected && "bg-muted/50"
                      )}
                      onClick={() => onSelect?.(isChildSelected ? null : child.id)}
                    >
                      <td className={cn(
                        "sticky left-0 px-3 py-2 transition-colors",
                        isChildSelected ? "bg-muted/50" : "bg-background"
                      )}>
                        {/* Indent: spacer (chevron width) + left padding */}
                        <span className="flex items-center gap-1 pl-5 text-muted-foreground">
                          {child.name}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          signedValues && child.total >= 0 && "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {signedValues && child.total >= 0 ? "+" : signedValues ? "−" : ""}
                        {formatAmount(Math.abs(child.total), locale)}
                      </td>
                      {monthLabels.map((monthLabel, i) => (
                        <td
                          key={monthLabel}
                          className="px-3 py-2 text-right tabular-nums text-muted-foreground"
                        >
                          {(signedValues ? child.months[i] !== 0 : child.months[i] > 0)
                            ? `${signedValues ? (child.months[i] >= 0 ? "+" : "−") : ""}${formatAmount(Math.abs(child.months[i]), locale)}`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}

          {/* Grand total row */}
          <tr className="bg-muted/50 font-semibold">
            <td className="sticky left-0 bg-muted/50 px-3 py-2">{t("tableTotal")}</td>
            <td
              className={cn(
                "px-3 py-2 text-right tabular-nums",
                signedValues && grandTotal >= 0 && "text-emerald-600 dark:text-emerald-400"
              )}
            >
              {signedValues && grandTotal >= 0 ? "+" : signedValues ? "−" : ""}
              {formatAmount(Math.abs(grandTotal), locale)}
            </td>
            {monthLabels.map((monthLabel, i) => (
              <td key={monthLabel} className="px-3 py-2 text-right tabular-nums">
                {(signedValues ? monthlyTotals[i] !== 0 : monthlyTotals[i] > 0)
                  ? `${signedValues ? (monthlyTotals[i] >= 0 ? "+" : "−") : ""}${formatAmount(Math.abs(monthlyTotals[i]), locale)}`
                  : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
