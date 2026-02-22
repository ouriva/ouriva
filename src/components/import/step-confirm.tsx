// Step 4: Confirm
// ================
// Shows a summary of what will be imported and a final "Import" button.
// Calls /api/import/execute with the selected, mapped transactions.
// Shows success/error state after the import completes.

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import type { ImportState } from "./import-wizard";
import { parseAmount, parseDate } from "./step-review-utils";

interface StepConfirmProps {
  state: ImportState;
  onBack: () => void;
}

export function StepConfirm({ state, onBack }: StepConfirmProps) {
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    imported?: number;
    error?: string;
  } | null>(null);

  // Build the list of transactions to import
  const transactions = useMemo(() => {
    const isSplitMode = state.columnMap.debitAmount !== undefined
      || state.columnMap.creditAmount !== undefined;

    return state.rows
      .map((row, i) => {
        if (!state.selectedRows[i]) return null;

        const rawDate = row[state.columnMap.date] ?? "";
        const description = row[state.columnMap.description] ?? "";

        const date = parseDate(rawDate, state.dateFormat);

        // Parse amount based on mode
        let amount: number;
        if (isSplitMode) {
          const rawDebit = state.columnMap.debitAmount !== undefined
            ? (row[state.columnMap.debitAmount] ?? "").trim()
            : "";
          const rawCredit = state.columnMap.creditAmount !== undefined
            ? (row[state.columnMap.creditAmount] ?? "").trim()
            : "";
          amount = rawDebit ? Math.abs(parseAmount(rawDebit)) : Math.abs(parseAmount(rawCredit));
        } else {
          const rawAmount = state.columnMap.amount !== undefined
            ? (row[state.columnMap.amount] ?? "0")
            : "0";
          amount = Math.abs(parseAmount(rawAmount));
        }

        return {
          type: state.transactionTypes[i] || ("EXPENSE" as const),
          amount,
          description: description || undefined,
          friendlyName: state.friendlyNames[i] || undefined,
          notes: state.notes[i] || undefined,
          date,
          fromAccountId: state.accountId,
          categoryId: state.categoryIds[i],
          importRef: state.importRefs[i],
        };
      })
      .filter((t): t is NonNullable<typeof t> => t !== null);
  }, [state]);

  // Summary stats
  const incomeCount = transactions.filter((t) => t.type === "INCOME").length;
  const expenseCount = transactions.filter((t) => t.type === "EXPENSE").length;
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);

  async function handleImport() {
    setIsImporting(true);
    try {
      const res = await fetch("/api/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Import failed");
      }

      const data = await res.json();
      setResult({ success: true, imported: data.data.imported });
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Import failed",
      });
    } finally {
      setIsImporting(false);
    }
  }

  // Success state
  if (result?.success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <CheckCircle2 className="mb-4 h-16 w-16 text-green-500" />
          <h3 className="text-xl font-semibold">Import Complete</h3>
          <p className="mt-2 text-muted-foreground">
            {result.imported} transactions imported successfully.
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              router.push("/transactions");
              router.refresh();
            }}
          >
            View Transactions
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (result && !result.success) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <XCircle className="mb-4 h-16 w-16 text-destructive" />
          <h3 className="text-xl font-semibold">Import Failed</h3>
          <p className="mt-2 text-sm text-destructive">{result.error}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => setResult(null)}>
              Try Again
            </Button>
            <Button variant="outline" onClick={onBack}>
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Confirm state
  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <h3 className="text-lg font-semibold">Import Summary</h3>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">{transactions.length}</p>
            <p className="text-sm text-muted-foreground">Transactions</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">
              {state.duplicateRefs.size}
            </p>
            <p className="text-sm text-muted-foreground">Skipped duplicates</p>
          </div>
        </div>

        {/* Income / Expense breakdown */}
        <div className="space-y-2">
          {incomeCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Income</Badge>
                <span className="text-sm text-muted-foreground">
                  {incomeCount} transactions
                </span>
              </div>
              <span className="font-semibold text-green-600">
                +{totalIncome.toFixed(2)}
              </span>
            </div>
          )}
          {expenseCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Expense</Badge>
                <span className="text-sm text-muted-foreground">
                  {expenseCount} transactions
                </span>
              </div>
              <span className="font-semibold text-red-600">
                -{totalExpense.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* File info */}
        <div className="text-xs text-muted-foreground">
          From: {state.fileName}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting}
            className="flex-1"
          >
            {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {transactions.length} Transactions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
