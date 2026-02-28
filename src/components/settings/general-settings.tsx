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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import Link from "next/link";

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

export function GeneralSettings() {
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

  function BalanceIndicator({
    balance,
    zeroLabel,
    nonZeroLabel,
  }: {
    balance: number;
    zeroLabel: string;
    nonZeroLabel: string;
  }) {
    return (
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Balance</p>
        <p
          className={`text-2xl font-bold tabular-nums ${
            balance === 0
              ? "text-green-600 dark:text-green-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          {formatCurrency(String(balance), "EUR")}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {balance === 0 ? zeroLabel : nonZeroLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Transfer Category */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Transfer Category</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Transactions in this category are excluded from summaries and budgets.
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
                <SelectItem value="none">None</SelectItem>
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
          {settings?.transferCategoryId && (
            <BalanceIndicator
              balance={settings.transferBalance}
              zeroLabel="All transfers are matched."
              nonZeroLabel="Non-zero balance means some transfers are not matched across accounts."
            />
          )}
        </CardContent>
      </Card>

      {/* Non-tracked Balance */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Non-tracked Balance</Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Combined balance of all non-tracked categories. Should be €0 when all
              on-behalf-of-others transactions are settled.
            </p>
            <p className="mt-2 text-sm">
              Mark categories as non-tracked in{" "}
              <Link href="/settings/categories" className="underline underline-offset-2">
                Settings › Categories
              </Link>
              .
            </p>
          </div>
          <BalanceIndicator
            balance={settings?.nonTrackedBalance ?? 0}
            zeroLabel="All non-tracked transactions are settled."
            nonZeroLabel="Outstanding amount across all non-tracked categories."
          />
        </CardContent>
      </Card>
    </div>
  );
}
