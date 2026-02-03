"use client";

import { useState, useEffect } from "react";
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
  Loader,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// Define types for API responses
interface Pilot {
  id: number;
  callsign: string;
  ifc: string;
  name: string;
}

interface Aircraft {
  id: number;
  name: string;
  liveryname: string;
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
  fuelused: number;
  multi: string;
  status: number;
  Pilot?: Pilot;
  Aircraft?: Aircraft;
  adminRemarks?: string;
}

interface CountsData {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface PirepsResponse {
  success: boolean;
  data: {
    pireps: Pirep[];
    counts: CountsData;
  };
}

export default function AdminPireps() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateSort, setDateSort] = useState("desc");
  const [selectedPirep, setSelectedPirep] = useState<Pirep | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [adminRemarks, setAdminRemarks] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pirepsData, setPirepsData] = useState<Pirep[]>([]);
  const [counts, setCounts] = useState<CountsData>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  // Fetch PIREPs from API - simplified with no filters
  const fetchPireps = async () => {
    try {
      setLoading(true);
      setError(null);

      // Simplified fetch with no parameters
      const response = await fetch(`/api/admin/pireps`);
      const data: PirepsResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch PIREPs");
      }

      // Update state with fetched data
      setPirepsData(data.data.pireps);
      setCounts(data.data.counts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
      console.error("Error fetching PIREPs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch PIREPs when component mounts - simplified with no dependencies on filters
  useEffect(() => {
    fetchPireps();
  }, []);

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
  const handleApprovePirep = async (pirep: Pirep) => {
    try {
      const response = await fetch(`/api/admin/pireps`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pirep.id,
          status: 1, // Approved
          adminRemarks: adminRemarks || "Approved without remarks",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to approve PIREP");
      }

      // Refresh the PIREPs list
      fetchPireps();

      // Reset admin remarks and selected PIREP
      setAdminRemarks("");
      setSelectedPirep(null);
    } catch (error) {
      console.error("Error approving PIREP:", error);
      // Show error message to user
      setError(
        error instanceof Error ? error.message : "Failed to approve PIREP"
      );
    }
  };

  // Handle PIREP rejection
  const handleRejectPirep = async (pirep: Pirep) => {
    try {
      const response = await fetch(`/api/admin/pireps`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pirep.id,
          status: 2, // Rejected
          adminRemarks: adminRemarks || "Rejected without remarks",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to reject PIREP");
      }

      // Refresh the PIREPs list
      fetchPireps();

      // Reset admin remarks and selected PIREP
      setAdminRemarks("");
      setSelectedPirep(null);
    } catch (error) {
      console.error("Error rejecting PIREP:", error);
      // Show error message to user
      setError(
        error instanceof Error ? error.message : "Failed to reject PIREP"
      );
    }
  };

  // Use counts from API response
  const pendingCount = counts.pending;
  const approvedCount = counts.approved;
  const rejectedCount = counts.rejected;
  const totalCount = counts.total;

  // Filtered PIREPs based on search query and active tab
  const filteredPireps = pirepsData.filter((pirep) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      pirep.flightnum.toLowerCase().includes(query) ||
      pirep.departure.toLowerCase().includes(query) ||
      pirep.arrival.toLowerCase().includes(query) ||
      (pirep.Pilot?.name.toLowerCase().includes(query) ?? false) ||
      (pirep.Pilot?.callsign.toLowerCase().includes(query) ?? false);

    // Filter by tab (status)
    const matchesTab =
      activeTab === "all" ? true : pirep.status.toString() === activeTab;

    return matchesSearch && matchesTab;
  });

  return (
    <CrewHeader>
      <main className="flex-1">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">PIREP Management</h1>
          </div>

          <Tabs
            defaultValue="all"
            className="space-y-4"
            onValueChange={(val) => setActiveTab(val)}
          >
            <div className="flex justify-between">
              <TabsList>
                <TabsTrigger value="all">
                  All
                  <Badge className="ml-2 bg-primary/10 text-primary">
                    {totalCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="0">
                  Pending
                  <Badge className="ml-2 bg-amber-100 text-amber-700">
                    {pendingCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="1">
                  Approved
                  <Badge className="ml-2 bg-green-100 text-green-700">
                    {approvedCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="2">
                  Rejected
                  <Badge className="ml-2 bg-red-100 text-red-700">
                    {rejectedCount}
                  </Badge>
                </TabsTrigger>
              </TabsList>
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
              </div>
              <Card>
                <CardHeader className="p-4">
                  <CardTitle>All PIREPs</CardTitle>
                  <CardDescription>
                    View and manage pilot reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Flight</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Pilot</TableHead>
                        <TableHead className="hidden md:table-cell">
                          Check Flight Log
                        </TableHead>
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
                      {loading ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-muted-foreground"
                          >
                            Loading PIREPs...
                          </TableCell>
                        </TableRow>
                      ) : error ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-red-500"
                          >
                            Error: {error}
                          </TableCell>
                        </TableRow>
                      ) : filteredPireps.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No PIREPs found matching your criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPireps.map((pirep) => (
                          <TableRow key={pirep.id}>
                            <TableCell>{pirep.flightnum}</TableCell>
                            <TableCell>{pirep.date}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span>
                                  {pirep.Pilot
                                    ? `${pirep.Pilot.callsign} (${pirep.Pilot.name})`
                                    : pirep.pilotid}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <a
                                href={`https://www.iflytics.app/user/${pirep.Pilot?.ifc}/flights`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {pirep.Pilot?.ifc}
                              </a>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <div className="flex items-center gap-1">
                                <span>{pirep.departure}</span>
                                <span>→</span>
                                <span>{pirep.arrival}</span>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              {pirep.Aircraft
                                ? `${pirep.Aircraft.name} - ${pirep.Aircraft?.liveryname}`
                                : pirep.aircraftid}
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
                                      onClick={() => handleApprovePirep(pirep)}
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
                                            </dl>
                                          </CardContent>
                                          <CardContent className=" pt-0">
                                            <dl className="space-y-2 text-sm">
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Aircraft Type:
                                                </dt>
                                                <dd>
                                                  {" "}
                                                  {pirep.Aircraft
                                                    ? `${pirep.Aircraft.name} - ${pirep.Aircraft?.liveryname}`
                                                    : pirep.aircraftid}
                                                </dd>
                                              </div>
                                              <div className="flex justify-between">
                                                <dt className="text-muted-foreground">
                                                  Fuel Used:
                                                </dt>
                                                <dd>{pirep.fuelused} kg</dd>
                                              </div>
                                            </dl>
                                          </CardContent>
                                        </Card>

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
                    Showing {filteredPireps.length} of {totalCount} PIREPs
                  </div>
                </CardFooter>
              </Card>
            </div>
          </Tabs>
        </div>
      </main>
    </CrewHeader>
  );
}
