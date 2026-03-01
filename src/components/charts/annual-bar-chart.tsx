// Annual Bar Chart
// ================
// Shows income vs expenses per month as grouped bars, with a net line
// overlay that makes the savings trend immediately readable without
// mental arithmetic. Uses Recharts ComposedChart to mix bars and a line.

"use client";

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
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
  const chartData = data.map((d) => ({
    ...d,
    name: MONTH_LABELS[d.month - 1],
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={chartData} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />

        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
        />

        <YAxis
          tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
          tickLine={false}
          axisLine={false}
          width={55}
          tickFormatter={(v) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
          }
        />

        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter={(value: any, name: any) => [
            `€${Number(value).toFixed(2)}`,
            typeof name === "string" ? name.charAt(0).toUpperCase() + name.slice(1) : String(name),
          ] as any}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            backgroundColor: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            fontSize: "12px",
          }}
        />

        {/* Zero baseline for net line */}
        <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />

        {/* Income and expense bars */}
        <Bar dataKey="income" fill="hsl(160, 60%, 45%)" radius={[3, 3, 0, 0]} maxBarSize={20} />
        <Bar dataKey="expense" fill="hsl(0, 65%, 55%)" radius={[3, 3, 0, 0]} maxBarSize={20} />

        {/* Net line — amber so it stands out from the green/red bars */}
        <Line
          dataKey="net"
          stroke="hsl(45, 80%, 55%)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          type="monotone"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
