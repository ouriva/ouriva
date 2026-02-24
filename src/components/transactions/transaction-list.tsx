// Transaction List
// ================
// Displays transactions grouped by date with filtering and search.
// Filter controls sit above the list:
//   1. Search bar — always visible, debounced (300ms)
//   2. Type tabs — All | Income | Expense
//   3. Collapsible "Filters" section — account, category, date range
//
// The API already supports all these filters — this component just
// provides the UI and wires filter state to the useTransactions hook.

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransactions } from "@/hooks/use-transactions";
import { TransactionCard } from "./transaction-card";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { TransactionQuery } from "@/validators/transaction";

interface Account {
  id: string;
  name: string;
  currency: { code: string; symbol: string };
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface TransactionListProps {
  initialFilters?: Partial<TransactionQuery>;
}

export function TransactionList({ initialFilters }: TransactionListProps) {
  const router = useRouter();

  // --- Filter state ---
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [type, setType] = useState<string | undefined>();
  const [accountId, setAccountId] = useState<string | undefined>();
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // --- Reference data for filter dropdowns ---
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Fetch accounts and categories on mount
  useEffect(() => {
    async function loadFilterData() {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);

      if (accountsRes.ok) {
        const data = await accountsRes.json();
        setAccounts(data.data || data);
      }
      if (categoriesRes.ok) {
        const data = await categoriesRes.json();
        setCategories(data.data || data);
      }
    }
    loadFilterData();
  }, []);

  // Debounce search — wait 300ms after the user stops typing before
  // hitting the API. This prevents a request on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page to 1 when any filter changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, type, accountId, categoryId, startDate, endDate]);

  // Build the filter object passed to the hook
  const filters: Partial<TransactionQuery> = {
    ...initialFilters,
    page,
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(type && { type: type as TransactionQuery["type"] }),
    ...(accountId && { accountId }),
    ...(categoryId && { categoryId }),
    ...(startDate && { startDate: new Date(startDate) }),
    ...(endDate && { endDate: new Date(endDate) }),
  };

  const { transactions, pagination, isLoading, error } = useTransactions(filters);

  // Count active filters (excluding search and type tabs)
  const activeFilterCount = [accountId, categoryId, startDate, endDate].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setType(undefined);
    setAccountId(undefined);
    setCategoryId(undefined);
    setStartDate("");
    setEndDate("");
  }

  // Category helpers for grouped dropdown
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  // Group transactions by date for display
  const grouped = transactions.reduce<Record<string, typeof transactions>>(
    (groups, tx) => {
      const dateKey = tx.date.split("T")[0];
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(tx);
      return groups;
    },
    {}
  );

  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-4">
      {/* --- Filter UI --- */}
      <div className="space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Type tabs */}
        <Tabs
          value={type || "ALL"}
          onValueChange={(v) => setType(v === "ALL" ? undefined : v)}
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ALL">All</TabsTrigger>
            <TabsTrigger value="INCOME">Income</TabsTrigger>
            <TabsTrigger value="EXPENSE">Expense</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* More filters toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {(activeFilterCount > 0 || search || type) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>

        {/* Collapsible filter section */}
        {showFilters && (
          <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
            {/* Account filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Account
              </label>
              <Select
                value={accountId || "all"}
                onValueChange={(v) => setAccountId(v === "all" ? undefined : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} ({account.currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category filter */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Category
              </label>
              <Select
                value={categoryId || "all"}
                onValueChange={(v) => setCategoryId(v === "all" ? undefined : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {parentCategories.map((parent) => {
                    const children = childCategories.filter(
                      (c) => c.parentId === parent.id
                    );
                    if (children.length > 0) {
                      return children.map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          {parent.name} › {child.name}
                        </SelectItem>
                      ));
                    }
                    return (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                From
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* --- Transaction list --- */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          {error}
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No transactions found
        </div>
      ) : (
        <>
          {/* Date-grouped transaction cards */}
          {sortedDates.map((dateKey) => (
            <div key={dateKey}>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                {formatDate(dateKey, "EEEE, MMM d, yyyy")}
              </h3>
              <div className="rounded-lg border bg-card">
                {grouped[dateKey].map((tx, index) => (
                  <div key={tx.id}>
                    {index > 0 && <div className="mx-3 border-t" />}
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
        </>
      )}
    </div>
  );
}
