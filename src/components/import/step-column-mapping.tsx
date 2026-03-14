// Step 2: Column Mapping
// ======================
// User maps file columns to transaction fields (date, description, amount,
// and optionally reference). Shows a preview table with the first 5 rows
// so users can see their data while mapping.
//
// Amount mapping supports two modes:
//   1. Single column — one column with positive/negative values
//   2. Split columns — separate Debit and Credit columns (European banks)
//
// Users can also select a date format and optionally save the mapping
// as a reusable profile for future imports from the same bank.

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ImportPreviewTable } from "./import-preview-table";
import type { ImportState } from "./import-wizard";
import type { ColumnMap } from "@/validators/import";

const DATE_FORMATS = [
  { value: "yyyy-MM-dd", label: "2026-01-15 (yyyy-MM-dd)" },
  { value: "dd/MM/yyyy", label: "15/01/2026 (dd/MM/yyyy)" },
  { value: "MM/dd/yyyy", label: "01/15/2026 (MM/dd/yyyy)" },
  { value: "dd-MM-yyyy", label: "15-01-2026 (dd-MM-yyyy)" },
  { value: "dd.MM.yyyy", label: "15.01.2026 (dd.MM.yyyy)" },
];

type AmountMode = "single" | "split";

interface StepColumnMappingProps {
  state: ImportState;
  onComplete: (columnMap: ColumnMap, dateFormat: string) => void;
  onBack: () => void;
}

export function StepColumnMapping({
  state,
  onComplete,
  onBack,
}: StepColumnMappingProps) {
  const t = useTranslations("import");
  // Detect initial amount mode from existing columnMap
  const initialMode: AmountMode =
    state.columnMap.debitAmount !== undefined || state.columnMap.creditAmount !== undefined
      ? "split"
      : "single";

  const [amountMode, setAmountMode] = useState<AmountMode>(initialMode);
  const [columnMap, setColumnMap] = useState<ColumnMap>(state.columnMap);
  const [dateFormat, setDateFormat] = useState(state.dateFormat);
  const [profileName, setProfileName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // Show exchange rate column selector when the import account uses a non-default currency
  const [showExchangeRateColumn, setShowExchangeRateColumn] = useState(false);
  const [accountCurrencyCode, setAccountCurrencyCode] = useState<string | null>(null);
  const [defaultCurrencyCode, setDefaultCurrencyCode] = useState<string | null>(null);

  useEffect(() => {
    async function checkCurrencies() {
      const [accountRes, currenciesRes] = await Promise.all([
        fetch(`/api/accounts/${state.accountId}`),
        fetch("/api/currencies"),
      ]);
      const accountData = accountRes.ok ? await accountRes.json() : null;
      const currenciesData = currenciesRes.ok ? await currenciesRes.json() : null;

      const accCode = accountData?.data?.currency?.code ?? accountData?.currency?.code ?? null;
      const currencies: Array<{ code: string; isDefault: boolean }> = currenciesData?.data ?? [];
      const defCode = currencies.find((c) => c.isDefault)?.code ?? currencies[0]?.code ?? null;

      setAccountCurrencyCode(accCode);
      setDefaultCurrencyCode(defCode);
      setShowExchangeRateColumn(!!accCode && !!defCode && accCode !== defCode);
    }
    checkCurrencies();
  }, [state.accountId]);

  // Build column options from headers
  const columnOptions = state.headers.map((header, i) => ({
    value: String(i),
    label: `Col ${i}: ${header}`,
  }));

  // Track which columns are mapped (for highlighting in preview)
  const highlightedColumns = new Set<number>();
  highlightedColumns.add(columnMap.date);
  highlightedColumns.add(columnMap.description);
  if (amountMode === "single" && columnMap.amount !== undefined) {
    highlightedColumns.add(columnMap.amount);
  }
  if (amountMode === "split") {
    if (columnMap.debitAmount !== undefined) highlightedColumns.add(columnMap.debitAmount);
    if (columnMap.creditAmount !== undefined) highlightedColumns.add(columnMap.creditAmount);
  }
  if (columnMap.reference !== undefined) {
    highlightedColumns.add(columnMap.reference);
  }

  // Validation: all required columns must be mapped and distinct
  const isValid = (() => {
    const mapped = [columnMap.date, columnMap.description];
    if (amountMode === "single") {
      if (columnMap.amount === undefined) return false;
      mapped.push(columnMap.amount);
    } else {
      if (columnMap.debitAmount === undefined || columnMap.creditAmount === undefined) return false;
      mapped.push(columnMap.debitAmount, columnMap.creditAmount);
    }
    // Check all mapped columns are unique
    return new Set(mapped).size === mapped.length;
  })();

  function handleAmountModeChange(mode: AmountMode) {
    setAmountMode(mode);
    if (mode === "single") {
      // Clear split fields, set default single amount
      setColumnMap((prev) => ({
        ...prev,
        amount: prev.amount ?? 2,
        debitAmount: undefined,
        creditAmount: undefined,
      }));
    } else {
      // Clear single field, set default split columns
      setColumnMap((prev) => ({
        ...prev,
        amount: undefined,
        debitAmount: prev.debitAmount ?? 3,
        creditAmount: prev.creditAmount ?? 4,
      }));
    }
  }

  // Build the final columnMap to pass on (strip irrelevant fields)
  function getCleanColumnMap(): ColumnMap {
    const rateField = showExchangeRateColumn ? { exchangeRate: columnMap.exchangeRate } : {};
    if (amountMode === "single") {
      return {
        date: columnMap.date,
        description: columnMap.description,
        amount: columnMap.amount,
        reference: columnMap.reference,
        ...rateField,
      };
    }
    return {
      date: columnMap.date,
      description: columnMap.description,
      debitAmount: columnMap.debitAmount,
      creditAmount: columnMap.creditAmount,
      reference: columnMap.reference,
      ...rateField,
    };
  }

  async function handleSaveProfile() {
    if (!profileName.trim()) return;
    setIsSaving(true);

    try {
      const res = await fetch("/api/import/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profileName.trim(),
          fileType: state.fileType,
          columnMap: getCleanColumnMap(),
          dateFormat,
          delimiter: state.delimiter,
          skipRows: state.skipRows,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to save profile");
      }
      setProfileName("");
    } catch {
      alert("Could not save profile. You can still continue with the import.");
    } finally {
      setIsSaving(false);
    }
  }


  return (
    <Card>
      <CardContent className="space-y-6 p-4">
        {/* File preview */}
        <div>
          <Label className="mb-2 block">{t("dataPreview")}</Label>
          <ImportPreviewTable
            headers={state.headers}
            rows={state.rows}
            highlightedColumns={highlightedColumns}
          />
        </div>

        {/* Column mapping dropdowns */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>{t("dateColumn")}</Label>
            <Select
              value={String(columnMap.date)}
              onValueChange={(v) =>
                setColumnMap((prev) => ({ ...prev, date: parseInt(v) }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("descriptionColumn")}</Label>
            <Select
              value={String(columnMap.description)}
              onValueChange={(v) =>
                setColumnMap((prev) => ({ ...prev, description: parseInt(v) }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Amount mode toggle */}
        <div>
          <Label className="mb-2 block">{t("amountColumns")}</Label>
          <Tabs
            value={amountMode}
            onValueChange={(v) => handleAmountModeChange(v as AmountMode)}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">{t("singleColumn")}</TabsTrigger>
              <TabsTrigger value="split">{t("debitCredit")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Amount column(s) */}
        <div className="grid gap-4 sm:grid-cols-2">
          {amountMode === "single" ? (
            <div>
              <Label>{t("amountColumn")}</Label>
              <Select
                value={columnMap.amount !== undefined ? String(columnMap.amount) : ""}
                onValueChange={(v) =>
                  setColumnMap((prev) => ({ ...prev, amount: parseInt(v) }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columnOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("amountColumnHelper")}
              </p>
            </div>
          ) : (
            <>
              <div>
                <Label>{t("debitColumn")}</Label>
                <Select
                  value={columnMap.debitAmount !== undefined ? String(columnMap.debitAmount) : ""}
                  onValueChange={(v) =>
                    setColumnMap((prev) => ({ ...prev, debitAmount: parseInt(v) }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("creditColumn")}</Label>
                <Select
                  value={columnMap.creditAmount !== undefined ? String(columnMap.creditAmount) : ""}
                  onValueChange={(v) =>
                    setColumnMap((prev) => ({ ...prev, creditAmount: parseInt(v) }))
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {columnOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Reference column (optional) — always shown */}
          <div>
            <Label>{t("referenceColumn")}</Label>
            <Select
              value={columnMap.reference !== undefined ? String(columnMap.reference) : "none"}
              onValueChange={(v) =>
                setColumnMap((prev) => ({
                  ...prev,
                  reference: v === "none" ? undefined : parseInt(v),
                }))
              }
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("notMapped")}</SelectItem>
                {columnOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Exchange Rate column — only shown when account currency ≠ default */}
          {showExchangeRateColumn && (
            <div>
              <Label>{t("exchangeRateColumn")}</Label>
              <Select
                value={columnMap.exchangeRate !== undefined ? String(columnMap.exchangeRate) : "none"}
                onValueChange={(v) =>
                  setColumnMap((prev) => ({
                    ...prev,
                    exchangeRate: v === "none" ? undefined : parseInt(v),
                  }))
                }
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("exchangeRateNotMapped")}</SelectItem>
                  {columnOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("exchangeRateHelper")}
              </p>
            </div>
          )}
        </div>

        {/* Date format */}
        <div>
          <Label>{t("dateFormatLabel")}</Label>
          <Select value={dateFormat} onValueChange={setDateFormat}>
            <SelectTrigger className="mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_FORMATS.map((fmt) => (
                <SelectItem key={fmt.value} value={fmt.value}>
                  {fmt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Save as profile (optional) */}
        <div>
          <Label>{t("saveProfileLabel")}</Label>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder={t("saveProfilePlaceholder")}
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={handleSaveProfile}
              disabled={!profileName.trim() || isSaving}
            >
              {t("saveProfileButton")}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            {t("back")}
          </Button>
          <Button
            onClick={() => onComplete(getCleanColumnMap(), dateFormat)}
            disabled={!isValid}
            className="flex-1"
          >
            {t("nextReview")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
