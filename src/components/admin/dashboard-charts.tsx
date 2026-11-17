import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CountPoint, TrendPoint } from "@/lib/admin/dashboard";
import { formatFlightTime } from "@/lib/utils/time";

const chartColors = ["#0052a5", "#0f766e", "#b45309", "#be123c", "#4338ca"];

export function formatHours(value: number) {
  return formatFlightTime((Number(value) || 0) * 3600);
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(
    Number(value) || 0,
  );
}

export function StatCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ElementType;
}) {
  return (
    <Card>
      <CardContent className="rounded-[12px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-4 py-4">
        <p className="text-[12px] text-[var(--v2-text-text-muted,#525252)]">
          {title}
        </p>
        <p className="mt-2 font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--v2-text-text-base,#171717)]">
          {value}
        </p>
        <p className="mt-2 text-[12px] text-[var(--v2-text-text-faint,#737373)]">
          {detail}
        </p>
        {/* Icon kept in signature for callers; chrome stays quiet. */}
        <span className="sr-only">
          <Icon />
        </span>
      </CardContent>
    </Card>
  );
}

export function MetricTile({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: ElementType;
}) {
  return (
    <div className="rounded-[12px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-4 py-4">
      <p className="text-[12px] text-[var(--v2-text-text-muted,#525252)]">
        {title}
      </p>
      <p className="mt-2 font-mono text-[28px] font-medium tabular-nums leading-none text-[var(--v2-text-text-base,#171717)]">
        {value}
      </p>
      <p className="mt-2 text-[12px] text-[var(--v2-text-text-faint,#737373)]">
        {detail}
      </p>
      <span className="sr-only">
        <Icon />
      </span>
    </div>
  );
}

export function ChartCard({
  title,
  actionHref,
  actionLabel,
  children,
}: {
  title: string;
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {actionHref && actionLabel ? (
          <Button asChild variant="outline" size="sm">
            <Link href={actionHref}>{actionLabel}</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function BarList({ data }: { data: CountPoint[] }) {
  const max = Math.max(...data.map((item) => Number(item.value) || 0), 1);

  if (!data.length) return <EmptyChart label="No data for this range" />;

  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.label} className="grid gap-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium">{item.label}</span>
            <span className="text-muted-foreground">
              {compactNumber(item.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark-theme-bar-track">
            <div
              className="h-full rounded-full bg-primary dark-theme-bar-fill transition-all"
              style={{ width: `${Math.max(5, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SimpleBarChart({ data }: { data: CountPoint[] }) {
  if (!data.length) return <EmptyChart label="No data available" />;

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#0052a5" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({
  data,
  dataKey,
  color,
  className = "h-[260px]",
}: {
  data: TrendPoint[];
  dataKey: "flights" | "hours" | "pilots";
  color?: string;
  className?: string;
}) {
  if (!data.length) return <EmptyChart label="No activity in this range" />;

  const strokeColor = color || "var(--trend-chart-stroke, #0052a5)";

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor="var(--trend-chart-area-start, rgba(0, 82, 165, 0.25))"
                stopOpacity={0.8}
              />
              <stop
                offset="95%"
                stopColor="var(--trend-chart-area-end, rgba(0, 82, 165, 0))"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" minTickGap={28} tick={{ fontSize: 12 }} />
          <YAxis
            allowDecimals
            tick={{ fontSize: 12 }}
            tickFormatter={
              dataKey === "hours"
                ? (value) => formatHours(Number(value))
                : undefined
            }
          />
          <Tooltip
            formatter={(value) =>
              dataKey === "hours"
                ? [formatHours(Number(value)), "Flight time"]
                : [value, dataKey]
            }
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#trendAreaGradient)"
            fillOpacity={1}
            dot={false}
            className="dark-theme-trend-line"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data }: { data: CountPoint[] }) {
  if (!data.some((item) => item.value > 0)) {
    return <EmptyChart label="No data available" />;
  }

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.label}
                fill={chartColors[index % chartColors.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
