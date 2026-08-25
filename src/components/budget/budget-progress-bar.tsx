// Budget Progress Bar
// ===================
// Visual indicator of budget usage.
//
// Expense mode (default):
//   green  < 75%   — on track
//   amber  75–100% — approaching limit
//   red    > 100%  — over budget
//
// Income mode (inverse=true):
//   red    < 75%   — not receiving enough
//   amber  75–99%  — nearly there
//   green  ≥ 100%  — target met or exceeded

interface BudgetProgressBarProps {
  percentage: number; // 0–100+ (can exceed 100)
  inverse?: boolean;  // true for income rows
}

export function BudgetProgressBar({
  percentage,
  inverse = false,
}: Readonly<BudgetProgressBarProps>) {
  let colorClass: string;

  if (inverse && percentage >= 100) colorClass = "bg-positive-bar";
  else if (inverse && percentage >= 75) colorClass = "bg-amber-500";
  else if (inverse) colorClass = "bg-red-500";
  else if (percentage > 100) colorClass = "bg-red-500";
  else if (percentage >= 75) colorClass = "bg-amber-500";
  else colorClass = "bg-positive-bar";

  const visualWidth = Math.min(percentage, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${visualWidth}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">
        {percentage}%
      </span>
    </div>
  );
}
