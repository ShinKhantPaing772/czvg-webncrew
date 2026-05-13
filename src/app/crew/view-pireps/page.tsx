"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  Loader2,
  Search,
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
import { formatFlightTimeHM } from "@/lib/utils/format-flight-time";
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
import { Input } from "@/components/ui/input"; // 🔍 new import
import { useSession } from "@/hooks/use-session";

interface PirepComment {
  id: number;
  userid: number;
  content: string;
  dateposted: string;
  User?: {
    id: number;
    callsign: string;
    name: string;
  };
}

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
  Comments?: PirepComment[];
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

  // 🔍 Search Feature
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchPireps = async () => {
      try {
        const response = await fetch(`/api/pilots/${user?.id}/pireps`);
        if (!response.ok) throw new Error("Failed to fetch PIREPs");
        const data = await response.json();
        setPirepsData(data.pireps);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) fetchPireps();
  }, [user?.id]);

  // Sort by date
  const sortedPireps = [...pirepsData].sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateSort === "desc" ? dateB - dateA : dateA - dateB;
  });

  // 🔍 Filter PIREPs by search term
  const filteredPireps = sortedPireps.filter((p) => {
    const search = searchTerm.toLowerCase();
    return (
      p.flightnum.toLowerCase().includes(search) ||
      p.departure.toLowerCase().includes(search) ||
      p.arrival.toLowerCase().includes(search) ||
      p.date.toLowerCase().includes(search) ||
      p.fuelused.toString().includes(search) ||
      p.multi.toString().includes(search) ||
      p.Aircraft?.name.toLowerCase().includes(search) ||
      p.Aircraft?.liveryname.toLowerCase().includes(search) ||
      (p.status === 1 && "approved".includes(search)) ||
      (p.status === 0 && "pending".includes(search)) ||
      (p.status === 2 && "rejected".includes(search))
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredPireps.length / itemsPerPage);
  const paginatedPireps = filteredPireps.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

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
    <CrewHeader>
      <main className="flex flex-1 flex-col gap-4 md:gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl font-bold">My PIREPs</h1>

            <div className="flex gap-2 items-center w-full sm:w-auto">
              {/* 🔍 Search bar */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search PIREPs..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-8"
                />
              </div>

              <Button asChild>
                <a href="/crew/file-pirep">Submit New PIREP</a>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader className="p-4">
              <CardTitle>Flight Reports</CardTitle>
              <CardDescription>
                View and search your submitted pilot reports
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
                  {!loading && paginatedPireps.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-8 text-muted-foreground"
                      >
                        No PIREPs found for your search.
                      </TableCell>
                    </TableRow>
                  )}
                  {paginatedPireps.map((pirep) => (
                    <TableRow key={pirep.id}>
                      <TableCell>{pirep.flightnum}</TableCell>
                      <TableCell>{pirep.date}</TableCell>
                      <TableCell>
                        {pirep.departure} → {pirep.arrival}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {pirep.Aircraft?.name +
                          " (" +
                          pirep.Aircraft?.liveryname +
                          ")"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {formatFlightTimeHM(pirep.flighttime)}
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
                                      : "rejected",
                                )}
                                <span>PIREP Details: {pirep.id}</span>
                              </DialogTitle>
                              <DialogDescription>
                                Flight {pirep.flightnum} from {pirep.departure}{" "}
                                to {pirep.arrival}
                              </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4">
                              <Card>
                                <CardHeader>
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
                                        {formatFlightTimeHM(pirep.flighttime)}
                                      </dd>
                                    </div>
                                    <div className="flex justify-between">
                                      <dt className="text-muted-foreground">
                                        Aircraft Type:
                                      </dt>
                                      <dd>
                                        {pirep.Aircraft.name} (
                                        {pirep.Aircraft.liveryname})
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
                                      <dd>{getStatusBadge(pirep.status)}</dd>
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

                              {pirep.Comments && pirep.Comments.length > 0 && (
                                <Card>
                                  <CardHeader>
                                    <CardTitle className="text-sm font-medium">
                                      Admin Comments
                                    </CardTitle>
                                  </CardHeader>
                                  <CardContent className="pt-0">
                                    <div className="space-y-3 text-sm">
                                      {pirep.Comments.map((comment) => (
                                        <div
                                          key={comment.id}
                                          className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                                        >
                                          <div className="flex items-center justify-between gap-4 text-xs text-slate-500">
                                            <span>
                                              {comment.User
                                                ? `${comment.User.name}`
                                                : `User #${comment.userid}`}
                                            </span>
                                            <span>
                                              {new Date(
                                                comment.dateposted,
                                              ).toLocaleString()}
                                            </span>
                                          </div>
                                          <p className="mt-2 text-sm text-slate-700">
                                            {comment.content}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>

            <CardFooter className="flex items-center justify-between p-4">
              <div className="text-sm text-muted-foreground">
                Showing {paginatedPireps.length} of {filteredPireps.length}{" "}
                filtered PIREPs
              </div>

              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage((p) => Math.max(p - 1, 1));
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
                          setCurrentPage((p) => Math.min(p + 1, totalPages));
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
