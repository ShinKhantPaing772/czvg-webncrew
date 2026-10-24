"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  Clock,
  ImageOff,
  Loader2,
  Plane,
  Plus,
  RefreshCw,
} from "lucide-react";

import {
  BarList,
  DonutChart,
  TrendChart,
} from "@/components/admin/dashboard-charts";
import { CrewHeader } from "@/components/crew-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/components/theme-provider";
import { Icon } from "@iconify/react";
import { AirlineLogo } from "@/components/airline-logo";
import { authFetch } from "@/lib/utils/api";

type RecentPirep = {
  id: number;
  flightnum: string;
  date: string;
  departure: string;
  arrival: string;
  flighttime: string;
  flightTimeInput: string;
  status: number;
  aircraft: {
    id: number;
    name: string;
    liveryname: string | null;
  } | null;
};

type ReceivedAward = {
  id: number;
  name: string | null;
  description: string | null;
  imageurl: string | null;
  dateAwarded: string;
};

type DashboardData = {
  standing: {
    status: number;
    label: string;
  };
  rank: {
    current: {
      id: number;
      name: string;
      timeReqFormatted: string;
    };
    next: {
      id: number;
      name: string;
      timeReqFormatted: string;
      remainingFormatted: string;
    } | null;
    progressToNextRank: number;
  };
  statistics: {
    totalFlightTime: string;
    approvedPireps: number;
    pendingPireps: number;
    rejectedPireps: number;
    recentRejectedPireps: number;
    recentPirepWarningLimit: number;
  };
  awards: {
    ownedAwardIds: number[];
    received: ReceivedAward[];
  };
  recentPireps: RecentPirep[];
};

function SummaryCard({
  icon,
  label,
  value,
  variantIndex = 0,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  variantIndex?: number;
}) {
  const { isHalloween } = useTheme();

  return (
    <Card
      className={`group relative overflow-hidden transition-all ${
        isHalloween ? "border-[#292524] bg-[#1c1917]" : ""
      }`}
    >
      {isHalloween && (
        <>
          {/* Top 1px highlight gradient line */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[1px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(249,115,22,0.4), rgba(168,85,247,0.4), transparent)",
            }}
          />
          {/* Top-right cobweb watermark */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 -right-1 h-10 w-10 text-orange-400 opacity-[0.08] transition-all duration-300 group-hover:scale-105 group-hover:text-orange-300 group-hover:opacity-[0.22]"
          >
            <Icon icon="game-icons:cobweb" className="h-full w-full" />
          </div>
        </>
      )}

      <CardContent className="relative z-10 flex items-center gap-3 p-3 sm:p-4">
        <span
          className={
            isHalloween
              ? variantIndex % 2 === 0
                ? "hidden rounded-md bg-orange-500/15 p-2 text-orange-400 ring-1 ring-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.18)] sm:block"
                : "hidden rounded-md bg-purple-500/15 p-2 text-purple-400 ring-1 ring-purple-500/30 shadow-[0_0_12px_rgba(168,85,247,0.18)] sm:block"
              : "hidden rounded-md bg-[#eef4fb] p-2 text-[#0052a5] sm:block"
          }
        >
          {icon}
        </span>
        <div>
          <p className="text-xl font-semibold sm:text-2xl">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: number }) {
  if (status === 1) {
    return <Badge variant="default">Approved</Badge>;
  }
  if (status === 0) {
    return <Badge variant="secondary">Awaiting approval</Badge>;
  }
  return <Badge variant="destructive">Rejected</Badge>;
}

function parseHoursFromDuration(duration: string) {
  const [hours, minutes] = duration.split(":").map(Number);
  if (!Number.isFinite(hours)) return 0;
  return Number((hours + (Number(minutes) || 0) / 60).toFixed(2));
}

function formatUtcDate(dateStr: string) {
  const dateOnly = dateStr.slice(0, 10);
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function buildReflyHref(flight: RecentPirep) {
  const params = new URLSearchParams({
    flightnum: flight.flightnum,
    departure: flight.departure,
    arrival: flight.arrival,
    flightTime: flight.flightTimeInput || flight.flighttime,
  });
  if (flight.aircraft?.id) {
    params.set("aircraftId", String(flight.aircraft.id));
  }
  return `/crew/file-pirep?${params}`;
}

function displayImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function AwardArtwork({ award }: { award: ReceivedAward }) {
  const imageUrl = displayImageUrl(award.imageurl);

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 shrink-0 object-contain"
      />
    );
  }

  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
      <ImageOff className="h-4 w-4 text-muted-foreground" />
    </span>
  );
}

export default function UserDashboard() {
  const { user, loading: sessionLoading } = useSession();
  const { isHalloween } = useTheme();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");

  async function fetchDashboard(isRefresh = false) {
    if (!user?.id) return;

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await authFetch(`/api/pilots/${user.id}/dashboard`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load pilot dashboard");
      }

      setDashboard(data);
    } catch (fetchError) {
      setDashboard(null);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Failed to load pilot dashboard",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void fetchDashboard(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const visibleFlights = useMemo(() => {
    if (!dashboard) return [];
    const search = query.trim().toLowerCase();

    return dashboard.recentPireps.filter((flight) => {
      if (!search) return true;
      return [
        flight.flightnum,
        flight.departure,
        flight.arrival,
        flight.aircraft?.name,
        flight.aircraft?.liveryname,
      ].some((val) => val?.toLowerCase().includes(search));
    });
  }, [dashboard, query]);

  const chartMetrics = useMemo(() => {
    if (!dashboard) return null;

    const statusData = [
      { label: "Approved", value: dashboard.statistics.approvedPireps },
      { label: "Pending", value: dashboard.statistics.pendingPireps },
      { label: "Rejected", value: dashboard.statistics.rejectedPireps },
    ];

    const chronological = [...dashboard.recentPireps].reverse();
    const trendData = chronological.map((flight) => ({
      date: flight.date,
      label: flight.date.slice(5),
      flights: 1,
      hours: parseHoursFromDuration(flight.flighttime),
      pilots: 1,
    }));

    // Aircraft / airport bars are based on the latest 10 sectors only — not career totals.
    const latestSectors = dashboard.recentPireps.slice(0, 10);
    const depCounts = new Map<string, number>();
    const arrCounts = new Map<string, number>();
    const aircraftCounts = new Map<string, number>();

    for (const flight of latestSectors) {
      depCounts.set(flight.departure, (depCounts.get(flight.departure) || 0) + 1);
      arrCounts.set(flight.arrival, (arrCounts.get(flight.arrival) || 0) + 1);
      const acName = flight.aircraft?.name || "Unknown";
      aircraftCounts.set(acName, (aircraftCounts.get(acName) || 0) + 1);
    }

    const toCountPoints = (map: Map<string, number>) =>
      Array.from(map.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 4);

    return {
      statusData,
      trendData,
      latestSectorCount: latestSectors.length,
      topDepartures: toCountPoints(depCounts),
      topArrivals: toCountPoints(arrCounts),
      topAircraft: toCountPoints(aircraftCounts),
    };
  }, [dashboard]);

  return (
    <CrewHeader>
      <main className="flex-1 space-y-6 pb-24 md:pb-6">
        {(sessionLoading || loading) && (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading pilot workspace…
          </div>
        )}

        {!sessionLoading && !loading && error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {!sessionLoading && !loading && user && dashboard && (
          <>
            {/* Top Header / Festive Banner */}
            <div
              className={
                isHalloween
                  ? "relative flex flex-col gap-4 overflow-hidden rounded-xl border border-orange-500/20 bg-gradient-to-br from-purple-950/30 via-orange-950/15 to-[#1c1917]/90 p-5 shadow-[0_4px_24px_-4px_rgba(147,51,234,0.15)] transition-all sm:flex-row sm:items-center sm:justify-between sm:p-6"
                  : "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
              }
            >
              {isHalloween && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-4 right-2 h-32 w-32 select-none text-amber-500/15 drop-shadow-[0_0_16px_rgba(245,158,11,0.25)] sm:-top-2 sm:right-6 sm:h-40 sm:w-40"
                >
                  <Icon icon="game-icons:moon-bats" className="h-full w-full" />
                </div>
              )}

              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="flex items-center gap-2 text-2xl font-bold">
                    {isHalloween && (
                      <Icon
                        icon="fluent-emoji-flat:jack-o-lantern"
                        className="h-6 w-6 shrink-0"
                      />
                    )}
                    <span>{user.name}</span>
                  </h1>
                  {isHalloween && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-gradient-to-r from-purple-900/70 to-purple-800/50 px-2.5 py-0.5 text-xs font-medium text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                      🎃 万圣夜幽灵机组
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dashboard.rank.next
                    ? `${user.callsign} · ${dashboard.rank.current.name} · ${dashboard.rank.next.remainingFormatted} remaining to ${dashboard.rank.next.name}`
                    : `${user.callsign} · ${dashboard.rank.current.name} · Top rank achieved`}
                </p>
              </div>

              <div className="relative z-10 flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => void fetchDashboard(true)}
                  disabled={refreshing}
                  aria-label="Refresh dashboard"
                  className={isHalloween ? "hover:border-orange-500/40" : ""}
                >
                  <RefreshCw
                    className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")}
                  />
                </Button>
                <Button asChild className={isHalloween ? "halloween-shimmer-btn" : ""}>
                  <Link href="/crew/file-pirep">
                    <Plus className="mr-1 h-4 w-4" />
                    File PIREP
                  </Link>
                </Button>
              </div>
            </div>

            {dashboard.statistics.recentRejectedPireps > 0 && (
              <div
                role="status"
                className="flex flex-col gap-2 rounded-md bg-[var(--v2-state-bg-danger,#fceceb)] px-4 py-2.5 text-sm text-[var(--v2-state-fg-danger,#b82d35)] sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  {dashboard.statistics.recentRejectedPireps === 1
                    ? `${dashboard.statistics.recentRejectedPireps} of your latest ${dashboard.statistics.recentPirepWarningLimit} PIREPs was rejected.`
                    : `${dashboard.statistics.recentRejectedPireps} of your latest ${dashboard.statistics.recentPirepWarningLimit} PIREPs were rejected.`}
                </span>
                <Button asChild variant="secondary">
                  <Link href="/crew/view-pireps">Review PIREPs</Link>
                </Button>
              </div>
            )}

            {/* Summary Metric Row */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              <SummaryCard
                icon={<Clock className="h-4 w-4" />}
                label="Total flight time"
                value={dashboard.statistics.totalFlightTime}
                variantIndex={0}
              />
              <SummaryCard
                icon={<CheckCircle2 className="h-4 w-4" />}
                label="Approved PIREPs"
                value={dashboard.statistics.approvedPireps}
                variantIndex={1}
              />
              <SummaryCard
                icon={<CalendarClock className="h-4 w-4" />}
                label="Pending PIREPs"
                value={dashboard.statistics.pendingPireps}
                variantIndex={2}
              />
              <SummaryCard
                icon={<Award className="h-4 w-4" />}
                label={
                  dashboard.rank.next
                    ? `Next: ${dashboard.rank.next.name}`
                    : "Pilot rank"
                }
                value={dashboard.rank.current.name}
                variantIndex={3}
              />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4 grid w-full grid-cols-2 sm:w-auto sm:inline-flex">
                <TabsTrigger value="overview">
                  Flights &amp; analytics
                </TabsTrigger>
                <TabsTrigger value="awards">Awards &amp; rank</TabsTrigger>
              </TabsList>

              {/* Tab 1: Fused Analytics + Recent Flights (Clean 2-Column Row + Flight List) */}
              <TabsContent value="overview" className="space-y-6">
                {chartMetrics && (
                  <section className="grid items-start gap-10 lg:grid-cols-2">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-medium">
                          Recent Flight Time
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          {`Latest ${chartMetrics.trendData.length} sectors`}
                        </span>
                      </div>
                      <TrendChart
                        data={chartMetrics.trendData}
                        dataKey="hours"
                        className="h-[172px]"
                      />
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-medium">
                          Most Flown Aircraft
                        </h2>
                        <span className="text-xs text-muted-foreground">
                          {`Latest ${chartMetrics.latestSectorCount} sectors`}
                        </span>
                      </div>
                      <BarList data={chartMetrics.topAircraft} />
                    </div>
                  </section>
                )}

                {/* Part B: Recent Flights List (Live aircraft scheduling style) */}
                <section className="space-y-3">
                  <Input
                    aria-label="Search recent flights"
                    placeholder="Search route, flight number, or aircraft"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />

                  {visibleFlights.length === 0 ? (
                    <div className="rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-6 py-10 text-center">
                      <Plane className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
                      <p className="text-[13px] font-medium">
                        No flights to show
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Try another search, or file a new PIREP.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {visibleFlights.map((flight) => (
                        <Card key={flight.id}>
                          <Link
                            href={buildReflyHref(flight)}
                            className="grid w-full gap-4 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--v2-background-bg-layer-02,#f2f2f2)] focus-visible:outline-none md:grid-cols-[1fr_1.3fr_1fr]"
                          >
                            <div>
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <AirlineLogo
                                  flightnum={flight.flightnum}
                                  liveryname={flight.aircraft?.liveryname}
                                  className="h-4 w-auto max-w-[54px] shrink-0 object-contain"
                                />
                                <span className="font-semibold">
                                  {flight.flightnum}
                                </span>
                                <StatusBadge status={flight.status} />
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {flight.aircraft?.name || "Fleet aircraft"}
                                {flight.aircraft?.liveryname
                                  ? ` · ${flight.aircraft.liveryname}`
                                  : ""}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Logged {formatUtcDate(flight.date)}
                              </p>
                            </div>

                            <div>
                              <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
                                <span>{flight.departure}</span>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <span>{flight.arrival}</span>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Block duration {flight.flighttime}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Date {flight.date}
                              </p>
                            </div>

                            <div className="space-y-2 md:text-right">
                              <p className="text-sm">
                                {user.name}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  {user.callsign}
                                </span>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {dashboard.rank.current.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Click to file again
                              </p>
                            </div>
                          </Link>
                        </Card>
                      ))}
                    </div>
                  )}
                </section>
              </TabsContent>

              {/* Tab 2: Awards & Rank */}
              <TabsContent value="awards" className="space-y-4">
                <div className="rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {dashboard.rank.current.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {dashboard.rank.next
                          ? `${dashboard.rank.next.remainingFormatted} remaining to reach ${dashboard.rank.next.name} (${dashboard.rank.next.timeReqFormatted} required)`
                          : "Maximum pilot rank achieved"}
                      </p>
                    </div>
                    <Badge variant="default">
                      {Math.round(dashboard.rank.progressToNextRank)}%
                    </Badge>
                  </div>
                  <Progress
                    value={dashboard.rank.progressToNextRank}
                    className="mt-3 h-1.5"
                  />
                </div>

                <div className="space-y-1.5">
                  {dashboard.awards.received.map((award) => (
                    <div
                      key={award.id}
                      className="grid w-full items-center gap-4 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3.5 md:grid-cols-[1fr_1.5fr_auto]"
                    >
                      <div className="flex items-center gap-3">
                        <AwardArtwork award={award} />
                        <div>
                          <p className="font-semibold">
                            {award.name || "Unnamed award"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pilot Commendation
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {award.description ||
                          "Awarded for operational service."}
                      </p>

                      <div className="text-xs text-muted-foreground md:text-right">
                        Awarded {formatUtcDate(award.dateAwarded)}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </CrewHeader>
  );
}
