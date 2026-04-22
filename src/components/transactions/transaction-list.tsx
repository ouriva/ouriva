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

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Download,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { TransactionWithRelations } from "@/hooks/use-transactions";
import { useTranslations, useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";

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
function formatGroupDate(dateKey: string, locale: string, todayLabel: string, yesterdayLabel: string): string {
  // Parse as local midnight to avoid UTC offset shifting the day
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.getTime() === today.getTime()) return todayLabel;
  if (date.getTime() === yesterday.getTime()) return yesterdayLabel;

  const intlLocale = locale === "pt" ? "pt-PT" : "en-US";
  return date.toLocaleDateString(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function TransactionListSkeleton() {
  return (
    <div className="space-y-5">
      {[3, 2].map((rowCount, gi) => (
        <div key={`skeleton-group-${gi}`}>
          {/* Date header skeleton */}
          <Skeleton className="mb-2 h-3.5 w-28" />
          {/* Card skeleton */}
          <div className="rounded-lg border bg-card">
            {Array.from({ length: rowCount }).map((_, i) => (
              <div key={`skeleton-row-${gi}-${i}`}>
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
  ariaLabel,
  onRemove,
}: {
  label: string;
  ariaLabel?: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 rounded-full text-muted-foreground hover:text-foreground"
        aria-label={ariaLabel ?? `Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Module-scope helpers ─────────────────────────────────────────────────────

// Builds a stable URLSearchParams string from the current filter state.
// Extracted to module scope so the useMemo wrapper in TransactionList
// doesn't need to house control flow, reducing cognitive complexity.
function buildFilterParams(
  urlSearch: string,
  type: string | undefined,
  accountId: string | undefined,
  categoryId: string | undefined,
  startDate: string,
  endDate: string,
  needsReview: boolean
): string {
  const params = new URLSearchParams();
  if (urlSearch) params.set("search", urlSearch);
  if (type) params.set("type", type);
  if (accountId) params.set("accountId", accountId);
  if (categoryId) params.set("categoryId", categoryId);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (needsReview) params.set("needsReview", "true");
  return params.toString();
}

// Builds the CSV export URL from the current filter state.
function buildExportUrl(
  type: string | undefined,
  accountId: string | undefined,
  categoryId: string | undefined,
  startDate: string,
  endDate: string,
  needsReview: boolean,
  urlSearch: string
): string {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  if (accountId) params.set("accountId", accountId);
  if (categoryId) params.set("categoryId", categoryId);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  if (needsReview) params.set("needsReview", "true");
  if (urlSearch) params.set("search", urlSearch);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  return `/api/transactions/export${suffix}`;
}

// Groups transactions by their date key (YYYY-MM-DD) and returns sorted keys.
function groupByDate(transactions: TransactionWithRelations[]): {
  grouped: Record<string, TransactionWithRelations[]>;
  sortedDates: string[];
} {
  const grouped = transactions.reduce<Record<string, TransactionWithRelations[]>>(
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
  return { grouped, sortedDates };
}

// Applies a map of key→value updates to an existing URLSearchParams string,
// optionally resetting the page. Returns the new params string.
// Extracted to module scope to simplify the updateParams callback inside
// TransactionList (reduces cognitive complexity, S3776).
function applyParamUpdates(
  current: string,
  updates: Record<string, string | undefined>,
  resetPage: boolean
): string {
  const params = new URLSearchParams(current);
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  }
  if (resetPage) params.delete("page");
  return params.toString();
}

// ─── Search debounce hook ────────────────────────────────────────────────────
// Syncs the local search input value to the URL with a 300ms delay. Extracted
// from TransactionList: the setTimeout callback adds two levels of function
// nesting (useEffect arrow → setTimeout arrow), making the inner if/else a
// significant contributor to cognitive complexity (S3776).

function useSearchDebounce(
  search: string,
  searchParams: ReturnType<typeof useSearchParams>,
  router: ReturnType<typeof useRouter>
) {
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
}

// ─── Active filter chips ──────────────────────────────────────────────────────
// Renders the row of dismissable filter pills when any collapsible filter is
// active. Each chip maps to one active filter. Extracted from TransactionList
// to reduce cognitive complexity (S3776): the outer && plus six inner &&
// operators each add to the parent component's score.

interface ActiveFilterChipsProps {
  accountId: string | undefined;
  categoryId: string | undefined;
  startDate: string;
  endDate: string;
  needsReview: boolean;
  accounts: Account[];
  categories: Category[];
  onRemove: (updates: Record<string, string | undefined>) => void;
}

function ActiveFilterChips({
  accountId, categoryId, startDate, endDate, needsReview,
  accounts, categories, onRemove,
}: Readonly<ActiveFilterChipsProps>) {
  const t = useTranslations("transactions");
  const count = [accountId, categoryId, startDate, endDate, needsReview].filter(Boolean).length;
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {accountId && (
        <FilterChip
          label={accounts.find((a) => a.id === accountId)?.name ?? t("filterAccount")}
          ariaLabel={t("removeFilter", { label: accounts.find((a) => a.id === accountId)?.name ?? t("filterAccount") })}
          onRemove={() => onRemove({ accountId: undefined })}
        />
      )}
      {categoryId && categoryId !== "uncategorized" && (
        <FilterChip
          label={categories.find((c) => c.id === categoryId)?.name ?? t("filterCategory")}
          ariaLabel={t("removeFilter", { label: categories.find((c) => c.id === categoryId)?.name ?? t("filterCategory") })}
          onRemove={() => onRemove({ categoryId: undefined })}
        />
      )}
      {categoryId === "uncategorized" && (
        <FilterChip
          label={t("uncategorized")}
          ariaLabel={t("removeFilter", { label: t("uncategorized") })}
          onRemove={() => onRemove({ categoryId: undefined })}
        />
      )}
      {startDate && (
        <FilterChip
          label={`${t("filterFrom")} ${startDate}`}
          ariaLabel={t("removeFilter", { label: `${t("filterFrom")} ${startDate}` })}
          onRemove={() => onRemove({ startDate: undefined })}
        />
      )}
      {endDate && (
        <FilterChip
          label={`${t("filterTo")} ${endDate}`}
          ariaLabel={t("removeFilter", { label: `${t("filterTo")} ${endDate}` })}
          onRemove={() => onRemove({ endDate: undefined })}
        />
      )}
      {needsReview && (
        <FilterChip
          label={t("needsReviewOnly")}
          ariaLabel={t("removeFilter", { label: t("needsReviewOnly") })}
          onRemove={() => onRemove({ needsReview: undefined })}
        />
      )}
    </div>
  );
}

// ─── Transaction data hook ───────────────────────────────────────────────────
// Manages fetching, pagination, and load-more for the transaction list.
// Extracted from TransactionList to reduce cognitive complexity (S3776):
// fetchPage contains the bulk of the branching logic.

function useTransactionData(filterParams: string) {
  const [allTransactions, setAllTransactions] = useState<TransactionWithRelations[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loadedPage, setLoadedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    setAllTransactions([]);
    fetchPage(1, false);
  }, [fetchPage]);

  async function loadMore() {
    const nextPage = loadedPage + 1;
    setLoadedPage(nextPage);
    await fetchPage(nextPage, true);
  }

  const hasMore = pagination ? loadedPage < pagination.totalPages : false;

  return { allTransactions, isLoading, isLoadingMore, error, loadMore, hasMore };
}

// ─── Transaction list content ────────────────────────────────────────────────
// Renders the result of a transaction fetch: skeleton, error, empty state, or
// the actual list. Extracted from TransactionList to eliminate the deeply nested
// ternary chain (isLoading ? error ? empty ? list) which, combined with the
// hasMore/isLoadingMore ternaries inside, pushed cognitive complexity to 21.
//
// Early returns replace nested ternaries, so hasMore ? sits at nesting depth 0
// instead of depth 3. This brings the sub-component to complexity ~8 and leaves
// TransactionList itself with a single complexity point (S3776 fix).

interface TransactionListContentProps {
  isLoading: boolean;
  error: string | null;
  allTransactions: TransactionWithRelations[];
  sortedDates: string[];
  grouped: Record<string, TransactionWithRelations[]>;
  isLoadingMore: boolean;
  hasMore: boolean;
  loadMore: () => void;
  locale: string;
}

function TransactionListContent({
  isLoading,
  error,
  allTransactions,
  sortedDates,
  grouped,
  isLoadingMore,
  hasMore,
  loadMore,
  locale,
}: Readonly<TransactionListContentProps>) {
  const t = useTranslations("transactions");
  const tCommon = useTranslations("common");
  const router = useRouter();

  if (isLoading) return <TransactionListSkeleton />;

  if (error)
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        {error}
      </div>
    );

  if (allTransactions.length === 0)
    return (
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        {t("noTransactionsFound")}
      </div>
    );

  return (
    <div className="space-y-5">
      {sortedDates.map((dateKey) => {
        const txs = grouped[dateKey];
        const dayNet = txs.reduce((sum, tx) => {
          const amount = Number.parseFloat(tx.amount);
          return tx.type === "INCOME" ? sum + amount : sum - amount;
        }, 0);
        return (
          <div key={dateKey}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {formatGroupDate(dateKey, locale, tCommon("today"), tCommon("yesterday"))}
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
                {formatAmount(Math.abs(dayNet), locale)}
              </span>
            </div>
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
              {t("loadMore")}
            </>
          ) : (
            t("loadMore")
          )}
        </Button>
      ) : (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {allTransactions.length === 1
            ? t("countSingle")
            : t("countPlural", { count: allTransactions.length })}
        </p>
      )}
    </div>
  );
}

// ─── Filter dropdowns hook ────────────────────────────────────────────────────
// Fetches the accounts and categories lists once on mount so the filter
// panel dropdowns are populated. Extracted to reduce cognitive complexity
// in TransactionList (S3776).

function useFilterDropdowns() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

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

  return { accounts, categories };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TransactionList() {
  const t = useTranslations("transactions");
  const locale = useLocale();
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
  const { accounts, categories } = useFilterDropdowns();

  // ── Filter param helper ─────────────────────────────────────────────────
  // updateParams rebuilds the URL search params with the given changes.
  const updateParams = useCallback(
    (updates: Record<string, string | undefined>, resetPage = true) => {
      const qs = applyParamUpdates(searchParams.toString(), updates, resetPage);
      router.push(`/transactions?${qs}`);
    },
    [searchParams, router]
  );

  // ── Search debounce ─────────────────────────────────────────────────────
  useSearchDebounce(search, searchParams, router);

  // ── Build filter query string ────────────────────────────────────────────
  const filterParams = useMemo(
    () => buildFilterParams(urlSearch, type, accountId, categoryId, startDate, endDate, needsReview),
    [urlSearch, type, accountId, categoryId, startDate, endDate, needsReview]
  );

  // ── Transaction data ─────────────────────────────────────────────────────
  const { allTransactions, isLoading, isLoadingMore, error, loadMore, hasMore } = useTransactionData(filterParams);

  // ── Derived UI data ─────────────────────────────────────────────────────

  const activeFilterCount = [accountId, categoryId, startDate, endDate, needsReview].filter(Boolean).length;

  const exportUrl = useMemo(
    () => buildExportUrl(type, accountId, categoryId, startDate, endDate, needsReview, urlSearch),
    [type, accountId, categoryId, startDate, endDate, needsReview, urlSearch]
  );

  function clearFilters() {
    setSearch("");
    router.push("/transactions");
  }

  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  const { grouped, sortedDates } = groupByDate(allTransactions);

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
            placeholder={t("searchPlaceholder")}
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
            <TabsTrigger value="ALL">{t("tabAll")}</TabsTrigger>
            <TabsTrigger value="INCOME">{t("tabIncome")}</TabsTrigger>
            <TabsTrigger value="EXPENSE">{t("tabExpense")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Active filter chips — only shown when collapsible filters are active */}
        <ActiveFilterChips
          accountId={accountId}
          categoryId={categoryId}
          startDate={startDate}
          endDate={endDate}
          needsReview={needsReview}
          accounts={accounts}
          categories={categories}
          onRemove={updateParams}
        />

        {/* Filters toggle + clear + export */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            {t("filtersButton")}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          {(activeFilterCount > 0 || search || type) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="mr-1 h-3 w-3" />
              {t("clearAll")}
            </Button>
          )}
          <a href={exportUrl} download aria-label={t("exportAriaLabel")} className="ml-auto">
            <Button variant="ghost" size="sm">
              <Download className="mr-2 h-4 w-4" />
              {t("exportButton")}
            </Button>
          </a>
        </div>
      </div>

      {/* ── Collapsible filter panel (not sticky — expands in normal flow) ── */}
      {showFilters && (
        <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              {t("filterAccount")}
            </label>
            <Select
              value={accountId || "all"}
              onValueChange={(v) => updateParams({ accountId: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t("allAccounts")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allAccounts")}</SelectItem>
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
              {t("filterCategory")}
            </label>
            <Select
              value={categoryId || "all"}
              onValueChange={(v) => updateParams({ categoryId: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={t("allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                <SelectItem value="uncategorized">{t("uncategorized")}</SelectItem>
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
              {t("filterFrom")}
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
              {t("filterTo")}
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
              {t("needsReviewOnly")}
            </Label>
          </div>
        </div>
      )}

      {/* ── Transaction list ─────────────────────────────────────────────── */}
      <TransactionListContent
        isLoading={isLoading}
        error={error}
        allTransactions={allTransactions}
        sortedDates={sortedDates}
        grouped={grouped}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        loadMore={loadMore}
        locale={locale}
      />
    </div>
  );
}
