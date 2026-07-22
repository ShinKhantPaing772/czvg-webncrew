import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import {
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
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
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
    <div className="rounded-md border bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
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
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary"
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
  color = "#0052a5",
}: {
  data: TrendPoint[];
  dataKey: "flights" | "hours" | "pilots";
  color?: string;
}) {
  if (!data.length) return <EmptyChart label="No activity in this range" />;

  return (
    <div className="h-[260px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
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
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
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
