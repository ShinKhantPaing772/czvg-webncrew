"use client";

import { useState } from "react";
import {
  Search,
  Filter,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
    status: 1,
  },
];

export default function ViewPireps() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(0);
  const [aircraftFilter, setAircraftFilter] = useState(0);
  const [dateSort, setDateSort] = useState("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPirep, setSelectedPirep] = useState<
    (typeof pirepsData)[0] | null
  >(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Filter PIREPs based on search and filters
  const filteredPireps = pirepsData.filter((pirep) => {
    const matchesSearch =
      pirep.flightnum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.departure.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pirep.arrival.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter == 0 ? true : pirep.status == statusFilter;
    const matchesAircraft =
      aircraftFilter === 0 ? true : pirep.aircraftid === aircraftFilter;

    return matchesSearch && matchesStatus && matchesAircraft;
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
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "pending":
        return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <CrewHeader
      userName="John Doe"
      userAvatar="/placeholder.svg?height=80&width=80"
    >
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My PIREPs</h1>
            <Button asChild>
              <a href="/pirep-form">Submit New PIREP</a>
            </Button>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="search">Search PIREPs</Label>
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

            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateSort(dateSort === "desc" ? "asc" : "desc")}
              className="hidden md:flex items-center gap-1"
            >
              <Calendar className="h-4 w-4" />
              <span>Date</span>
              {dateSort === "desc" ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>

          {showFilters && (
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={"" + statusFilter}
                    onValueChange={(value) => setStatusFilter(Number(value))}
                  >
                    <SelectTrigger id="status">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={"" + 0}>All Statuses</SelectItem>
                      <SelectItem value={"" + 1}>Approved</SelectItem>
                      <SelectItem value={"" + 2}>Pending</SelectItem>
                      <SelectItem value={"" + 3}>Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="aircraft">Aircraft</Label>
                  <Select
                    value={"" + aircraftFilter}
                    onValueChange={(value) => setAircraftFilter(Number(value))}
                  >
                    <SelectTrigger id="aircraft">
                      <SelectValue placeholder="Filter by aircraft" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Aircraft</SelectItem>
                      <SelectItem value="B738">
                        B738 - Boeing 737-800
                      </SelectItem>
                      <SelectItem value="A320">A320 - Airbus A320</SelectItem>
                      <SelectItem value="B77W">
                        B77W - Boeing 777-300ER
                      </SelectItem>
                      <SelectItem value="CRJ7">
                        CRJ7 - Bombardier CRJ-700
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

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
                    <TableHead>PIREP ID</TableHead>
                    <TableHead>Flight</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>Date</span>
                      </div>
                    </TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Aircraft
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Duration
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
                          <div className="flex items-center gap-1">
                            <span>{pirep.departure}</span>
                            <span>→</span>
                            <span>{pirep.arrival}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {pirep.aircraftid}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {pirep.flighttime}
                        </TableCell>
                        <TableCell>{getStatusBadge(pirep.status)}</TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedPirep(pirep)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                <span className="hidden sm:inline">View</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-5xl w-full bg-white">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  {getStatusIcon(
                                    pirep.status === 1
                                      ? "approved"
                                      : pirep.status === 0
                                      ? "pending"
                                      : "rejected"
                                  )}
                                  <span>PIREP Details: {pirep.id}</span>
                                </DialogTitle>
                                <DialogDescription>
                                  Flight {pirep.flightnum} from{" "}
                                  {pirep.departure} to {pirep.arrival}
                                </DialogDescription>
                              </DialogHeader>

                              <div className="grid gap-4">
                                <div className="flex flex-col gap-3">
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
                                            {pirep.departure} → {pirep.arrival}
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

                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">
                                            Aircraft Type:
                                          </dt>
                                          <dd>{pirep.aircraftid}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">
                                            Fuel Used:
                                          </dt>
                                          <dd>{pirep.fuelused} kg</dd>
                                        </div>

                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">
                                            Status:
                                          </dt>
                                          <dd>
                                            {getStatusBadge(pirep.status)}
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
                                              Approved:
                                            </dt>
                                            <dd>
                                              {new Date(
                                                pirep.approvedAt
                                              ).toLocaleString()}
                                            </dd>
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
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Log
                                  </Button>
                                </div>
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
                Showing {paginatedPireps.length} of {filteredPireps.length}{" "}
                PIREPs
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
      </main>
    </CrewHeader>
  );
}
