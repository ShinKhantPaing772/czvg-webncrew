"use client";

import { useState, useEffect } from "react";
import { Search, ArrowRight, Route, Loader2 } from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatFlightTime } from "@/lib/utils/format-flight-time";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";

interface Aircraft {
  id: string;
  name: string;
  liveryname: string;
  ifaircraftid?: string;
  ifliveryid?: string;
  status?: number;
  notes?: string;
}

interface Route {
  id: string;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  notes: string;
  aircraft: Aircraft[];
}

export default function FindRoutes() {
  const { user } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [departureFilter, setDepartureFilter] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const [durationRange, setDurationRange] = useState<string | undefined>();
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // State for routes data
  const [routesData, setRoutesData] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);

  // State for aircraft data
  const [aircraftData, setAircraftData] = useState<Aircraft[]>([]);
  const [loadingAircraft, setLoadingAircraft] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: "fltnum" | "dep" | "arr" | "duration" | "aircraft";
    direction: "ascending" | "descending";
  } | null>(null);

  // Function to fetch aircraft data
  const fetchAircraft = async () => {
    try {
      setLoadingAircraft(true);
      const response = await fetch("/api/aircraft");
      if (!response.ok) {
        throw new Error("Failed to fetch aircraft");
      }
      const data = await response.json();
      setAircraftData(data.aircrafts || []);
      setLoadingAircraft(false);
    } catch (err) {
      console.error("Error fetching aircraft:", err);
      setLoadingAircraft(false);
    }
  };

  // Load aircraft data on component mount
  useEffect(() => {
    fetchAircraft();
  }, []);

  // Function to fetch routes data from API
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      setCurrentPage(1); // Reset to the first page
      const url = new URL("/api/routes", window.location.origin);
      if (searchQuery) url.searchParams.set("fltnum", searchQuery);
      if (departureFilter) url.searchParams.set("dep", departureFilter);
      if (arrivalFilter) url.searchParams.set("arr", arrivalFilter);
      if (aircraftFilter && aircraftFilter !== "all")
        url.searchParams.set("aircraftId", aircraftFilter);
      if (durationRange) {
        const [min, max] = durationRange.split("-").map(Number);
        if (min !== undefined) url.searchParams.set("minDuration", "" + min);
        if (max !== undefined && max !== 0)
          url.searchParams.set("maxDuration", "" + max);
        if (max === 0) url.searchParams.delete("maxDuration");
      }

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }
      const data = await response.json();
      if (data.success) {
        const formatRoutes = data.data.map((route: Route) => ({
          id: route.id,
          fltnum: route.fltnum,
          dep: route.dep,
          arr: route.arr,
          duration: formatFlightTime(parseFloat(route.duration)),
          notes: route.notes,
          aircraft: route.aircraft,
        }));
        setRoutesData(formatRoutes);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  // Sort routes if sortConfig exists
  const sortRoutes = (routes: Route[]) => {
    if (!sortConfig) return routes;

    return [...routes].sort((a, b) => {
      if (sortConfig.key === "duration") {
        // Parse duration string into total minutes
        const parseDuration = (duration: string) => {
          const parts = duration.split(" ");
          let totalMinutes = 0;

          for (let i = 0; i < parts.length; i++) {
            if (parts[i].endsWith("h")) {
              totalMinutes += parseFloat(parts[i]) * 60;
            } else if (parts[i].endsWith("m")) {
              totalMinutes += parseFloat(parts[i]);
            }
          }

          return isNaN(totalMinutes) ? 0 : totalMinutes;
        };

        const durationA = parseDuration(a.duration);
        const durationB = parseDuration(b.duration);

        return sortConfig.direction === "ascending"
          ? durationA - durationB
          : durationB - durationA;
      } else if (sortConfig.key === "aircraft") {
        // Compare aircraft names case-insensitively
        const aircraftA = a.aircraft[0]?.name.toLowerCase() || "";
        const aircraftB = b.aircraft[0]?.name.toLowerCase() || "";
        return sortConfig.direction === "ascending"
          ? aircraftA.localeCompare(aircraftB)
          : aircraftB.localeCompare(aircraftA);
      } else if (sortConfig.key === "fltnum") {
        // Compare flight numbers numerically if they are numbers, otherwise as strings
        const isNumA = !isNaN(Number(a.fltnum));
        const isNumB = !isNaN(Number(b.fltnum));

        if (isNumA && isNumB) {
          return sortConfig.direction === "ascending"
            ? Number(a.fltnum) - Number(b.fltnum)
            : Number(b.fltnum) - Number(a.fltnum);
        }
        return sortConfig.direction === "ascending"
          ? a.fltnum.localeCompare(b.fltnum)
          : b.fltnum.localeCompare(a.fltnum);
      } else if (sortConfig.key === "dep" || sortConfig.key === "arr") {
        // Compare airport codes case-insensitively
        const valueA = a[sortConfig.key].toLowerCase();
        const valueB = b[sortConfig.key].toLowerCase();
        return sortConfig.direction === "ascending"
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      return 0;
    });
  };

  // Filter routes based on search criteria
  const filteredRoutes = sortRoutes(routesData);

  // Handle sort request
  const requestSort = (
    key: "fltnum" | "dep" | "arr" | "duration" | "aircraft"
  ) => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Calculate paginated routes
  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage);
  const paginatedRoutes = filteredRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <CrewHeader userName={user?.name || ""}>
      <main className="flex flex-1 flex-col gap-4  md:gap-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Find Routes</h1>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Departure</Label>
              <Input
                placeholder="ICAO code"
                value={departureFilter}
                onChange={(e) => setDepartureFilter(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Arrival</Label>
              <Input
                placeholder="ICAO code"
                value={arrivalFilter}
                onChange={(e) => setArrivalFilter(e.target.value)}
              />
            </div>
            <div className="space-y-2 w-full">
              <Label>Aircraft</Label>
              <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
                <SelectTrigger className="w-full">
                  {loadingAircraft ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      Loading...
                    </div>
                  ) : (
                    <SelectValue placeholder="Select aircraft" />
                  )}
                </SelectTrigger>
                <SelectContent className="bg-white max-h-[200px] overflow-y-auto w-full">
                  {loadingAircraft && (
                    <div className="flex items-center justify-center h-10">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  )}
                  {aircraftData.map((aircraft) => (
                    <SelectItem key={aircraft.id} value={aircraft.id}>
                      {aircraft.name}
                      {aircraft.liveryname && `(${aircraft.liveryname})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 w-full">
              <Label>Duration</Label>
              <Select onValueChange={(val) => setDurationRange(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select duration range" />
                </SelectTrigger>
                <SelectContent className="bg-white w-full ">
                  <SelectItem value="0-3600">&lt;1 hour</SelectItem>
                  <SelectItem value="3600-7200">1-2 hours</SelectItem>
                  <SelectItem value="7200-10800">2-3 hours</SelectItem>
                  <SelectItem value="10800-14400">3-4 hours</SelectItem>
                  <SelectItem value="14400-18000">4-5 hours</SelectItem>
                  <SelectItem value="18000-21600">5-6 hours</SelectItem>
                  <SelectItem value="21600-25200">6-7 hours</SelectItem>
                  <SelectItem value="25200-28800">7-8 hours</SelectItem>
                  <SelectItem value="28800-32400">8-9 hours</SelectItem>
                  <SelectItem value="32400-36000">9-10 hours</SelectItem>
                  <SelectItem value="36000-">10+ hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search Routes</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by flight number, airport code..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Button onClick={fetchRoutes} variant="default" size="sm">
              Search
            </Button>
          </div>

          <div className="rounded-lg bg-card">
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
                        {sortConfig?.key === "fltnum" && (
                          <span>
                            {sortConfig.direction === "ascending" ? " ↑" : " ↓"}
                          </span>
                        )}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => requestSort("dep")}
                      >
                        Route
                        {sortConfig?.key === "dep" && (
                          <span>
                            {sortConfig.direction === "ascending" ? " ↑" : " ↓"}
                          </span>
                        )}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => requestSort("duration")}
                      >
                        Duration
                        {sortConfig?.key === "duration" && (
                          <span>
                            {sortConfig.direction === "ascending" ? " ↑" : " ↓"}
                          </span>
                        )}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer hover:bg-muted"
                        onClick={() => requestSort("aircraft")}
                      >
                        Aircraft
                        {sortConfig?.key === "aircraft" && (
                          <span>
                            {sortConfig.direction === "ascending" ? " ↑" : " ↓"}
                          </span>
                        )}
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Loading...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : paginatedRoutes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          {searchQuery ||
                          departureFilter ||
                          arrivalFilter ||
                          aircraftFilter ||
                          durationRange
                            ? "No routes found matching your criteria"
                            : "Apply filters to search for routes"}
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
                          <TableCell className="w-[30%]">
                            {route.aircraft.length !== 0 ? (
                              <div className="flex flex-wrap items-center gap-1">
                                {route.aircraft.map((aircraft) => (
                                  <Badge key={aircraft.id} variant="outline">
                                    {aircraft.name}{" "}
                                    {aircraft.liveryname && aircraft.liveryname}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <></>
                            )}
                          </TableCell>

                          <TableCell className="w-[10%] text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/crew/route/${route.id}`}>View</a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Pagination controls */}
          <div className="flex justify-center mt-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <div className="flex items-center px-4 text-sm">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </main>
    </CrewHeader>
  );
}
