// Category Rules List
// ===================
// Settings page component for managing auto-categorization rules.
// Each rule maps a text pattern (contains / starts with / exact / regex)
// to a category. During import, Step 3 (Review) fetches these rules and
// pre-fills the category dropdown for any matching transaction description.

"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Loader2, Pencil, Plus, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type MatchType = "CONTAINS" | "STARTS_WITH" | "EXACT" | "REGEX";

interface CategoryRule {
  id: string;
  pattern: string;
  matchType: MatchType;
  priority: number;
  isActive: boolean;
  categoryId: string;
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
}

interface CategoryRulesListProps {
  pageTitle: string;
  pageDescription?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MATCH_TYPE_LABELS: Record<MatchType, string> = {
  CONTAINS:    "Contains",
  STARTS_WITH: "Starts with",
  EXACT:       "Exact",
  REGEX:       "Regex",
};

function categoryDisplayName(rule: CategoryRule): string {
  return rule.category.parent
    ? `${rule.category.parent.name} › ${rule.category.name}`
    : rule.category.name;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CategoryRulesList({ pageTitle, pageDescription }: CategoryRulesListProps) {
  const [rules, setRules]           = useState<CategoryRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [rulesRes, catRes] = await Promise.all([
      fetch("/api/category-rules"),
      fetch("/api/categories"),
    ]);
    if (rulesRes.ok) setRules((await rulesRes.json()).data);
    if (catRes.ok)   setCategories((await catRes.json()).data);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function deleteRule(id: string) {
    if (!confirm("Delete this rule?")) return;
    await fetch(`/api/category-rules/${id}`, { method: "DELETE" });
    fetchData();
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
        <RuleForm categories={categories} onSuccess={fetchData} />
      </div>

      {/* Rules list */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No rules yet. Add a rule to auto-assign categories during import.
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
                      {MATCH_TYPE_LABELS[rule.matchType]}
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
                    onSuccess={fetchData}
                    trigger={
                      <Button variant="ghost" size="sm">
                        <Pencil className="mr-1 h-4 w-4" />
                        Edit
                      </Button>
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteRule(rule.id)}
                  >
                    <Trash2 className="h-4 w-4" />
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

function RuleForm({ categories, rule, onSuccess, trigger }: RuleFormProps) {
  const isEditing = !!rule;
  const [isOpen, setIsOpen]           = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pattern, setPattern]         = useState(rule?.pattern ?? "");
  const [matchType, setMatchType]     = useState<MatchType>(rule?.matchType ?? "CONTAINS");
  const [categoryId, setCategoryId]   = useState(rule?.categoryId ?? "");
  const [priority, setPriority]       = useState(String(rule?.priority ?? 0));
  const [isActive, setIsActive]       = useState(rule?.isActive ?? true);

  function resetForm() {
    setPattern(rule?.pattern ?? "");
    setMatchType(rule?.matchType ?? "CONTAINS");
    setCategoryId(rule?.categoryId ?? "");
    setPriority(String(rule?.priority ?? 0));
    setIsActive(rule?.isActive ?? true);
  }

  async function handleSubmit(e: React.FormEvent) {
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
          priority: parseInt(priority) || 0,
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

  const parentCategories = categories.filter((c) => !c.parentId);
  const childCategories  = categories.filter((c) => c.parentId);

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
            Add
          </Button>
        )}
      </SheetTrigger>

      <SheetContent side="bottom" className="rounded-t-xl">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Rule" : "New Rule"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Pattern */}
          <div>
            <Label htmlFor="rule-pattern">Pattern</Label>
            <Input
              id="rule-pattern"
              placeholder='e.g. LIDL'
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="mt-2 font-mono"
              required
            />
          </div>

          {/* Match type */}
          <div>
            <Label htmlFor="rule-match-type">Match Type</Label>
            <Select value={matchType} onValueChange={(v) => setMatchType(v as MatchType)}>
              <SelectTrigger id="rule-match-type" className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONTAINS">Contains — description includes the pattern</SelectItem>
                <SelectItem value="STARTS_WITH">Starts with — description begins with the pattern</SelectItem>
                <SelectItem value="EXACT">Exact — description matches exactly</SelectItem>
                <SelectItem value="REGEX">Regex — full regular expression</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="rule-category">Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger id="rule-category" className="mt-2">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
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

          {/* Priority */}
          <div>
            <Label htmlFor="rule-priority">Priority</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Higher number = checked first. Default 0.
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
            <Label htmlFor="rule-active">Active (inactive rules are skipped during import)</Label>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting || !pattern || !categoryId}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
