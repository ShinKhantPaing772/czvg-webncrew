"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Loader2,
  Plane,
  PlaneTakeoff,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { getAirlineLogoForFlight } from "@/lib/group-airlines";
import { formatFlightTime } from "@/lib/utils/time";
import { authFetch } from "@/lib/utils/api";

interface Route {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  durationSeconds: number;
  notes: string;
  aircraft: {
    id: number | null;
    name: string | null;
    notes: string | null;
    status: string | null;
    rankreq: string | null;
    awardreq: string | null;
    ifliveryid: string | null;
    liveryname: string | null;
    ifaircraftid: string | null;
  }[];
  recentFlights: any[];
}

export default function ViewRoute() {
  const { user } = useSession();
  const params = useParams();
  const routeId = params.id as string;
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [eligibleRankIds, setEligibleRankIds] = useState<number[]>([]);
  const [ownedAwardIds, setOwnedAwardIds] = useState<number[]>([]);
  const [loadingEligibility, setLoadingEligibility] = useState(true);

  function secondsToInput(seconds: number) {
    return formatFlightTime(seconds);
  }

  function filePirepHref(currentRoute: Route) {
    const params = new URLSearchParams({
      flightnum: currentRoute.fltnum || "",
      departure: currentRoute.dep,
      arrival: currentRoute.arr,
      flightTime: secondsToInput(currentRoute.durationSeconds),
    });
    const firstAircraft = currentRoute.aircraft.find(isAircraftEligible);
    if (firstAircraft?.id) {
      params.set("aircraftId", String(firstAircraft.id));
    }

    return `/crew/file-pirep?${params}`;
  }

  function isAircraftEligible(aircraft: Route["aircraft"][number]) {
    if (Number(aircraft.status) !== 1) return false;
    const rankRequirement = Number(aircraft.rankreq) || null;
    const awardRequirement = Number(aircraft.awardreq) || null;
    if (!rankRequirement && !awardRequirement) return false;
    return Boolean(
      (rankRequirement && eligibleRankIds.includes(rankRequirement)) ||
        (awardRequirement && ownedAwardIds.includes(awardRequirement)),
    );
  }

  useEffect(() => {
    const fetchRouteData = async () => {
      try {
        const response = await authFetch(`/api/routes/${routeId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch route data");
        }
        const data = await response.json();
        if (data.success) {
          setRoute(data.data);
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRouteData();
  }, [routeId]);

  useEffect(() => {
    if (!user?.id) return;

    authFetch(`/api/pilots/${user.id}/dashboard`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load aircraft eligibility");
        return response.json();
      })
      .then((data) => {
        setEligibleRankIds(data.rank?.eligibleRankIds || []);
        setOwnedAwardIds(data.awards?.ownedAwardIds || []);
      })
      .catch((error) =>
        console.error("Failed to load aircraft eligibility:", error),
      )
      .finally(() => setLoadingEligibility(false));
  }, [user?.id]);

  if (loading) {
    return (
      <CrewHeader>
        <main className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--v2-text-text-muted,#5c5c5c)]" />
        </main>
      </CrewHeader>
    );
  }

  if (!route) {
    return (
      <CrewHeader>
        <main className="flex flex-1 flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/crew/find-routes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-[18px] font-semibold">Route Not Found</h1>
          </div>
          <p className="text-[13px] text-[var(--v2-text-text-muted,#5c5c5c)]">
            The requested route could not be found.
          </p>
        </main>
      </CrewHeader>
    );
  }

  const eligibleAircraftCount = route.aircraft.filter(isAircraftEligible).length;
  const canFly = eligibleAircraftCount > 0 && !loadingEligibility;

  return (
    <CrewHeader>
      <div className="space-y-5 pb-24 md:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <Button variant="ghost" size="icon" asChild className="mt-0.5">
              <Link href="/crew/find-routes">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    getAirlineLogoForFlight(
                      route.fltnum,
                      route.aircraft[0]?.liveryname,
                    ).logo
                  }
                  alt=""
                  className="h-5 w-auto max-w-[68px] shrink-0 object-contain"
                />
                <h1 className="font-mono text-2xl font-bold">{route.fltnum}</h1>
                <Badge variant={canFly ? "default" : "secondary"}>
                  {canFly ? "Eligible" : "Locked"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {route.notes || `${route.dep} to ${route.arr} scheduled sector`}
              </p>
            </div>
          </div>

          {canFly ? (
            <Button asChild>
              <Link href={filePirepHref(route)}>
                <PlaneTakeoff className="mr-1.5 size-3.5" />
                File PIREP
              </Link>
            </Button>
          ) : (
            <Button
              disabled
              title="You do not meet an aircraft requirement for this route"
            >
              <PlaneTakeoff className="mr-1.5 size-3.5" />
              File PIREP
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <SummaryCard
            icon={Clock}
            label="Scheduled duration"
            value={route.duration}
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Unlocked aircraft"
            value={`${eligibleAircraftCount} / ${route.aircraft.length}`}
          />
          <SummaryCard
            icon={Plane}
            label="Recent dispatches"
            value={route.recentFlights.length}
          />
        </div>

        <div className="grid gap-4 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3.5 md:grid-cols-[1fr_1.3fr_1fr]">
          <div>
            <p className="text-xs text-muted-foreground">Departure airport</p>
            <p className="mt-0.5 font-mono text-xl font-semibold">
              {route.dep}
            </p>
          </div>

          <div className="flex items-center gap-3 text-sm font-medium">
            <span className="font-mono text-base">{route.dep}</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-base">{route.arr}</span>
            <span className="text-xs font-normal text-muted-foreground">
              ({route.duration})
            </span>
          </div>

          <div className="md:text-right">
            <p className="text-xs text-muted-foreground">Arrival airport</p>
            <p className="mt-0.5 font-mono text-xl font-semibold">
              {route.arr}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-2.5">
            <div>
              <h2 className="text-base font-semibold">Assigned Aircraft</h2>
              <p className="text-xs text-muted-foreground">
                Fleet types authorized on {route.fltnum}
              </p>
            </div>
            <div className="space-y-2">
              {route.aircraft.map((ac) => {
                const eligible = isAircraftEligible(ac);
                return (
                  <div
                    key={ac.id}
                    className={`flex items-center justify-between gap-3 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3 ${
                      eligible ? "" : "opacity-55"
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">{ac.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {ac.liveryname || "Standard livery"}
                        {ac.notes ? ` · ${ac.notes}` : ""}
                      </p>
                    </div>
                    <Badge variant={eligible ? "default" : "secondary"}>
                      {eligible ? "Unlocked" : "Locked"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-2.5">
            <div>
              <h2 className="text-base font-semibold">Recent Flights</h2>
              <p className="text-xs text-muted-foreground">
                Latest pilot reports filed on this route
              </p>
            </div>
            {route.recentFlights.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  No recent flights logged on this route.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {route.recentFlights.map((flight) => (
                  <div
                    key={flight.id}
                    className="flex items-center justify-between gap-3 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{flight.pilot}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {flight.pilotCallsign}
                      </p>
                    </div>
                    <div className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                      <p className="font-medium text-foreground">
                        {flight.flightTime}
                      </p>
                      <p>{new Date(flight.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </CrewHeader>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Plane;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className="rounded-md bg-[#eef4fb] p-2 text-[#0052a5]">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="font-mono text-xl font-semibold tabular-nums sm:text-2xl">
            {value}
          </p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
