"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  ChevronDown,
  Download,
  Eye,
  Clock,
  Calendar,
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Mock data for PIREPs
const pirepsData = [
  {
    id: "PIREP-1001",
    flightNumber: "VA101",
    date: "2023-03-15",
    departure: "KLAX",
    arrival: "KSFO",
    aircraft: "B738",
    registration: "N12345",
    duration: "1:15",
    fuelUsed: "2450.5",
    status: "Approved",
    pilot: {
      id: "P001",
      name: "John Doe",
      email: "john.doe@example.com",
      rank: "Captain",
      hours: 256.5,
    },
    submittedAt: "2023-03-15T18:30:00Z",
    approvedAt: "2023-03-15T20:15:00Z",
    approvedBy: "Admin User",
    comments: "Smooth flight with good weather conditions.",
    landingRate: "-120 fpm",
    route: "KLAX SID KSFO",
    multiplier: "1.0",
    flightPoints: 125,
    adminRemarks: "Clean landing, good flight plan adherence.",
  },
  {
    id: "PIREP-1002",
    flightNumber: "VA202",
    date: "2023-03-10",
    departure: "KSFO",
    arrival: "KDEN",
    aircraft: "A320",
    registration: "N54321",
    duration: "2:30",
    fuelUsed: "3850.2",
    status: "Approved",
    pilot: {
      id: "P001",
      name: "John Doe",
      email: "john.doe@example.com",
      rank: "Captain",
      hours: 256.5,
    },
    submittedAt: "2023-03-10T16:45:00Z",
    approvedAt: "2023-03-10T18:20:00Z",
    approvedBy: "Admin User",
    comments: "Encountered light turbulence over the Rockies.",
    landingRate: "-180 fpm",
    route: "KSFO SID KDEN",
    multiplier: "1.0",
    flightPoints: 250,
    adminRemarks: "Good handling of turbulence.",
  },
  {
    id: "PIREP-1003",
    flightNumber: "VA303",
    date: "2023-03-05",
    departure: "KDEN",
    arrival: "KATL",
    aircraft: "B738",
    registration: "N12345",
    duration: "2:45",
    fuelUsed: "4120.8",
    status: "Pending",
    pilot: {
      id: "P001",
      name: "John Doe",
      email: "john.doe@example.com",
      rank: "Captain",
      hours: 256.5,
    },
    submittedAt: "2023-03-05T21:10:00Z",
    approvedAt: null,
    approvedBy: null,
    comments: "Delayed departure due to weather, otherwise uneventful.",
    landingRate: "-210 fpm",
    route: "KDEN SID KATL",
    multiplier: "1.0",
    flightPoints: null,
    adminRemarks: null,
  },
  {
    id: "PIREP-1004",
    flightNumber: "VA404",
    date: "2023-03-01",
    departure: "KATL",
    arrival: "KJFK",
    aircraft: "B738",
    registration: "N12345",
    duration: "2:10",
    fuelUsed: "3750.3",
    status: "Rejected",
    pilot: {
      id: "P002",
      name: "Jane Smith",
      email: "jane.smith@example.com",
      rank: "First Officer",
      hours: 178.2,
    },
    submittedAt: "2023-03-01T23:45:00Z",
    approvedAt: null,
    approvedBy: "Admin User",
    comments: "Strong crosswinds on landing.",
    landingRate: "-350 fpm",
    route: "KATL SID KJFK",
    multiplier: "1.0",
    flightPoints: null,
    adminRemarks:
      "Landing rate exceeded limits. Please review landing procedures.",
  },
  {
    id: "PIREP-1005",
    flightNumber: "VA505",
    date: "2023-02-25",
    departure: "KJFK",
    arrival: "KBOS",
    aircraft: "CRJ7",
    registration: "N98765",
    duration: "1:05",
    fuelUsed: "1850.4",
    status: "Approved",
    pilot: {
      id: "P003",
      name: "Robert Wilson",
      email: "robert.wilson@example.com",
      rank: "Captain",
      hours: 412.8,
    },
    submittedAt: "2023-02-25T14:20:00Z",
    approvedAt: "2023-02-25T16:05:00Z",
    approvedBy: "Admin User",
    comments: "Short and smooth flight.",
    landingRate: "-140 fpm",
    route: "KJFK SID KBOS",
    multiplier: "1.0",
    flightPoints: 105,
    adminRemarks: "Excellent flight.",
  },
  {
    id: "PIREP-1006",
    flightNumber: "VA606",
    date: "2023-02-20",
    departure: "KBOS",
    arrival: "KLAX",
    aircraft: "B77W",
    registration: "N78901",
    duration: "6:15",
    fuelUsed: "12500.7",
    status: "Pending",
    pilot: {
      id: "P004",
      name: "Emily Davis",
      email: "emily.davis@example.com",
      rank: "First Officer",
      hours: 156.3,
    },
    submittedAt: "2023-02-20T08:30:00Z",
    approvedAt: null,
    approvedBy: null,
    comments: "Long-haul flight with minor turbulence mid-flight.",
    landingRate: "-160 fpm",
    route: "KBOS SID KLAX",
    multiplier: "1.5",
    flightPoints: null,
    adminRemarks: null,
  },
];

export default function AdminPireps() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pilotFilter, setPilotFilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPirep, setSelectedPirep] = useState<
    (typeof pirepsData)[0] | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const itemsPerPage = 5;

  // Filter PIREPs based on search, filters, and active tab
  const filteredPireps = pirepsData.filter((pirep) => {
    const matchesSearch =
      pirep.flightNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.departure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.arrival.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.pilot.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all"
        ? true
        : pirep.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesPilot =
      pilotFilter === "all" ? true : pirep.pilot.id === pilotFilter;
    const matchesTab =
      activeTab === "all"
        ? true
        : pirep.status.toLowerCase() === activeTab.toLowerCase();

    return matchesSearch && matchesStatus && matchesPilot && matchesTab;
  });

  // Sort PIREPs by date
  const sortedPireps = [...filteredPireps].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateSort === "desc" ? dateB - dateA : dateA - dateB;
  });

  // Paginate PIREPs
  const totalPages = Math.ceil(sortedPireps.length / itemsPerPage);
  const paginatedPireps = sortedPireps.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Get unique pilots for filter
  const uniquePilots = Array.from(
    new Set(pirepsData.map((pirep) => pirep.pilot.id))
  ).map((pilotId) => {
    const pilot = pirepsData.find((pirep) => pirep.pilot.id === pilotId)?.pilot;
    return pilot;
  });

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  // Handle PIREP approval
  const handleApprovePirep = (pirep: (typeof pirepsData)[0]) => {
    // In a real app, you would call an API to update the PIREP status
    console.log(`Approving PIREP ${pirep.id} with remarks: ${adminRemarks}`);
    // Reset admin remarks
    setAdminRemarks("");
  };

  // Handle PIREP rejection
  const handleRejectPirep = (pirep: (typeof pirepsData)[0]) => {
    // In a real app, you would call an API to update the PIREP status
    console.log(`Rejecting PIREP ${pirep.id} with remarks: ${adminRemarks}`);
    // Reset admin remarks
    setAdminRemarks("");
  };

  // Count PIREPs by status
  const pendingCount = pirepsData.filter(
    (pirep) => pirep.status.toLowerCase() === "pending"
  ).length;
  const approvedCount = pirepsData.filter(
    (pirep) => pirep.status.toLowerCase() === "approved"
  ).length;
  const rejectedCount = pirepsData.filter(
    (pirep) => pirep.status.toLowerCase() === "rejected"
  ).length;

  return (
    <CrewHeader userName="Admin User" isAdmin={true}>
      <main className="flex-1 p-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">PIREP Management</h1>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/pirep-settings">
                  <Clock className="mr-2 h-4 w-4" />
                  <span>Auto-Approval Settings</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/admin/pirep-export">
                  <Download className="mr-2 h-4 w-4" />
                  <span>Export PIREPs</span>
                </a>
              </Button>
            </div>
          </div>

          <Tabs
            defaultValue="all"
            className="space-y-4"
            onValueChange={setActiveTab}
          >
            <div className="flex justify-between">
              <TabsList>
                <TabsTrigger value="all" className="relative">
                  All
                  <Badge className="ml-2 bg-primary/10 text-primary">
                    {pirepsData.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="relative">
                  Pending
                  <Badge className="ml-2 bg-amber-100 text-amber-700">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="approved" className="relative">
                  Approved
                  <Badge className="ml-2 bg-green-100 text-green-700">
                    {approvedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="rejected" className="relative">
                  Rejected
                  <Badge className="ml-2 bg-red-100 text-red-700">
                    {rejectedCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setDateSort(dateSort === "desc" ? "asc" : "desc")
                  }
                  className="flex items-center gap-1"
                >
                  <Calendar className="h-4 w-4" />
                  <span>Date</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      dateSort === "asc" ? "rotate-180" : ""
                    }`}
                  />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-1"
                >
                  <Filter className="h-4 w-4" />
                  <span>Filters</span>
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="search">Search PIREPs</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="search"
                      placeholder="Search by flight number, pilot name, airport code..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <div className="md:hidden flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDateSort(dateSort === "desc" ? "asc" : "desc")
                    }
                    className="flex items-center gap-1"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Date</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        dateSort === "asc" ? "rotate-180" : ""
                      }`}
                    />
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                  </Button>
                </div>
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
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pilot">Pilot</Label>
                      <Select
                        value={pilotFilter}
                        onValueChange={setPilotFilter}
                      >
                        <SelectTrigger id="pilot">
                          <SelectValue placeholder="Filter by pilot" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Pilots</SelectItem>
                          {uniquePilots.map((pilot) => (
                            <SelectItem key={pilot?.id} value={pilot?.id || ""}>
                              {pilot?.name} ({pilot?.rank})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              )}

              <TabsContent value="all" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>All PIREPs</CardTitle>
                    <CardDescription>
                      View and manage all pilot reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PIREP ID</TableHead>
                          <TableHead>Flight</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Pilot</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Route
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Aircraft
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPireps.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No PIREPs found matching your criteria
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedPireps.map((pirep) => (
                            <TableRow key={pirep.id}>
                              <TableCell className="font-medium">
                                {pirep.id}
                              </TableCell>
                              <TableCell>{pirep.flightNumber}</TableCell>
                              <TableCell>{pirep.date}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>{pirep.pilot.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {pirep.pilot.rank}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-1">
                                  <span>{pirep.departure}</span>
                                  <span>→</span>
                                  <span>{pirep.arrival}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {pirep.aircraft}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(pirep.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedPirep(pirep)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      <span className="hidden sm:inline">
                                        View
                                      </span>
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-4xl">
                                    <DialogHeader>
                                      <DialogTitle className="flex items-center gap-2">
                                        {getStatusIcon(pirep.status)}
                                        <span>PIREP Details: {pirep.id}</span>
                                      </DialogTitle>
                                      <DialogDescription>
                                        Flight {pirep.flightNumber} from{" "}
                                        {pirep.departure} to {pirep.arrival}
                                      </DialogDescription>
                                    </DialogHeader>

                                    <div className="grid gap-4 py-4">
                                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm font-medium">
                                              Flight Information
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-3 pt-0">
                                            <dl className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Flight Number:
                                                </dt>
                                                <dd>{pirep.flightNumber}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Date:
                                                </dt>
                                                <dd>{pirep.date}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Route:
                                                </dt>
                                                <dd>
                                                  {pirep.departure} →{" "}
                                                  {pirep.arrival}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Duration:
                                                </dt>
                                                <dd>{pirep.duration}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Detailed Route:
                                                </dt>
                                                <dd
                                                  className="truncate max-w-[150px]"
                                                  title={pirep.route}
                                                >
                                                  {pirep.route}
                                                </dd>
                                              </div>
                                            </dl>
                                          </CardContent>
                                        </Card>

                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm font-medium">
                                              Aircraft Details
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-3 pt-0">
                                            <dl className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Aircraft Type:
                                                </dt>
                                                <dd>{pirep.aircraft}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Registration:
                                                </dt>
                                                <dd>{pirep.registration}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Fuel Used:
                                                </dt>
                                                <dd>{pirep.fuelUsed} kg</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Landing Rate:
                                                </dt>
                                                <dd>{pirep.landingRate}</dd>
                                              </div>
                                            </dl>
                                          </CardContent>
                                        </Card>

                                        <Card>
                                          <CardHeader className="p-3">
                                            <CardTitle className="text-sm font-medium">
                                              Pilot Information
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-3 pt-0">
                                            <dl className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Name:
                                                </dt>
                                                <dd>{pirep.pilot.name}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Rank:
                                                </dt>
                                                <dd>{pirep.pilot.rank}</dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Email:
                                                </dt>
                                                <dd className="truncate max-w-[150px]">
                                                  {pirep.pilot.email}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Flight Hours:
                                                </dt>
                                                <dd>{pirep.pilot.hours}</dd>
                                              </div>
                                            </dl>
                                          </CardContent>
                                        </Card>
                                      </div>

                                      <Card>
                                        <CardHeader className="p-3">
                                          <CardTitle className="text-sm font-medium">
                                            Status Information
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-3 pt-0">
                                          <dl className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Status:
                                              </dt>
                                              <dd>
                                                {getStatusBadge(pirep.status)}
                                              </dd>
                                            </div>
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Submitted:
                                              </dt>
                                              <dd>
                                                {new Date(
                                                  pirep.submittedAt
                                                ).toLocaleString()}
                                              </dd>
                                            </div>
                                            {pirep.approvedAt && (
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Processed:
                                                </dt>
                                                <dd>
                                                  {new Date(
                                                    pirep.approvedAt
                                                  ).toLocaleString()}
                                                </dd>
                                              </div>
                                            )}
                                            {pirep.approvedBy && (
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Processed By:
                                                </dt>
                                                <dd>{pirep.approvedBy}</dd>
                                              </div>
                                            )}
                                            <div className="flex justify-between">
                                              <dt className="text-muted-foreground">
                                                Multiplier:
                                              </dt>
                                              <dd>{pirep.multiplier}x</dd>
                                            </div>
                                            {pirep.flightPoints && (
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Points Awarded:
                                                </dt>
                                                <dd>
                                                  {pirep.flightPoints} pts
                                                </dd>
                                              </div>
                                            )}
                                          </dl>
                                        </CardContent>
                                      </Card>

                                      <Accordion
                                        type="single"
                                        collapsible
                                        className="w-full"
                                      >
                                        <AccordionItem value="comments">
                                          <AccordionTrigger>
                                            Pilot Comments
                                          </AccordionTrigger>
                                          <AccordionContent>
                                            <p className="text-sm">
                                              {pirep.comments}
                                            </p>
                                          </AccordionContent>
                                        </AccordionItem>

                                        {pirep.adminRemarks && (
                                          <AccordionItem value="admin-remarks">
                                            <AccordionTrigger>
                                              Admin Remarks
                                            </AccordionTrigger>
                                            <AccordionContent>
                                              <p className="text-sm">
                                                {pirep.adminRemarks}
                                              </p>
                                            </AccordionContent>
                                          </AccordionItem>
                                        )}
                                      </Accordion>

                                      {pirep.status === "Pending" && (
                                        <div className="space-y-2">
                                          <Label htmlFor="admin-remarks">
                                            Admin Remarks
                                          </Label>
                                          <Textarea
                                            id="admin-remarks"
                                            placeholder="Enter remarks for the pilot..."
                                            value={adminRemarks}
                                            onChange={(e) =>
                                              setAdminRemarks(e.target.value)
                                            }
                                          />

                                          <div className="flex justify-end gap-2 mt-4">
                                            <AlertDialog>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="destructive">
                                                  <XCircle className="mr-2 h-4 w-4" />
                                                  Reject PIREP
                                                </Button>
                                              </AlertDialogTrigger>
                                              <AlertDialogContent>
                                                <AlertDialogHeader>
                                                  <AlertDialogTitle>
                                                    Are you sure?
                                                  </AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                    This will reject the PIREP
                                                    and notify the pilot. This
                                                    action cannot be undone.
                                                  </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                  <AlertDialogCancel>
                                                    Cancel
                                                  </AlertDialogCancel>
                                                  <AlertDialogAction
                                                    onClick={() =>
                                                      handleRejectPirep(pirep)
                                                    }
                                                  >
                                                    Reject
                                                  </AlertDialogAction>
                                                </AlertDialogFooter>
                                              </AlertDialogContent>
                                            </AlertDialog>

                                            <Button
                                              onClick={() =>
                                                handleApprovePirep(pirep)
                                              }
                                            >
                                              <CheckCircle className="mr-2 h-4 w-4" />
                                              Approve PIREP
                                            </Button>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedPireps.length} of{" "}
                      {filteredPireps.length} PIREPs
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
                              (page >= currentPage - 1 &&
                                page <= currentPage + 1)
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
              </TabsContent>

              <TabsContent value="pending" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>Pending PIREPs</CardTitle>
                    <CardDescription>
                      Review and process pending pilot reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Same table structure as "all" tab but filtered for pending PIREPs */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>PIREP ID</TableHead>
                          <TableHead>Flight</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Pilot</TableHead>
                          <TableHead className="hidden md:table-cell">
                            Route
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Aircraft
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPireps.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={8}
                              className="text-center py-8 text-muted-foreground"
                            >
                              No pending PIREPs found
                            </TableCell>
                          </TableRow>
                        ) : (
                          paginatedPireps.map((pirep) => (
                            <TableRow key={pirep.id}>
                              <TableCell className="font-medium">
                                {pirep.id}
                              </TableCell>
                              <TableCell>{pirep.flightNumber}</TableCell>
                              <TableCell>{pirep.date}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span>{pirep.pilot.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {pirep.pilot.rank}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-1">
                                  <span>{pirep.departure}</span>
                                  <span>→</span>
                                  <span>{pirep.arrival}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {pirep.aircraft}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(pirep.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setSelectedPirep(pirep)}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      <span className="hidden sm:inline">
                                        View
                                      </span>
                                    </Button>
                                  </DialogTrigger>
                                  {/* Same dialog content as in "all" tab */}
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedPireps.length} of{" "}
                      {filteredPireps.length} PIREPs
                    </div>

                    {/* Same pagination as in "all" tab */}
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="approved" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>Approved PIREPs</CardTitle>
                    <CardDescription>
                      View all approved pilot reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Same table structure as "all" tab but filtered for approved PIREPs */}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedPireps.length} of{" "}
                      {filteredPireps.length} PIREPs
                    </div>

                    {/* Same pagination as in "all" tab */}
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="rejected" className="m-0">
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle>Rejected PIREPs</CardTitle>
                    <CardDescription>
                      View all rejected pilot reports
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {/* Same table structure as "all" tab but filtered for rejected PIREPs */}
                  </CardContent>
                  <CardFooter className="flex items-center justify-between p-4">
                    <div className="text-sm text-muted-foreground">
                      Showing {paginatedPireps.length} of{" "}
                      {filteredPireps.length} PIREPs
                    </div>

                    {/* Same pagination as in "all" tab */}
                  </CardFooter>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>
    </CrewHeader>
  );
}
