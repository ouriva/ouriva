// useTransactions Hook
// ====================
// Custom React hook for fetching and managing transactions.
//
// "use client" hooks run in the browser and manage client-side state.
// This hook encapsulates:
//   1. Data fetching (via fetch API)
//   2. Loading/error states
//   3. Refetching after mutations (create, update, delete)
//
// Why not use a library like SWR or React Query?
// They're great but add complexity. For learning purposes, we're
// building this manually so you understand what those libraries
// abstract away. You could swap this for SWR later.

"use client";

import { useState, useEffect, useCallback } from "react";
import type { TransactionQuery } from "@/validators/transaction";

// The transaction shape returned by the API (with included relations).
// We define it here rather than generating from Prisma because this
// represents the API response, not the raw database row.
export interface TransactionWithRelations {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string; // Decimal comes as string from JSON
  description: string | null;
  friendlyName: string | null;
  notes: string | null;
  date: string; // ISO date string
  fromAccount: {
    id: string;
    name: string;
    currency: { id: string; code: string; symbol: string };
  };
  category: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    parent: { id: string; name: string } | null;
  } | null;
  // Split children — empty array for regular transactions.
  // When non-empty, this transaction is a split parent.
  splits: Array<{
    id: string;
    amount: string;
    category: {
      id: string;
      name: string;
      parent: { id: string; name: string } | null;
    } | null;
  }>;
  needsReview: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UseTransactionsResult {
  transactions: TransactionWithRelations[];
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTransactions(
  filters?: Partial<TransactionQuery>
): UseTransactionsResult {
  const [transactions, setTransactions] = useState<TransactionWithRelations[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useCallback memoizes the function so it doesn't get recreated
  // on every render. This is important because `fetchData` is in
  // the useEffect dependency array — without useCallback, it would
  // trigger an infinite loop (new function → effect runs → re-render
  // → new function → ...).
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query string from filters, omitting undefined values
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== "") {
            params.set(key, String(value));
          }
        });
      }

      const response = await fetch(`/api/transactions?${params.toString()}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || "Failed to fetch transactions");
      }

      const result = await response.json();
      setTransactions(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  // useEffect runs side effects after render. Here, it fetches data
  // when the component mounts and whenever filters change.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    transactions,
    pagination,
    isLoading,
    error,
    refetch: fetchData,
  };
}
