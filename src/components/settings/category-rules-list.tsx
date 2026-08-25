// Category Rules List
// ===================
// Settings page component for managing auto-categorization rules.
// Each rule maps a text pattern (contains / starts with / exact / regex)
// to a category. During import, Step 3 (Review) fetches these rules and
// pre-fills the category dropdown for any matching transaction description.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { CategorySelectOptions } from "@/components/ui/category-select-options";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Loader2, Pencil, Plus, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/hooks/use-confirm";

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchType = "CONTAINS" | "STARTS_WITH" | "EXACT" | "REGEX";

interface CategoryRule {
  id: string;
  pattern: string;
  matchType: MatchType;
  priority: number;
  isActive: boolean;
  categoryId: string;
  friendlyName: string | null;
  category: {
    id: string;
    name: string;
    parent: { id: string; name: string } | null;
  };
}

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
}

interface CategoryRulesListProps {
  pageTitle: string;
  pageDescription?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function categoryDisplayName(rule: CategoryRule): string {
  return rule.category.parent
    ? `${rule.category.parent.name} › ${rule.category.name}`
    : rule.category.name;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CategoryRulesList({ pageTitle, pageDescription }: Readonly<CategoryRulesListProps>) {
  const t = useTranslations("settings.categoryRules");
  const tCommon = useTranslations("common");
  const { confirm } = useConfirm();
  const [rules, setRules]           = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [rulesRes, catRes] = await Promise.all([
        fetch("/api/category-rules"),
        fetch("/api/categories"),
      ]);
      if (cancelled) return;
      if (rulesRes.ok) setRules((await rulesRes.json()).data);
      if (catRes.ok)   setCategories((await catRes.json()).data);
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function deleteRule(id: string) {
    const ok = await confirm({
      variant: "sheet",
      destructive: true,
      title: t("deleteConfirm"),
      confirmLabel: tCommon("delete"),
      cancelLabel: tCommon("cancel"),
    });
    if (!ok) return;
    await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
    setRefreshKey((k) => k + 1);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
          {pageDescription && (
            <p className="text-sm text-muted-foreground">{pageDescription}</p>
          )}
        </div>
        <RuleForm categories={categories} onSuccess={() => setRefreshKey((k) => k + 1)} />
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            {t("noRules")}
          </div>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={cn(!rule.isActive && "opacity-50")}>
              <CardContent className="flex items-center gap-3 py-3 px-4">
                {/* Pattern + match type */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-sm font-medium">{rule.pattern}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {({"CONTAINS": t("matchContainsBadge"), "STARTS_WITH": t("matchStartsWithBadge"), "EXACT": t("matchExactBadge"), "REGEX": t("matchRegexBadge")} as Record<MatchType, string>)[rule.matchType]}
                    </Badge>
                    {rule.priority > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        P{rule.priority}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    {categoryDisplayName(rule)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <RuleForm
                    categories={categories}
                    rule={rule}
                    onSuccess={() => setRefreshKey((k) => k + 1)}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Pencil className="mr-1 h-4 w-4" />
                        {t("editButton")}
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                    <span className="sr-only">{tCommon("delete")}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─── RuleForm (Sheet) ─────────────────────────────────────────────────────────

interface RuleFormProps {
  categories: Category[];
  rule?: CategoryRule;
  onSuccess: () => void;
  trigger?: React.ReactNode;
}

function RuleForm({ categories, rule, onSuccess, trigger }: Readonly<RuleFormProps>) {
  const t = useTranslations("settings.categoryRules");
  const isEditing = !!rule;
  const [isOpen, setIsOpen]               = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [pattern, setPattern]             = useState(rule?.pattern ?? "");
  const [matchType, setMatchType]         = useState<MatchType>(rule?.matchType ?? "CONTAINS");
  const [categoryId, setCategoryId]       = useState(rule?.categoryId ?? "");
  const [friendlyName, setFriendlyName]   = useState(rule?.friendlyName ?? "");
  const [priority, setPriority]           = useState(String(rule?.priority ?? 0));
  const [isActive, setIsActive]           = useState(rule?.isActive ?? true);

  function resetForm() {
    setPattern(rule?.pattern ?? "");
    setMatchType(rule?.matchType ?? "CONTAINS");
    setCategoryId(rule?.categoryId ?? "");
    setFriendlyName(rule?.friendlyName ?? "");
    setPriority(String(rule?.priority ?? 0));
    setIsActive(rule?.isActive ?? true);
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url    = isEditing ? `/api/category-rules/${rule.id}` : "/api/category-rules";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern,
          matchType,
          categoryId,
          friendlyName: friendlyName.trim() || null,
          priority: Number.parseInt(priority) || 0,
          isActive,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed to save");
      }
      setIsOpen(false);
      onSuccess();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Exclude TRANSFER-type system categories — rules should only target INCOME/EXPENSE categories.
  const parentCategories = categories.filter((c) => !c.parentId && c.type !== "TRANSFER");
  const childCategories  = categories.filter((c) => !!c.parentId && c.type !== "TRANSFER");

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (open) resetForm();
      }}
    >
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            {t("addButton")}
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? t("editTitle") : t("newTitle")}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Pattern */}
          <div>
            <Label htmlFor="rule-pattern">{t("patternLabel")}</Label>
            <Input
              id="rule-pattern"
              placeholder={t("patternPlaceholder")}
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="mt-2 font-mono"
              required
            />
          </div>

          {/* Match type */}
          <div>
            <Label htmlFor="rule-match-type">{t("matchTypeLabel")}</Label>
            <Select value={matchType} onValueChange={(v) => setMatchType(v as MatchType)}>
              <SelectTrigger id="rule-match-type" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTAINS">{t("matchContains")}</SelectItem>
                <SelectItem value="STARTS_WITH">{t("matchStartsWith")}</SelectItem>
                <SelectItem value="EXACT">{t("matchExact")}</SelectItem>
                <SelectItem value="REGEX">{t("matchRegex")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="rule-category">{t("categoryLabel")}</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="rule-category" className="mt-2">
                <SelectValue placeholder={t("categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <CategorySelectOptions
                  parentCategories={parentCategories}
                  childCategories={childCategories}
                />
              </SelectContent>
            </Select>
          </div>

          {/* Display Name */}
          <div>
            <Label htmlFor="rule-friendly-name">{t("displayNameLabel")} <span className="text-muted-foreground font-normal">{t("displayNameOptional")}</span></Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("displayNameHelper")}
            </p>
            <Input
              id="rule-friendly-name"
              placeholder={t("displayNamePlaceholder")}
              value={friendlyName}
              onChange={(e) => setFriendlyName(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* Priority */}
          <div>
            <Label htmlFor="rule-priority">{t("priorityLabel")}</Label>
            <p className="text-xs text-muted-foreground mb-2">
              {t("priorityHelper")}
            </p>
            <Input
              id="rule-priority"
              type="number"
              min={0}
              step={1}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="mt-2"
              inputMode="numeric"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="rule-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="rule-active">{t("activeLabel")}</Label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
              {t("cancelButton")}
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !pattern || !categoryId}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? t("updateButton") : t("createButton")}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
