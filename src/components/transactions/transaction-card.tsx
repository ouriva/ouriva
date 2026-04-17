// Transaction Card
// ================
// Displays a single transaction as a card in the list.
// Amount color: emerald for income, default foreground for expenses.
//
// For split transactions, each split is shown as its own sub-row
// below the main row, so the user can see exactly how much was
// allocated to each category without opening the edit form.

"use client";

import { ArrowDownLeft, ArrowUpRight, TriangleAlert, CircleDot, Split } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { TransactionWithRelations } from "@/hooks/use-transactions";
import { CategoryIcon } from "@/components/ui/category-icon";
import { useTranslations, useLocale } from "next-intl";

interface TransactionCardProps {
  transaction: TransactionWithRelations;
  onClick?: () => void;
}

// Map transaction types to visual properties.
// `color` is the icon arrow color; `amountColor` is the amount text color.
const typeConfig = {
  INCOME: {
    icon: ArrowDownLeft,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    amountColor: "text-emerald-600 dark:text-emerald-400",
    sign: "+",
  },
  EXPENSE: {
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    amountColor: "",
    sign: "-",
  },
} as const;

// Format a split's category into a display string
function splitCategoryName(
  split: TransactionWithRelations["splits"][number],
  uncategorizedLabel: string
): string {
  if (!split.category) return uncategorizedLabel;
  return split.category.parent
    ? `${split.category.parent.name} › ${split.category.name}`
    : split.category.name;
}

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const t = useTranslations("transactions");
  const locale = useLocale();
  const config = typeConfig[transaction.type];
  const Icon = config.icon;
  const currency = transaction.fromAccount.currency;

  const isSplit = transaction.splits.length > 0;

  // Single-category subtitle (only used when not a split)
  const subtitleText = transaction.category
    ? transaction.category.parent
      ? `${transaction.category.parent.name} › ${transaction.category.name}`
      : transaction.category.name
    : t("uncategorizedLabel");

  const isUncategorized = !isSplit && !transaction.category;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
    >
      {/* ── Main row ── */}
      <div className="flex items-center gap-3">
        {/* Icon circle — w-10 = 40px, gap-3 = 12px → 52px total indent for sub-rows.
            Shows the category's custom icon+color when set; falls back to the
            type arrow (green income / red expense) when not set or for splits. */}
        <CategoryIcon
          icon={!isSplit ? transaction.category?.icon : undefined}
          color={!isSplit ? transaction.category?.color : undefined}
          fallback={Icon}
          fallbackBg={config.bgColor}
          fallbackColor={config.color}
        />

        {/* Description and category/split indicator */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {transaction.friendlyName?.trim() || transaction.description || subtitleText}
          </p>
          {transaction.friendlyName?.trim() && transaction.description && (
            <p className="truncate text-xs text-muted-foreground/70">
              {transaction.description}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {isUncategorized ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <TriangleAlert className="h-3.5 w-3.5" />
                {t("uncategorizedLabel")}
              </span>
            ) : isSplit ? (
              // For splits, sub-rows below show the categories — just
              // show the split indicator here to keep the header clean.
              <span className="inline-flex items-center gap-1">
                <Split className="h-3.5 w-3.5" />
                {t("splitBadge")}
              </span>
            ) : (
              subtitleText
            )}
            {transaction.needsReview && (
              <>
                <span className="mx-1">·</span>
                <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <CircleDot className="h-3.5 w-3.5" />
                  {t("reviewBadge")}
                </span>
              </>
            )}
          </p>
        </div>

        {/* Total amount */}
        <div className="text-right">
          <p className={cn("font-semibold tabular-nums", config.amountColor)}>
            {config.sign}
            {formatCurrency(transaction.amount, currency.code, locale)}
          </p>
        </div>
      </div>

      {/* ── Split sub-rows ──
          Indented by 52px (icon width + gap) so they align with the text above.
          Each row shows the category name and that split's amount, making it
          easy to see the allocation without opening the transaction. This also
          answers "why does this transaction show up when I filter by category X?"
          — the matching split and its amount are visible right here. */}
      {isSplit && (
        <div className="mt-2 space-y-1 pl-[52px]">
          {transaction.splits.map((split) => (
            <div key={split.id} className="flex items-center justify-between">
              <span className="truncate text-sm text-muted-foreground">
                {splitCategoryName(split, t("uncategorizedLabel"))}
              </span>
              <span className={cn("ml-3 shrink-0 text-sm tabular-nums", config.amountColor)}>
                {config.sign}
                {formatCurrency(split.amount, currency.code, locale)}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
