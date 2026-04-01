"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Edit,
  Trash,
  ArrowRight,
  Loader2,
  Search,
  Upload,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CrewHeader } from "@/components/crew-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatFlightTimeHM } from "@/lib/utils/format-flight-time";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const routeSchema = z.object({
  fltnum: z.string().min(1, "Flight number is required."),
  dep: z
    .string()
    .min(4, "Departure airport is required.")
    .max(4, "ICAO code must be 4 letters.")
    .regex(/^[A-Z]{4}$/, "Must be a 4-letter ICAO code."),
  arr: z
    .string()
    .min(4, "Arrival airport is required.")
    .max(4, "ICAO code must be 4 letters.")
    .regex(/^[A-Z]{4}$/, "Must be a 4-letter ICAO code."),
  duration: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/, "Duration must be in HH:MM format."),
  notes: z.string().optional(),
});
type RouteFormData = z.infer<typeof routeSchema>;

interface Route {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: number;
  notes: string;
  aircraft: Aircraft[];
}

interface newRoute {
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  notes: string;
  aircraft: Aircraft[];
}
interface Aircraft {
  id: number;
  name: string;
  ifaircraftid: string;
  liveryname: string;
  ifliveryid: string;
  notes: string;
}

export default function RoutesPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingAircraft, setLoadingAircraft] = useState(true);
  const [error, setError] = useState("");
  const [aircraftOptions, setAircraftOptions] = useState<Aircraft[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  const [durationRange, setDurationRange] = useState<string | undefined>();
  const [departureFilter, setDepartureFilter] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("all");
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredAircraft, setFilteredAircraft] = useState<Aircraft[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImportingBulk, setIsImportingBulk] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showImportResult, setShowImportResult] = useState(false);
  const [importStep, setImportStep] = useState<"upload" | "mapping" | "result">(
    "upload",
  );
  const [csvPreview, setCsvPreview] = useState<any>(null);
  const [aircraftMappings, setAircraftMappings] = useState<
    Record<string, number>
  >({});
  const [availableAircraft, setAvailableAircraft] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    setFilteredAircraft(aircraftOptions);
  }, [aircraftOptions]);

  const handleBulkImport = async (file: File) => {
    try {
      setImportLoading(true);

      // Step 1: Parse and preview CSV
      const csvContent = await file.text();

      const response = await fetch("/api/admin/routes/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          csvContent,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setImportResult({
          success: false,
          message: data.message,
          errors: data.errors,
        });
        setShowImportResult(true);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        setCsvPreview(null);
        setAvailableAircraft([]);
        setAircraftMappings({});
        setImportStep("upload");
        return;
      }

      // Show mapping step
      setCsvPreview(data.preview);
      setAvailableAircraft(data.availableAircraft);
      setImportStep("mapping");

      // Initialize mappings (empty by default)
      const defaultMappings: Record<string, number> = {};
      setAircraftMappings(defaultMappings);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setImportResult({
        success: false,
        message: `Failed to parse CSV: ${(error as Error).message}`,
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setCsvPreview(null);
      setAvailableAircraft([]);
      setAircraftMappings({});
      setImportStep("upload");
      setShowImportResult(true);
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    try {
      setImportLoading(true);

      // Step 2: Import with aircraft mappings
      const response = await fetch("/api/admin/routes/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import",
          routes: csvPreview,
          mappings: aircraftMappings,
        }),
      });

      const data = await response.json();
      setImportResult(data);
      setImportStep("result");
      setShowImportResult(true);

      if (data.success || data.createdCount > 0) {
        // Refresh routes after successful import
        setTimeout(() => {
          fetchRoutes();
        }, 1000);
      }
    } catch (error) {
      console.error("Error importing routes:", error);
      setImportResult({
        success: false,
        message: `Failed to import routes: ${(error as Error).message}`,
      });
      setImportStep("result");
      setShowImportResult(true);
    } finally {
      setImportLoading(false);
    }
  };
  const [newRoute, setNewRoute] = useState<newRoute>({
    fltnum: "",
    dep: "",
    arr: "",
    duration: "",
    notes: "",
    aircraft: [],
  });

  // Fetch routes from API
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/admin/routes", window.location.origin);
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
      setRoutes(data.data.routes);
      setError("");
    } catch (err) {
      setError("Error fetching routes. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch aircraft options
  const fetchAircraft = async () => {
    try {
      const response = await fetch("/api/aircraft");

      if (!response.ok) {
        throw new Error("Failed to fetch aircraft");
      }

      const data = await response.json();
      setAircraftOptions(
        data.aircrafts.map((aircraft: any) => ({
          id: aircraft.id,
          name: aircraft.name,
          liveryname: aircraft.liveryname,
        })),
      );
    } catch (err) {
      console.error("Error fetching aircraft:", err);
    } finally {
      setLoadingAircraft(false);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchRoutes();
    fetchAircraft();
  }, []);

  const filteredRoutes = routes;
  const sortedRoutes = [...filteredRoutes];

  const pageCount = Math.ceil(sortedRoutes.length / itemsPerPage);
  const paginatedRoutes = sortedRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleDeleteRoute = async () => {
    if (!selectedRoute) return;

    try {
      const response = await fetch(
        `/api/admin/routes?id=${(selectedRoute as any).id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete route");
      }

      setShowDeleteDialog(false);
      alert("Route deleted successfully.");
      fetchRoutes();
    } catch (err) {
      console.error("Error deleting route:", err);
      alert("Failed to delete route. Please try again.");
    }
  };

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<RouteFormData>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      fltnum: "",
      dep: "",
      arr: "",
      duration: "",
      notes: "",
    },
  });

  return (
    <CrewHeader>
      <div className="flex flex-1 flex-col gap-4 ">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Routes</h1>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsImportingBulk(true);
                setImportStep("upload");
                setCsvPreview(null);
                setAvailableAircraft([]);
                setAircraftMappings({});
                setImportResult(null);
                setShowImportResult(false);
              }}
              variant="outline"
            >
              <Upload className="mr-2 h-4 w-4" />
              Bulk Import CSV
            </Button>
            <Button onClick={() => setIsAddingRoute(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Route
            </Button>
          </div>
        </div>

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
                <SelectItem key="all" value="all">
                  All aircraft
                </SelectItem>
                {aircraftOptions.map((aircraft) => (
                  <SelectItem key={aircraft.id} value={"" + aircraft.id}>
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
                <SelectItem value="0">All durations</SelectItem>
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
            <Label htmlFor="search">Search by Flight Number</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Search by flight number"
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

        <div className="relative overflow-x-auto">
          <Card>
            <CardHeader className="p-4">
              <CardTitle>Flight Reports</CardTitle>
              <CardDescription>
                View and manage your submitted pilot reports
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flight Number</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Duration
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Notes
                    </TableHead>
                    <TableHead>Aircraft</TableHead>

                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Loading routes...
                      </TableCell>
                    </TableRow>
                  ) : error ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        {error}
                      </TableCell>
                    </TableRow>
                  ) : paginatedRoutes.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No routes found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRoutes.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell>{route.fltnum}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span>{route.dep}</span>
                            <ArrowRight className="h-3 w-3" />
                            <span>{route.arr}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatFlightTimeHM(route.duration)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {route.notes}
                        </TableCell>
                        <TableCell>
                          {route.aircraft &&
                            route.aircraft.map((ac: any) => (
                              <Badge
                                key={ac.id}
                                variant="outline"
                                className="mr-1"
                              >
                                {ac.name} - {ac.liveryname}
                                {ac.notes ? ` - ${ac.notes}` : ""}
                              </Badge>
                            ))}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                router.push(`/crew/admin/routes/${route.id}`)
                              }
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedRoute(route as any);
                                setShowDeleteDialog(true);
                              }}
                            >
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
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
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            variant="outline"
            size="sm"
          >
            Previous
          </Button>
          <span>
            Page {currentPage} of {pageCount}
          </span>
          <Button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === pageCount}
            variant="outline"
            size="sm"
          >
            Next
          </Button>
        </div>

        {/* Add Route Dialog */}
        <Dialog open={isAddingRoute} onOpenChange={setIsAddingRoute}>
          <DialogTrigger asChild>{/* Opened programmatically */}</DialogTrigger>
          <DialogContent className="max-w-3xl bg-white">
            <DialogHeader>
              <DialogTitle>Add New Route</DialogTitle>
              <DialogDescription>
                Create a new flight route in the system. All fields marked with
                * are required.
              </DialogDescription>
            </DialogHeader>

            {/* ✅ Form Starts */}
            <form
              onSubmit={handleSubmit(async (data) => {
                // Merge aircraft selections with form data
                const payload = { ...data, aircraft: newRoute.aircraft };

                try {
                  const response = await fetch("/api/admin/routes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  if (!response.ok) throw new Error("Failed to add route");

                  setIsAddingRoute(false);
                  reset();
                  setNewRoute({
                    fltnum: "",
                    dep: "",
                    arr: "",
                    duration: "",
                    notes: "",
                    aircraft: [],
                  });

                  alert("Route added successfully.");
                  fetchRoutes();
                } catch (err) {
                  console.error("Error adding route:", err);
                  alert("Failed to add route.");
                }
              })}
              className="grid gap-4 py-4"
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Flight Number */}
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="fltnum">Flight Number *</Label>
                  <Input
                    id="fltnum"
                    placeholder="VA101"
                    {...register("fltnum")}
                  />
                  {errors.fltnum && (
                    <p className="text-sm text-red-500">
                      {errors.fltnum.message}
                    </p>
                  )}
                </div>

                {/* Departure */}
                <div className="space-y-2">
                  <Label htmlFor="dep">Departure Airport *</Label>
                  <Input
                    id="dep"
                    placeholder="Enter departure ICAO code"
                    maxLength={4}
                    {...register("dep")}
                    onChange={(e) =>
                      setValue("dep", e.target.value.toUpperCase())
                    }
                  />
                  {errors.dep && (
                    <p className="text-sm text-red-500">{errors.dep.message}</p>
                  )}
                </div>

                {/* Arrival */}
                <div className="space-y-2">
                  <Label htmlFor="arr">Arrival Airport *</Label>
                  <Input
                    id="arr"
                    placeholder="Enter arrival ICAO code"
                    maxLength={4}
                    {...register("arr")}
                    onChange={(e) =>
                      setValue("arr", e.target.value.toUpperCase())
                    }
                  />
                  {errors.arr && (
                    <p className="text-sm text-red-500">{errors.arr.message}</p>
                  )}
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (HH:MM) *</Label>
                  <Input
                    id="duration"
                    placeholder="1:15"
                    {...register("duration")}
                  />
                  {errors.duration && (
                    <p className="text-sm text-red-500">
                      {errors.duration.message}
                    </p>
                  )}
                </div>

                {/* Aircraft Selector */}
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="aircraft">Aircraft</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full">
                    <Select
                      onValueChange={(value) => {
                        const ac = aircraftOptions.find(
                          (a) => a.id.toString() === value,
                        );
                        if (
                          ac &&
                          !newRoute.aircraft.some((a) => a.id === ac.id)
                        ) {
                          setNewRoute({
                            ...newRoute,
                            aircraft: [...newRoute.aircraft, ac],
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select aircraft..." />
                      </SelectTrigger>

                      <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                        {isSearching ? (
                          <div className="flex items-center justify-center h-10">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : (
                          filteredAircraft.map((ac) => (
                            <SelectItem key={ac.id} value={ac.id.toString()}>
                              {ac.name} - {ac.liveryname}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    <Input
                      placeholder="Search aircraft..."
                      className="w-full"
                      onChange={(e) => {
                        const term = e.target.value.toLowerCase();
                        setIsSearching(true);
                        setTimeout(() => {
                          const filtered = aircraftOptions.filter(
                            (a) =>
                              a.name.toLowerCase().includes(term) ||
                              a.liveryname.toLowerCase().includes(term),
                          );
                          setFilteredAircraft(filtered);
                          setIsSearching(false);
                        }, 150);
                      }}
                    />
                  </div>

                  {/* Selected aircraft badges */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {newRoute.aircraft.map((a) => (
                      <Badge
                        key={a.id}
                        variant="secondary"
                        className="flex items-center space-x-1"
                      >
                        <span>
                          {a.name} - {a.liveryname}
                        </span>
                        <button
                          className="text-xs font-bold hover:text-red-500"
                          onClick={() =>
                            setNewRoute({
                              ...newRoute,
                              aircraft: newRoute.aircraft.filter(
                                (x) => x.id !== a.id,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Enter any additional info..."
                  rows={3}
                  {...register("notes")}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddingRoute(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Route</Button>
              </DialogFooter>
            </form>
            {/* ✅ Form Ends */}
          </DialogContent>
        </Dialog>

        {/* Delete Route Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-white">
            <DialogHeader>
              <DialogTitle>Delete Route</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete route{" "}
                {(selectedRoute as any)?.fltnum}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="bg-white hover:bg-gray-300"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteRoute}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div>
          <span>Routes Found: {routes.length}</span>
        </div>

        {/* Bulk Import Dialog - Upload Step */}
        <Dialog
          open={isImportingBulk && importStep === "upload"}
          onOpenChange={(open) => {
            if (!open) {
              setIsImportingBulk(false);
              setImportStep("upload");
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }
            }
          }}
        >
          <DialogContent className="max-w-2xl bg-white">
            <DialogHeader>
              <DialogTitle>Bulk Import Routes from CSV</DialogTitle>
              <DialogDescription>
                Upload a CSV file to import multiple routes at once.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      handleBulkImport(e.target.files[0]);
                    }
                  }}
                  disabled={importLoading}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importLoading}
                  className="flex flex-col items-center gap-2 w-full"
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
                      <span className="text-sm text-gray-600">
                        Parsing CSV...
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        Click to upload CSV or drag and drop
                      </span>
                      <span className="text-xs text-gray-500">
                        CSV files only
                      </span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-sm text-blue-900 mb-2">
                  CSV Format
                </h4>
                <p className="text-xs text-blue-800 mb-2">
                  Your CSV file should have the following columns (in any
                  order):
                </p>
                <code className="text-xs bg-white border border-blue-200 rounded px-2 py-1 block text-blue-900 font-mono">
                  fltnum, dep, arr, duration, notes, aircraft
                </code>
                <p className="text-xs text-blue-800 mt-2">Example:</p>
                <pre className="text-xs bg-white border border-blue-200 rounded px-2 py-1 block text-blue-900 font-mono overflow-x-auto">
                  {`VA101,KJFK,KLAX,5:30,NY to LA,Boeing 787; Airbus A350
VA102,KLAX,KJFK,5:45,LA to NY,Boeing 787`}
                </pre>
                <p className="text-xs text-blue-800 mt-2">
                  Download a sample CSV template{" "}
                  <a
                    href="/routes-template.csv"
                    download
                    className="text-blue-500 hover:underline"
                  >
                    here.
                  </a>
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportingBulk(false);
                  setImportStep("upload");
                }}
                disabled={importLoading}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Import Dialog - Aircraft Mapping Step */}
        <Dialog
          open={isImportingBulk && importStep === "mapping"}
          onOpenChange={(open) => {
            if (!open) {
              setIsImportingBulk(false);
              setImportStep("upload");
              setCsvPreview(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl bg-white max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Map Aircraft to Database Records</DialogTitle>
              <DialogDescription>
                Match aircraft names from your CSV with aircraft in the
                database.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Aircraft Mapping */}
              {csvPreview &&
                csvPreview.some((r: any) => r.aircraftNames?.length > 0) && (
                  <div className="space-y-3">
                    <h3 className="font-semibold text-sm">Aircraft Mappings</h3>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      {Array.from(
                        new Set(
                          csvPreview.flatMap((r: any) => r.aircraftNames || []),
                        ),
                      ).map((aircraftName: any) => (
                        <div
                          key={aircraftName}
                          className="grid grid-cols-3 gap-2 items-end"
                        >
                          <div>
                            <Label className="text-xs text-gray-600">
                              CSV Aircraft
                            </Label>
                            <div className="text-sm font-medium p-2 bg-white border rounded">
                              {aircraftName}
                            </div>
                          </div>
                          <div className="flex justify-center">→</div>
                          <div>
                            <Label className="text-xs text-gray-600">
                              Database Aircraft
                            </Label>
                            <Select
                              value={
                                aircraftMappings[aircraftName] !== undefined
                                  ? aircraftMappings[aircraftName].toString()
                                  : "none"
                              }
                              onValueChange={(value) => {
                                if (value !== "none") {
                                  setAircraftMappings({
                                    ...aircraftMappings,
                                    [aircraftName]: parseInt(value, 10),
                                  });
                                } else {
                                  const newMappings = { ...aircraftMappings };
                                  delete newMappings[aircraftName];
                                  setAircraftMappings(newMappings);
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select aircraft" />
                              </SelectTrigger>
                              <SelectContent className="bg-white max-h-[150px]">
                                <SelectItem value="none">
                                  <span className="text-gray-500">
                                    None (skip)
                                  </span>
                                </SelectItem>
                                {availableAircraft.map((ac: any) => (
                                  <SelectItem
                                    key={ac.id}
                                    value={ac.id.toString()}
                                  >
                                    {ac.name}
                                    {ac.liveryname && ` (${ac.liveryname})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Routes Preview */}
              <div className="space-y-2">
                <h3 className="font-semibold text-sm">Routes to Import</h3>
                <div className="bg-gray-50 p-4 rounded-lg space-y-2 max-h-[300px] overflow-y-auto">
                  {csvPreview?.map((route: any, idx: number) => (
                    <div
                      key={idx}
                      className="text-sm p-2 bg-white border rounded"
                    >
                      <div className="font-medium">{route.fltnum}</div>
                      <div className="text-gray-600">
                        {route.dep} → {route.arr} ({route.duration})
                      </div>
                      {route.aircraftNames?.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          Aircraft: {route.aircraftNames.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportingBulk(false);
                  setImportStep("upload");
                  setCsvPreview(null);
                }}
                disabled={importLoading}
              >
                Cancel
              </Button>
              <Button onClick={handleConfirmImport} disabled={importLoading}>
                {importLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  "Import Routes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Import Result Dialog */}
        <AlertDialog open={showImportResult} onOpenChange={setShowImportResult}>
          <AlertDialogContent className="bg-white">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {importResult?.success
                  ? "Import Successful"
                  : importResult?.createdCount > 0
                    ? "Import Completed with Errors"
                    : "Import Failed"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {importResult?.message}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {importResult?.createdCount !== undefined && (
              <div className="space-y-2 py-4 text-sm">
                <div className="flex justify-between">
                  <span>Routes Created:</span>
                  <span className="font-semibold text-green-600">
                    {importResult.createdCount}
                  </span>
                </div>
                {importResult?.errorCount > 0 && (
                  <div className="flex justify-between">
                    <span>Errors:</span>
                    <span className="font-semibold text-red-600">
                      {importResult.errorCount}
                    </span>
                  </div>
                )}
              </div>
            )}

            {importResult?.errors && importResult.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-red-900 mb-2">
                  Errors:
                </p>
                <ul className="space-y-1 text-xs text-red-800">
                  {importResult.errors.map((error: string, idx: number) => (
                    <li key={idx}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogAction
                onClick={() => setShowImportResult(false)}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                Close
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CrewHeader>
  );
}
