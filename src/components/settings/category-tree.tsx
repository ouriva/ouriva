// Category Tree
// =============
// Displays categories in a parent/child tree structure.
//
// UX pattern: each row is a clean tap target that opens a bottom Sheet
// with all category settings (name, icon/color, bucket, active status,
// non-tracked). This follows the Revolut / Copilot pattern — the list
// stays scannable, editing happens in a focused context.
//
// Row anatomy:
//   Parent:  [▶/▼ expand] [icon] Name (N active)   [+ add child]  ›
//   Child:              [icon] Name            [status badges]  ›
//
// The expand chevron is a separate tap target so it doesn't interfere
// with the "tap to edit" gesture on the rest of the row.

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Plus,
} from "lucide-react";
import { SettingsItemForm } from "./settings-item-form";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, CATEGORY_COLORS, ICON_GROUPS } from "@/lib/category-icons";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  excludeFromStats: boolean;
  bucket: "NEEDS" | "WANTS" | "SAVINGS" | null;
  icon: string | null;
  color: string | null;
  children: Category[];
}

// ── CategoryEditSheet ─────────────────────────────────────────────────────
// Bottom sheet opened when the user taps a category row.
// All fields are staged in local state; Save commits everything in one PUT.
// This keeps the list rows minimal while giving full control in the sheet.
function CategoryEditSheet({
  category,
  isGroupDefault,
  onSave,
  onClose,
}: {
  category: Category;
  isGroupDefault: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("categories");
  const [name,             setName]             = useState(category.name);
  const [icon,             setIcon]             = useState<string | null>(category.icon);
  const [color,            setColor]            = useState<string | null>(category.color);
  const [bucket,           setBucket]           = useState<"NEEDS" | "WANTS" | "SAVINGS" | null>(category.bucket);
  const [isActive,         setIsActive]         = useState(category.isActive);
  const [excludeFromStats, setExcludeFromStats] = useState(category.excludeFromStats);
  const [saving,           setSaving]           = useState(false);

  const PreviewIcon = icon ? CATEGORY_ICONS[icon] : undefined;
  const colorEntry  = CATEGORY_COLORS.find((c) => c.key === color);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, icon, color, bucket, isActive, excludeFromStats }),
    });
    setSaving(false);
    onSave();
    onClose();
  }

  const buckets = [
    { key: "NEEDS"   as const, label: isGroupDefault ? t("needs")    : t("bucketNeeds")    },
    { key: "WANTS"   as const, label: isGroupDefault ? t("wants")    : t("bucketWants")    },
    { key: "SAVINGS" as const, label: isGroupDefault ? t("savings")  : t("bucketSavings")  },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="pb-2">
          {/* Large icon preview — updates live as the user picks icon/color */}
          <div className="flex justify-center pb-1">
            <div
              className={cn(
                "flex h-16 w-16 items-center justify-center rounded-full",
                PreviewIcon
                  ? (colorEntry?.bg ?? "bg-zinc-500")
                  : "border-2 border-dashed border-muted-foreground/30"
              )}
            >
              {PreviewIcon && <PreviewIcon className="h-8 w-8 text-white" />}
            </div>
          </div>
          <SheetTitle className="text-center">{category.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-4 py-2">

          {/* ── Name ── */}
          <div className="space-y-1.5">
            <Label>{t("nameLabel")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("categoryNameLabel")}
            />
          </div>

          {/* ── Color ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("colorLabel")}</Label>
              {color && (
                <button
                  onClick={() => setColor(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("clearColor")}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2.5">
              {CATEGORY_COLORS.map(({ key, bg }) => (
                <button
                  key={key}
                  onClick={() => setColor(key)}
                  className={cn(
                    "h-7 w-7 rounded-full transition-all",
                    bg,
                    color === key && "ring-2 ring-white ring-offset-2 ring-offset-background"
                  )}
                />
              ))}
            </div>
          </div>

          {/* ── Icon ── */}
          {/* Sections match ICON_GROUPS so the user can find icons by context.
              Tapping the selected icon again clears it (toggle behaviour). */}
          <div className="space-y-3">
            <Label>{t("iconLabel")}</Label>
            {ICON_GROUPS.map(({ label, icons }) => (
              <div key={label}>
                <p className="mb-1.5 text-xs text-muted-foreground">{label}</p>
                <div className="grid grid-cols-7 gap-1">
                  {icons.map((iconName) => {
                    const IconComp  = CATEGORY_ICONS[iconName];
                    const isSelected = icon === iconName;
                    return (
                      <button
                        key={iconName}
                        title={iconName}
                        onClick={() => setIcon(isSelected ? null : iconName)}
                        className={cn(
                          "flex items-center justify-center rounded-lg p-2 transition-colors",
                          isSelected
                            ? cn("text-white", colorEntry?.bg ?? "bg-zinc-500")
                            : "hover:bg-muted"
                        )}
                      >
                        <IconComp className="h-5 w-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* ── Bucket ── */}
          <div className="space-y-1.5">
            <Label>
              {isGroupDefault
                ? t("bucketLabelParent")
                : t("bucketLabelChild")}
            </Label>
            <div className="flex gap-2">
              {buckets.map(({ key, label }) => {
                let activeClass: string;
                if (key === "NEEDS") activeClass = "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300";
                else if (key === "WANTS") activeClass = "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300";
                else activeClass = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300";
                return (
                  <button
                    key={key}
                    onClick={() => setBucket(bucket === key ? null : key)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      bucket === key ? activeClass : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Toggles ── */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`active-${category.id}`}
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(!!checked)}
                className="mt-0.5"
              />
              <Label htmlFor={`active-${category.id}`} className="cursor-pointer leading-snug">
                <span className="font-medium">{t("activeLabel")}</span>
                <span className="block text-xs text-muted-foreground">
                  {t("activeHelper")}
                </span>
              </Label>
            </div>

            {/* Non-tracked only makes sense on leaf categories — parents can't
                have transactions assigned to them so the flag has no effect. */}
            {category.children.length === 0 && (
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`stats-${category.id}`}
                  checked={excludeFromStats}
                  onCheckedChange={(checked) => setExcludeFromStats(!!checked)}
                  className="mt-0.5"
                />
                <Label htmlFor={`stats-${category.id}`} className="cursor-pointer leading-snug">
                  <span className="font-medium">{t("excludeFromStatsLabel")}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t("excludeFromStatsHelper")}
                  </span>
                </Label>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="px-4 pb-8 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("saveButton")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ── SmallIconCircle ───────────────────────────────────────────────────────
// Inline icon preview for list rows. Dashed placeholder when no icon is set.
function SmallIconCircle({
  icon,
  color,
  size = "md",
}: {
  icon: string | null;
  color: string | null;
  size?: "sm" | "md";
}) {
  const IconComp   = icon ? CATEGORY_ICONS[icon] : undefined;
  const colorEntry = CATEGORY_COLORS.find((c) => c.key === color);
  const circleSize = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const iconSize   = size === "sm" ? "h-3 w-3"  : "h-3.5 w-3.5";

  if (IconComp) {
    return (
      <div className={cn("shrink-0 flex items-center justify-center rounded-full", circleSize, colorEntry?.bg ?? "bg-zinc-500")}>
        <IconComp className={cn(iconSize, "text-white")} />
      </div>
    );
  }

  return (
    <div className={cn("shrink-0 rounded-full border-2 border-dashed border-muted-foreground/25", circleSize)} />
  );
}

// ── CategoryTree ──────────────────────────────────────────────────────────

interface CategoryTreeProps {
  pageTitle: string;
  pageDescription?: string;
}

export function CategoryTree({ pageTitle, pageDescription }: CategoryTreeProps) {
  const t = useTranslations("categories");
  const [categories,       setCategories]       = useState<Category[]>([]);
  const [isLoading,        setIsLoading]        = useState(true);
  const [expanded,         setExpanded]         = useState<Set<string>>(new Set());
  const [editingCategory,  setEditingCategory]  = useState<Category | null>(null);
  const [refreshKey,       setRefreshKey]       = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/categories?all=true");
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setCategories(data.data);
      }
      setIsLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Always look up the full category from the flat list before editing.
  // The nested child objects inside parent.children don't have their own
  // children array (Prisma only fetches one level of nesting), so using
  // them directly in CategoryEditSheet would throw on children.length.
  function openEdit(id: string) {
    const cat = categories.find((c) => c.id === id);
    if (cat) setEditingCategory(cat);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const parents     = categories.filter((c) => !c.parentId);
  const nameField   = [{ name: "name", label: t("categoryNameLabel"), placeholder: t("namePlaceholder") }];

  return (
    <>
      <div className="space-y-6">
        {/* Page header with Add button */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pageTitle}</h1>
            {pageDescription && (
              <p className="text-sm text-muted-foreground">{pageDescription}</p>
            )}
          </div>
          <SettingsItemForm
            title={t("categoryFormTitle")}
            fields={nameField}
            apiEndpoint="/api/categories"
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </div>

        <div className="space-y-4">

        {parents.map((parent) => {
          const isExpanded    = expanded.has(parent.id);
          const activeChildren = parent.children.filter((c) => c.isActive).length;
          const expandIcon = isExpanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />;

          return (
            <Card
              key={parent.id}
              className={cn(!parent.isActive && "opacity-60")}
            >
              <CardContent className="p-0">

                {/* ── Parent row ──
                    Only the icon circle is tappable to open edit — this avoids
                    the 300ms delay that div onClick has on mobile, and keeps
                    the expand chevron clearly separate from the edit action. */}
                <div className="flex min-h-[52px] items-center">

                  {/* Expand/collapse button */}
                  <button
                    onClick={() => parent.children.length > 0 && toggleExpand(parent.id)}
                    className={cn(
                      "flex min-h-[52px] w-10 shrink-0 items-center justify-center",
                      parent.children.length === 0 && "pointer-events-none"
                    )}
                  >
                    {parent.children.length > 0 ? expandIcon : <div className="w-4" />}
                  </button>

                  {/* Icon circle — the tap target that opens edit */}
                  <button
                    onClick={() => openEdit(parent.id)}
                    className="shrink-0 rounded-full transition-opacity hover:opacity-80 active:opacity-60"
                    title={t("editTitle")}
                  >
                    <SmallIconCircle icon={parent.icon} color={parent.color} />
                  </button>

                  {/* Name + badges — display only */}
                  <div className="flex flex-1 items-center gap-2 px-2">
                    <span className="font-medium">{parent.name}</span>
                    {parent.children.length > 0 && (
                      <Badge variant="secondary">{t("activeChildCount", { count: activeChildren })}</Badge>
                    )}
                    {!parent.isActive && (
                      <Badge variant="outline" className="text-muted-foreground">{t("inactiveBadge")}</Badge>
                    )}
                    {parent.children.length === 0 && parent.excludeFromStats && (
                      <Badge variant="outline" className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400">
                        {t("nonTrackedBadge")}
                      </Badge>
                    )}
                  </div>

                  {/* Add subcategory */}
                  <SettingsItemForm
                    title={t("subcategoryFormTitle")}
                    fields={nameField}
                    initialValues={{ parentId: parent.id }}
                    apiEndpoint="/api/categories"
                    onSuccess={() => setRefreshKey((k) => k + 1)}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                </div>

                {/* ── Child rows (expanded) ── */}
                {isExpanded && parent.children.length > 0 && (
                  <div className="border-t">
                    {parent.children.map((child) => (
                      <button
                        key={child.id}
                        onClick={() => openEdit(child.id)}
                        className={cn(
                          "flex w-full items-center gap-2 py-3 pl-12 pr-4 text-left transition-colors hover:bg-muted/50 active:bg-muted",
                          !child.isActive && "opacity-60"
                        )}
                      >
                        <SmallIconCircle icon={child.icon} color={child.color} size="sm" />

                        <span className="flex-1 text-sm">{child.name}</span>

                        {!child.isActive && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">{t("inactiveBadge")}</Badge>
                        )}
                        {child.excludeFromStats && (
                          <Badge variant="outline" className="border-purple-300 text-xs text-purple-700 dark:border-purple-700 dark:text-purple-400">
                            {t("nonTrackedBadge")}
                          </Badge>
                        )}
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}

              </CardContent>
            </Card>
          );
        })}
        </div>
      </div>

      {/* Edit sheet — rendered outside the list so z-index is never an issue */}
      {editingCategory && (
        <CategoryEditSheet
          category={editingCategory}
          isGroupDefault={(editingCategory.children?.length ?? 0) > 0}
          onSave={() => setRefreshKey((k) => k + 1)}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </>
  );
}
