// Transaction Card
// ================
// Displays a single transaction as a card in the list.
// Color-coded by type: green for income, red for expense,
// blue for transfer.
//
// This is a Server Component (no "use client") — it receives
// data as props and renders HTML. No browser JavaScript needed.

import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, AlertTriangle } from "lucide-react";
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
  TRANSFER: {
    icon: ArrowLeftRight,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    sign: "",
  },
} as const;

export function TransactionCard({ transaction, onClick }: TransactionCardProps) {
  const config = typeConfig[transaction.type];
  const Icon = config.icon;
  const currency = transaction.fromAccount.currency;

  // Build the subtitle: category name or transfer accounts
  const isUncategorized =
    transaction.type !== "TRANSFER" && !transaction.category;

  const subtitleText =
    transaction.type === "TRANSFER"
      ? `${transaction.fromAccount.name} → ${transaction.toAccount?.name}`
      : transaction.category
        ? transaction.category.parent
          ? `${transaction.category.parent.name} › ${transaction.category.name}`
          : transaction.category.name
        : "Uncategorized";

  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
    >
      {/* Icon circle */}
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          config.bgColor
        )}
      >
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>

      {/* Description and category */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {transaction.friendlyName || transaction.description || subtitleText}
        </p>
        {transaction.friendlyName && transaction.description && (
          <p className="truncate text-xs text-muted-foreground/70">
            {transaction.description}
          </p>
        )}
        <p className="truncate text-sm text-muted-foreground">
          {isUncategorized ? (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Uncategorized
            </span>
          ) : (
            subtitleText
          )}
        </p>
      </div>

      {/* Amount and date */}
      <div className="text-right">
        <p className={cn("font-semibold tabular-nums", config.color)}>
          {config.sign}
          {formatCurrency(transaction.amount, currency.code)}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(transaction.date)}
        </p>
      </div>
    </button>
  );
}
