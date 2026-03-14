// Expense Pie Chart
// =================
// Shows expense distribution across categories as a donut chart.
//
// Recharts works with declarative components:
//   <PieChart>       — the container
//     <Pie>          — the data series (each slice)
//     <Cell>         — individual slice styling
//     <Tooltip>      — hover info
//     <Legend>        — color labels
//   </PieChart>
//
// ResponsiveContainer makes the chart resize with its parent.
// Without it, you'd need to hardcode width/height in pixels.

"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";

// A curated color palette that works well in both light and dark mode
const COLORS = [
  "hsl(220, 70%, 55%)",   // blue
  "hsl(340, 70%, 55%)",   // pink
  "hsl(160, 60%, 45%)",   // green
  "hsl(45, 80%, 55%)",    // yellow
  "hsl(280, 60%, 55%)",   // purple
  "hsl(15, 75%, 55%)",    // orange
  "hsl(190, 65%, 50%)",   // teal
  "hsl(0, 65%, 55%)",     // red
];

interface CategoryData {
  name: string;
  total: number;
}

interface ExpensePieChartProps {
  data: CategoryData[];
  emptyMessage?: string;
}

export function ExpensePieChart({ data, emptyMessage = "No data" }: ExpensePieChartProps) {
  const locale = useLocale();
  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"         // center X
          cy="50%"         // center Y
          innerRadius={60}  // > 0 makes it a donut (hole in center)
          outerRadius={100}
          paddingAngle={2}  // gap between slices
          dataKey="total"   // which property holds the value
          nameKey="name"    // which property holds the label
        >
          {/* Each <Cell> styles one slice with a color from our palette.
              The index loops around if there are more categories than colors. */}
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number | undefined) => `€${formatAmount(value ?? 0, locale)}`}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
          }}
        />
        <Legend
          wrapperStyle={{
            color: "hsl(var(--foreground))",
            fontSize: "12px",
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
