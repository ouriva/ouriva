// Annual Bar Chart
// ================
// Shows income vs expenses for each month of the year.
// Uses grouped bars — one green bar (income) and one red bar
// (expense) side by side for each month.
//
// Key Recharts concepts:
//   <BarChart>      — container for bar charts
//   <XAxis>         — horizontal axis (months)
//   <YAxis>         — vertical axis (amounts)
//   <Bar>           — a data series (one per color)
//   <CartesianGrid> — the background grid lines

"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

interface MonthData {
  month: number;
  income: number;
  expense: number;
  net: number;
}

interface AnnualBarChartProps {
  data: MonthData[];
}

export function AnnualBarChart({ data }: AnnualBarChartProps) {
  // Add month labels to the data
  const chartData = data.map((d) => ({
    ...d,
    name: MONTH_LABELS[d.month - 1],
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData}>
        {/* Grid — dashed lines in the background for readability */}
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />

        {/* X axis — month abbreviations */}
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
        />

        {/* Y axis — auto-scaled amounts, hidden for cleaner mobile look */}
        <YAxis
          tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
          width={60}
          tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
        />

        <Tooltip
          formatter={(value: number | undefined, name: string | undefined) => [
            `€${(value ?? 0).toFixed(2)}`,
            name ? name.charAt(0).toUpperCase() + name.slice(1) : "",
          ]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
          }}
        />

        {/* Two bars per month — income (green) and expense (red) */}
        <Bar dataKey="income" fill="hsl(160, 60%, 45%)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="hsl(0, 65%, 55%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
