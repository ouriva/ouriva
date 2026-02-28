// Transaction List
// ================
// Displays transactions grouped by date with filtering and search.
// Filter controls sit above the list:
//   1. Search bar — always visible, debounced (300ms)
//   2. Type tabs — All | Income | Expense
//   3. Collapsible "Filters" section — account, category, date range, review
//
// Filter state lives in URL search params (not React state).
// This means filters survive navigation — when you edit a transaction
// and come back, your filters are preserved in the URL.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

export function TransactionList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Read filter state from URL search params ---
  // The URL is the source of truth for all filters.
  const page = parseInt(searchParams.get("page") || "1");
  const type = searchParams.get("type") || undefined;
  const accountId = searchParams.get("accountId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const needsReview = searchParams.get("needsReview") === "true";
  const urlSearch = searchParams.get("search") || "";

  // Search input uses local state for responsive typing.
  // The debounced value syncs to the URL after 300ms.
  const [search, setSearch] = useState(urlSearch);

  // Auto-open filters panel if any collapsible filter is active
  const [showFilters, setShowFilters] = useState(
    Boolean(accountId || categoryId || startDate || endDate || needsReview)
  );

  // --- Reference data for filter dropdowns ---
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Helper: update URL search params.
  // Resets page to 1 by default (most filter changes should reset pagination).
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });

      if (resetPage) {
        params.delete("page");
      }

      router.push(`/transactions?${params.toString()}`);
    },
    [searchParams, router]
  );

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

  // Debounce search — sync to URL after 300ms of inactivity.
  // Uses router.replace to avoid cluttering browser history with
  // a new entry for every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentUrlSearch = searchParams.get("search") || "";
      if (search !== currentUrlSearch) {
        const params = new URLSearchParams(searchParams.toString());
        if (search) {
          params.set("search", search);
        } else {
          params.delete("search");
        }
        params.delete("page");
        router.replace(`/transactions?${params.toString()}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, router]);

  // Build the filter object passed to the hook.
  // Uses the URL values (not local search state) as the source of truth.
  const filters: Partial<TransactionQuery> = {
    page,
    ...(urlSearch && { search: urlSearch }),
    ...(type && { type: type as TransactionQuery["type"] }),
    ...(accountId && { accountId }),
    ...(categoryId && { categoryId }),
    ...(startDate && { startDate: new Date(startDate) }),
    ...(endDate && { endDate: new Date(endDate) }),
    ...(needsReview && { needsReview: true }),
  };

  const { transactions, pagination, isLoading, error } = useTransactions(filters);

  // Count active filters (excluding search and type tabs)
  const activeFilterCount = [accountId, categoryId, startDate, endDate, needsReview].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    router.push("/transactions");
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
          onValueChange={(v) => updateParams({ type: v === "ALL" ? undefined : v })}
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
                onValueChange={(v) => updateParams({ accountId: v === "all" ? undefined : v })}
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
                onValueChange={(v) => updateParams({ categoryId: v === "all" ? undefined : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="uncategorized">Uncategorized</SelectItem>
                  {parentCategories.map((parent) => {
                    const children = childCategories.filter(
                      (c) => c.parentId === parent.id
                    );
                    if (children.length > 0) {
                      return (
                        <SelectGroup key={parent.id}>
                          <SelectLabel>{parent.name}</SelectLabel>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id}>
                              {child.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
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
                onChange={(e) => updateParams({ startDate: e.target.value || undefined })}
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
                onChange={(e) => updateParams({ endDate: e.target.value || undefined })}
                className="h-8 text-xs"
              />
            </div>

            {/* Needs review filter */}
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox
                id="needsReviewFilter"
                checked={needsReview}
                onCheckedChange={(checked) =>
                  updateParams({ needsReview: checked === true ? "true" : undefined })
                }
              />
              <Label htmlFor="needsReviewFilter" className="cursor-pointer text-xs font-medium text-muted-foreground">
                Needs review only
              </Label>
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
                onClick={() => updateParams({ page: String(Math.max(1, page - 1)) }, false)}
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
                onClick={() => updateParams({ page: String(page + 1) }, false)}
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
