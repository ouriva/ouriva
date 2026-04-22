// General Settings
// ================
// App-wide preferences. Currently supports selecting a "transfer
// category" whose transactions are excluded from summaries and budgets.
// Shows a Transfer Balance indicator (should be 0 if matched).
//
// Non-tracked categories are now configured per-category in
// Settings > Categories (via the excludeFromStats flag). This page
// shows the combined Non-tracked Balance across all such categories.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategorySelectOptions } from "@/components/ui/category-select-options";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface Settings {
  transferCategoryId: string | null;
  transferCategory: { id: string; name: string } | null;
  transferBalance: number;
  nonTrackedBalance: number;
}

// Set the NEXT_LOCALE cookie directly. The next-intl middleware reads
// this cookie on every request and makes the locale available to all
// Server Components and Client Components. A full page reload is
// required so the server re-renders with the new locale's message bundle.
function handleLocaleChange(newLocale: string) {
  document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
  window.location.reload();
}

interface BalanceIndicatorProps {
  balance: number;
  zeroLabel: string;
  nonZeroLabel: string;
}

// Defined at module scope (not inside GeneralSettings) to avoid React creating
// a new component identity on every render (S6478).
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
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [catRes, settingsRes] = await Promise.all([
      fetch("/api/categories"),
      fetch("/api/settings"),
    ]);

    if (catRes.ok) {
      const data = await catRes.json();
      setCategories(data.data || data);
    }
    if (settingsRes.ok) {
      const data = await settingsRes.json();
      setSettings(data.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleCategoryChange(value: string) {
    const categoryId = value === "none" ? null : value;
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferCategoryId: categoryId }),
      });

      if (res.ok) {
        const settingsRes = await fetch("/api/settings");
        if (settingsRes.ok) {
          const data = await settingsRes.json();
          setSettings(data.data);
        }
      }
    } catch {
      alert("Failed to save setting.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build category options grouped by parent
  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories = categories.filter((c) => c.parentId);

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

      {/* Transfer Category */}
      <Card>
        <CardContent className="space-y-4 p-4">
          <div>
            <Label>{t("transferCategoryLabel")}</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("transferCategoryDescription")}
            </p>
            <Select
              value={settings?.transferCategoryId ?? "none"}
              onValueChange={handleCategoryChange}
              disabled={isSaving}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{tCommon("none")}</SelectItem>
                <CategorySelectOptions
                  parentCategories={parentCategories}
                  childCategories={childCategories}
                />
              </SelectContent>
            </Select>
          </div>
          {settings?.transferCategoryId && (
            <BalanceIndicator
              balance={settings.transferBalance}
              zeroLabel={t("balanceZero")}
              nonZeroLabel={t("balanceNonZero")}
            />
          )}
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
