// General Settings
// ================
// App-wide preferences. Currently supports selecting a "transfer
// category" whose transactions are excluded from summaries and budgets.
// Shows a Transfer Balance indicator (should be 0 if matched).

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
import { Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
}

interface Settings {
  transferCategoryId: string | null;
  transferCategory: { id: string; name: string } | null;
  transferBalance: number;
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

  async function handleTransferCategoryChange(value: string) {
    const transferCategoryId = value === "none" ? null : value;
    setIsSaving(true);

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transferCategoryId }),
      });

      if (res.ok) {
        // Refetch to get updated transfer balance
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
              onValueChange={handleTransferCategoryChange}
              disabled={isSaving}
            >
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
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

          {/* Transfer Balance */}
          {settings?.transferCategoryId && (
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Transfer Balance</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  settings.transferBalance === 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {formatCurrency(String(settings.transferBalance), "EUR")}
              </p>
              {settings.transferBalance !== 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Non-zero balance means some transfers are not matched across accounts.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
