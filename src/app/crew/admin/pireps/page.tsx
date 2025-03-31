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
    id: 1001,
    flightnum: "VA101",
    departure: "KLAX",
    arrival: "KSFO",
    flighttime: 75,
    pilotid: 1,
    date: "2023-03-15",
    aircraftid: 1,
    fuelused: 2450,
    multi: 1,
    status: 1,
  },
  {
    id: 1002,
    flightnum: "VA202",
    departure: "KSFO",
    arrival: "KDEN",
    flighttime: 150,
    pilotid: 1,
    date: "2023-03-10",
    aircraftid: 2,
    fuelused: 3850,
    multi: 1,
    status: 1,
  },
  {
    id: 1003,
    flightnum: "VA303",
    departure: "KDEN",
    arrival: "KATL",
    flighttime: 165,
    pilotid: 1,
    date: "2023-03-05",
    aircraftid: 1,
    fuelused: 4120,
    multi: 1,
    status: 0,
  },
  {
    id: 1004,
    flightnum: "VA404",
    departure: "KATL",
    arrival: "KJFK",
    flighttime: 130,
    pilotid: 1,
    date: "2023-03-01",
    aircraftid: 1,
    fuelused: 3750,
    multi: 1,
    status: 2,
  },
  {
    id: 1005,
    flightnum: "VA505",
    departure: "KJFK",
    arrival: "KBOS",
    flighttime: 65,
    pilotid: 1,
    date: "2023-02-25",
    aircraftid: 4,
    fuelused: 1850,
    multi: 1,
    status: 1,
  },
  {
    id: 1006,
    flightnum: "VA606",
    departure: "KBOS",
    arrival: "KLAX",
    flighttime: 375,
    pilotid: 1,
    date: "2023-02-20",
    aircraftid: 3,
    fuelused: 12500,
    multi: 2,
    status: 0,
  },
];

export default function AdminPireps() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(0);
  const [pilotFilter, setPilotFilter] = useState("all");
  const [dateSort, setDateSort] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPirep, setSelectedPirep] = useState<
    (typeof pirepsData)[0] | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [activeTab, setActiveTab] = useState("0");
  const itemsPerPage = 5;

  // Filter PIREPs based on search, filters, and active tab
  const filteredPireps = pirepsData.filter((pirep) => {
    const matchesSearch =
      pirep.flightnum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.departure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.arrival.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(pirep.id).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 0 ? true : pirep.status === statusFilter;
    const matchesPilot =
      pilotFilter === "all" ? true : pirep.pilotid === parseInt(pilotFilter);
    const matchesTab =
      activeTab === "0" ? true : pirep.status === parseInt(activeTab);

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
    new Set(pirepsData.map((pirep) => pirep.pilotid))
  );

  // Get status badge variant
  const getStatusBadge = (status: number) => {
    switch (status) {
      case 1:
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Approved
          </Badge>
        );
      case 0:
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            Pending
          </Badge>
        );
      case 2:
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: number) => {
    switch (status) {
      case 1:
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 0:
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 2:
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  // Handle PIREP approval
  const handleApprovePirep = (pirep: (typeof pirepsData)[0]) => {
    // In a real app, you would call an API to update the PIREP status
    console.log(`Approving PIREP ${pirep.id} with remarks: ${adminRemarks}`);
    // Update PIREP status and add admin remarks
    const updatedPirep = {
      ...pirep,
      status: 1,
      approvedAt: new Date().toISOString(),
      approvedBy: "Admin User",
      adminRemarks: adminRemarks || "Approved without remarks",
    };
    // Here you would update the PIREP in your database
    console.log("Updated PIREP:", updatedPirep);
    // Reset admin remarks
    setAdminRemarks("");
    setSelectedPirep(null);
  };

  // Handle PIREP rejection
  const handleRejectPirep = (pirep: (typeof pirepsData)[0]) => {
    // In a real app, you would call an API to update the PIREP status
    console.log(`Rejecting PIREP ${pirep.id} with remarks: ${adminRemarks}`);
    // Update PIREP status and add admin remarks
    const updatedPirep = {
      ...pirep,
      status: 2,
      approvedAt: new Date().toISOString(),
      approvedBy: "Admin User",
      adminRemarks: adminRemarks || "Rejected without remarks",
      flightPoints: null,
    };
    // Here you would update the PIREP in your database
    console.log("Updated PIREP:", updatedPirep);
    // Reset admin remarks
    setAdminRemarks("");
    setSelectedPirep(null);
  };

  // Count PIREPs by status
  const pendingCount = pirepsData.filter((pirep) => pirep.status === 0).length;
  const approvedCount = pirepsData.filter((pirep) => pirep.status === 1).length;
  const rejectedCount = pirepsData.filter((pirep) => pirep.status === 2).length;

  return (
    <CrewHeader userName="Admin User" isAdmin={true}>
      <main className="flex-1">
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
                <TabsTrigger value="0" className="relative">
                  All
                  <Badge className="ml-2 bg-primary/10 text-primary">
                    {pirepsData.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="1" className="relative">
                  Pending
                  <Badge className="ml-2 bg-amber-100 text-amber-700">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="2" className="relative">
                  Approved
                  <Badge className="ml-2 bg-green-100 text-green-700">
                    {approvedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="3" className="relative">
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
                        value={String(statusFilter)}
                        onValueChange={(value) =>
                          setStatusFilter(Number(value))
                        }
                      >
                        <SelectTrigger id="status">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">All Statuses</SelectItem>
                          <SelectItem value="1">Approved</SelectItem>
                          <SelectItem value="0">Pending</SelectItem>
                          <SelectItem value="2">Rejected</SelectItem>
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
                          {/* {uniquePilots.map((pilot) => (
                            <SelectItem key={pilot?.id} value={pilot?.id || ""}>
                              {pilot?.name} ({pilot?.rank})
                            </SelectItem>
                          ))} */}
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
                              <TableCell>{pirep.flightnum}</TableCell>
                              <TableCell>{pirep.date}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  {/* <span>{pirep.pilot.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {pirep.pilot.rank}
                                  </span> */}
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
                                {pirep.aircraftid}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(pirep.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {pirep.status === 0 && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-green-600 hover:text-green-700"
                                        onClick={() =>
                                          handleApprovePirep(pirep)
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleRejectPirep(pirep)}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
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
                                    <DialogContent className="max-w-4xl bg-white">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                          {getStatusIcon(pirep.status)}
                                          <span>PIREP Details: {pirep.id}</span>
                                        </DialogTitle>
                                        <DialogDescription>
                                          Flight {pirep.flightnum} from{" "}
                                          {pirep.departure} to {pirep.arrival}
                                        </DialogDescription>
                                      </DialogHeader>

                                      <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-1 gap-4">
                                          <Card>
                                            <CardHeader className="">
                                              <CardTitle className="text-sm font-medium">
                                                Flight Information
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                              <dl className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                  <dt className="text-muted-foreground">
                                                    Flight Number:
                                                  </dt>
                                                  <dd>{pirep.flightnum}</dd>
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
                                                  <dd>{pirep.flighttime}</dd>
                                                </div>
                                                {/* <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Detailed Route:
                                                </dt>
                                                <dd
                                                  className="truncate max-w-[150px]"
                                                  title={pirep.route}
                                                >
                                                  {pirep.route}
                                                </dd>
                                              </div> */}
                                              </dl>
                                            </CardContent>
                                            <CardContent className=" pt-0">
                                              <dl className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                  <dt className="text-muted-foreground">
                                                    Aircraft Type:
                                                  </dt>
                                                  <dd>{pirep.aircraftid}</dd>
                                                </div>
                                                {/* <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Registration:
                                                </dt>
                                                <dd>{pirep.registration}</dd>
                                              </div> */}
                                                <div className="flex justify-between">
                                                  <dt className="text-muted-foreground">
                                                    Fuel Used:
                                                  </dt>
                                                  <dd>{pirep.fuelused} kg</dd>
                                                </div>
                                              </dl>
                                            </CardContent>
                                          </Card>

                                          {/* <Card>
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
                                        </Card> */}

                                          <Card>
                                            <CardHeader className="">
                                              <CardTitle className="text-sm font-medium">
                                                Status Information
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent className="pt-0">
                                              <dl className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                  <dt className="text-muted-foreground">
                                                    Status:
                                                  </dt>
                                                  <dd>
                                                    {getStatusBadge(
                                                      pirep.status
                                                    )}
                                                  </dd>
                                                </div>
                                                {/* <div className="flex justify-between">
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
                                            )} */}
                                                <div className="flex justify-between">
                                                  <dt className="text-muted-foreground">
                                                    Multiplier:
                                                  </dt>
                                                  <dd>{pirep.multi}x</dd>
                                                </div>
                                              </dl>
                                            </CardContent>
                                          </Card>
                                        </div>
                                        {/* <Accordion
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
                                      </Accordion> */}

                                        {pirep.status === 0 && (
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
                              <TableCell>{pirep.flightnum}</TableCell>
                              <TableCell>{pirep.date}</TableCell>
                              {/* <TableCell>
                                <div className="flex flex-col">
                                  <span>{pirep.pilot.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {pirep.pilot.rank}
                                  </span>
                                </div>
                              </TableCell> */}
                              <TableCell className="hidden md:table-cell">
                                <div className="flex items-center gap-1">
                                  <span>{pirep.departure}</span>
                                  <span>→</span>
                                  <span>{pirep.arrival}</span>
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {pirep.aircraftid}
                              </TableCell>
                              <TableCell>
                                {getStatusBadge(pirep.status)}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {pirep.status === 0 && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-green-600 hover:text-green-700"
                                        onClick={() =>
                                          handleApprovePirep(pirep)
                                        }
                                      >
                                        <CheckCircle className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700"
                                        onClick={() => handleRejectPirep(pirep)}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  )}
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
