// Category Icon
// =============
// Reusable component that renders a category's icon inside a colored circle.
// Falls back to the transaction-type arrow when no icon/color is set (e.g.,
// for uncategorized transactions, split parents, or categories without an icon).
//
// Design rationale: storing the icon name as a string in the DB (rather than
// the component itself) keeps the schema simple and the bundle small — we look
// up the component from CATEGORY_ICONS at render time.
//
// Size variants:
//   sm — h-8 w-8 circle, h-4 w-4 icon  (compact contexts)
//   md — h-10 w-10 circle, h-5 w-5 icon (default — transaction card)

import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, CATEGORY_COLORS } from "@/lib/category-icons";
import type { LucideIcon } from "lucide-react";

interface CategoryIconProps {
  /** Lucide icon name stored on the category (e.g. "ShoppingCart"). */
  icon: string | null | undefined;
  /** Color palette key stored on the category (e.g. "emerald"). */
  color: string | null | undefined;
  /** Arrow icon component to show when no category icon is set. */
  fallback: LucideIcon;
  /** Tailwind bg class for the fallback circle (e.g. "bg-red-100 dark:bg-red-900/30"). */
  fallbackBg: string;
  /** Tailwind text class for the fallback icon (e.g. "text-red-600 dark:text-red-400"). */
  fallbackColor: string;
  size?: "sm" | "md";
}

export function CategoryIcon({
  icon,
  color,
  fallback: Fallback,
  fallbackBg,
  fallbackColor,
  size = "md",
}: Readonly<CategoryIconProps>) {
  const IconComponent = icon ? CATEGORY_ICONS[icon] : undefined;
  const colorEntry = color ? CATEGORY_COLORS.find((c) => c.key === color) : undefined;

  const circleClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconClass   = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  if (IconComponent) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full",
          circleClass,
          colorEntry?.bg ?? "bg-zinc-500"
        )}
      >
        <IconComponent className={cn(iconClass, "text-white")} />
      </div>
    );
  }

  // No category icon — render the type-based arrow (unchanged appearance)
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        circleClass,
        fallbackBg
      )}
    >
      <Fallback className={cn(iconClass, fallbackColor)} />
    </div>
  );
}
