// General Settings
// ================
// App-wide preferences. Shows Transfer Balance (total volume of all
// TRANSFER-type transactions) and Non-tracked Balance.
// Non-tracked categories are configured per-category in
// Settings > Categories (via the excludeFromStats flag).

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
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

interface Settings {
  transferBalance: number;
  nonTrackedBalance: number;
}

function handleLocaleChange(newLocale: string) {
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  globalThis.location.reload();
}

interface BalanceIndicatorProps {
  balance: number;
  zeroLabel: string;
  nonZeroLabel: string;
}

function BalanceIndicator({ balance, zeroLabel, nonZeroLabel }: Readonly<BalanceIndicatorProps>) {
  const t = useTranslations("generalSettings");
  const locale = useLocale();
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{t("balanceLabel")}</p>
      <p
        className={`text-2xl font-bold tabular-nums ${
          balance === 0
            ? "text-green-600 dark:text-green-400"
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

      {/* Budget bucket colours */}
      <Card>
        <CardContent className="p-4">
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
              onCheckedChange={handleBucketColorsToggle}
            />
          </div>
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
            <p className="mt-2 text-sm">
              <Link href="/settings/categories" className="underline underline-offset-2">
                {t("nonTrackedLink")}
              </Link>
            </p>
          </div>
          <BalanceIndicator
            balance={settings?.nonTrackedBalance ?? 0}
            zeroLabel={t("nonTrackedZero")}
            nonZeroLabel={t("nonTrackedNonZero")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
