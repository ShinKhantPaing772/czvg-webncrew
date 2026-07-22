"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarIcon,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  MapPinned,
  Plane,
  Route,
  Shield,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { DayPicker } from "react-day-picker";

import {
  BarList,
  ChartCard,
  compactNumber,
  DonutChart,
  formatHours,
  MetricTile,
  SimpleBarChart,
  StatCard,
  TrendChart,
} from "@/components/admin/dashboard-charts";
import { CrewHeader } from "@/components/crew-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import {
  type AnalyticsResponse,
  type DateRange,
  hasClientPermission,
  presetRange,
  statusChartData,
  thisYearRange,
  toDateInput,
} from "@/lib/admin/dashboard";
import { authFetch } from "@/lib/utils/api";

export default function AdminDashboard() {
  const { user } = useSession();
  const [range, setRange] = useState<DateRange>(presetRange(30));
  const [selected, setSelected] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: range.from, to: range.to });
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          startDate: toDateInput(range.from),
          endDate: toDateInput(range.to),
        });
        const response = await authFetch(`/api/admin/dashboard/analytics?${params}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to load admin analytics");
        }

        if (mounted) {
          setAnalytics(data);
        }
      } catch (loadError) {
        if (mounted) {
          setAnalytics(null);
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load admin analytics",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      mounted = false;
    };
  }, [range]);

  const allowedSections = useMemo(() => {
    const sections = analytics?.sections;
    if (!sections) return [];

    return [
      {
        id: "pireps",
        label: "PIREPs",
        permission: "pireps",
        available: Boolean(sections.pireps),
      },
      {
        id: "users",
        label: "Users",
        permission: "users",
        available: Boolean(sections.users),
      },
      {
        id: "routes",
        label: "Routes",
        permission: "routes",
        available: Boolean(sections.routes),
      },
      {
        id: "aircrafts",
        label: "Aircraft",
        permission: "aircrafts",
        available: Boolean(sections.aircrafts),
      },
      {
        id: "permissions",
        label: "Permissions",
        permission: "permissions",
        available: Boolean(sections.permissions),
      },
    ].filter(
      (section) =>
        section.available && hasClientPermission(user?.Permissions, section.permission),
    );
  }, [analytics?.sections, user?.Permissions]);

  const overview = analytics?.sections.overview;

  function applyPreset(nextRange: DateRange) {
    setRange(nextRange);
    setSelected({ from: nextRange.from, to: nextRange.to });
  }

  return (
    <CrewHeader>
      <main className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">Admin Analytics</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Showing operational metrics for{" "}
              {format(range.from, "LLL dd, y")} to {format(range.to, "LLL dd, y")}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["7 days", presetRange(7)],
              ["30 days", presetRange(30)],
              ["90 days", presetRange(90)],
              ["This year", thisYearRange()],
            ].map(([label, nextRange]) => (
              <Button
                key={label as string}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(nextRange as DateRange)}
              >
                {label as string}
              </Button>
            ))}

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Custom
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto bg-white p-4" align="end">
                <div className="flex flex-col gap-4">
                  <DayPicker
                    mode="range"
                    today={new Date()}
                    disabled={{ after: new Date() }}
                    selected={selected}
                    onSelect={(nextSelected) => {
                      setSelected({
                        from: nextSelected?.from,
                        to: nextSelected?.to,
                      });
                    }}
                    numberOfMonths={2}
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {selected.from && selected.to
                        ? `${format(selected.from, "LLL dd, y")} to ${format(
                            selected.to,
                            "LLL dd, y",
                          )}`
                        : "Select a date range"}
                    </p>
                    <Button
                      type="button"
                      disabled={!selected.from || !selected.to}
                      onClick={() => {
                        if (selected.from && selected.to) {
                          setRange({ from: selected.from, to: selected.to });
                        }
                      }}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-md border bg-white text-sm text-muted-foreground">
            Loading admin analytics...
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm font-medium text-red-700">{error}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check database access and try again.
              </p>
            </CardContent>
          </Card>
        ) : overview ? (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="Active Pilots"
                value={compactNumber(overview.totalPilots)}
                detail={`${compactNumber(overview.range.newPilots)} joined in range`}
                icon={Users}
              />
              <StatCard
                title="Approved PIREPs"
                value={compactNumber(overview.totalFlights)}
                detail={`${compactNumber(
                  overview.range.approvedPireps,
                )} approved in range`}
                icon={FileText}
              />
              <StatCard
                title="Flight Hours"
                value={formatHours(overview.totalHours)}
                detail={`${formatHours(overview.range.flightHours)} in range`}
                icon={Clock}
              />
              <StatCard
                title="Pending PIREPs"
                value={compactNumber(overview.pendingPireps)}
                detail="Awaiting review"
                icon={Activity}
              />
            </section>

            {allowedSections.length === 0 ? (
              <Card>
                <CardContent className="flex min-h-[180px] flex-col items-center justify-center text-center">
                  <Shield className="h-8 w-8 text-muted-foreground" />
                  <h2 className="mt-3 text-lg font-semibold">
                    No additional analytics available
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Your account has dashboard access, but no section-specific
                    permissions for PIREPs, users, routes, aircraft, or permissions.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Tabs key={allowedSections.map((item) => item.id).join("-")} defaultValue={allowedSections[0].id}>
                <TabsList className="max-w-full flex-wrap justify-start overflow-x-auto">
                  {allowedSections.map((section) => (
                    <TabsTrigger key={section.id} value={section.id}>
                      {section.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {analytics?.sections.pireps &&
                hasClientPermission(user?.Permissions, "pireps") ? (
                  <TabsContent value="pireps" className="grid gap-4 lg:grid-cols-2">
                    <ChartCard
                      title="PIREP Status"
                      actionHref="/crew/admin/pireps"
                      actionLabel="Review"
                    >
                      <DonutChart
                        data={statusChartData(analytics.sections.pireps.statusCounts)}
                      />
                    </ChartCard>
                    <ChartCard title="Approved Flight Time">
                      <TrendChart
                        data={analytics.sections.pireps.trends}
                        dataKey="hours"
                      />
                    </ChartCard>
                    <ChartCard title="PIREP Volume">
                      <TrendChart
                        data={analytics.sections.pireps.trends}
                        dataKey="flights"
                        color="#0f766e"
                      />
                    </ChartCard>
                    <ChartCard title="Busiest PIREP Airports">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <p className="mb-3 text-sm font-medium">Departures</p>
                          <BarList data={analytics.sections.pireps.topDepartures} />
                        </div>
                        <div>
                          <p className="mb-3 text-sm font-medium">Arrivals</p>
                          <BarList data={analytics.sections.pireps.topArrivals} />
                        </div>
                      </div>
                    </ChartCard>
                  </TabsContent>
                ) : null}

                {analytics?.sections.users &&
                hasClientPermission(user?.Permissions, "users") ? (
                  <TabsContent value="users" className="grid gap-4 lg:grid-cols-2">
                    <ChartCard
                      title="Pilot Status"
                      actionHref="/crew/admin/users"
                      actionLabel="Manage"
                    >
                      <DonutChart
                        data={statusChartData(analytics.sections.users.pilotStatusCounts)}
                      />
                    </ChartCard>
                    <ChartCard title="Pilot Growth">
                      <TrendChart
                        data={analytics.sections.users.growth}
                        dataKey="pilots"
                        color="#0f766e"
                      />
                    </ChartCard>
                    <ChartCard title="Application Pipeline">
                      <SimpleBarChart data={analytics.sections.users.applicationPipeline} />
                    </ChartCard>
                    <ChartCard title="Pilot Activity">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <MetricTile
                          title="Recently Active"
                          value={compactNumber(
                            analytics.sections.users.activity.recentlyActive,
                          )}
                          detail="Approved flight in last 30 days"
                          icon={Activity}
                        />
                        <MetricTile
                          title="Inactive"
                          value={compactNumber(
                            analytics.sections.users.activity.inactive,
                          )}
                          detail="No approved flight in last 30 days"
                          icon={Users}
                        />
                      </div>
                    </ChartCard>
                  </TabsContent>
                ) : null}

                {analytics?.sections.routes &&
                hasClientPermission(user?.Permissions, "routes") ? (
                  <TabsContent value="routes" className="grid gap-4 lg:grid-cols-2">
                    <ChartCard
                      title="Route Duration Distribution"
                      actionHref="/crew/admin/routes"
                      actionLabel="Manage"
                    >
                      <SimpleBarChart data={analytics.sections.routes.durationBuckets} />
                    </ChartCard>
                    <ChartCard title="Top Departure Airports">
                      <BarList data={analytics.sections.routes.topDepartures} />
                    </ChartCard>
                    <ChartCard title="Top Arrival Airports">
                      <BarList data={analytics.sections.routes.topArrivals} />
                    </ChartCard>
                    <ChartCard title="Route Coverage">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <MetricTile
                          title="Routes"
                          value={compactNumber(analytics.sections.routes.totalRoutes)}
                          detail="Published route records"
                          icon={Route}
                        />
                        <MetricTile
                          title="Aircraft"
                          value={compactNumber(overview.activeAircraft)}
                          detail="Active aircraft available"
                          icon={Plane}
                        />
                      </div>
                    </ChartCard>
                  </TabsContent>
                ) : null}

                {analytics?.sections.aircrafts &&
                hasClientPermission(user?.Permissions, "aircrafts") ? (
                  <TabsContent value="aircrafts" className="grid gap-4 lg:grid-cols-2">
                    <ChartCard
                      title="Most Used Aircraft"
                      actionHref="/crew/admin/aircrafts"
                      actionLabel="Manage"
                    >
                      <BarList data={analytics.sections.aircrafts.usage} />
                    </ChartCard>
                    <ChartCard title="Active Livery Breakdown">
                      <SimpleBarChart
                        data={analytics.sections.aircrafts.liveryBreakdown}
                      />
                    </ChartCard>
                    <ChartCard title="Aircraft Inventory">
                      <MetricTile
                        title="Active Aircraft"
                        value={compactNumber(analytics.sections.aircrafts.activeAircraft)}
                        detail="Available for route and PIREP use"
                        icon={Plane}
                      />
                    </ChartCard>
                  </TabsContent>
                ) : null}

                {analytics?.sections.permissions &&
                hasClientPermission(user?.Permissions, "permissions") ? (
                  <TabsContent value="permissions" className="grid gap-4 lg:grid-cols-2">
                    <ChartCard
                      title="Admin Permission Distribution"
                      actionHref="/crew/admin/permissions"
                      actionLabel="Manage"
                    >
                      <SimpleBarChart
                        data={analytics.sections.permissions.distribution}
                      />
                    </ChartCard>
                    <ChartCard title="Admin Access">
                      <MetricTile
                        title="Admin Users"
                        value={compactNumber(
                          analytics.sections.permissions.adminCount,
                        )}
                        detail="Pilots with at least one admin permission"
                        icon={KeyRound}
                      />
                    </ChartCard>
                  </TabsContent>
                ) : null}
              </Tabs>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <MapPinned className="h-4 w-4" />
                  Live Flight Map
                </CardTitle>
                <Badge variant="outline">External</Badge>
              </CardHeader>
              <CardContent>
                <div className="h-[420px] w-full overflow-hidden rounded-md border bg-slate-50 md:h-[560px]">
                  <iframe
                    src={overview.liveMapUrl}
                    title="CZVG Live Flight Map"
                    width="100%"
                    height="100%"
                    className="block border-0"
                    loading="lazy"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              No dashboard data is available.
            </CardContent>
          </Card>
        )}
      </main>
    </CrewHeader>
  );
}
