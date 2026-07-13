"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Loader2,
  PlaneTakeoff,
  Save,
  Search,
  X,
} from "lucide-react";

import { CrewHeader } from "@/components/crew-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
};

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
  const [loadingAircraft, setLoadingAircraft] = useState(false);
  const [eligibleRankIds, setEligibleRankIds] = useState<number[]>([]);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: "fltnum" | "dep" | "arr" | "duration" | "aircraft";
    direction: "ascending" | "descending";
  } | null>(null);

  useEffect(() => {
    setSavedFilters(readStorage<SavedFilter[]>(SAVED_FILTERS_KEY, []));
  }, []);

  useEffect(() => {
    async function fetchAircraft() {
      try {
        setLoadingAircraft(true);
        const response = await fetch("/api/aircraft");
        if (!response.ok) throw new Error("Failed to fetch aircraft");
        const data = await response.json();
        setAircraftData(data.aircrafts || []);
      } catch (fetchError) {
        console.error("Error fetching aircraft:", fetchError);
      } finally {
        setLoadingAircraft(false);
      }
    }

    fetchAircraft();
  }, []);

  useEffect(() => {
    async function fetchEligibility() {
      if (!user?.id) return;

      try {
        const response = await authFetch(`/api/pilots/${user.id}/dashboard`);
        if (!response.ok) return;
        const data: PilotDashboard = await response.json();
        setEligibleRankIds(data.rank?.eligibleRankIds || []);
      } catch (fetchError) {
        console.error("Failed to load route eligibility:", fetchError);
      }
    }

    fetchEligibility();
  }, [user?.id]);

  useEffect(() => {
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        setCurrentPage(1);

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

        const response = await fetch(url.toString());
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || "Failed to fetch routes");
        }

        setRoutesData(
          (data.data || []).map((route: RouteItem) => ({
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
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [filters]);

  const isAircraftEligible = useCallback((aircraft: Aircraft) => {
    if (aircraft.awardreq) return false;
    if (!aircraft.rankreq) return true;
    return eligibleRankIds.includes(Number(aircraft.rankreq));
  }, [eligibleRankIds]);

  const eligibleAircraft = useCallback(
    (route: RouteItem) => route.aircraft.filter(isAircraftEligible),
    [isAircraftEligible],
  );

  const filteredRoutes = useMemo(() => {
    const visibleRoutes = filters.eligibleOnly
      ? routesData
          .map((route) => ({
            ...route,
            aircraft: eligibleAircraft(route),
          }))
          .filter((route) => route.aircraft.length > 0)
      : routesData;

    if (!sortConfig) return visibleRoutes;

    return [...visibleRoutes].sort((a, b) => {
      if (sortConfig.key === "duration") {
        return sortConfig.direction === "ascending"
          ? a.durationSeconds - b.durationSeconds
          : b.durationSeconds - a.durationSeconds;
      }

      if (sortConfig.key === "aircraft") {
        const aircraftA = a.aircraft[0]?.name.toLowerCase() || "";
        const aircraftB = b.aircraft[0]?.name.toLowerCase() || "";
        return sortConfig.direction === "ascending"
          ? aircraftA.localeCompare(aircraftB)
          : aircraftB.localeCompare(aircraftA);
      }

      const valueA = String(a[sortConfig.key] || "").toLowerCase();
      const valueB = String(b[sortConfig.key] || "").toLowerCase();
      return sortConfig.direction === "ascending"
        ? valueA.localeCompare(valueB)
        : valueB.localeCompare(valueA);
    });
  }, [routesData, sortConfig, filters.eligibleOnly, eligibleAircraft]);

  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);
  const paginatedRoutes = filteredRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  function updateFilters(next: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function requestSort(key: "fltnum" | "dep" | "arr" | "duration" | "aircraft") {
    setSortConfig((current) => ({
      key,
      direction:
        current?.key === key && current.direction === "ascending"
          ? "descending"
          : "ascending",
    }));
  }

  function saveCurrentFilter() {
    const saved: SavedFilter = {
      ...filters,
      id: `${Date.now()}`,
      label: filterLabel(filters),
    };
    setSavedFilters((current) => {
      const next = [saved, ...current.filter((item) => item.label !== saved.label)]
        .slice(0, 6);
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
    setFilters(saved);
  }

  function filePirepHref(route: RouteItem) {
    const aircraft =
      eligibleAircraft(route)[0] ||
      route.aircraft.find((item) => String(item.id) === filters.aircraftFilter) ||
      route.aircraft[0];
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
      <main className="flex flex-1 flex-col gap-5 md:gap-7">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Find Routes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search updates automatically. Save filters for this browser.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={saveCurrentFilter}>
            <Save className="mr-2 h-4 w-4" />
            Save Filter
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-2">
                <Label htmlFor="departure">Departure</Label>
                <Input
                  id="departure"
                  placeholder="ICAO"
                  value={filters.departureFilter}
                  onChange={(event) =>
                    updateFilters({
                      departureFilter: normalizeIcao(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrival">Arrival</Label>
                <Input
                  id="arrival"
                  placeholder="ICAO"
                  value={filters.arrivalFilter}
                  onChange={(event) =>
                    updateFilters({
                      arrivalFilter: normalizeIcao(event.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Aircraft</Label>
                <Select
                  value={filters.aircraftFilter}
                  onValueChange={(value) => updateFilters({ aircraftFilter: value })}
                >
                  <SelectTrigger className="w-full">
                    {loadingAircraft ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading
                      </span>
                    ) : (
                      <SelectValue placeholder="Any aircraft" />
                    )}
                  </SelectTrigger>
                  <SelectContent className="max-h-[240px] bg-white">
                    <SelectItem value="all">Any aircraft</SelectItem>
                    {aircraftData.map((aircraft) => (
                      <SelectItem key={aircraft.id} value={String(aircraft.id)}>
                        {aircraft.name}
                        {aircraft.liveryname ? ` (${aircraft.liveryname})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select
                  value={filters.durationRange || "all"}
                  onValueChange={(value) =>
                    updateFilters({ durationRange: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Any duration" />
                  </SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="all">Any duration</SelectItem>
                    <SelectItem value="0-3600">&lt; 01:00</SelectItem>
                    <SelectItem value="3600-7200">01:00–02:00</SelectItem>
                    <SelectItem value="7200-14400">02:00–04:00</SelectItem>
                    <SelectItem value="14400-28800">04:00–08:00</SelectItem>
                    <SelectItem value="28800-">08:00+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search">Flight Number</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="CZ123"
                    className="pl-8"
                    value={filters.searchQuery}
                    onChange={(event) =>
                      updateFilters({ searchQuery: event.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={filters.eligibleOnly}
                  onCheckedChange={(checked) =>
                    updateFilters({ eligibleOnly: checked === true })
                  }
                />
                Eligible aircraft only
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFilters({
                    searchQuery: "",
                    departureFilter: "",
                    arrivalFilter: "",
                    aircraftFilter: "all",
                    durationRange: "",
                    eligibleOnly: false,
                  })
                }
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {savedFilters.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Saved Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {savedFilters.map((saved) => (
                <span key={saved.id} className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => applyFilter(saved)}
                  >
                    {saved.label}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeSavedFilter(saved.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </span>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => requestSort("fltnum")}
                  >
                    Flight
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => requestSort("dep")}
                  >
                    Route
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => requestSort("duration")}
                  >
                    Duration
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => requestSort("aircraft")}
                  >
                    Aircraft
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading routes...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-red-700"
                    >
                      {error}
                    </TableCell>
                  </TableRow>
                ) : paginatedRoutes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-muted-foreground"
                    >
                      No routes found matching your criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRoutes.map((route) => (
                    <TableRow key={route.id}>
                      <TableCell className="font-medium">
                        {route.fltnum}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{route.dep}</span>
                          <ArrowRight className="h-3 w-3" />
                          <span>{route.arr}</span>
                        </div>
                      </TableCell>
                      <TableCell>{route.duration}</TableCell>
                      <TableCell className="max-w-[360px]">
                        <div className="flex flex-wrap gap-1">
                          {route.aircraft.length > 0 ? (
                            route.aircraft.map((aircraft) => (
                              <Badge
                                key={aircraft.id}
                                variant="outline"
                                className={
                                  filters.eligibleOnly || isAircraftEligible(aircraft)
                                    ? ""
                                    : "opacity-60"
                                }
                              >
                                {aircraft.name}
                                {aircraft.liveryname
                                  ? ` ${aircraft.liveryname}`
                                  : ""}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              No eligible aircraft
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/crew/route/${route.id}`}>View</Link>
                          </Button>
                          <Button
                            size="sm"
                            asChild
                            disabled={filters.eligibleOnly && route.aircraft.length === 0}
                          >
                            <Link href={filePirepHref(route)}>
                              <PlaneTakeoff className="mr-2 h-4 w-4" />
                              File
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          {totalPages > 1 && (
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
          )}
        </div>
      </main>
    </CrewHeader>
  );
}
