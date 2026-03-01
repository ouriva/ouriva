// Transaction List
// ================
// Displays transactions grouped by date with filtering, search, and
// "load more" pagination. All filter state lives in URL search params
// so filters survive navigation.
//
// Key design decisions:
//   - Sticky filter bar: search + tabs + chips stay visible while scrolling
//   - Active filter chips: each active filter shown as a dismissable pill
//   - Date group headers: "Today" / "Yesterday" / "Tue, Mar 5" + day net total
//   - Load more: accumulates pages in local state instead of replacing
//   - Skeleton loading: matches the actual list shape to prevent layout shift

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TransactionCard } from "./transaction-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { cn } from "@/lib/utils";
import {
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { TransactionWithRelations } from "@/hooks/use-transactions";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Format a date key (YYYY-MM-DD) into a human-readable group header label.
// Recent dates use relative labels; older ones use the full date.
function formatGroupDate(dateKey: string): string {
  // Parse as local midnight to avoid UTC offset shifting the day
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return "Today";
  if (date.getTime() === yesterday.getTime()) return "Yesterday";

  const daysDiff = (today.getTime() - date.getTime()) / 86_400_000;
  if (daysDiff < 7) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TransactionListSkeleton() {
  return (
    <div className="space-y-5">
      {[3, 2].map((rowCount, gi) => (
        <div key={gi}>
          {/* Date header skeleton */}
          <Skeleton className="mb-2 h-3.5 w-28" />
          {/* Card skeleton */}
          <div className="rounded-lg border bg-card">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div key={i}>
                {i > 0 && <div className="mx-3 border-t" />}
                <div className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 flex-none rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-3.5 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Filter Chip ─────────────────────────────────────────────────────────────

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionList() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read all filter state from URL — URL is the single source of truth
  const type = searchParams.get("type") || undefined;
  const accountId = searchParams.get("accountId") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  const needsReview = searchParams.get("needsReview") === "true";
  const urlSearch = searchParams.get("search") || "";

  // Local state for the search input (debounced to URL after 300ms)
  const [search, setSearch] = useState(urlSearch);

  // Expand the filter panel automatically if any collapsible filter is set
  const [showFilters, setShowFilters] = useState(
    Boolean(accountId || categoryId || startDate || endDate || needsReview)
  );

  // Reference data for filter dropdowns
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Transaction data — accumulated across pages for "load more"
  const [allTransactions, setAllTransactions] = useState<TransactionWithRelations[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadedPage, setLoadedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Filter param helper ─────────────────────────────────────────────────
  // updateParams rebuilds the URL search params with the given changes.
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
      if (resetPage) params.delete("page");
      router.push(`/transactions?${params.toString()}`);
    },
    [searchParams, router]
  );

  // ── Load filter dropdowns ───────────────────────────────────────────────
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

  // ── Search debounce ─────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentUrlSearch = searchParams.get("search") || "";
      if (search !== currentUrlSearch) {
        const params = new URLSearchParams(searchParams.toString());
        if (search) params.set("search", search);
        else params.delete("search");
        params.delete("page");
        router.replace(`/transactions?${params.toString()}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, router]);

  // ── Build filter query string ────────────────────────────────────────────
  // Memoised so the string reference is stable when nothing changed.
  // This is the key that identifies a unique filter combination —
  // when it changes, we reset to page 1 and clear the accumulated list.
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (urlSearch) params.set("search", urlSearch);
    if (type) params.set("type", type);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (needsReview) params.set("needsReview", "true");
    return params.toString();
  }, [urlSearch, type, accountId, categoryId, startDate, endDate, needsReview]);

  // ── Fetch transactions ──────────────────────────────────────────────────
  // fetchPage fetches a single page and either replaces or appends the list.
  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (append) setIsLoadingMore(true);
      else { setIsLoading(true); setError(null); }

      try {
        const url = `/api/transactions?${filterParams}&page=${page}`;
        const res = await fetch(url);
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || "Failed to fetch");
        }
        const result = await res.json();

        if (append) {
          setAllTransactions((prev) => [...prev, ...result.data]);
        } else {
          setAllTransactions(result.data);
          setLoadedPage(1);
        }
        setPagination(result.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (append) setIsLoadingMore(false);
        else setIsLoading(false);
      }
    },
    [filterParams]
  );

  // When filters change, reset and fetch page 1.
  // fetchPage is stable while filterParams is unchanged, so this only
  // runs when the actual filter values change.
  useEffect(() => {
    setAllTransactions([]);
    fetchPage(1, false);
  }, [fetchPage]);

  async function loadMore() {
    const nextPage = loadedPage + 1;
    setLoadedPage(nextPage);
    await fetchPage(nextPage, true);
  }

  // ── Derived UI data ─────────────────────────────────────────────────────

  const activeFilterCount = [accountId, categoryId, startDate, endDate, needsReview].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    router.push("/transactions");
  }

  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  // Group transactions by date key (YYYY-MM-DD)
  const grouped = allTransactions.reduce<Record<string, typeof allTransactions>>(
    (acc, tx) => {
      const key = tx.date.split("T")[0];
      if (!acc[key]) acc[key] = [];
      acc[key].push(tx);
      return acc;
    },
    {}
  );
  const sortedDates = Object.keys(grouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  const hasMore = pagination ? loadedPage < pagination.totalPages : false;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Sticky filter bar ────────────────────────────────────────────── */}
      {/* -mx-4 px-4: expand to screen edges so the bg covers the layout padding.
          backdrop-blur + bg-background/95: frosted glass while scrolling. */}
      <div className="sticky top-0 z-10 -mx-4 space-y-3 bg-background/95 px-4 pt-3 pb-3 backdrop-blur-sm">

        {/* Search */}
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

        {/* Active filter chips — only shown when collapsible filters are active */}
        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {accountId && (
              <FilterChip
                label={accounts.find((a) => a.id === accountId)?.name ?? "Account"}
                onRemove={() => updateParams({ accountId: undefined })}
              />
            )}
            {categoryId && categoryId !== "uncategorized" && (
              <FilterChip
                label={categories.find((c) => c.id === categoryId)?.name ?? "Category"}
                onRemove={() => updateParams({ categoryId: undefined })}
              />
            )}
            {categoryId === "uncategorized" && (
              <FilterChip
                label="Uncategorized"
                onRemove={() => updateParams({ categoryId: undefined })}
              />
            )}
            {startDate && (
              <FilterChip
                label={`From ${startDate}`}
                onRemove={() => updateParams({ startDate: undefined })}
              />
            )}
            {endDate && (
              <FilterChip
                label={`To ${endDate}`}
                onRemove={() => updateParams({ endDate: undefined })}
              />
            )}
            {needsReview && (
              <FilterChip
                label="Needs review"
                onRemove={() => updateParams({ needsReview: undefined })}
              />
            )}
          </div>
        )}

        {/* Filters toggle + clear */}
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
      </div>

      {/* ── Collapsible filter panel (not sticky — expands in normal flow) ── */}
      {showFilters && (
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
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
                  const children = childCategories.filter((c) => c.parentId === parent.id);
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

          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox
              id="needsReviewFilter"
              checked={needsReview}
              onCheckedChange={(checked) =>
                updateParams({ needsReview: checked === true ? "true" : undefined })
              }
            />
            <Label
              htmlFor="needsReviewFilter"
              className="cursor-pointer text-xs font-medium text-muted-foreground"
            >
              Needs review only
            </Label>
          </div>
        </div>
      )}

      {/* ── Transaction list ─────────────────────────────────────────────── */}
      {isLoading ? (
        <TransactionListSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          {error}
        </div>
      ) : allTransactions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          No transactions found
        </div>
      ) : (
        <div className="space-y-5">
          {sortedDates.map((dateKey) => {
            const txs = grouped[dateKey];

            // Compute the net total for the day to show in the header.
            // Income is positive, expenses negative — same sign convention
            // as the individual amounts in the cards.
            const dayNet = txs.reduce((sum, tx) => {
              const amount = parseFloat(tx.amount);
              return tx.type === "INCOME" ? sum + amount : sum - amount;
            }, 0);

            return (
              <div key={dateKey}>
                {/* Date group header: label on left, day net on right */}
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {formatGroupDate(dateKey)}
                  </h3>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      dayNet >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                    )}
                  >
                    {dayNet >= 0 ? "+" : "−"}
                    {Math.abs(dayNet).toFixed(2)}
                  </span>
                </div>

                {/* Transactions for this date inside a single rounded card */}
                <div className="rounded-lg border bg-card">
                  {txs.map((tx, index) => (
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
            );
          })}

          {/* Load more / end of list */}
          {hasMore ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load more"
              )}
            </Button>
          ) : (
            <p className="py-2 text-center text-xs text-muted-foreground">
              {allTransactions.length === 1
                ? "1 transaction"
                : `${allTransactions.length} transactions`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
