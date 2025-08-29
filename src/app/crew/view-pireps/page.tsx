"use client";

import { useState } from "react";
import {
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
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
import { useSession } from "@/hooks/use-session";
import { useEffect } from "react";
import { formatFlightTime } from "@/lib/utils/format-flight-time";

interface Pirep {
  id: number;
  flightnum: string;
  departure: string;
  arrival: string;
  flighttime: number;
  pilotid: number;
  date: string;
  aircraftid: number;
  Aircraft: {
    name: string;
    liveryname: string;
  };
  fuelused: number;
  multi: number;
  status: number;
}

export default function ViewPireps() {
  const { user } = useSession();
  const dateSort = "desc";
  const [_selectedPirep, setSelectedPirep] = useState<Pirep | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [pirepsData, setPirepsData] = useState<Pirep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPireps = async () => {
      try {
        const response = await fetch(`/api/pilots/${user?.id}/pireps`);
        if (!response.ok) {
          throw new Error("Failed to fetch PIREPs");
        }
        const data = await response.json();
        setPirepsData(data.pireps);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchPireps();
    }
  }, [user?.id]);

  // Sort PIREPs by date
  const sortedPireps = [...pirepsData].sort((a, b) => {
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
    <CrewHeader userName={"" + user?.name}>
      <main className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">My PIREPs</h1>
            <Button asChild>
              <a href="/file-pirep">Submit New PIREP</a>
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
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          <span>Loading...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {paginatedPireps.length === 0 && !loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        Click Search
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPireps.map((pirep) => (
                      <TableRow key={pirep.id}>
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
                          {pirep.Aircraft?.name +
                            " (" +
                            pirep.Aircraft.liveryname +
                            ")" || pirep.aircraftid}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatFlightTime(pirep.flighttime)}
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
                                          <dd>
                                            {formatFlightTime(pirep.flighttime)}
                                          </dd>
                                        </div>

                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">
                                            Aircraft Type:
                                          </dt>
                                          <dd>
                                            {pirep.Aircraft.name +
                                              " (" +
                                              pirep.Aircraft.liveryname +
                                              ")"}
                                          </dd>
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
                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">
                                            Multiplier:
                                          </dt>
                                          <dd>{pirep.multi}</dd>
                                        </div>
                                      </dl>
                                    </CardContent>
                                  </Card>
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
                Showing {paginatedPireps.length} of {pirepsData.length} PIREPs
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
