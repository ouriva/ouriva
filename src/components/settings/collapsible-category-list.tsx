// Collapsible Category List
// =========================
// Shared presentational shell for a "here's what needs attention" list of
// categories inside a settings card — used by UnclassifiedCategories and
// NonTrackedCategories. Each caller owns its own data-fetching and row
// selection logic; this component just renders the disclosure.

"use client";

import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CategoryListRow {
  id: string;
  name: string;
  parentName: string | null;
}

interface CollapsibleCategoryListProps {
  label: string;
  description: string;
  rows: CategoryListRow[];
  countText: string;
  emptyMessage: string;
  linkText: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  withTopBorder?: boolean;
}

export function CollapsibleCategoryList({
  label,
  description,
  rows,
  countText,
  emptyMessage,
  linkText,
  isOpen,
  onOpenChange,
  withTopBorder = true,
}: Readonly<CollapsibleCategoryListProps>) {
  return (
    <div className={withTopBorder ? "border-t pt-4" : undefined}>
      <Collapsible open={isOpen} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-4 text-left">
          <div className="min-w-0">
            <p className="font-medium">{label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {rows.length === 0 ? (
              <CheckCircle2 className="h-4 w-4 text-positive" />
            ) : (
              <span className="text-sm font-semibold tabular-nums text-amber-600 dark:text-amber-400">
                {countText}
              </span>
            )}
            <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-2">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          ) : (
            <>
              <ul className="divide-y rounded-lg border">
                {rows.map((row) => (
                  <li key={row.id} className="px-3 py-2 text-sm">
                    {row.parentName ? (
                      <span>
                        <span className="text-muted-foreground">{row.parentName}</span>
                        <span className="text-muted-foreground"> › </span>
                        {row.name}
                      </span>
                    ) : (
                      row.name
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                <Link href="/settings/categories" className="underline underline-offset-2">
                  {linkText}
                </Link>
              </p>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
