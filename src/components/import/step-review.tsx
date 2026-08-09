// Step 3: Review
// ==============
// Shows all parsed transactions with:
//   - Checkboxes to include/exclude rows
//   - Category dropdowns for each row
//   - Duplicate badges for rows already in the database
//   - Auto-detection of income vs expense based on amount sign
//
// On mount, this step:
//   1. Parses dates and amounts from the raw row data
//   2. Generates importRefs using occurrence counters (async, Web Crypto)
//   3. Checks duplicates via the API
//   4. Auto-unchecks duplicate rows

"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatAmount, formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  generateImportRef,
  buildOccurrenceCounters,
  getAmountString,
} from "@/lib/import-ref";
import { matchRule, type CategoryRuleInput } from "@/lib/category-rules";
import { parseDate, parseAmount } from "./step-review-utils";
import type { ImportState } from "./import-wizard";
import type { TransactionType, CategoryType } from "@/generated/prisma/client";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: CategoryType;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  reference?: string;
  type: TransactionType;
  importRef: string;
}

interface ReviewResult {
  selectedRows: boolean[];
  categoryIds: (string | undefined)[];
  transactionTypes: TransactionType[];
  importRefs: string[];
  duplicateRefs: Set<string>;
  friendlyNames: (string | undefined)[];
  notes: (string | undefined)[];
  needsReview: boolean[];
}

interface StepReviewProps {
  state: ImportState;
  onComplete: (result: ReviewResult) => void;
  onBack: () => void;
}

// ── ReviewRow ──────────────────────────────────────────────────────────────
// Memoized single-row component. React.memo does a shallow prop comparison:
// if none of this row's props changed, React skips re-rendering it entirely.
// This means typing in one row's input only re-renders that one row, not
// all 50–100 rows in the list.
//
// For memo to work, the callbacks passed as props must be stable (same
// reference across parent renders). We achieve that with useCallback +
// functional state updates (the `prev =>` form) in the parent below.

interface ReviewRowProps {
  index: number;
  row: ParsedRow;
  isDuplicate: boolean;
  isSelected: boolean;
  categoryId: string | undefined;
  autoApplied: boolean;
  transactionType: TransactionType;
  friendlyName: string | undefined;
  note: string | undefined;
  needsReview: boolean;
  parentCategories: Category[];
  childCategories: Category[];
  onSelectChange: (i: number, checked: boolean) => void;
  onTypeChange: (i: number, type: TransactionType) => void;
  onCategoryChange: (i: number, id: string | undefined) => void;
  onFriendlyNameChange: (i: number, value: string) => void;
  onNoteChange: (i: number, value: string) => void;
  onNeedsReviewChange: (i: number, checked: boolean) => void;
}

const ReviewRow = memo(function ReviewRow({
  index: i,
  row,
  isDuplicate,
  isSelected,
  categoryId,
  autoApplied,
  transactionType,
  friendlyName,
  note,
  needsReview,
  parentCategories,
  childCategories,
  onSelectChange,
  onTypeChange,
  onCategoryChange,
  onFriendlyNameChange,
  onNoteChange,
  onNeedsReviewChange,
}: Readonly<ReviewRowProps>) {
  const t = useTranslations("import");
  const locale = useLocale();
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 ${
        isDuplicate ? "opacity-50" : ""
      } ${isSelected ? "border-primary/30 bg-primary/5" : ""}`}
    >
      <Checkbox
        checked={isSelected}
        disabled={isDuplicate}
        onCheckedChange={(checked) => onSelectChange(i, !!checked)}
        className="mt-1"
      />

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatDate(row.date, "d MMM yyyy", locale)}</span>
          {isDuplicate && (
            <Badge variant="destructive" className="text-[10px]">
              {t("duplicateBadge")}
            </Badge>
          )}
          {autoApplied && (
            <Badge variant="secondary" className="text-[10px]">
              {t("autoBadge")}
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-medium">
          {row.description || "(no description)"}
        </p>

        <input
          type="text"
          placeholder={t("displayNamePlaceholder")}
          value={friendlyName ?? ""}
          onChange={(e) => onFriendlyNameChange(i, e.target.value)}
          className="h-6 w-full rounded border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground/50"
        />
        <input
          type="text"
          placeholder={t("notesPlaceholder")}
          value={note ?? ""}
          onChange={(e) => onNoteChange(i, e.target.value)}
          className="h-6 w-full rounded border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground/50"
        />

        <div className="flex items-center gap-2">
          <Checkbox
            id={`review-${i}`}
            checked={needsReview}
            onCheckedChange={(checked) => onNeedsReviewChange(i, !!checked)}
          />
          <label htmlFor={`review-${i}`} className="text-xs text-muted-foreground">
            {t("reviewCheckbox")}
          </label>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={transactionType}
            onValueChange={(v) => onTypeChange(i, v as TransactionType)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INCOME">{t("incomeBadge")}</SelectItem>
              <SelectItem value="EXPENSE">{t("expenseBadge")}</SelectItem>
              <SelectItem value="TRANSFER">{t("transferBadge")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Category picker — hidden for TRANSFER. Shows all categories:
              INCOME categories first (grouped), then EXPENSE below. */}
          {transactionType !== "TRANSFER" && (
          <div className="flex-1">
            <Select
              value={categoryId ?? "none"}
              onValueChange={(v) => onCategoryChange(i, v === "none" ? undefined : v)}
            >
              <SelectTrigger className="h-7 w-full text-xs">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("noCategoryOption")}</SelectItem>
                {[...parentCategories]
                  .sort((a, b) => (a.type === b.type ? 0 : a.type === "INCOME" ? -1 : 1))
                  .map((parent) => {
                    const children = childCategories.filter(
                      (c) => c.parentId === parent.id
                    );
                    if (children.length > 0) {
                      return (
                        <SelectGroup key={parent.id}>
                          <SelectLabel className="text-xs">{parent.name}</SelectLabel>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id} className="text-xs">
                              {child.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      );
                    }
                    return (
                      <SelectItem key={parent.id} value={parent.id} className="text-xs">
                        {parent.name}
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>
          </div>
          )}
        </div>
      </div>

      <span
        className={`whitespace-nowrap text-sm font-semibold ${
          row.amount >= 0 ? "text-green-600" : "text-red-600"
        }`}
      >
        {row.amount >= 0 ? "+" : "−"}
        {formatAmount(Math.abs(row.amount), locale)}
      </span>
    </div>
  );
});

// ── StepReview ─────────────────────────────────────────────────────────────

export function StepReview({ state, onComplete, onBack }: Readonly<StepReviewProps>) {
  const t = useTranslations("import");
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<boolean[]>([]);
  const [categoryIds, setCategoryIds] = useState<(string | undefined)[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<TransactionType[]>([]);
  const [duplicateRefs, setDuplicateRefs] = useState<Set<string>>(new Set());
  const [friendlyNames, setFriendlyNames] = useState<(string | undefined)[]>([]);
  const [notes, setNotes] = useState<(string | undefined)[]>([]);
  const [needsReview, setNeedsReview] = useState<boolean[]>([]);
  const [autoApplied, setAutoApplied] = useState<boolean[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<{ code: string; symbol: string } | null>(null);

  // Parse rows, generate importRefs, load categories, check duplicates
  useEffect(() => {
    async function init() {
      // Step 1: Parse rows and generate importRefs (async because of Web Crypto)
      const counters = buildOccurrenceCounters(state.rows, state.columnMap);

      const isSplitMode = state.columnMap.debitAmount !== undefined
        || state.columnMap.creditAmount !== undefined;

      const parsed: ParsedRow[] = await Promise.all(
        state.rows.map(async (row, i) => {
          const rawDate = row[state.columnMap.date] ?? "";
          const description = row[state.columnMap.description] ?? "";
          const reference = state.columnMap.reference === undefined
            ? undefined
            : row[state.columnMap.reference];

          const date = parseDate(rawDate, state.dateFormat);

          // Parse amount based on mode
          let amount: number;
          let type: CategoryType;

          if (isSplitMode) {
            // Split mode: separate Debit (expense) and Credit (income) columns
            const rawDebit = state.columnMap.debitAmount === undefined
              ? ""
              : (row[state.columnMap.debitAmount] ?? "").trim();
            const rawCredit = state.columnMap.creditAmount === undefined
              ? ""
              : (row[state.columnMap.creditAmount] ?? "").trim();

            if (rawDebit) {
              amount = -Math.abs(parseAmount(rawDebit));
              type = "EXPENSE";
            } else {
              amount = Math.abs(parseAmount(rawCredit));
              type = "INCOME";
            }
          } else {
            // Single column mode: sign determines type
            const rawAmount = state.columnMap.amount === undefined
              ? "0"
              : (row[state.columnMap.amount] ?? "0");
            amount = parseAmount(rawAmount);
            type = amount >= 0 ? "INCOME" : "EXPENSE";
          }

          // For the hash, use the raw amount string from the file
          const rawAmountForHash = getAmountString(row, state.columnMap);

          const importRef = await generateImportRef({
            accountId: state.accountId,
            date,
            description,
            amount: rawAmountForHash,
            reference,
            occurrenceCounter: counters[i],
          });

          return { date, description, amount, reference, type, importRef };
        })
      );

      setParsedRows(parsed);

      // Step 2: Load categories, auto-categorization rules, and the account
      // balance in parallel — all three are independent fetches.
      const [catRes, rulesRes, balancesRes] = await Promise.all([
        fetch("/api/categories"),
        fetch("/api/category-rules"),
        fetch("/api/accounts/balances"),
      ]);

      if (balancesRes.ok) {
        const balancesData = await balancesRes.json();
        const account = (balancesData.accounts ?? []).find(
          (a: { id: string; balance: number; currency: { code: string; symbol: string } }) =>
            a.id === state.accountId
        );
        if (account) {
          setCurrentBalance(account.balance);
          setAccountCurrency(account.currency);
        }
      }

      let loadedCategories: Category[] = [];
      let loadedRules: CategoryRuleInput[] = [];

      if (catRes.ok) {
        const catData = await catRes.json();
        loadedCategories = catData.data || catData;
        setCategories(loadedCategories);
      }
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        loadedRules = rulesData.data || [];
      }

      // Step 3: Check duplicates
      const refs = parsed.map((r) => r.importRef);
      let dupSet = new Set<string>();

      if (refs.length > 0) {
        const dupRes = await fetch("/api/import/check-duplicates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importRefs: refs }),
        });

        if (dupRes.ok) {
          const dupData = await dupRes.json();
          dupSet = new Set(dupData.data.duplicates);
        }
      }
      setDuplicateRefs(dupSet);

      // Step 4: Apply auto-categorization rules to pre-fill categories and display names.
      // Skip duplicates — they'll be unchecked anyway and matching them wastes effort.
      const matches = parsed.map((r) =>
        dupSet.has(r.importRef) ? undefined : matchRule(r.description, loadedRules)
      );

      // Step 5: Initialize selections
      setSelectedRows(parsed.map((r) => !dupSet.has(r.importRef)));
      setCategoryIds(matches.map((m) => m?.categoryId));
      setAutoApplied(matches.map((m) => m !== undefined));
      setTransactionTypes(parsed.map((r) => r.type));
      setFriendlyNames(matches.map((m) => m?.friendlyName ?? undefined));
      setNotes(new Array(parsed.length).fill(undefined));
      setNeedsReview(new Array(parsed.length).fill(false));
      setIsChecking(false);
    }
    init().catch((err) => {
      console.error("Import review init failed:", err);
      setError(err instanceof Error ? err.message : "Failed to process rows");
      setIsChecking(false);
    });
  // Run once when the component mounts — state props are stable references
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Category helpers — memoized so their array reference is stable across renders.
  // Without useMemo, .filter() produces a new array every render, which defeats
  // React.memo on ReviewRow (shallow prop comparison sees a new reference every time).
  const parentCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const childCategories = useMemo(() => categories.filter((c) => c.parentId), [categories]);

  const selectedCount = selectedRows.filter(Boolean).length;
  const duplicateCount = parsedRows.filter((r) =>
    duplicateRefs.has(r.importRef)
  ).length;

  // Net change from the selected rows, using the (possibly user-overridden)
  // transaction type to determine direction. Recomputes whenever the user
  // selects/deselects rows or flips a type dropdown.
  const netChange = useMemo(() => {
    return parsedRows.reduce((sum, row, i) => {
      if (!selectedRows[i]) return sum;
      const abs = Math.abs(row.amount);
      // TRANSFER transactions are neutral — excluded from the net change display
      if (transactionTypes[i] === "TRANSFER") return sum;
      return transactionTypes[i] === "INCOME" ? sum + abs : sum - abs;
    }, 0);
  }, [parsedRows, selectedRows, transactionTypes]);

  function toggleAll(checked: boolean) {
    setSelectedRows(
      parsedRows.map((r) =>
        checked ? !duplicateRefs.has(r.importRef) : false
      )
    );
  }

  // Stable callbacks — created once, never change reference.
  // Using the functional `prev =>` form of each setter means the callback
  // doesn't need to close over the current array value, so useCallback
  // can use an empty dependency array and return the same function every render.
  // ReviewRow's memo comparison then sees the same prop reference → no re-render.
  const handleSelectChange = useCallback((i: number, checked: boolean) => {
    setSelectedRows((prev) => { const n = [...prev]; n[i] = checked; return n; });
  }, []);

  const handleTypeChange = useCallback((i: number, type: TransactionType) => {
    setTransactionTypes((prev) => { const n = [...prev]; n[i] = type; return n; });
  }, []);

  const handleCategoryChange = useCallback((i: number, id: string | undefined) => {
    setCategoryIds((prev) => { const n = [...prev]; n[i] = id; return n; });
    setAutoApplied((prev) => { const n = [...prev]; n[i] = false; return n; });
  }, []);

  const handleFriendlyNameChange = useCallback((i: number, value: string) => {
    setFriendlyNames((prev) => { const n = [...prev]; n[i] = value || undefined; return n; });
  }, []);

  const handleNoteChange = useCallback((i: number, value: string) => {
    setNotes((prev) => { const n = [...prev]; n[i] = value || undefined; return n; });
  }, []);

  const handleNeedsReviewChange = useCallback((i: number, checked: boolean) => {
    setNeedsReview((prev) => { const n = [...prev]; n[i] = checked; return n; });
  }, []);

  if (isChecking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          {t("checkingDuplicates")}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="space-y-4 py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        {/* Summary bar */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{t("totalRows", { count: parsedRows.length })}</Badge>
          <Badge variant="secondary">{t("selectedRows", { count: selectedCount })}</Badge>
          {duplicateCount > 0 && (
            <Badge variant="destructive">{t("duplicateRows", { count: duplicateCount })}</Badge>
          )}
        </div>

        {/* Balance preview — only shown once the account balance has loaded.
            netChange recomputes live as the user selects rows or changes types. */}
        {currentBalance !== null && accountCurrency && (
          <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/40 p-3 text-center text-xs">
            <div>
              <p className="text-muted-foreground">{t("balanceCurrent")}</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {accountCurrency.symbol}{formatAmount(currentBalance, locale)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("balanceChange")}</p>
              <p className={`mt-0.5 font-semibold tabular-nums ${netChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {netChange >= 0 ? "+" : "−"}{accountCurrency.symbol}{formatAmount(Math.abs(netChange), locale)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("balanceAfter")}</p>
              <p className="mt-0.5 font-semibold tabular-nums">
                {accountCurrency.symbol}{formatAmount(currentBalance + netChange, locale)}
              </p>
            </div>
          </div>
        )}

        {/* Select all checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectedCount === parsedRows.length - duplicateCount && selectedCount > 0}
            onCheckedChange={(checked) => toggleAll(!!checked)}
          />
          <label htmlFor="select-all" className="text-sm">
            {t("selectAllNonDuplicate")}
          </label>
        </div>

        {/* Transaction rows */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {parsedRows.map((row, i) => (
            <ReviewRow
              key={row.importRef}
              index={i}
              row={row}
              isDuplicate={duplicateRefs.has(row.importRef)}
              isSelected={selectedRows[i] || false}
              categoryId={categoryIds[i]}
              autoApplied={autoApplied[i] || false}
              transactionType={transactionTypes[i]}
              friendlyName={friendlyNames[i]}
              note={notes[i]}
              needsReview={needsReview[i] || false}
              parentCategories={parentCategories}
              childCategories={childCategories}
              onSelectChange={handleSelectChange}
              onTypeChange={handleTypeChange}
              onCategoryChange={handleCategoryChange}
              onFriendlyNameChange={handleFriendlyNameChange}
              onNoteChange={handleNoteChange}
              onNeedsReviewChange={handleNeedsReviewChange}
            />
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={() =>
              onComplete({
                selectedRows,
                categoryIds,
                transactionTypes,
                importRefs: parsedRows.map((r) => r.importRef),
                duplicateRefs,
                friendlyNames,
                notes,
                needsReview,
              })
            }
            disabled={selectedCount === 0}
            className="flex-1"
          >
            {t("nextConfirm", { count: selectedCount })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
