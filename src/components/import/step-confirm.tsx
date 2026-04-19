// Step 4: Confirm
// ================
// Shows a summary of what will be imported and a final "Import" button.
// Calls /api/import/execute with the selected, mapped transactions.
// Shows success/error state after the import completes.

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";
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
  const t = useTranslations("import");
  const locale = useLocale();
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

        // Extract exchange rate from the mapped column if present
        let exchangeRate: number | undefined;
        if (state.columnMap.exchangeRate !== undefined) {
          const raw = (row[state.columnMap.exchangeRate] ?? "").trim().replace(",", ".");
          const parsed = Number.parseFloat(raw);
          if (Number.isFinite(parsed) && parsed > 0) exchangeRate = parsed;
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
          needsReview: state.needsReview[i] || false,
          exchangeRate,
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
          <h3 className="text-xl font-semibold">{t("successTitle")}</h3>
          <p className="mt-2 text-muted-foreground">
            {t("successMessage", { count: result.imported ?? 0 })}
          </p>
          <Button
            className="mt-6"
            onClick={() => {
              router.push("/transactions");
              router.refresh();
            }}
          >
            {t("viewTransactions")}
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
          <h3 className="text-xl font-semibold">{t("errorTitle")}</h3>
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
      <CardContent className="space-y-6 p-4">
        <h3 className="text-lg font-semibold">{t("summaryTitle")}</h3>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">{transactions.length}</p>
            <p className="text-sm text-muted-foreground">{t("statTransactions")}</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-2xl font-bold">
              {state.duplicateRefs.size}
            </p>
            <p className="text-sm text-muted-foreground">{t("statSkipped")}</p>
          </div>
        </div>

        {/* Income / Expense breakdown */}
        <div className="space-y-2">
          {incomeCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t("incomeBadge")}</Badge>
                <span className="text-sm text-muted-foreground">
                  {incomeCount} {t("statTransactions")}
                </span>
              </div>
              <span className="font-semibold text-green-600">
                +{formatAmount(totalIncome, locale)}
              </span>
            </div>
          )}
          {expenseCount > 0 && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{t("expenseBadge")}</Badge>
                <span className="text-sm text-muted-foreground">
                  {expenseCount} {t("statTransactions")}
                </span>
              </div>
              <span className="font-semibold text-red-600">
                −{formatAmount(totalExpense, locale)}
              </span>
            </div>
          )}
        </div>

        {/* File info */}
        <div className="text-xs text-muted-foreground">
          {t("fromFile", { fileName: state.fileName })}
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
            {t("importButton", { count: transactions.length })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
