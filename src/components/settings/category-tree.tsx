// Category Tree
// =============
// Displays categories in a parent/child tree structure.
// Parents are collapsible — tap to expand and see subcategories.
// Add buttons let you create new parents or children.
//
// Each category has two toggles:
//   Active (green) — whether the category appears in dropdowns
//   Non-tracked (purple EyeOff) — whether transactions are excluded
//     from summaries and budgets (excludeFromStats flag)

"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  ChevronRight,
  ChevronDown,
  Plus,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { SettingsItemForm } from "./settings-item-form";
import { cn } from "@/lib/utils";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  excludeFromStats: boolean;
  children: Category[];
}

export function CategoryTree() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch("/api/categories?all=true");
    if (res.ok) {
      const data = await res.json();
      setCategories(data.data);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggleActive(category: Category) {
    await fetch(`/api/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !category.isActive }),
    });
    fetchData();
  }

  async function toggleExcludeFromStats(category: Category) {
    await fetch(`/api/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludeFromStats: !category.excludeFromStats }),
    });
    fetchData();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter to only parent categories (parentId is null)
  const parents = categories.filter((c) => !c.parentId);

  const nameField = [{ name: "name", label: "Category Name", placeholder: "e.g., Groceries" }];

  return (
    <div className="space-y-4">
      {/* Add parent category button */}
      <div className="flex justify-end">
        <SettingsItemForm
          title="Category"
          fields={nameField}
          apiEndpoint="/api/categories"
          onSuccess={fetchData}
        />
      </div>

      {parents.map((parent) => {
        const isExpanded = expanded.has(parent.id);

        return (
          <Card
            key={parent.id}
            className={cn(!parent.isActive && "opacity-50")}
          >
            <CardContent className="p-0">
              {/* Parent row */}
              <div className="flex items-center justify-between px-4 py-3">
                <button
                  onClick={() => toggleExpand(parent.id)}
                  className="flex items-center gap-2 min-h-[44px] flex-1 text-left"
                >
                  {parent.children.length > 0 ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )
                  ) : (
                    <div className="w-4" /> // spacer
                  )}
                  <span className="font-medium">{parent.name}</span>
                  <Badge variant="secondary" className="ml-2">
                    {parent.children.filter((c) => c.isActive).length}
                  </Badge>
                  {parent.children.length === 0 && parent.excludeFromStats && (
                    <Badge
                      variant="outline"
                      className="ml-1 border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400"
                    >
                      Non-tracked
                    </Badge>
                  )}
                </button>

                <div className="flex items-center gap-1">
                  {/* Add subcategory */}
                  <SettingsItemForm
                    title="Subcategory"
                    fields={nameField}
                    initialValues={{ parentId: parent.id }}
                    apiEndpoint="/api/categories"
                    onSuccess={fetchData}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Plus className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <SettingsItemForm
                    title="Category"
                    fields={nameField}
                    initialValues={{ name: parent.name }}
                    apiEndpoint="/api/categories"
                    itemId={parent.id}
                    onSuccess={fetchData}
                    trigger={
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    }
                  />
                  {/* Non-tracked toggle — only shown on standalone parents
                      (no children). Parents with children can't have transactions
                      assigned to them, so the flag would have no effect. */}
                  {parent.children.length === 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={parent.excludeFromStats ? "Non-tracked: click to include in stats" : "Tracked: click to exclude from stats"}
                      onClick={() => toggleExcludeFromStats(parent)}
                    >
                      {parent.excludeFromStats ? (
                        <EyeOff className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  )}
                  {/* Active toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleActive(parent)}
                  >
                    {parent.isActive ? (
                      <ToggleRight className="h-5 w-5 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Children (expanded) */}
              {isExpanded && parent.children.length > 0 && (
                <div className="border-t">
                  {parent.children.map((child) => (
                    <div
                      key={child.id}
                      className={cn(
                        "flex items-center justify-between px-4 py-2 pl-10",
                        !child.isActive && "opacity-50"
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm">
                        {child.name}
                        {child.excludeFromStats && (
                          <Badge
                            variant="outline"
                            className="border-purple-300 text-purple-700 dark:border-purple-700 dark:text-purple-400 text-xs"
                          >
                            Non-tracked
                          </Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-1">
                        <SettingsItemForm
                          title="Subcategory"
                          fields={nameField}
                          initialValues={{ name: child.name }}
                          apiEndpoint="/api/categories"
                          itemId={child.id}
                          onSuccess={fetchData}
                          trigger={
                            <Button variant="ghost" size="sm" className="text-xs">
                              Edit
                            </Button>
                          }
                        />
                        {/* Non-tracked toggle for child */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title={child.excludeFromStats ? "Non-tracked: click to include in stats" : "Tracked: click to exclude from stats"}
                          onClick={() => toggleExcludeFromStats(child)}
                        >
                          {child.excludeFromStats ? (
                            <EyeOff className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        {/* Active toggle for child */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => toggleActive(child)}
                        >
                          {child.isActive ? (
                            <ToggleRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
