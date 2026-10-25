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
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  Layers,
  RefreshCw,
  Info,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Check,
  Download,
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
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authFetch } from "@/lib/utils/api";

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
    .regex(/^\d+:[0-5]\d$/, "Duration must be in HH:MM format."),
  notes: z.string().optional(),
});
type RouteFormData = z.infer<typeof routeSchema>;

interface Route {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
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
  const [importStep, setImportStep] = useState<
    "upload" | "mapping" | "preview" | "result"
  >("upload");
  const [importMode, setImportMode] = useState<"append" | "overwrite">("append");
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [invalidRoutes, setInvalidRoutes] = useState<any[]>([]);
  const [aircraftNames, setAircraftNames] = useState<string[]>([]);
  const [availableAircraft, setAvailableAircraft] = useState<any[]>([]);
  const [aircraftMappings, setAircraftMappings] = useState<
    Record<string, number>
  >({});
  const [totalExistingRoutes, setTotalExistingRoutes] = useState<number>(0);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewSearch, setPreviewSearch] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showInvalidDetails, setShowInvalidDetails] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    setFilteredAircraft(aircraftOptions);
  }, [aircraftOptions]);

  const resetImportState = () => {
    setIsImportingBulk(false);
    setImportStep("upload");
    setImportMode("append");
    setCsvPreview(null);
    setInvalidRoutes([]);
    setAircraftNames([]);
    setAvailableAircraft([]);
    setAircraftMappings({});
    setImportResult(null);
    setTotalExistingRoutes(0);
    setShowOverwriteConfirm(false);
    setShowInvalidDetails(false);
    setPreviewPage(1);
    setPreviewSearch("");
    setIsDragOver(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleBulkImport = async (file: File) => {
    try {
      setImportLoading(true);
      const csvContent = await file.text();

      const response = await authFetch("/api/admin/routes/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "preview",
          csvContent,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setImportResult({
          success: false,
          message: data.message || "Failed to parse CSV",
          errors:
            data.invalidRoutes?.map(
              (inv: any) =>
                `Row ${inv.rowNumber}: ${inv.errors?.join(", ")}`,
            ) || data.errors || [data.message],
        });
        setImportStep("result");
        return;
      }

      setCsvPreview(data.preview || []);
      setInvalidRoutes(data.invalidRoutes || []);
      setAircraftNames(data.aircraftNames || []);
      setAvailableAircraft(data.availableAircraft || []);
      setTotalExistingRoutes(data.totalExistingRoutes || 0);

      // Initialize empty mappings
      const initialMappings: Record<string, number> = {};
      setAircraftMappings(initialMappings);

      // If CSV contains aircraft names, go to mapping step; otherwise go straight to preview
      if (data.aircraftNames && data.aircraftNames.length > 0) {
        setImportStep("mapping");
      } else {
        setImportStep("preview");
      }
    } catch (error) {
      console.error("Error parsing CSV:", error);
      setImportResult({
        success: false,
        message: `Failed to parse CSV: ${(error as Error).message}`,
      });
      setImportStep("result");
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const executeImport = async () => {
    try {
      setImportLoading(true);
      const response = await authFetch("/api/admin/routes/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "import",
          importType: importMode,
          routes: csvPreview,
          mappings: aircraftMappings,
        }),
      });

      const data = await response.json();
      setImportResult(data);
      setImportStep("result");

      if (data.success || data.createdCount > 0) {
        await fetchRoutes();
      }
    } catch (error) {
      console.error("Error importing routes:", error);
      setImportResult({
        success: false,
        message: `Failed to import routes: ${(error as Error).message}`,
      });
      setImportStep("result");
    } finally {
      setImportLoading(false);
      setShowOverwriteConfirm(false);
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

      const response = await authFetch(url.toString());

      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }

      const data = await response.json();
      const nextRoutes = Array.isArray(data?.data?.routes)
        ? data.data.routes
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.routes)
            ? data.routes
            : [];
      setRoutes(nextRoutes);
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
      const response = await authFetch("/api/aircraft");

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

  const filteredRoutes = Array.isArray(routes) ? routes : [];
  const sortedRoutes = [...filteredRoutes];

  const pageCount = Math.max(
    1,
    Math.ceil(sortedRoutes.length / itemsPerPage),
  );
  const paginatedRoutes = sortedRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const applyFilters = () => {
    setCurrentPage(1);
    fetchRoutes();
  };

  const handleDeleteRoute = async () => {
    if (!selectedRoute) return;

    try {
      const response = await authFetch(
        `/api/admin/routes?id=${(selectedRoute as any).id}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to delete route");
      }

      await fetchRoutes();
      setShowDeleteDialog(false);
      alert("Route deleted successfully.");
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
                resetImportState();
                setIsImportingBulk(true);
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
              onChange={(e) => {
                setDepartureFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Arrival</Label>
            <Input
              placeholder="ICAO code"
              value={arrivalFilter}
              onChange={(e) => {
                setArrivalFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="space-y-2 w-full">
            <Label>Aircraft</Label>
            <Select
              value={aircraftFilter}
              onValueChange={(value) => {
                setAircraftFilter(value);
                setCurrentPage(1);
              }}
            >
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
            <Select
              onValueChange={(value) => {
                setDurationRange(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select duration range" />
              </SelectTrigger>
              <SelectContent className="bg-white w-full ">
                <SelectItem value="0">All durations</SelectItem>
                <SelectItem value="0-3600">&lt; 01:00</SelectItem>
                <SelectItem value="3600-7200">01:00–02:00</SelectItem>
                <SelectItem value="7200-10800">02:00–03:00</SelectItem>
                <SelectItem value="10800-14400">03:00–04:00</SelectItem>
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
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          <Button onClick={applyFilters} variant="default" size="sm">
            Search
          </Button>
        </div>

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
                          {route.duration}
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
            {`Page ${currentPage} of ${pageCount}`}
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
                  const response = await authFetch("/api/admin/routes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                  });

                  if (!response.ok) throw new Error("Failed to add route");

                  await fetchRoutes();
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
                    placeholder="01:15"
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

        {/* Bulk Import Unified Wizard Dialog */}
        <Dialog
          open={isImportingBulk}
          onOpenChange={(open) => {
            if (!open && !importLoading) {
              resetImportState();
            }
          }}
        >
          <DialogContent className="max-w-4xl bg-white max-h-[92vh] flex flex-col p-0 overflow-hidden">
            {/* Wizard Header with Steps */}
            <div className="p-6 border-b bg-gray-50/70">
              <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  批量导入航线 CSV (Bulk Import Routes)
                </DialogTitle>
                <DialogDescription>
                  多步骤向导式导入，支持新增追加与全量覆盖替换，提供数据容错校验与机型映射。
                </DialogDescription>
              </DialogHeader>

              {/* Stepper Progress */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[
                  { id: "upload", title: "1. 模式与上传" },
                  { id: "mapping", title: "2. 机型映射" },
                  { id: "preview", title: "3. 校验与预览" },
                  { id: "result", title: "4. 导入结果" },
                ].map((step, idx) => {
                  const stepOrder = ["upload", "mapping", "preview", "result"];
                  const currentIdx = stepOrder.indexOf(importStep);
                  const thisIdx = stepOrder.indexOf(step.id);
                  const isDone = thisIdx < currentIdx;
                  const isCurrent = thisIdx === currentIdx;

                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        isCurrent
                          ? "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
                          : isDone
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-white border-gray-200 text-gray-400"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${
                          isCurrent
                            ? "bg-blue-600 text-white"
                            : isDone
                              ? "bg-green-600 text-white"
                              : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                      </span>
                      <span className="truncate">{step.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Wizard Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* STEP 1: Upload & Mode Selection */}
              {importStep === "upload" && (
                <div className="space-y-6">
                  {/* Mode Selector */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-800">
                      1. 选择导入模式 (Select Import Mode)
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Option 1: Append */}
                      <div
                        onClick={() => setImportMode("append")}
                        className={`cursor-pointer rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${
                          importMode === "append"
                            ? "border-blue-600 bg-blue-50/40 shadow-sm ring-1 ring-blue-500"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers className="h-5 w-5 text-blue-600" />
                              <span className="font-semibold text-gray-900">
                                新增追加 (Append)
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              推荐 / 安全
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            保留数据库中现存的全部航线，将 CSV 中的新数据追加到航线库中，适合日常增补航班。
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-100 flex items-center text-xs text-gray-500">
                          <span>现有航线不受任何影响</span>
                        </div>
                      </div>

                      {/* Option 2: Overwrite */}
                      <div
                        onClick={() => setImportMode("overwrite")}
                        className={`cursor-pointer rounded-xl border-2 p-4 transition-all flex flex-col justify-between ${
                          importMode === "overwrite"
                            ? "border-amber-600 bg-amber-50/40 shadow-sm ring-1 ring-amber-500"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-amber-600" />
                              <span className="font-semibold text-gray-900">
                                全量覆盖替换 (Wipe & Replace)
                              </span>
                            </div>
                            <Badge
                              variant="destructive"
                              className="bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-100"
                            >
                              高危替换
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            清空数据库中的所有旧航线，完全用本次上传的 CSV 数据替代，适合航班换季或航线库重置。
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-amber-100 flex items-center text-xs text-amber-700 font-medium">
                          <span>执行前会要求二次安全确认</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* File Upload Drop Area */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-800">
                      2. 上传 CSV 文件 (Upload CSV)
                    </Label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file && file.name.endsWith(".csv")) {
                          handleBulkImport(file);
                        }
                      }}
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                        isDragOver
                          ? "border-blue-500 bg-blue-50/60 scale-[0.99]"
                          : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100/50"
                      }`}
                      onClick={() => !importLoading && fileInputRef.current?.click()}
                    >
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

                      <div className="flex flex-col items-center justify-center gap-3">
                        {importLoading ? (
                          <>
                            <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
                            <div className="text-sm font-medium text-gray-700">
                              正在解析 CSV 并校验数据格式...
                            </div>
                            <div className="text-xs text-gray-500">
                              系统正在核验 ICAO 机场代码、时长与表头
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                              <Upload className="h-6 w-6" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">
                                点击选择文件 或 将 CSV 文件拖放到此处
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                支持标准 UTF-8 编码的 .csv 格式文件
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-1"
                            >
                              浏览本地文件
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Standard CSV Help Box */}
                  <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Info className="h-4 w-4 text-blue-600" />
                        CSV 表头规范说明
                      </span>
                      <a
                        href="/routes-template.csv"
                        download
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        下载标准样例模板 (routes-template.csv)
                      </a>
                    </div>
                    <p className="text-blue-800">
                      文件首行需包含以下表头字段：
                    </p>
                    <code className="block bg-white/90 border border-blue-200 rounded px-2.5 py-1.5 font-mono text-blue-950">
                      fltnum, dep, arr, duration, notes, aircraft
                    </code>
                    <p className="text-[11px] text-blue-700">
                      提示：dep 与 arr 必须为 4 位 ICAO 机场代码；duration 需为 HH:MM 格式；若包含多款机型，请用分号 (;) 分隔。
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: Aircraft Mapping */}
              {importStep === "mapping" && (
                <div className="space-y-5">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-900 space-y-1">
                      <p className="font-semibold">
                        严格手动映射模式 (Strict Manual Mapping)
                      </p>
                      <p>
                        系统检测到上传的 CSV 中包含以下机型名称。请为每个机型手动指定对应的系统机型；未映射的机型将被跳过，不会产生绑定关联。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold text-gray-800">
                        机型对应关系设置 ({aircraftNames.length} 个独立机型)
                      </Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-gray-500 hover:text-gray-900"
                        onClick={() => {
                          const cleared: Record<string, number> = {};
                          setAircraftMappings(cleared);
                        }}
                      >
                        重置所有映射
                      </Button>
                    </div>

                    <div className="border rounded-xl divide-y bg-white overflow-hidden shadow-sm">
                      <div className="grid grid-cols-12 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600">
                        <div className="col-span-5">CSV 中的机型名称</div>
                        <div className="col-span-2 text-center">映射关系</div>
                        <div className="col-span-5">对应系统机型 (数据库)</div>
                      </div>

                      {aircraftNames.map((aircraftName) => {
                        const countInCsv = (csvPreview || []).filter((r: any) =>
                          r.aircraftNames?.includes(aircraftName),
                        ).length;

                        return (
                          <div
                            key={aircraftName}
                            className="grid grid-cols-12 px-4 py-3 items-center gap-2 text-sm hover:bg-gray-50/50 transition-colors"
                          >
                            <div className="col-span-5 flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {aircraftName}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] text-gray-500 px-1.5 py-0"
                              >
                                {countInCsv} 航线
                              </Badge>
                            </div>

                            <div className="col-span-2 flex justify-center text-gray-400">
                              <ArrowRight className="h-4 w-4" />
                            </div>

                            <div className="col-span-5">
                              <Select
                                value={
                                  aircraftMappings[aircraftName] !== undefined
                                    ? aircraftMappings[aircraftName].toString()
                                    : "none"
                                }
                                onValueChange={(val) => {
                                  if (val !== "none") {
                                    setAircraftMappings({
                                      ...aircraftMappings,
                                      [aircraftName]: parseInt(val, 10),
                                    });
                                  } else {
                                    const next = { ...aircraftMappings };
                                    delete next[aircraftName];
                                    setAircraftMappings(next);
                                  }
                                }}
                              >
                                <SelectTrigger className="h-9 text-xs">
                                  <SelectValue placeholder="选择对应系统机型..." />
                                </SelectTrigger>
                                <SelectContent className="bg-white max-h-56">
                                  <SelectItem value="none">
                                    <span className="text-gray-400 font-normal">
                                      跳过 / 不关联机型 (None)
                                    </span>
                                  </SelectItem>
                                  {availableAircraft.map((ac: any) => (
                                    <SelectItem
                                      key={ac.id}
                                      value={ac.id.toString()}
                                    >
                                      {ac.name}
                                      {ac.liveryname && (
                                        <span className="text-gray-500 ml-1">
                                          ({ac.liveryname})
                                        </span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Validation & Preview */}
              {importStep === "preview" && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="shadow-none border-gray-200">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">
                            总记录行数
                          </p>
                          <p className="text-2xl font-bold text-gray-900 mt-1">
                            {(csvPreview?.length || 0) + (invalidRoutes?.length || 0)}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <Layers className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="shadow-none border-green-200 bg-green-50/20">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-green-700 font-medium">
                            校验通过 (将导入)
                          </p>
                          <p className="text-2xl font-bold text-green-700 mt-1">
                            {csvPreview?.length || 0}
                          </p>
                        </div>
                        <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center text-green-700">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card
                      className={`shadow-none ${
                        invalidRoutes.length > 0
                          ? "border-red-200 bg-red-50/20"
                          : "border-gray-200"
                      }`}
                    >
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p
                            className={`text-xs font-medium ${
                              invalidRoutes.length > 0
                                ? "text-red-700"
                                : "text-gray-500"
                            }`}
                          >
                            异常行 (将跳过)
                          </p>
                          <p
                            className={`text-2xl font-bold mt-1 ${
                              invalidRoutes.length > 0
                                ? "text-red-700"
                                : "text-gray-400"
                            }`}
                          >
                            {invalidRoutes.length}
                          </p>
                        </div>
                        <div
                          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                            invalidRoutes.length > 0
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <XCircle className="h-5 w-5" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Mode Alert Pill */}
                  <div
                    className={`rounded-lg p-3 text-xs flex items-center justify-between border ${
                      importMode === "overwrite"
                        ? "bg-amber-50 border-amber-200 text-amber-900"
                        : "bg-blue-50 border-blue-200 text-blue-900"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {importMode === "overwrite" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Layers className="h-4 w-4 text-blue-600" />
                      )}
                      <span>
                        本次执行模式：
                        <strong className="underline ml-1">
                          {importMode === "overwrite"
                            ? "全量覆盖替换 (清空旧数据)"
                            : "新增追加 (保留旧数据)"}
                        </strong>
                      </span>
                    </div>
                    {importMode === "overwrite" && (
                      <span className="text-amber-700 font-semibold">
                        现有约 {totalExistingRoutes} 条旧航线将被清除
                      </span>
                    )}
                  </div>

                  {/* Invalid Rows Accordion (if any) */}
                  {invalidRoutes.length > 0 && (
                    <div className="border border-red-200 rounded-xl overflow-hidden bg-red-50/30">
                      <div
                        onClick={() => setShowInvalidDetails(!showInvalidDetails)}
                        className="px-4 py-3 bg-red-50/80 flex items-center justify-between cursor-pointer hover:bg-red-100/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold text-red-900">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span>
                            发现 {invalidRoutes.length} 行数据存在格式错误（容错模式已将其隔离，导入时会自动跳过）
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-red-700 hover:text-red-900"
                        >
                          {showInvalidDetails ? "收起明细" : "展开错误明细"}
                        </Button>
                      </div>

                      {showInvalidDetails && (
                        <div className="p-3 max-h-44 overflow-y-auto divide-y divide-red-100 bg-white">
                          {invalidRoutes.map((inv: any, idx: number) => (
                            <div
                              key={idx}
                              className="py-2 text-xs grid grid-cols-12 gap-2"
                            >
                              <div className="col-span-2 font-mono text-gray-500 font-medium">
                                第 {inv.rowNumber} 行
                              </div>
                              <div className="col-span-3 text-gray-700 font-medium truncate">
                                {inv.fltnum || "(空航班号)"}{" "}
                                {inv.dep && inv.arr
                                  ? `(${inv.dep} → ${inv.arr})`
                                  : ""}
                              </div>
                              <div className="col-span-7 text-red-600">
                                {inv.errors?.join("; ") || "数据格式错误"}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Valid Routes Table Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label className="text-sm font-semibold text-gray-800">
                        有效航线预览 ({csvPreview?.length || 0} 条)
                      </Label>
                      <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                        <Input
                          placeholder="搜索航班号或机场..."
                          value={previewSearch}
                          onChange={(e) => {
                            setPreviewSearch(e.target.value);
                            setPreviewPage(1);
                          }}
                          className="pl-8 h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                      <Table>
                        <TableHeader className="bg-gray-50">
                          <TableRow className="text-xs">
                            <TableHead className="w-16">序号</TableHead>
                            <TableHead>航班号</TableHead>
                            <TableHead>起飞</TableHead>
                            <TableHead>降落</TableHead>
                            <TableHead>预计用时</TableHead>
                            <TableHead>关联机型</TableHead>
                            <TableHead>备注</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(() => {
                            const filtered = (csvPreview || []).filter(
                              (r: any) => {
                                if (!previewSearch.trim()) return true;
                                const q = previewSearch.toLowerCase();
                                return (
                                  r.fltnum?.toLowerCase().includes(q) ||
                                  r.dep?.toLowerCase().includes(q) ||
                                  r.arr?.toLowerCase().includes(q) ||
                                  r.notes?.toLowerCase().includes(q)
                                );
                              },
                            );

                            if (filtered.length === 0) {
                              return (
                                <TableRow>
                                  <TableCell
                                    colSpan={7}
                                    className="text-center py-6 text-gray-400 text-xs"
                                  >
                                    未找到匹配的有效航线
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            const pageSize = 8;
                            const totalPages = Math.max(
                              1,
                              Math.ceil(filtered.length / pageSize),
                            );
                            const startIdx = (previewPage - 1) * pageSize;
                            const currentSlice = filtered.slice(
                              startIdx,
                              startIdx + pageSize,
                            );

                            return currentSlice.map((route: any, idx: number) => {
                              // Find mapped aircraft display labels
                              const mappedLabels = (route.aircraftNames || [])
                                .map((acName: string) => {
                                  const dbId = aircraftMappings[acName];
                                  if (!dbId) return null;
                                  const found = availableAircraft.find(
                                    (a) => a.id === dbId,
                                  );
                                  return found ? found.name : acName;
                                })
                                .filter(Boolean);

                              return (
                                <TableRow
                                  key={idx}
                                  className="text-xs hover:bg-gray-50/50"
                                >
                                  <TableCell className="text-gray-400 font-mono">
                                    {startIdx + idx + 1}
                                  </TableCell>
                                  <TableCell className="font-semibold text-gray-900">
                                    {route.fltnum}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[11px]"
                                    >
                                      {route.dep}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className="font-mono text-[11px]"
                                    >
                                      {route.arr}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-gray-600">
                                    {route.duration}
                                  </TableCell>
                                  <TableCell>
                                    {mappedLabels.length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {mappedLabels.map(
                                          (lbl: string, lIdx: number) => (
                                            <Badge
                                              key={lIdx}
                                              variant="secondary"
                                              className="text-[10px] bg-blue-50 text-blue-700"
                                            >
                                              {lbl}
                                            </Badge>
                                          ),
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-[11px]">
                                        未关联
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-gray-500 max-w-xs truncate">
                                    {route.notes || "-"}
                                  </TableCell>
                                </TableRow>
                              );
                            });
                          })()}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination for preview */}
                    {(() => {
                      const filtered = (csvPreview || []).filter((r: any) => {
                        if (!previewSearch.trim()) return true;
                        const q = previewSearch.toLowerCase();
                        return (
                          r.fltnum?.toLowerCase().includes(q) ||
                          r.dep?.toLowerCase().includes(q) ||
                          r.arr?.toLowerCase().includes(q)
                        );
                      });
                      const pageSize = 8;
                      const totalPages = Math.max(
                        1,
                        Math.ceil(filtered.length / pageSize),
                      );

                      if (totalPages <= 1) return null;

                      return (
                        <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                          <span>
                            显示第 {(previewPage - 1) * pageSize + 1} -{" "}
                            {Math.min(previewPage * pageSize, filtered.length)} 条 / 共{" "}
                            {filtered.length} 条
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={previewPage <= 1}
                              onClick={() => setPreviewPage(previewPage - 1)}
                            >
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </Button>
                            <span className="px-2">
                              {previewPage} / {totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={previewPage >= totalPages}
                              onClick={() => setPreviewPage(previewPage + 1)}
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* STEP 4: Import Result Report */}
              {importStep === "result" && (
                <div className="py-6 flex flex-col items-center text-center space-y-4">
                  {importResult?.success ? (
                    <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                      <XCircle className="h-10 w-10" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-gray-900">
                      {importResult?.success ? "导入执行成功" : "导入未完成"}
                    </h3>
                    <p className="text-sm text-gray-600 max-w-md">
                      {importResult?.message}
                    </p>
                  </div>

                  {/* Result Detail Stats */}
                  {importResult?.createdCount !== undefined && (
                    <div className="w-full max-w-md bg-gray-50 border rounded-xl p-4 text-xs space-y-2.5">
                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="text-gray-600">执行模式:</span>
                        <Badge variant="outline">
                          {importMode === "overwrite"
                            ? "全量覆盖 (Wipe & Replace)"
                            : "新增追加 (Append)"}
                        </Badge>
                      </div>

                      {importMode === "overwrite" && (
                        <div className="flex justify-between items-center py-1 border-b border-gray-200">
                          <span className="text-gray-600">已清空旧航线:</span>
                          <span className="font-semibold text-amber-600">
                            {importResult.clearedCount ?? 0} 条
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-1 border-b border-gray-200">
                        <span className="text-gray-600">成功导入航线:</span>
                        <span className="font-semibold text-green-600">
                          {importResult.createdCount} 条
                        </span>
                      </div>

                      {invalidRoutes.length > 0 && (
                        <div className="flex justify-between items-center py-1">
                          <span className="text-gray-600">跳过异常行:</span>
                          <span className="font-semibold text-red-500">
                            {invalidRoutes.length} 条
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Errors display if failed */}
                  {importResult?.errors && importResult.errors.length > 0 && (
                    <div className="w-full max-w-md bg-red-50 border border-red-200 rounded-xl p-3 text-left max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-900 mb-1.5">
                        详细错误原因:
                      </p>
                      <ul className="space-y-1 text-xs text-red-700">
                        {importResult.errors.map((err: string, i: number) => (
                          <li key={i}>• {err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Wizard Footer Controls */}
            <div className="p-4 border-t bg-gray-50/70 flex items-center justify-between">
              <div>
                {importStep === "mapping" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportStep("upload")}
                    disabled={importLoading}
                  >
                    <ChevronLeft className="mr-1.5 h-4 w-4" />
                    上一步：重新选择文件
                  </Button>
                )}

                {importStep === "preview" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (aircraftNames.length > 0) {
                        setImportStep("mapping");
                      } else {
                        setImportStep("upload");
                      }
                    }}
                    disabled={importLoading}
                  >
                    <ChevronLeft className="mr-1.5 h-4 w-4" />
                    上一步
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {importStep !== "result" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetImportState}
                    disabled={importLoading}
                  >
                    取消
                  </Button>
                )}

                {importStep === "mapping" && (
                  <Button
                    size="sm"
                    onClick={() => setImportStep("preview")}
                    disabled={importLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    下一步：预览与校验
                    <ChevronRight className="ml-1.5 h-4 w-4" />
                  </Button>
                )}

                {importStep === "preview" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (importMode === "overwrite") {
                        setShowOverwriteConfirm(true);
                      } else {
                        executeImport();
                      }
                    }}
                    disabled={importLoading || (csvPreview?.length || 0) === 0}
                    className={
                      importMode === "overwrite"
                        ? "bg-red-600 hover:bg-red-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        正在导入...
                      </>
                    ) : importMode === "overwrite" ? (
                      <>
                        <Trash2 className="mr-1.5 h-4 w-4" />
                        确认全量覆盖导入 ({csvPreview?.length || 0} 条)
                      </>
                    ) : (
                      <>
                        <Upload className="mr-1.5 h-4 w-4" />
                        确认追加导入 ({csvPreview?.length || 0} 条)
                      </>
                    )}
                  </Button>
                )}

                {importStep === "result" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetImportState();
                        setIsImportingBulk(true);
                      }}
                    >
                      继续导入其他文件
                    </Button>
                    <Button
                      size="sm"
                      onClick={resetImportState}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      完成并查看航线
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Destructive Overwrite Double Confirmation Dialog */}
        <AlertDialog
          open={showOverwriteConfirm}
          onOpenChange={setShowOverwriteConfirm}
        >
          <AlertDialogContent className="bg-white max-w-md">
            <AlertDialogHeader>
              <div className="flex items-center gap-2 text-red-600 mb-1">
                <AlertTriangle className="h-6 w-6" />
                <AlertDialogTitle className="text-red-700">
                  危险操作：确认全量覆盖航线？
                </AlertDialogTitle>
              </div>
              <AlertDialogDescription className="text-gray-700 space-y-2 text-xs">
                <p>
                  您当前选择了
                  <strong className="text-red-600 mx-1">
                    【全量覆盖替换 (Wipe & Replace)】
                  </strong>
                  模式。
                </p>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800">
                  系统将在导入前
                  <strong>
                    彻底清空数据库中现存的全部航线（现有约{" "}
                    {totalExistingRoutes} 条）
                  </strong>
                  ，并仅保留本次 CSV 中的 {csvPreview?.length || 0} 条有效航线！
                </div>
                <p className="text-gray-500">
                  此操作不可撤销。请确保您已做好备份或确认需要重置航线库。
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter className="mt-4">
              <AlertDialogCancel
                onClick={() => setShowOverwriteConfirm(false)}
                disabled={importLoading}
                className="text-xs"
              >
                取消并返回检查
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={executeImport}
                disabled={importLoading}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
              >
                {importLoading ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    正在覆盖中...
                  </>
                ) : (
                  "我已知晓风险，确认清空并覆盖"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </CrewHeader>
  );
}
