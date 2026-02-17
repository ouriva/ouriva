// Transaction List
// ================
// Displays transactions grouped by date, with each group having
// a date header. Uses the useTransactions hook for data fetching.
//
// "use client" because it uses hooks and manages state.

"use client";

import { useRouter } from "next/navigation";
import { useTransactions } from "@/hooks/use-transactions";
import { TransactionCard } from "./transaction-card";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import type { TransactionQuery } from "@/validators/transaction";

interface TransactionListProps {
  initialFilters?: Partial<TransactionQuery>;
}

export function TransactionList({ initialFilters }: TransactionListProps) {
  const router = useRouter();
  const [page, setPage] = useState(1);

  // Merge initial filters with current page
  const filters = { ...initialFilters, page };
  const { transactions, pagination, isLoading, error } = useTransactions(filters);

  // Group transactions by date for display.
  // Object.groupBy is a newer JS method (ES2024), but we use a
  // manual approach for broader compatibility.
  const grouped = transactions.reduce<
    Record<string, typeof transactions>
  >((groups, tx) => {
    // tx.date comes as "2026-01-15T00:00:00.000Z" — we take just the date part
    const dateKey = tx.date.split("T")[0];
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(tx);
    return groups;
  }, {});

  // Sort date keys descending (most recent first)
  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        {/* Loader2 with animate-spin creates a spinning loading indicator */}
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {error}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        No transactions found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Date-grouped transaction cards */}
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          {/* Date header */}
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            {formatDate(dateKey, "EEEE, MMM d, yyyy")}
          </h3>

          {/* Transaction cards for this date */}
          <div className="rounded-lg border bg-card">
            {grouped[dateKey].map((tx, index) => (
              <div key={tx.id}>
                {/* Separator between cards (not before the first) */}
                {index > 0 && <div className="border-t mx-3" />}
                <TransactionCard
                  transaction={tx}
                  onClick={() => router.push(`/transactions/${tx.id}`)}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Pagination controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.totalPages}
          >
            Next
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
