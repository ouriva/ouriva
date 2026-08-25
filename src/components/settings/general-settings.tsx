// General Settings
// ================
// App-wide preferences. Shows Transfer Balance (net of Transfer In minus
// Transfer Out — zero means balanced, non-zero flags a missing side) and
// Non-tracked Balance. Non-tracked categories are configured per-category
// in Settings > Categories (via the excludeFromStats flag).

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { useTranslations, useLocale } from "next-intl";
import { UnclassifiedCategories } from "./unclassified-categories";
import { NonTrackedCategories } from "./non-tracked-categories";
import { BudgetSplitTargets } from "./budget-split-targets";

interface Settings {
  transferBalance: number;
  nonTrackedBalance: number;
  budgetSplitEnabled: boolean;
  budgetSplitInSummary: boolean;
  budgetSplitInBudget: boolean;
  needsTarget: number;
  wantsTarget: number;
  savingsTarget: number;
}

function handleLocaleChange(newLocale: string) {
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  globalThis.location.reload();
}

interface BalanceIndicatorProps {
  label: string;
  balance: number;
  zeroLabel: string;
  nonZeroLabel: string;
}

function BalanceIndicator({ label, balance, zeroLabel, nonZeroLabel }: Readonly<BalanceIndicatorProps>) {
  const locale = useLocale();
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          balance === 0
            ? "text-positive"
            : "text-amber-600 dark:text-amber-400"
        }`}
      >
        {formatCurrency(String(balance), "EUR", locale)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {balance === 0 ? zeroLabel : nonZeroLabel}
      </p>
    </div>
  );
}

export function GeneralSettings() {
  const t = useTranslations("generalSettings");
  const locale = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBucketColors, setShowBucketColors] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("budget.bucketColors") === "true"
  );

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "budget.bucketColors") {
        setShowBucketColors(e.newValue === "true");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleBucketColorsToggle(checked: boolean) {
    setShowBucketColors(checked);
    localStorage.setItem("budget.bucketColors", String(checked));
    window.dispatchEvent(new StorageEvent("storage", { key: "budget.bucketColors", newValue: String(checked) }));
  }

  // Server-backed toggle: updates optimistically, then persists via PATCH.
  // Reverts on failure so the switch never drifts from the saved state.
  async function handleBudgetSplitToggle(field: keyof Pick<Settings, "budgetSplitEnabled" | "budgetSplitInSummary" | "budgetSplitInBudget">, checked: boolean) {
    setSettings((prev) => (prev ? { ...prev, [field]: checked } : prev));
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: checked }),
    });
    if (!res.ok) {
      setSettings((prev) => (prev ? { ...prev, [field]: !checked } : prev));
    }
  }

  function handleTargetsSaved(saved: { needsTarget: number; wantsTarget: number; savingsTarget: number }) {
    setSettings((prev) => (prev ? { ...prev, ...saved } : prev));
  }

  // isLoading starts true; we only set it false after fetch resolves.
  // fetchData is stable — referenced by useEffect below.
  const fetchData = useCallback(() => {
    async function load() {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.data);
      }
      setIsLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const splitLabel = `${settings?.needsTarget ?? 50}·${settings?.wantsTarget ?? 30}·${settings?.savingsTarget ?? 20}`;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Language */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>{t("languageLabel")}</Label>
            <Select value={locale} onValueChange={handleLocaleChange}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{t("languageEnglish")}</SelectItem>
                <SelectItem value="pt">{t("languagePortuguese")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 50·30·20 Budget Rule visibility */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label htmlFor="budget-split-enabled-toggle">{t("budgetSplitEnabledLabel")}</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("budgetSplitEnabledDescription")}
              </p>
            </div>
            <Switch
              id="budget-split-enabled-toggle"
              checked={settings?.budgetSplitEnabled ?? true}
              onCheckedChange={(checked) => handleBudgetSplitToggle("budgetSplitEnabled", checked)}
            />
          </div>

          <div className="space-y-4 border-l pl-4">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="budget-split-summary-toggle">{t("budgetSplitInSummaryLabel")}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("budgetSplitInSummaryDescription", { split: splitLabel })}
                </p>
              </div>
              <Switch
                id="budget-split-summary-toggle"
                checked={settings?.budgetSplitInSummary ?? true}
                disabled={!(settings?.budgetSplitEnabled ?? true)}
                onCheckedChange={(checked) => handleBudgetSplitToggle("budgetSplitInSummary", checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="budget-split-budget-toggle">{t("budgetSplitInBudgetLabel")}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("budgetSplitInBudgetDescription", { split: splitLabel })}
                </p>
              </div>
              <Switch
                id="budget-split-budget-toggle"
                checked={settings?.budgetSplitInBudget ?? true}
                disabled={!(settings?.budgetSplitEnabled ?? true)}
                onCheckedChange={(checked) => handleBudgetSplitToggle("budgetSplitInBudget", checked)}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="bucket-colors-toggle">{t("bucketColorsLabel")}</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("bucketColorsDescription")}
                </p>
              </div>
              <Switch
                id="bucket-colors-toggle"
                checked={showBucketColors}
                disabled={!(settings?.budgetSplitEnabled ?? true)}
                onCheckedChange={handleBucketColorsToggle}
              />
            </div>
          </div>

          {/* Target percentages */}
          <BudgetSplitTargets
            targets={{
              needsTarget: settings?.needsTarget ?? 50,
              wantsTarget: settings?.wantsTarget ?? 30,
              savingsTarget: settings?.savingsTarget ?? 20,
            }}
            disabled={!(settings?.budgetSplitEnabled ?? true)}
            onSaved={handleTargetsSaved}
          />

          {/* Unclassified categories */}
          <UnclassifiedCategories enabled={settings?.budgetSplitEnabled ?? true} splitLabel={splitLabel} />
        </CardContent>
      </Card>

      {/* Transfer Balance */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>{t("transferBalanceLabel")}</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("transferBalanceDescription")}
            </p>
          </div>
          <BalanceIndicator
            label={t("transferBalanceValueLabel")}
            balance={settings?.transferBalance ?? 0}
            zeroLabel={t("balanceZero")}
            nonZeroLabel={t("balanceNonZero")}
          />
        </CardContent>
      </Card>

      {/* Non-tracked Balance */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>{t("nonTrackedLabel")}</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("nonTrackedDescription")}
            </p>
          </div>
          <BalanceIndicator
            label={t("nonTrackedValueLabel")}
            balance={settings?.nonTrackedBalance ?? 0}
            zeroLabel={t("nonTrackedZero")}
            nonZeroLabel={t("nonTrackedNonZero")}
          />

          <NonTrackedCategories />
        </CardContent>
      </Card>
    </div>
  );
}
