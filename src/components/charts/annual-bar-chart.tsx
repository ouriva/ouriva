// Annual Chart
// ============
// Two modes:
//
// Overview (default): two lines — income (emerald) and expenses (red) —
// over the months of the year. The gap between them communicates savings.
//
// Category detail: a single line for one category's monthly values,
// shown when the user selects a row in the category table below.
//
// All colors are set explicitly based on the resolved theme because
// Recharts renders axis labels as SVG presentation attributes (fill="…"),
// which do NOT process CSS custom properties — only HTML inline styles do.
// So we read the theme via useTheme and pick concrete color values.
//
// The data is sliced to maxMonth so future months (all zeros) are not
// shown when viewing the current year.

"use client";

import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { formatAmount } from "@/lib/formatters";
import {
  LineChart,
  Line,
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

// Tooltip container is a plain HTML div so CSS custom properties work fine here.
const TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--popover))",
  color: "hsl(var(--popover-foreground))",
  fontSize: "12px",
};

interface MonthData {
  month: number;
  income: number;
  expense: number;
  net: number;
}

interface AnnualBarChartProps {
  data: MonthData[];
  // Truncate to this month index (1–12). Pass current month for the
  // current year so future zero-value months don't compress the scale.
  maxMonth?: number;
  // When set, renders a single-category line instead of the two-line overview.
  categoryData?: { name: string; months: number[] };
}

export function AnnualBarChart({
  data,
  maxMonth,
  categoryData,
}: AnnualBarChartProps) {
  const { resolvedTheme } = useTheme();
  const locale = useLocale();
  const isDark = resolvedTheme === "dark";

  // Concrete axis label color — must be an explicit value, not a CSS variable,
  // because SVG presentation attributes don't process custom properties.
  const axisColor = isDark ? "hsl(240, 5%, 64%)" : "hsl(240, 5%, 34%)";
  const tickProps = { fontSize: 11, fill: axisColor };
  const yAxisFormatter = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);

  // Shared axis / grid structure used by both modes.
  // Y-axis sits on the right (Revolut-style) so the plot area starts flush
  // with the card's left edge and aligns with the chart card title above it.
  const sharedAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
      <XAxis
        dataKey="name"
        tick={tickProps}
        tickLine={false}
        axisLine={false}
      />
      <YAxis
        orientation="right"
        tick={tickProps}
        tickLine={false}
        axisLine={false}
        width={36}
        tickFormatter={yAxisFormatter}
      />
    </>
  );

  // ── Category detail mode: single line ──────────────────────────────
  if (categoryData) {
    const chartData = categoryData.months
      .slice(0, maxMonth ?? 12)
      .map((amount, i) => ({ name: MONTH_LABELS[i], amount }));

    const lineColor = isDark ? "hsl(220, 70%, 65%)" : "hsl(220, 70%, 55%)";

    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 0, bottom: 0, left: 14 }}
        >
          {sharedAxes}
          <Tooltip
            formatter={(value: number | string | (number | string)[] | readonly (string | number)[] | undefined) =>
              [`€${formatAmount(Number(value ?? 0), locale)}`, categoryData.name] as [string, string]
            }
            contentStyle={TOOLTIP_STYLE}
          />
          <Line
            dataKey="amount"
            stroke={lineColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // ── Overview mode: two lines (income vs expense) ───────────────────
  const incomeColor = isDark ? "hsl(160, 55%, 62%)" : "hsl(160, 60%, 40%)";
  const expenseColor = isDark ? "hsl(0, 70%, 68%)" : "hsl(0, 65%, 50%)";

  const chartData = data
    .slice(0, maxMonth ?? 12)
    .map((d) => ({ ...d, name: MONTH_LABELS[d.month - 1] }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart
        data={chartData}
        margin={{ top: 4, right: 0, bottom: 0, left: 14 }}
      >
        {sharedAxes}
        <Tooltip
          formatter={(value: number | string | (number | string)[] | readonly (string | number)[] | undefined, name: number | string | undefined) =>
            [
              `€${formatAmount(Number(value ?? 0), locale)}`,
              name == null
                ? ""
                : typeof name === "string"
                  ? name.charAt(0).toUpperCase() + name.slice(1)
                  : String(name),
            ] as [string, string]
          }
          contentStyle={TOOLTIP_STYLE}
        />
        <Line
          dataKey="income"
          stroke={incomeColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          type="monotone"
        />
        <Line
          dataKey="expense"
          stroke={expenseColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
          type="monotone"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
