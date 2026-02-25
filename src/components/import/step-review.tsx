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

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
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
import { parseDate, parseAmount } from "./step-review-utils";
import type { ImportState } from "./import-wizard";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  reference?: string;
  type: "INCOME" | "EXPENSE";
  importRef: string;
}

interface StepReviewProps {
  state: ImportState;
  onComplete: (
    selectedRows: boolean[],
    categoryIds: (string | undefined)[],
    transactionTypes: ("INCOME" | "EXPENSE")[],
    importRefs: string[],
    duplicateRefs: Set<string>,
    friendlyNames: (string | undefined)[],
    notes: (string | undefined)[],
    needsReview: boolean[]
  ) => void;
  onBack: () => void;
}

export function StepReview({ state, onComplete, onBack }: StepReviewProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [selectedRows, setSelectedRows] = useState<boolean[]>([]);
  const [categoryIds, setCategoryIds] = useState<(string | undefined)[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<("INCOME" | "EXPENSE")[]>([]);
  const [duplicateRefs, setDuplicateRefs] = useState<Set<string>>(new Set());
  const [friendlyNames, setFriendlyNames] = useState<(string | undefined)[]>([]);
  const [notes, setNotes] = useState<(string | undefined)[]>([]);
  const [needsReview, setNeedsReview] = useState<boolean[]>([]);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          const reference = state.columnMap.reference !== undefined
            ? row[state.columnMap.reference]
            : undefined;

          const date = parseDate(rawDate, state.dateFormat);

          // Parse amount based on mode
          let amount: number;
          let type: "INCOME" | "EXPENSE";

          if (isSplitMode) {
            // Split mode: separate Debit (expense) and Credit (income) columns
            const rawDebit = state.columnMap.debitAmount !== undefined
              ? (row[state.columnMap.debitAmount] ?? "").trim()
              : "";
            const rawCredit = state.columnMap.creditAmount !== undefined
              ? (row[state.columnMap.creditAmount] ?? "").trim()
              : "";

            if (rawDebit) {
              amount = -Math.abs(parseAmount(rawDebit));
              type = "EXPENSE";
            } else {
              amount = Math.abs(parseAmount(rawCredit));
              type = "INCOME";
            }
          } else {
            // Single column mode: sign determines type
            const rawAmount = state.columnMap.amount !== undefined
              ? (row[state.columnMap.amount] ?? "0")
              : "0";
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

      // Step 2: Load categories
      const catRes = await fetch("/api/categories");
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.data || catData);
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

      // Step 4: Initialize selections
      setSelectedRows(parsed.map((r) => !dupSet.has(r.importRef)));
      setCategoryIds(new Array(parsed.length).fill(undefined));
      setTransactionTypes(parsed.map((r) => r.type));
      setFriendlyNames(new Array(parsed.length).fill(undefined));
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

  // Category helpers
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

  const selectedCount = selectedRows.filter(Boolean).length;
  const duplicateCount = parsedRows.filter((r) =>
    duplicateRefs.has(r.importRef)
  ).length;

  function toggleAll(checked: boolean) {
    setSelectedRows(
      parsedRows.map((r) =>
        checked ? !duplicateRefs.has(r.importRef) : false
      )
    );
  }

  if (isChecking) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Checking for duplicates...
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
      <CardContent className="space-y-4 pt-6">
        {/* Summary bar */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="outline">{parsedRows.length} total rows</Badge>
          <Badge variant="secondary">{selectedCount} selected</Badge>
          {duplicateCount > 0 && (
            <Badge variant="destructive">{duplicateCount} duplicates</Badge>
          )}
        </div>

        {/* Select all checkbox */}
        <div className="flex items-center gap-2">
          <Checkbox
            id="select-all"
            checked={selectedCount === parsedRows.length - duplicateCount && selectedCount > 0}
            onCheckedChange={(checked) => toggleAll(!!checked)}
          />
          <label htmlFor="select-all" className="text-sm">
            Select all non-duplicate rows
          </label>
        </div>

        {/* Transaction rows */}
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {parsedRows.map((row, i) => {
            const isDuplicate = duplicateRefs.has(row.importRef);

            return (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  isDuplicate ? "opacity-50" : ""
                } ${selectedRows[i] ? "border-primary/30 bg-primary/5" : ""}`}
              >
                {/* Checkbox */}
                <Checkbox
                  checked={selectedRows[i] || false}
                  disabled={isDuplicate}
                  onCheckedChange={(checked) => {
                    const next = [...selectedRows];
                    next[i] = !!checked;
                    setSelectedRows(next);
                  }}
                  className="mt-1"
                />

                {/* Transaction info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {row.date}
                    </span>
                    {isDuplicate && (
                      <Badge variant="destructive" className="text-[10px]">
                        Duplicate
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm font-medium">
                    {row.description || "(no description)"}
                  </p>
                  {/* Inline edit: friendly name and notes */}
                  <input
                    type="text"
                    placeholder="Display name (optional)"
                    value={friendlyNames[i] ?? ""}
                    onChange={(e) => {
                      const next = [...friendlyNames];
                      next[i] = e.target.value || undefined;
                      setFriendlyNames(next);
                    }}
                    className="h-6 w-full rounded border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground/50"
                  />
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={notes[i] ?? ""}
                    onChange={(e) => {
                      const next = [...notes];
                      next[i] = e.target.value || undefined;
                      setNotes(next);
                    }}
                    className="h-6 w-full rounded border border-input bg-transparent px-2 text-xs placeholder:text-muted-foreground/50"
                  />
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`review-${i}`}
                      checked={needsReview[i] || false}
                      onCheckedChange={(checked) => {
                        const next = [...needsReview];
                        next[i] = !!checked;
                        setNeedsReview(next);
                      }}
                    />
                    <label htmlFor={`review-${i}`} className="text-xs text-muted-foreground">
                      Review
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Type toggle */}
                    <Select
                      value={transactionTypes[i]}
                      onValueChange={(v) => {
                        const next = [...transactionTypes];
                        next[i] = v as "INCOME" | "EXPENSE";
                        setTransactionTypes(next);
                      }}
                    >
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INCOME">Income</SelectItem>
                        <SelectItem value="EXPENSE">Expense</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Category */}
                    <Select
                      value={categoryIds[i] ?? "none"}
                      onValueChange={(v) => {
                        const next = [...categoryIds];
                        next[i] = v === "none" ? undefined : v;
                        setCategoryIds(next);
                      }}
                    >
                      <SelectTrigger className="h-7 flex-1 text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No category</SelectItem>
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
                </div>

                {/* Amount */}
                <span
                  className={`whitespace-nowrap text-sm font-semibold ${
                    row.amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {row.amount >= 0 ? "+" : ""}
                  {row.amount.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={() =>
              onComplete(
                selectedRows,
                categoryIds,
                transactionTypes,
                parsedRows.map((r) => r.importRef),
                duplicateRefs,
                friendlyNames,
                notes,
                needsReview
              )
            }
            disabled={selectedCount === 0}
            className="flex-1"
          >
            Next: Confirm ({selectedCount})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
