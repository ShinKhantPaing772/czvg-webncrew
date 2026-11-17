"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  PlaneTakeoff,
  Save,
  X,
} from "lucide-react";

import { CrewHeader } from "@/components/crew-header";
import {
  CrewEmpty,
  CrewFlightRow,
  CrewPageHeader,
  CrewStat,
} from "@/components/crew-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useSession } from "@/hooks/use-session";
import { authFetch } from "@/lib/utils/api";
import { formatFlightTime } from "@/lib/utils/time";

const SAVED_FILTERS_KEY = "czvg.routeSavedFilters";

type Aircraft = {
  id: string;
  name: string;
  liveryname: string | null;
  ifaircraftid?: string;
  ifliveryid?: string;
  status?: number | null;
  notes?: string | null;
  rankreq?: number | null;
  awardreq?: number | null;
};

type RouteItem = {
  id: string;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  durationSeconds: number;
  notes: string | null;
  aircraft: Aircraft[];
};

type Filters = {
  searchQuery: string;
  departureFilter: string;
  arrivalFilter: string;
  aircraftFilter: string;
  durationRange: string;
  eligibleOnly: boolean;
};

type SavedFilter = Filters & {
  id: string;
  label: string;
};

type PilotDashboard = {
  rank: {
    eligibleRankIds: number[];
  };
  awards: {
    ownedAwardIds: number[];
  };
};

function SummaryCard({
  label,
  count,
  accent = false,
}: {
  label: string;
  count: number | string;
  accent?: boolean;
}) {
  return <CrewStat label={label} value={count} accent={accent} />;
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function secondsToInput(seconds: number) {
  return formatFlightTime(seconds);
}

function secondsToLabel(seconds: number) {
  return formatFlightTime(seconds);
}

function filterLabel(filters: Filters) {
  const parts = [
    filters.departureFilter && `From ${filters.departureFilter.toUpperCase()}`,
    filters.arrivalFilter && `To ${filters.arrivalFilter.toUpperCase()}`,
    filters.searchQuery && `Flight ${filters.searchQuery}`,
    filters.eligibleOnly && "Eligible",
  ].filter(Boolean);

  return parts.length ? parts.join(" · ") : "All routes";
}

function normalizeIcao(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase();
}

export default function FindRoutes() {
  const { user } = useSession();
  const [filters, setFilters] = useState<Filters>({
    searchQuery: "",
    departureFilter: "",
    arrivalFilter: "",
    aircraftFilter: "all",
    durationRange: "",
    eligibleOnly: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [routesData, setRoutesData] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aircraftData, setAircraftData] = useState<Aircraft[]>([]);
  const [eligibleRankIds, setEligibleRankIds] = useState<number[]>([]);
  const [ownedAwardIds, setOwnedAwardIds] = useState<number[]>([]);
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const isInitialRouteFetch = useRef(true);

  useEffect(() => {
    setSavedFilters(readStorage<SavedFilter[]>(SAVED_FILTERS_KEY, []));
  }, []);

  useEffect(() => {
    async function fetchAircraft() {
      try {
        const response = await authFetch("/api/aircraft");
        if (!response.ok) throw new Error("Failed to fetch aircraft");
        const data = await response.json();
        setAircraftData(data.aircrafts || []);
      } catch (fetchError) {
        console.error("Error fetching aircraft:", fetchError);
      }
    }

    void fetchAircraft();
  }, []);

  useEffect(() => {
    async function fetchEligibility() {
      if (!user?.id) return;

      try {
        const response = await authFetch(`/api/pilots/${user.id}/dashboard`);
        if (!response.ok) return;
        const data: PilotDashboard = await response.json();
        setEligibleRankIds(data.rank?.eligibleRankIds || []);
        setOwnedAwardIds(data.awards?.ownedAwardIds || []);
      } catch (fetchError) {
        console.error("Failed to load route eligibility:", fetchError);
      } finally {
        setLoadingEligibility(false);
      }
    }

    void fetchEligibility();
  }, [user?.id]);

  useEffect(() => {
    const delayMs = isInitialRouteFetch.current ? 0 : 180;
    isInitialRouteFetch.current = false;

    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const url = new URL("/api/routes", window.location.origin);
        url.searchParams.set("limit", "500");
        if (filters.searchQuery.trim()) {
          url.searchParams.set("fltnum", filters.searchQuery.trim());
        }
        if (filters.departureFilter.trim()) {
          url.searchParams.set("dep", normalizeIcao(filters.departureFilter));
        }
        if (filters.arrivalFilter.trim()) {
          url.searchParams.set("arr", normalizeIcao(filters.arrivalFilter));
        }
        if (filters.aircraftFilter && filters.aircraftFilter !== "all") {
          url.searchParams.set("aircraftId", filters.aircraftFilter);
        }
        if (filters.durationRange) {
          const [min, max] = filters.durationRange.split("-").map(Number);
          if (Number.isFinite(min)) url.searchParams.set("minDuration", `${min}`);
          if (Number.isFinite(max) && max > 0) {
            url.searchParams.set("maxDuration", `${max}`);
          }
        }

        const response = await authFetch(`${url.pathname}${url.search}`);
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to fetch routes");
        }

        const rawRoutes = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.routes)
            ? data.routes
            : [];

        setRoutesData(
          rawRoutes.map((route: RouteItem) => ({
            ...route,
            durationSeconds: Number(route.durationSeconds) || 0,
            duration: secondsToLabel(Number(route.durationSeconds) || 0),
            aircraft: route.aircraft || [],
          })),
        );
      } catch (fetchError) {
        setRoutesData([]);
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Failed to fetch routes",
        );
      } finally {
        setLoading(false);
      }
    }, delayMs);

    return () => window.clearTimeout(timeout);
  }, [filters]);

  const isAircraftEligible = useCallback(
    (aircraft: Aircraft) => {
      const rankRequirement = Number(aircraft.rankreq) || null;
      const awardRequirement = Number(aircraft.awardreq) || null;
      if (!rankRequirement && !awardRequirement) return false;

      return Boolean(
        (rankRequirement && eligibleRankIds.includes(rankRequirement)) ||
          (awardRequirement && ownedAwardIds.includes(awardRequirement)),
      );
    },
    [eligibleRankIds, ownedAwardIds],
  );

  const eligibleAircraft = useCallback(
    (route: RouteItem) => route.aircraft.filter(isAircraftEligible),
    [isAircraftEligible],
  );

  const filteredRoutes = useMemo(() => {
    return filters.eligibleOnly
      ? routesData
          .map((route) => ({
            ...route,
            aircraft: eligibleAircraft(route),
          }))
          .filter((route) => route.aircraft.length > 0)
      : routesData;
  }, [routesData, filters.eligibleOnly, eligibleAircraft]);

  const eligibleRoutesCount = useMemo(
    () =>
      routesData.filter((route) => eligibleAircraft(route).length > 0).length,
    [routesData, eligibleAircraft],
  );

  const unlockedFleetCount = useMemo(
    () => aircraftData.filter(isAircraftEligible).length,
    [aircraftData, isAircraftEligible],
  );

  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);
  const paginatedRoutes = filteredRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    const lastPage = Math.max(totalPages, 1);
    if (currentPage > lastPage) {
      setCurrentPage(lastPage);
    }
  }, [currentPage, totalPages]);

  function updateFilters(next: Partial<Filters>) {
    setCurrentPage(1);
    setFilters((current) => ({ ...current, ...next }));
  }

  function saveCurrentFilter() {
    const saved: SavedFilter = {
      ...filters,
      id: `${Date.now()}`,
      label: filterLabel(filters),
    };
    setSavedFilters((current) => {
      const next = [
        saved,
        ...current.filter((item) => item.label !== saved.label),
      ].slice(0, 6);
      writeStorage(SAVED_FILTERS_KEY, next);
      return next;
    });
  }

  function removeSavedFilter(id: string) {
    setSavedFilters((current) => {
      const next = current.filter((item) => item.id !== id);
      writeStorage(SAVED_FILTERS_KEY, next);
      return next;
    });
  }

  function applyFilter(saved: Filters) {
    setCurrentPage(1);
    setFilters(saved);
  }

  function filePirepHref(route: RouteItem) {
    const aircraft =
      eligibleAircraft(route).find(
        (item) => String(item.id) === filters.aircraftFilter,
      ) || eligibleAircraft(route)[0];
    const params = new URLSearchParams({
      flightnum: route.fltnum || "",
      departure: route.dep,
      arrival: route.arr,
      flightTime: secondsToInput(route.durationSeconds),
    });

    if (aircraft?.id) params.set("aircraftId", String(aircraft.id));

    return `/crew/file-pirep?${params}`;
  }

  return (
    <CrewHeader>
      <main className="flex-1 space-y-5 pb-24 md:pb-6">
        {/* Top Header — Matches `Live aircraft scheduling` */}
        <CrewPageHeader
          title="Find routes"
          meta={<p className="mt-2 text-[13px] text-[var(--v2-text-text-muted,#525252)]">Search the CZVG network and open a PIREP</p>}
          actions={
            <>
              <Button type="button" variant="outline" onClick={saveCurrentFilter}>
                <Save className="h-4 w-4" strokeWidth={1.5} />
                Save filter
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCurrentPage(1);
                  setFilters({
                    searchQuery: "",
                    departureFilter: "",
                    arrivalFilter: "",
                    aircraftFilter: "all",
                    durationRange: "",
                    eligibleOnly: false,
                  });
                }}
              >
                Clear
              </Button>
            </>
          }
        />

        {/* Summary Row — Matches `Live aircraft scheduling` */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Matching" count={filteredRoutes.length} accent />
          <SummaryCard label="Eligible" count={eligibleRoutesCount} />
          <SummaryCard label="Unlocked fleet" count={unlockedFleetCount} />
        </div>

        {/* Filter Bar — Matches `Live aircraft scheduling` */}
        <section className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_110px_110px_auto_auto]">
            <Input
              aria-label="Search flight number"
              placeholder="Flight number"
              value={filters.searchQuery}
              onChange={(event) =>
                updateFilters({ searchQuery: event.target.value })
              }
            />
            <Input
              aria-label="Departure ICAO"
              placeholder="Dep ICAO"
              className="font-mono uppercase"
              value={filters.departureFilter}
              onChange={(event) =>
                updateFilters({
                  departureFilter: normalizeIcao(event.target.value),
                })
              }
            />
            <Input
              aria-label="Arrival ICAO"
              placeholder="Arr ICAO"
              className="font-mono uppercase"
              value={filters.arrivalFilter}
              onChange={(event) =>
                updateFilters({
                  arrivalFilter: normalizeIcao(event.target.value),
                })
              }
            />
            <select
              aria-label="Filter aircraft"
              className="h-8 rounded-[8px] border-0 bg-[var(--v2-background-bg-layer-02,#eef0f3)] px-2.5 text-[13px] outline-none"
              value={filters.aircraftFilter}
              onChange={(event) =>
                updateFilters({ aircraftFilter: event.target.value })
              }
            >
              <option value="all">All aircraft</option>
              {aircraftData.map((aircraft) => (
                <option
                  key={aircraft.id}
                  value={String(aircraft.id)}
                  disabled={!isAircraftEligible(aircraft)}
                >
                  {aircraft.name}
                  {aircraft.liveryname ? ` (${aircraft.liveryname})` : ""}
                  {!isAircraftEligible(aircraft) ? " — Locked" : ""}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter duration"
              className="h-8 rounded-[8px] border-0 bg-[var(--v2-background-bg-layer-02,#eef0f3)] px-2.5 text-[13px] outline-none"
              value={filters.durationRange || "all"}
              onChange={(event) =>
                updateFilters({
                  durationRange:
                    event.target.value === "all" ? "" : event.target.value,
                })
              }
            >
              <option value="all">Any duration</option>
              <option value="0-3600">&lt; 01:00</option>
              <option value="3600-7200">01:00–02:00</option>
              <option value="7200-14400">02:00–04:00</option>
              <option value="14400-28800">04:00–08:00</option>
              <option value="28800-">08:00+</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={filters.eligibleOnly}
                onCheckedChange={(checked) =>
                  updateFilters({ eligibleOnly: checked === true })
                }
              />
              Show only routes with unlocked aircraft
            </label>

            {savedFilters.map((saved) => (
              <span
                key={saved.id}
                className="inline-flex items-center gap-1 rounded-[5px] bg-[var(--v2-background-bg-layer-02,#f2f2f2)] px-2 py-0.5 text-xs"
              >
                <button
                  type="button"
                  onClick={() => applyFilter(saved)}
                  className="font-medium hover:underline"
                >
                  {saved.label}
                </button>
                <button
                  type="button"
                  onClick={() => removeSavedFilter(saved.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </section>

        {/* Route Cards — Matches `FlightList` in `Live aircraft scheduling` 1:1 */}
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading routes…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : paginatedRoutes.length === 0 ? (
          <CrewEmpty
            title="No routes to show"
            description="Try another filter or clear the search criteria"
          />
        ) : (
          <div className="space-y-1.5">
            {paginatedRoutes.map((route) => {
              const unlockedForRoute = eligibleAircraft(route);
              const canFly =
                unlockedForRoute.length > 0 && !loadingEligibility;
              const primaryAc = unlockedForRoute[0] || route.aircraft[0];
              const extraCount = Math.max(0, route.aircraft.length - 1);

              return (
                <CrewFlightRow
                  key={route.id}
                  flightnum={route.fltnum}
                  liveryname={primaryAc?.liveryname}
                  badge={
                    <span
                      className={
                        canFly
                          ? "text-[11px] text-[#0052a5]"
                          : "text-[11px] text-[var(--v2-text-text-faint,#737373)]"
                      }
                    >
                      {canFly ? "Eligible" : "Locked"}
                    </span>
                  }
                  subtitle={
                    primaryAc
                      ? [
                          primaryAc.name,
                          extraCount > 0 ? `+${extraCount}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                      : "No aircraft"
                  }
                  departure={route.dep}
                  arrival={route.arr}
                  duration={route.duration}
                  trailing={
                    <>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/crew/route/${route.id}`}>Details</Link>
                      </Button>
                      {canFly ? (
                        <Button size="sm" asChild>
                          <Link href={filePirepHref(route)}>
                            <PlaneTakeoff className="h-3.5 w-3.5" strokeWidth={1.5} />
                            File PIREP
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          <PlaneTakeoff className="h-3.5 w-3.5" strokeWidth={1.5} />
                          File PIREP
                        </Button>
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center pt-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage((current) => Math.max(current - 1, 1));
                    }}
                    aria-disabled={currentPage === 1}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const page = index + 1;
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }

                  if (
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }

                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(event) => {
                      event.preventDefault();
                      setCurrentPage((current) =>
                        Math.min(current + 1, totalPages),
                      );
                    }}
                    aria-disabled={currentPage === totalPages}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>
    </CrewHeader>
  );
}
