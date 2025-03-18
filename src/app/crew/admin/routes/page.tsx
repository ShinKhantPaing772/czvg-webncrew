"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash,
  ArrowRight,
  Download,
  Upload,
  Info,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";

// Mock data for routes
const routesData = [
  {
    id: "RT-1001",
    airline: "VA",
    flightNumber: "101",
    departure: "KLAX",
    departureName: "Los Angeles International Airport",
    arrival: "KSFO",
    arrivalName: "San Francisco International Airport",
    aircraft: ["B738", "A320"],
    distance: 337,
    duration: "1:15",
    frequency: "Daily",
    departureTime: "08:00",
    arrivalTime: "09:15",
    status: "Active",
    createdAt: "2023-01-15T10:00:00Z",
    updatedAt: "2023-02-10T14:30:00Z",
    flightCount: 245,
    notes: "Popular commuter route with high demand.",
  },
  {
    id: "RT-1002",
    airline: "VA",
    flightNumber: "202",
    departure: "KSFO",
    departureName: "San Francisco International Airport",
    arrival: "KDEN",
    arrivalName: "Denver International Airport",
    aircraft: ["B738", "A320"],
    distance: 967,
    duration: "2:30",
    frequency: "Daily",
    departureTime: "10:30",
    arrivalTime: "13:00",
    status: "Active",
    createdAt: "2023-01-15T10:15:00Z",
    updatedAt: "2023-02-10T14:35:00Z",
    flightCount: 198,
    notes: "Mountain crossing route with occasional turbulence.",
  },
  {
    id: "RT-1003",
    airline: "VA",
    flightNumber: "303",
    departure: "KDEN",
    departureName: "Denver International Airport",
    arrival: "KATL",
    arrivalName: "Hartsfield-Jackson Atlanta International Airport",
    aircraft: ["B738", "B77W"],
    distance: 1199,
    duration: "2:45",
    frequency: "Daily",
    departureTime: "14:15",
    arrivalTime: "17:00",
    status: "Active",
    createdAt: "2023-01-15T10:30:00Z",
    updatedAt: "2023-02-10T14:40:00Z",
    flightCount: 187,
    notes: "Cross-country route connecting mountain west to southeast.",
  },
  {
    id: "RT-1004",
    airline: "VA",
    flightNumber: "404",
    departure: "KATL",
    departureName: "Hartsfield-Jackson Atlanta International Airport",
    arrival: "KJFK",
    arrivalName: "John F. Kennedy International Airport",
    aircraft: ["A320", "B77W"],
    distance: 760,
    duration: "2:10",
    frequency: "Daily",
    departureTime: "18:30",
    arrivalTime: "20:40",
    status: "Active",
    createdAt: "2023-01-15T10:45:00Z",
    updatedAt: "2023-02-10T14:45:00Z",
    flightCount: 165,
    notes: "East coast connector between major hubs.",
  },
  {
    id: "RT-1005",
    airline: "VA",
    flightNumber: "505",
    departure: "KJFK",
    departureName: "John F. Kennedy International Airport",
    arrival: "KBOS",
    arrivalName: "Boston Logan International Airport",
    aircraft: ["CRJ7", "E190"],
    distance: 187,
    duration: "1:05",
    frequency: "Daily",
    departureTime: "21:30",
    arrivalTime: "22:35",
    status: "Active",
    createdAt: "2023-01-15T11:00:00Z",
    updatedAt: "2023-02-10T14:50:00Z",
    flightCount: 142,
    notes: "Short northeast corridor route, popular with business travelers.",
  },
  {
    id: "RT-1006",
    airline: "VA",
    flightNumber: "606",
    departure: "KBOS",
    departureName: "Boston Logan International Airport",
    arrival: "KLAX",
    arrivalName: "Los Angeles International Airport",
    aircraft: ["B77W", "A359"],
    distance: 2611,
    duration: "6:15",
    frequency: "Daily",
    departureTime: "23:45",
    arrivalTime: "06:00",
    status: "Inactive",
    createdAt: "2023-01-15T11:15:00Z",
    updatedAt: "2023-03-05T09:20:00Z",
    flightCount: 98,
    notes:
      "Transcontinental red-eye flight. Currently inactive due to seasonal adjustments.",
  },
  {
    id: "RT-1007",
    airline: "VA",
    flightNumber: "707",
    departure: "KMIA",
    departureName: "Miami International Airport",
    arrival: "KJFK",
    arrivalName: "John F. Kennedy International Airport",
    aircraft: ["B738", "A320"],
    distance: 1089,
    duration: "2:50",
    frequency: "Daily",
    departureTime: "09:30",
    arrivalTime: "12:20",
    status: "Active",
    createdAt: "2023-01-20T13:45:00Z",
    updatedAt: "2023-02-15T16:30:00Z",
    flightCount: 132,
    notes: "Popular route connecting south Florida to New York.",
  },
  {
    id: "RT-1008",
    airline: "VA",
    flightNumber: "808",
    departure: "KORD",
    departureName: "Chicago O'Hare International Airport",
    arrival: "KDFW",
    arrivalName: "Dallas/Fort Worth International Airport",
    aircraft: ["B738", "A320"],
    distance: 802,
    duration: "2:15",
    frequency: "Daily",
    departureTime: "11:45",
    arrivalTime: "14:00",
    status: "Active",
    createdAt: "2023-01-25T09:30:00Z",
    updatedAt: "2023-02-18T11:20:00Z",
    flightCount: 128,
    notes: "Midwest to south central route, connecting major hubs.",
  },
];

// Mock data for airports
const airportsData = [
  {
    code: "KLAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States",
  },
  {
    code: "KSFO",
    name: "San Francisco International Airport",
    city: "San Francisco",
    country: "United States",
  },
  {
    code: "KDEN",
    name: "Denver International Airport",
    city: "Denver",
    country: "United States",
  },
  {
    code: "KATL",
    name: "Hartsfield-Jackson Atlanta International Airport",
    city: "Atlanta",
    country: "United States",
  },
  {
    code: "KJFK",
    name: "John F. Kennedy International Airport",
    city: "New York",
    country: "United States",
  },
  {
    code: "KBOS",
    name: "Boston Logan International Airport",
    city: "Boston",
    country: "United States",
  },
  {
    code: "KMIA",
    name: "Miami International Airport",
    city: "Miami",
    country: "United States",
  },
  {
    code: "KORD",
    name: "Chicago O'Hare International Airport",
    city: "Chicago",
    country: "United States",
  },
  {
    code: "KDFW",
    name: "Dallas/Fort Worth International Airport",
    city: "Dallas",
    country: "United States",
  },
  {
    code: "KLAS",
    name: "Harry Reid International Airport",
    city: "Las Vegas",
    country: "United States",
  },
];

// Mock data for aircraft
const aircraftData = [
  { code: "B738", name: "Boeing 737-800", category: "Narrow-body" },
  { code: "A320", name: "Airbus A320", category: "Narrow-body" },
  { code: "B77W", name: "Boeing 777-300ER", category: "Wide-body" },
  { code: "A359", name: "Airbus A350-900", category: "Wide-body" },
  { code: "CRJ7", name: "Bombardier CRJ-700", category: "Regional" },
  { code: "E190", name: "Embraer E190", category: "Regional" },
];

export default function AdminRoutes() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [aircraftFilter, setAircraftFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRoute, setSelectedRoute] = useState<
    (typeof routesData)[0] | null
  >(null);
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const itemsPerPage = 5;

  // New route form state
  const [newRoute, setNewRoute] = useState({
    airline: "VA",
    flightNumber: "",
    departure: "",
    arrival: "",
    aircraft: [] as string[],
    distance: "",
    duration: "",
    frequency: "Daily",
    departureTime: "",
    arrivalTime: "",
    status: "Active",
    notes: "",
  });

  // Filter routes based on search and filters
  const filteredRoutes = routesData.filter((route) => {
    const matchesSearch =
      route.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.departure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.arrival.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `${route.airline}${route.flightNumber}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all"
        ? true
        : route.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesAircraft =
      aircraftFilter === "all"
        ? true
        : route.aircraft.some((ac) => ac === aircraftFilter);

    return matchesSearch && matchesStatus && matchesAircraft;
  });

  // Sort routes by flight number
  const sortedRoutes = [...filteredRoutes].sort((a, b) => {
    return Number.parseInt(a.flightNumber) - Number.parseInt(b.flightNumber);
  });

  // Paginate routes
  const totalPages = Math.ceil(sortedRoutes.length / itemsPerPage);
  const paginatedRoutes = sortedRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Active
          </Badge>
        );
      case "inactive":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            Inactive
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Handle adding a new route
  const handleAddRoute = () => {
    // In a real app, you would call an API to add the new route
    console.log("Adding new route:", newRoute);
    setIsAddingRoute(false);
    // Reset form
    setNewRoute({
      airline: "VA",
      flightNumber: "",
      departure: "",
      arrival: "",
      aircraft: [],
      distance: "",
      duration: "",
      frequency: "Daily",
      departureTime: "",
      arrivalTime: "",
      status: "Active",
      notes: "",
    });
  };

  // Handle editing a route
  const handleEditRoute = () => {
    // In a real app, you would call an API to update the route
    console.log("Editing route:", selectedRoute);
    setIsEditingRoute(false);
    setSelectedRoute(null);
  };

  // Handle deleting a route
  const handleDeleteRoute = () => {
    // In a real app, you would call an API to delete the route
    console.log("Deleting route:", selectedRoute?.id);
    setShowDeleteDialog(false);
    setSelectedRoute(null);
  };

  // Initialize edit form with selected route data
  const initEditForm = (route: (typeof routesData)[0]) => {
    setSelectedRoute(route);
    setIsEditingRoute(true);
  };

  // Toggle aircraft selection in new route form
  const toggleAircraftSelection = (aircraftCode: string) => {
    setNewRoute((prev) => {
      const isSelected = prev.aircraft.includes(aircraftCode);
      return {
        ...prev,
        aircraft: isSelected
          ? prev.aircraft.filter((code) => code !== aircraftCode)
          : [...prev.aircraft, aircraftCode],
      };
    });
  };

  // Handle import routes
  const handleImportRoutes = () => {
    // In a real app, you would handle file upload and processing
    console.log("Importing routes");
    setShowImportDialog(false);
  };

  return (
    <CrewHeader userName="Admin User" isAdmin={true}>
      <main className="flex-1 p-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">Route Management</h1>

            <div className="flex items-center gap-2">
              <Dialog
                open={showImportDialog}
                onOpenChange={setShowImportDialog}
              >
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    <span>Import</span>
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Routes</DialogTitle>
                    <DialogDescription>
                      Upload a CSV or JSON file containing route data to import
                      multiple routes at once.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="file">File</Label>
                      <Input id="file" type="file" accept=".csv,.json" />
                      <p className="text-xs text-muted-foreground">
                        Accepted formats: CSV, JSON. Maximum file size: 5MB.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Checkbox id="overwrite" />
                      <Label htmlFor="overwrite" className="text-sm">
                        Overwrite existing routes with matching flight numbers
                      </Label>
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setShowImportDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleImportRoutes}>Import Routes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                <span>Export</span>
              </Button>

              <Dialog open={isAddingRoute} onOpenChange={setIsAddingRoute}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Add Route</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>Add New Route</DialogTitle>
                    <DialogDescription>
                      Create a new flight route in the system. All fields marked
                      with * are required.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="airline">Airline Code *</Label>
                        <Input
                          id="airline"
                          value={newRoute.airline}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              airline: e.target.value,
                            })
                          }
                          placeholder="VA"
                          maxLength={3}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="flightNumber">Flight Number *</Label>
                        <Input
                          id="flightNumber"
                          value={newRoute.flightNumber}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              flightNumber: e.target.value,
                            })
                          }
                          placeholder="101"
                          maxLength={4}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="departure">Departure Airport *</Label>
                        <Select
                          value={newRoute.departure}
                          onValueChange={(value) =>
                            setNewRoute({ ...newRoute, departure: value })
                          }
                        >
                          <SelectTrigger id="departure">
                            <SelectValue placeholder="Select departure airport" />
                          </SelectTrigger>
                          <SelectContent>
                            {airportsData.map((airport) => (
                              <SelectItem
                                key={airport.code}
                                value={airport.code}
                              >
                                {airport.code} - {airport.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="arrival">Arrival Airport *</Label>
                        <Select
                          value={newRoute.arrival}
                          onValueChange={(value) =>
                            setNewRoute({ ...newRoute, arrival: value })
                          }
                        >
                          <SelectTrigger id="arrival">
                            <SelectValue placeholder="Select arrival airport" />
                          </SelectTrigger>
                          <SelectContent>
                            {airportsData.map((airport) => (
                              <SelectItem
                                key={airport.code}
                                value={airport.code}
                              >
                                {airport.code} - {airport.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="distance">Distance (nm) *</Label>
                        <Input
                          id="distance"
                          type="number"
                          min="0"
                          value={newRoute.distance}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              distance: e.target.value,
                            })
                          }
                          placeholder="337"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (HH:MM) *</Label>
                        <Input
                          id="duration"
                          value={newRoute.duration}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              duration: e.target.value,
                            })
                          }
                          placeholder="1:15"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="departureTime">
                          Departure Time (HH:MM) *
                        </Label>
                        <Input
                          id="departureTime"
                          value={newRoute.departureTime}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              departureTime: e.target.value,
                            })
                          }
                          placeholder="08:00"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="arrivalTime">
                          Arrival Time (HH:MM) *
                        </Label>
                        <Input
                          id="arrivalTime"
                          value={newRoute.arrivalTime}
                          onChange={(e) =>
                            setNewRoute({
                              ...newRoute,
                              arrivalTime: e.target.value,
                            })
                          }
                          placeholder="09:15"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="frequency">Frequency *</Label>
                        <Select
                          value={newRoute.frequency}
                          onValueChange={(value) =>
                            setNewRoute({ ...newRoute, frequency: value })
                          }
                        >
                          <SelectTrigger id="frequency">
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Daily">Daily</SelectItem>
                            <SelectItem value="Weekdays">Weekdays</SelectItem>
                            <SelectItem value="Weekends">Weekends</SelectItem>
                            <SelectItem value="Mon,Wed,Fri">
                              Mon, Wed, Fri
                            </SelectItem>
                            <SelectItem value="Tue,Thu,Sat">
                              Tue, Thu, Sat
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="status">Status *</Label>
                        <Select
                          value={newRoute.status}
                          onValueChange={(value) =>
                            setNewRoute({ ...newRoute, status: value })
                          }
                        >
                          <SelectTrigger id="status">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Aircraft Types *</Label>
                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        {aircraftData.map((aircraft) => (
                          <div
                            key={aircraft.code}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`aircraft-${aircraft.code}`}
                              checked={newRoute.aircraft.includes(
                                aircraft.code
                              )}
                              onCheckedChange={() =>
                                toggleAircraftSelection(aircraft.code)
                              }
                            />
                            <Label
                              htmlFor={`aircraft-${aircraft.code}`}
                              className="text-sm"
                            >
                              {aircraft.code} - {aircraft.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={newRoute.notes}
                        onChange={(e) =>
                          setNewRoute({ ...newRoute, notes: e.target.value })
                        }
                        placeholder="Enter any additional information about this route..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAddingRoute(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddRoute}
                      disabled={
                        !newRoute.airline ||
                        !newRoute.flightNumber ||
                        !newRoute.departure ||
                        !newRoute.arrival ||
                        !newRoute.distance ||
                        !newRoute.duration ||
                        !newRoute.departureTime ||
                        !newRoute.arrivalTime ||
                        newRoute.aircraft.length === 0
                      }
                    >
                      Add Route
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex flex-col gap-4">
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

              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowFilters(!showFilters)}
                className="h-10 w-10 shrink-0"
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only">Toggle filters</span>
              </Button>
            </div>

            {showFilters && (
              <Card>
                <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger id="status">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aircraft">Aircraft Type</Label>
                    <Select
                      value={aircraftFilter}
                      onValueChange={setAircraftFilter}
                    >
                      <SelectTrigger id="aircraft">
                        <SelectValue placeholder="Filter by aircraft" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Aircraft</SelectItem>
                        {aircraftData.map((aircraft) => (
                          <SelectItem key={aircraft.code} value={aircraft.code}>
                            {aircraft.code} - {aircraft.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="p-4">
                <CardTitle>Flight Routes</CardTitle>
                <CardDescription>
                  Manage all flight routes in the system
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Flight</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Aircraft
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Distance
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        Duration
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRoutes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No routes found matching your criteria
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRoutes.map((route) => (
                        <TableRow key={route.id}>
                          <TableCell className="font-medium">
                            {route.airline}
                            {route.flightNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>{route.departure}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span>{route.arrival}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {route.aircraft.join(", ")}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {route.distance} nm
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {route.duration}
                          </TableCell>
                          <TableCell>{getStatusBadge(route.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedRoute(route);
                                  initEditForm(route);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedRoute(route);
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
              <CardFooter className="flex items-center justify-between p-4">
                <div className="text-sm text-muted-foreground">
                  Showing {paginatedRoutes.length} of {filteredRoutes.length}{" "}
                  routes
                </div>

                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((prev) => Math.max(prev - 1, 1));
                          }}
                          aria-disabled={currentPage === 1}
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : ""
                          }
                        />
                      </PaginationItem>

                      {Array.from({ length: totalPages }).map((_, i) => {
                        const page = i + 1;
                        // Show first page, last page, and pages around current page
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setCurrentPage(page);
                                }}
                                isActive={page === currentPage}
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }

                        // Show ellipsis for gaps
                        if (
                          (page === 2 && currentPage > 3) ||
                          (page === totalPages - 1 &&
                            currentPage < totalPages - 2)
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
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages)
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
              </CardFooter>
            </Card>
          </div>

          {/* Edit Route Dialog */}
          <Dialog open={isEditingRoute} onOpenChange={setIsEditingRoute}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Edit Route</DialogTitle>
                <DialogDescription>
                  Update the details for route {selectedRoute?.airline}
                  {selectedRoute?.flightNumber}.
                </DialogDescription>
              </DialogHeader>

              {selectedRoute && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="edit-airline">Airline Code</Label>
                      <Input
                        id="edit-airline"
                        value={selectedRoute.airline}
                        onChange={(e) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            airline: e.target.value,
                          })
                        }
                        maxLength={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-flightNumber">Flight Number</Label>
                      <Input
                        id="edit-flightNumber"
                        value={selectedRoute.flightNumber}
                        onChange={(e) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            flightNumber: e.target.value,
                          })
                        }
                        maxLength={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-departure">Departure Airport</Label>
                      <Select
                        value={selectedRoute.departure}
                        onValueChange={(value) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            departure: value,
                          })
                        }
                      >
                        <SelectTrigger id="edit-departure">
                          <SelectValue placeholder="Select departure airport" />
                        </SelectTrigger>
                        <SelectContent>
                          {airportsData.map((airport) => (
                            <SelectItem key={airport.code} value={airport.code}>
                              {airport.code} - {airport.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-arrival">Arrival Airport</Label>
                      <Select
                        value={selectedRoute.arrival}
                        onValueChange={(value) =>
                          setSelectedRoute({ ...selectedRoute, arrival: value })
                        }
                      >
                        <SelectTrigger id="edit-arrival">
                          <SelectValue placeholder="Select arrival airport" />
                        </SelectTrigger>
                        <SelectContent>
                          {airportsData.map((airport) => (
                            <SelectItem key={airport.code} value={airport.code}>
                              {airport.code} - {airport.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-distance">Distance (nm)</Label>
                      <Input
                        id="edit-distance"
                        type="number"
                        min="0"
                        value={selectedRoute.distance}
                        onChange={(e) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            distance: Number.parseInt(e.target.value),
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-duration">Duration (HH:MM)</Label>
                      <Input
                        id="edit-duration"
                        value={selectedRoute.duration}
                        onChange={(e) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            duration: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-departureTime">
                        Departure Time (HH:MM)
                      </Label>
                      <Input
                        id="edit-departureTime"
                        value={selectedRoute.departureTime}
                        onChange={(e) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            departureTime: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-arrivalTime">
                        Arrival Time (HH:MM)
                      </Label>
                      <Input
                        id="edit-arrivalTime"
                        value={selectedRoute.arrivalTime}
                        onChange={(e) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            arrivalTime: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-frequency">Frequency</Label>
                      <Select
                        value={selectedRoute.frequency}
                        onValueChange={(value) =>
                          setSelectedRoute({
                            ...selectedRoute,
                            frequency: value,
                          })
                        }
                      >
                        <SelectTrigger id="edit-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Daily">Daily</SelectItem>
                          <SelectItem value="Weekdays">Weekdays</SelectItem>
                          <SelectItem value="Weekends">Weekends</SelectItem>
                          <SelectItem value="Mon,Wed,Fri">
                            Mon, Wed, Fri
                          </SelectItem>
                          <SelectItem value="Tue,Thu,Sat">
                            Tue, Thu, Sat
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={selectedRoute.status}
                        onValueChange={(value) =>
                          setSelectedRoute({ ...selectedRoute, status: value })
                        }
                      >
                        <SelectTrigger id="edit-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Aircraft Types</Label>
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {aircraftData.map((aircraft) => (
                        <div
                          key={aircraft.code}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`edit-aircraft-${aircraft.code}`}
                            checked={selectedRoute.aircraft.includes(
                              aircraft.code
                            )}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedRoute({
                                  ...selectedRoute,
                                  aircraft: [
                                    ...selectedRoute.aircraft,
                                    aircraft.code,
                                  ],
                                });
                              } else {
                                setSelectedRoute({
                                  ...selectedRoute,
                                  aircraft: selectedRoute.aircraft.filter(
                                    (code) => code !== aircraft.code
                                  ),
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`edit-aircraft-${aircraft.code}`}
                            className="text-sm"
                          >
                            {aircraft.code} - {aircraft.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea
                      id="edit-notes"
                      value={selectedRoute.notes}
                      onChange={(e) =>
                        setSelectedRoute({
                          ...selectedRoute,
                          notes: e.target.value,
                        })
                      }
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    <span>
                      This route has been flown {selectedRoute.flightCount}{" "}
                      times. Last updated on{" "}
                      {new Date(selectedRoute.updatedAt).toLocaleDateString()}.
                    </span>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsEditingRoute(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleEditRoute}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Route Dialog */}
          <AlertDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the route{" "}
                  {selectedRoute?.airline}
                  {selectedRoute?.flightNumber} ({selectedRoute?.departure} to{" "}
                  {selectedRoute?.arrival}). This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteRoute}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </main>
    </CrewHeader>
  );
}
