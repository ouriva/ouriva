// Budget Progress Bar
// ===================
// Visual indicator of budget usage. The bar fills from left to right
// and changes color based on how much budget has been used:
//   - Green  (< 75%)  — on track
//   - Yellow (75-100%) — approaching limit
//   - Red    (> 100%)  — over budget
//
// CSS technique: The bar uses a fixed container with a colored inner
// div whose width is set as a percentage. The `Math.min(percentage, 100)`
// caps the visual width so it doesn't overflow the container, while
// the text can still show the real percentage (e.g. "120%").

"use client";

interface BudgetProgressBarProps {
  percentage: number; // 0-100+ (can exceed 100 if over budget)
}

export function BudgetProgressBar({ percentage }: BudgetProgressBarProps) {
  // Determine color based on percentage
  const colorClass =
    percentage > 100
      ? "bg-red-500"
      : percentage >= 75
        ? "bg-yellow-500"
        : "bg-green-500";

  // Cap visual width at 100% so the bar doesn't overflow
  const visualWidth = Math.min(percentage, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${visualWidth}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {percentage}%
      </span>
    </div>
  );
}
