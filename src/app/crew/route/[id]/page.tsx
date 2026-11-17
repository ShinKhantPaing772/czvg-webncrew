"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  PlaneTakeoff,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import {
  CrewCallsign,
  CrewEmpty,
  CrewMeta,
  CrewPageHeader,
  CrewPanel,
  CrewSector,
} from "@/components/crew-ui";
import { airportCity } from "@/lib/airports";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { AirlineLogo } from "@/components/airline-logo";
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
        <div className="flex items-start gap-2">
          <Button variant="ghost" size="icon" asChild className="mt-1 shrink-0">
            <Link href="/crew/find-routes" aria-label="Back to routes">
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </Link>
          </Button>
          <CrewPageHeader
            className="min-w-0 flex-1"
            title={
              <span className="inline-flex flex-wrap items-center gap-2.5">
                <AirlineLogo
                  flightnum={route.fltnum}
                  liveryname={route.aircraft[0]?.liveryname}
                  className="h-5 w-auto max-w-[68px] shrink-0 object-contain"
                />
                <CrewCallsign className="text-[28px] font-medium md:text-[32px]">
                  {route.fltnum}
                </CrewCallsign>
                <Badge variant={canFly ? "default" : "secondary"}>
                  {canFly ? "Eligible" : "Locked"}
                </Badge>
              </span>
            }
            meta={
              <CrewMeta
                items={[
                  route.notes || `${route.dep} → ${route.arr}`,
                  `${eligibleAircraftCount}/${route.aircraft.length} unlocked`,
                  `${route.recentFlights.length} recent`,
                ]}
              />
            }
            actions={
              canFly ? (
                <Button asChild>
                  <Link href={filePirepHref(route)}>
                    <PlaneTakeoff className="size-3.5" strokeWidth={1.5} />
                    File PIREP
                  </Link>
                </Button>
              ) : (
                <Button
                  disabled
                  title="You do not meet an aircraft requirement for this route"
                >
                  <PlaneTakeoff className="size-3.5" strokeWidth={1.5} />
                  File PIREP
                </Button>
              )
            }
          />
        </div>

        <CrewSector
          size="lg"
          departure={route.dep}
          arrival={route.arr}
          departureName={airportCity(route.dep)}
          arrivalName={airportCity(route.arr)}
          duration={route.duration}
          durationHint="Scheduled"
          footer={
            <CrewMeta
              className="mt-0"
              items={[
                `${eligibleAircraftCount} aircraft unlocked`,
                `${route.recentFlights.length} recent sectors`,
              ]}
            />
          }
        />

        <div className="grid gap-8 lg:grid-cols-2">
          <CrewPanel title="Aircraft">
            <div className="space-y-2">
              {route.aircraft.map((ac) => {
                const eligible = isAircraftEligible(ac);
                return (
                  <div
                    key={ac.id}
                    className={`flex items-center justify-between gap-3 rounded-[14px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-4 py-3 ${
                      eligible ? "" : "opacity-55"
                    }`}
                  >
                    <div>
                      <p className="text-[13px] font-medium">{ac.name}</p>
                      <p className="text-[12px] text-[var(--v2-text-text-faint,#737373)]">
                        {ac.liveryname || "Standard livery"}
                      </p>
                    </div>
                    <Badge variant={eligible ? "default" : "secondary"}>
                      {eligible ? "Unlocked" : "Locked"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CrewPanel>

          <CrewPanel title="Recent flights">
            {route.recentFlights.length === 0 ? (
              <CrewEmpty title="No recent flights" description="Be the first to file this sector" />
            ) : (
              <div className="space-y-2">
                {route.recentFlights.map((flight) => (
                  <div
                    key={flight.id}
                    className="flex items-center justify-between gap-3 rounded-[14px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-4 py-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium">{flight.pilot}</p>
                      <p className="font-mono text-[12px] tabular-nums text-[var(--v2-text-text-faint,#737373)]">
                        {flight.pilotCallsign}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[12px] tabular-nums text-[var(--v2-text-text-faint,#737373)]">
                      <p className="font-medium text-[var(--v2-text-text-base,#171717)]">
                        {flight.flightTime}
                      </p>
                      <p>{new Date(flight.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CrewPanel>
        </div>
      </div>
    </CrewHeader>
  );
}
