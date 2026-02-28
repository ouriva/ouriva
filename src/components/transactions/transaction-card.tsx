// Transaction Card
// ================
// Displays a single transaction as a card in the list.
// Color-coded by type: green for income, red for expense.
//
// For split transactions, each split is shown as its own sub-row
// below the main row, so the user can see exactly how much was
// allocated to each category without opening the edit form.
//
// This is a Server Component (no "use client") — it receives
// data as props and renders HTML. No browser JavaScript needed.

import { ArrowDownLeft, ArrowUpRight, AlertTriangle, CircleDot, Split } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { TransactionWithRelations } from "@/hooks/use-transactions";

interface TransactionCardProps {
  transaction: TransactionWithRelations;
  onClick?: () => void;
}

// Map transaction types to visual properties
const typeConfig = {
  INCOME: {
    icon: ArrowDownLeft,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    sign: "+",
  },
  EXPENSE: {
    icon: ArrowUpRight,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    sign: "-",
  },
} as const;

// Format a split's category into a display string
function splitCategoryName(split: TransactionWithRelations["splits"][number]): string {
  if (!split.category) return "Uncategorized";
  return split.category.parent
    ? `${split.category.parent.name} › ${split.category.name}`
    : split.category.name;
}

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const config = typeConfig[transaction.type];
  const Icon = config.icon;
  const currency = transaction.fromAccount.currency;

  const isSplit = transaction.splits.length > 0;

  // Single-category subtitle (only used when not a split)
  const subtitleText = transaction.category
    ? transaction.category.parent
      ? `${transaction.category.parent.name} › ${transaction.category.name}`
      : transaction.category.name
    : "Uncategorized";

  const isUncategorized = !isSplit && !transaction.category;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
    >
      {/* ── Main row ── */}
      <div className="flex items-center gap-3">
        {/* Icon circle — w-10 = 40px, gap-3 = 12px → 52px total indent for sub-rows */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            config.bgColor
          )}
        >
          <Icon className={cn("h-5 w-5", config.color)} />
        </div>

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
                <AlertTriangle className="h-3.5 w-3.5" />
                Uncategorized
              </span>
            ) : isSplit ? (
              // For splits, sub-rows below show the categories — just
              // show the split indicator here to keep the header clean.
              <span className="inline-flex items-center gap-1">
                <Split className="h-3.5 w-3.5" />
                Split
              </span>
            ) : (
              subtitleText
            )}
            {transaction.needsReview && (
              <>
                <span className="mx-1">·</span>
                <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <CircleDot className="h-3.5 w-3.5" />
                  Review
                </span>
              </>
            )}
          </p>
        </div>

        {/* Total amount and date */}
        <div className="text-right">
          <p className={cn("font-semibold tabular-nums", config.color)}>
            {config.sign}
            {formatCurrency(transaction.amount, currency.code)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(transaction.date)}
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
                {splitCategoryName(split)}
              </span>
              <span className={cn("ml-3 shrink-0 text-sm tabular-nums", config.color)}>
                {config.sign}
                {formatCurrency(split.amount, currency.code)}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
