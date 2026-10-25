"use client";

import { Bar, BarChart, CartesianGrid, ErrorBar, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/components/ThemeToggle";

export interface ChartSeries {
  key: string;
  name: string;
  colorIndex: 1 | 2 | 3 | 4;
}
/** One row per language; `${key}` is a percentage, `${key}_err` is [minus, plus] distance to the 95% CI. */
export type ChartRow = { lang: string } & Record<string, number | [number, number] | string | null>;

// Mirrors --series-* in app/globals.css (SVG attributes cannot read CSS variables reliably).
const SERIES = {
  light: { 1: "#171717", 2: "#6B6B6B", 3: "#A66BFF", 4: "#5B21B6", ink: "#171717", grid: "#D4D4D4", surface: "#FFFBE6" },
  dark: { 1: "#FFF21A", 2: "#6B6B6B", 3: "#A66BFF", 4: "#FFFBE6", ink: "#FFFBE6", grid: "#6B6B6B", surface: "#171717" },
} as const;

export function MetricChart({ rows, series, yLabel }: { rows: ChartRow[]; series: ChartSeries[]; yLabel: string }) {
  const c = SERIES[useTheme()];
  return (
    <div className="h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 8, left: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="lang" tick={{ fill: c.ink, fontSize: 12 }} axisLine={{ stroke: c.ink }} tickLine={false} />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fill: c.ink, fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={44}
            label={{ value: yLabel, angle: -90, position: "insideLeft", fill: c.ink, fontSize: 11, dx: 6, dy: 40 }}
          />
          <Tooltip
            cursor={{ fill: c.grid, opacity: 0.35 }}
            contentStyle={{ background: c.surface, border: `2px solid ${c.ink}`, borderRadius: 12, color: c.ink }}
            labelStyle={{ color: c.ink, fontWeight: 700 }}
            itemStyle={{ color: c.ink }}
            formatter={(v) => (typeof v === "number" ? `${v.toFixed(1)}%` : "–")}
          />
          {/* Legend text in ink colour (series colours are too light for small text); colour stays on the swatch. */}
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value: string) => <span style={{ color: c.ink }}>{value}</span>}
          />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.name} fill={c[s.colorIndex]} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              <ErrorBar dataKey={`${s.key}_err`} width={4} strokeWidth={1.5} stroke={c.ink} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
