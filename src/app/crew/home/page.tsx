"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Award,
  Clock,
  FileText,
  Loader2,
  Plane,
  Route,
  Search,
  UserIcon,
} from "lucide-react";

import { CrewHeader } from "@/components/crew-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSession } from "@/hooks/use-session";
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

type RouteSuggestion = {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  durationSeconds: number;
  flightTimeInput: string;
  notes: string | null;
  aircraft: {
    id: number;
    name: string;
    liveryname: string | null;
    rankreq: number | null;
    awardreq: number | null;
  };
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
  };
  recentPireps: RecentPirep[];
  routeSuggestions: RouteSuggestion[];
};

function statusBadge(status: number) {
  if (status === 0) {
    return "border-yellow-200 bg-yellow-50 text-yellow-700";
  }
  if (status === 1) {
    return "border-green-200 bg-green-50 text-green-700";
  }
  return "border-red-200 bg-red-50 text-red-700";
}

function statusLabel(status: number) {
  if (status === 0) return "Pending";
  if (status === 1) return "Accepted";
  return "Rejected";
}

function pirepHref(route: RouteSuggestion) {
  const params = new URLSearchParams({
    flightnum: route.fltnum || "",
    departure: route.dep,
    arrival: route.arr,
    flightTime: route.flightTimeInput,
    aircraftId: String(route.aircraft.id),
  });

  return `/crew/file-pirep?${params}`;
}

export default function UserDashboard() {
  const { user, loading: sessionLoading } = useSession();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchDashboard() {
      if (!user?.id) return;

      setLoading(true);
      setError(null);

      try {
        const response = await authFetch(`/api/pilots/${user.id}/dashboard`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load pilot dashboard");
        }

        if (mounted) {
          setDashboard(data);
        }
      } catch (fetchError) {
        if (mounted) {
          setDashboard(null);
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load pilot dashboard",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchDashboard();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  return (
    <CrewHeader>
      {(sessionLoading || loading) && (
        <div className="flex min-h-[420px] items-center justify-center">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading pilot dashboard...
        </div>
      )}

      {!sessionLoading && !loading && error && (
        <Card>
          <CardContent className="py-8">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!sessionLoading && !loading && user && dashboard && (
        <main className="flex flex-1 flex-col gap-5 md:gap-7">
          <section className="grid gap-3">
            <Card className="py-0">
              <CardContent className="p-3 sm:p-4">
                <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-xl font-bold sm:text-2xl">
                          {user.name}
                        </h1>
                        <Badge variant="outline">{dashboard.standing.label}</Badge>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="bg-slate-50">
                          {user.callsign}
                        </Badge>
                        <span className="truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href="/crew/file-pirep">
                        <FileText className="mr-2 h-4 w-4" />
                        File PIREP
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/crew/find-routes">
                        <Search className="mr-2 h-4 w-4" />
                        Find Routes
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gap-3 py-4">
              <CardHeader className="px-4 pb-0 sm:px-5">
                <CardTitle className="text-base">Rank Progress</CardTitle>
                <CardDescription>
                  {dashboard.rank.next
                    ? `${dashboard.rank.next.remainingFormatted} until ${dashboard.rank.next.name}`
                    : "Top rank reached"}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-0 sm:px-5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{dashboard.rank.current.name}</span>
                  <span className="text-muted-foreground">
                    {dashboard.rank.next?.name || "Maximum rank"}
                  </span>
                </div>
                <Progress
                  value={dashboard.rank.progressToNextRank}
                  className="mt-2 h-2.5 bg-slate-200"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {Math.round(dashboard.rank.progressToNextRank)}% complete
                </p>
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Flight Time
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard.statistics.totalFlightTime}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved PIREP time
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Approved PIREPs
                </CardTitle>
                <Plane className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard.statistics.approvedPireps}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Counted toward rank
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending PIREPs
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard.statistics.pendingPireps}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Awaiting staff review
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Member Since</CardTitle>
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {new Date(user.joined).toLocaleDateString()}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Current rank: {dashboard.rank.current.name}
                </p>
              </CardContent>
            </Card>
          </section>

          {dashboard.statistics.rejectedPireps > 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-red-800">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">
                    {dashboard.statistics.rejectedPireps} rejected PIREP
                    {dashboard.statistics.rejectedPireps === 1 ? "" : "s"} may
                    need attention.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href="/crew/view-pireps">Review PIREPs</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle>Suggested Routes</CardTitle>
                <CardDescription>
                  Rank-eligible routes with a mix of flight lengths.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {dashboard.routeSuggestions.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No eligible route suggestions yet.
                  </div>
                ) : (
                  dashboard.routeSuggestions.map((route) => (
                    <div
                      key={route.id}
                      className="rounded-md border p-4 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{route.fltnum}</p>
                            <Badge variant="outline">
                              {route.dep} <ArrowRight className="h-3 w-3" />{" "}
                              {route.arr}
                            </Badge>
                            <Badge variant="outline">{route.duration}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {route.aircraft.name}
                            {route.aircraft.liveryname
                              ? ` · ${route.aircraft.liveryname}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/crew/route/${route.id}`}>View</Link>
                          </Button>
                          <Button asChild size="sm">
                            <Link href={pirepHref(route)}>File</Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Flights</CardTitle>
                <CardDescription>Your latest PIREP activity</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flight</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Aircraft</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard.recentPireps.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          No PIREPs filed yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      dashboard.recentPireps.slice(0, 6).map((flight) => (
                        <TableRow key={flight.id}>
                          <TableCell className="font-medium">
                            <div>{flight.flightnum}</div>
                            <div className="text-xs text-muted-foreground">
                              {flight.date}
                            </div>
                          </TableCell>
                          <TableCell>
                            {flight.departure} → {flight.arrival}
                          </TableCell>
                          <TableCell>
                            {flight.aircraft
                              ? `${flight.aircraft.name}${
                                  flight.aircraft.liveryname
                                    ? ` (${flight.aircraft.liveryname})`
                                    : ""
                                }`
                              : "N/A"}
                          </TableCell>
                          <TableCell>{flight.flighttime}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={statusBadge(flight.status)}
                            >
                              {statusLabel(flight.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </main>
      )}
    </CrewHeader>
  );
}
