"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/utils/api";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

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
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

interface AircraftOption extends Aircraft {
  notes?: string | null;
}

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
  flighttime: number | string;
  flighttimeSeconds?: number;
  pilotid: number;
  date: string;
  aircraftid: number;
  fuelused: number;
  multi: string;
  status: number;
  Pilot?: Pilot;
  Aircraft?: Aircraft;
  Comments?: PirepComment[];
}

interface PirepEditForm {
  flightnum: string;
  departure: string;
  arrival: string;
  flighttime: string;
  aircraftid: string;
  fuelused: string;
  status: string;
  multi: string;
  newComment: string;
}

const secondsToDurationInput = (
  seconds?: number,
  formattedFlighttime?: number | string,
) => {
  if (!Number.isFinite(seconds)) {
    const numericFlighttime = Number(formattedFlighttime);
    if (Number.isFinite(numericFlighttime)) {
      const totalMinutes = Math.round(numericFlighttime * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${hours}:${minutes.toString().padStart(2, "0")}`;
    }

    return "";
  }

  const totalMinutes = Math.round((seconds ?? 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
};

const pirepToEditForm = (pirep: Pirep): PirepEditForm => ({
  flightnum: pirep.flightnum ?? "",
  departure: pirep.departure ?? "",
  arrival: pirep.arrival ?? "",
  flighttime: secondsToDurationInput(
    pirep.flighttimeSeconds,
    pirep.flighttime,
  ),
  aircraftid: String(pirep.aircraftid ?? ""),
  fuelused: String(pirep.fuelused ?? ""),
  status: String(pirep.status),
  multi: String(pirep.multi ?? ""),
  newComment: "",
});

interface CountsData {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

interface PaginationData {
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

interface PirepsResponse {
  success: boolean;
  data: {
    pireps: Pirep[];
    counts: CountsData;
    pagination: PaginationData;
  };
}

export default function AdminPireps() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPirep, setSelectedPirep] = useState<Pirep | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const remarkRef = useRef<HTMLTextAreaElement | null>(null);
  const [hasRemark, setHasRemark] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isEditingPirep, setIsEditingPirep] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editForm, setEditForm] = useState<PirepEditForm>({
    flightnum: "",
    departure: "",
    arrival: "",
    flighttime: "",
    aircraftid: "",
    fuelused: "",
    status: "0",
    multi: "",
    newComment: "",
  });
  const [deletedCommentIds, setDeletedCommentIds] = useState<number[]>([]);
  const [aircraftOptions, setAircraftOptions] = useState<AircraftOption[]>([]);
  const [pirepsData, setPirepsData] = useState<Pirep[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
  });
  const [counts, setCounts] = useState<CountsData>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });

  const fetchPireps = async (page = currentPage) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: String(page),
        limit: String(itemsPerPage),
      });

      if (activeTab !== "all") {
        params.set("status", activeTab);
      }

      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const response = await authFetch(`/api/admin/pireps?${params}`);
      const data: PirepsResponse = await response.json();

      if (!data.success) {
        throw new Error("Failed to fetch PIREPs");
      }

      setPirepsData(data.data.pireps);
      setCounts(data.data.counts);
      setPagination(data.data.pagination);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred",
      );
      console.error("Error fetching PIREPs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPireps();
  }, [currentPage, activeTab, searchQuery, itemsPerPage]);

  useEffect(() => {
    if (pagination.totalPages > 0 && currentPage > pagination.totalPages) {
      setCurrentPage(pagination.totalPages);
    }
  }, [currentPage, pagination.totalPages]);

  useEffect(() => {
    const fetchAircraft = async () => {
      try {
        const response = await authFetch("/api/aircraft");
        const data = await response.json();
        setAircraftOptions(Array.isArray(data.aircrafts) ? data.aircrafts : []);
      } catch (error) {
        console.error("Error fetching aircraft:", error);
      }
    };

    fetchAircraft();
  }, []);

  useEffect(() => {
    if (isDialogOpen && remarkRef.current) {
      remarkRef.current.value = "";
      setHasRemark(false);
    }
  }, [isDialogOpen, selectedPirep]);

  useEffect(() => {
    if (selectedPirep) {
      setEditForm(pirepToEditForm(selectedPirep));
      setDeletedCommentIds([]);
      setUpdateError(null);
      setIsEditingPirep(false);
    }
  }, [selectedPirep]);

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
    const remark = remarkRef.current?.value.trim() ?? "";

    try {
      const response = await authFetch(`/api/admin/pireps`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pirep.id,
          status: 1, // Approved
          comment: remark,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to approve PIREP");
      }

      // Refresh the PIREPs list
      fetchPireps();

      // Reset selected PIREP and close the dialog
      setSelectedPirep(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error approving PIREP:", error);
      // Show error message to user
      setError(
        error instanceof Error ? error.message : "Failed to approve PIREP",
      );
    }
  };

  // Handle PIREP rejection
  const handleRejectPirep = async (pirep: Pirep) => {
    const remark = remarkRef.current?.value.trim() ?? "";
    if (!remark) {
      setError("A remark is required to reject this PIREP.");
      return;
    }

    try {
      const response = await authFetch(`/api/admin/pireps`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pirep.id,
          status: 2, // Rejected
          comment: remark,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to reject PIREP");
      }

      // Refresh the PIREPs list
      fetchPireps();

      // Reset selected PIREP and close the dialog
      setSelectedPirep(null);
      setIsDialogOpen(false);
    } catch (error) {
      console.error("Error rejecting PIREP:", error);
      // Show error message to user
      setError(
        error instanceof Error ? error.message : "Failed to reject PIREP",
      );
    }
  };

  const handleEditFormChange = (field: keyof PirepEditForm, value: string) => {
    setEditForm((current) => ({
      ...current,
      [field]: field === "departure" || field === "arrival"
        ? value.toUpperCase()
        : value,
    }));
    setUpdateError(null);
  };

  const handleDeleteComment = (commentId: number) => {
    setDeletedCommentIds((current) =>
      current.includes(commentId) ? current : [...current, commentId],
    );
    setUpdateError(null);
  };

  const handleCancelEdit = () => {
    if (selectedPirep) {
      setEditForm(pirepToEditForm(selectedPirep));
    }
    setDeletedCommentIds([]);
    setUpdateError(null);
    setIsEditingPirep(false);
  };

  const handleUpdatePirep = async (pirep: Pirep) => {
    const flightnum = editForm.flightnum.trim();
    const departure = editForm.departure.trim().toUpperCase();
    const arrival = editForm.arrival.trim().toUpperCase();
    const flighttime = editForm.flighttime.trim();
    const fuelused = editForm.fuelused.trim();
    const multi = editForm.multi.trim();
    const newComment = editForm.newComment.trim();
    const parsedAircraftId = Number(editForm.aircraftid);
    const parsedStatus = Number(editForm.status);

    if (
      !flightnum ||
      !departure ||
      !arrival ||
      !flighttime ||
      !editForm.aircraftid ||
      !fuelused ||
      !multi
    ) {
      setUpdateError(
        "Flight number, route, duration, aircraft type, fuel used, and multiplier are required.",
      );
      return;
    }

    if (!/^[A-Z0-9]{4}$/.test(departure) || !/^[A-Z0-9]{4}$/.test(arrival)) {
      setUpdateError("Departure and arrival ICAO codes must be 4 characters.");
      return;
    }

    if (!/^\d+:[0-5]\d$/.test(flighttime) && !/^\d+(\.\d+)?$/.test(flighttime)) {
      setUpdateError("Duration must be HH:MM or decimal hours.");
      return;
    }

    if (!Number.isFinite(Number(fuelused)) || Number(fuelused) < 0) {
      setUpdateError("Fuel used must be a valid number.");
      return;
    }

    if (!Number.isInteger(parsedAircraftId) || parsedAircraftId <= 0) {
      setUpdateError("Select a valid aircraft type.");
      return;
    }

    if (![0, 1, 2].includes(parsedStatus)) {
      setUpdateError("Select a valid PIREP status.");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await authFetch("/api/admin/pireps", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: pirep.id,
          flightnum,
          departure,
          arrival,
          flighttime,
          aircraftid: parsedAircraftId,
          fuelused,
          status: parsedStatus,
          multi,
          comment: newComment,
          deleteCommentIds: deletedCommentIds,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to update PIREP");
      }

      const updatedPirep = data.data as Pirep;
      setPirepsData((currentPireps) =>
        currentPireps.map((currentPirep) =>
          currentPirep.id === pirep.id ? updatedPirep : currentPirep,
        ),
      );
      setSelectedPirep(updatedPirep);
      setEditForm(pirepToEditForm(updatedPirep));
      setDeletedCommentIds([]);
      setUpdateError(null);
      setIsEditingPirep(false);
      await fetchPireps();
    } catch (error) {
      console.error("Error updating PIREP:", error);
      setUpdateError(
        error instanceof Error ? error.message : "Failed to update PIREP",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Use counts from API response
  const pendingCount = counts.pending;
  const approvedCount = counts.approved;
  const rejectedCount = counts.rejected;
  const totalCount = counts.total;
  const totalPages = Math.max(pagination.totalPages, 1);
  const currentPageStart =
    pagination.total === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.limit + 1;
  const currentPageEnd = Math.min(
    pagination.currentPage * pagination.limit,
    pagination.total,
  );

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
            onValueChange={(val) => {
              setActiveTab(val);
              setCurrentPage(1);
            }}
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
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2 md:w-40">
                  <Label htmlFor="pireps-per-page">Per Page</Label>
                  <Select
                    value={String(itemsPerPage)}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger id="pireps-per-page" className="w-full">
                      <SelectValue placeholder="Per page" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
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
                      ) : pirepsData.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={8}
                            className="text-center py-8 text-muted-foreground"
                          >
                            No PIREPs found matching your criteria
                          </TableCell>
                        </TableRow>
                      ) : (
                        pirepsData.map((pirep) => (
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
                              <span className="block max-w-[240px] truncate">
                                {pirep.Aircraft
                                  ? `${pirep.Aircraft.name} - ${pirep.Aircraft?.liveryname}`
                                  : pirep.aircraftid}
                              </span>
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
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPirep(pirep);
                                    setIsDialogOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                  <Dialog
                    open={isDialogOpen}
                    onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) {
                        setHasRemark(false);
                        setIsEditingPirep(false);
                        setDeletedCommentIds([]);
                        setUpdateError(null);
                        if (remarkRef.current) remarkRef.current.value = "";
                      }
                    }}
                  >
                    <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto bg-white">
                      {selectedPirep ? (
                        <>
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              {getStatusIcon(selectedPirep.status)}
                              <span>PIREP Details: {selectedPirep.id}</span>
                            </DialogTitle>
                            <DialogDescription>
                              Flight {selectedPirep.flightnum} from{" "}
                              {selectedPirep.departure} to{" "}
                              {selectedPirep.arrival}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-1 gap-4">
                              <Card>
                                <CardHeader className="flex flex-row items-center justify-between gap-4">
                                  <CardTitle className="text-sm font-medium">
                                    Flight Information
                                  </CardTitle>
                                  <div className="flex gap-2">
                                    {isEditingPirep ? (
                                      <>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={handleCancelEdit}
                                          disabled={isUpdating}
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            handleUpdatePirep(selectedPirep)
                                          }
                                          disabled={isUpdating}
                                        >
                                          <Save className="mr-2 h-4 w-4" />
                                          Save Changes
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                          setIsEditingPirep(true)
                                        }
                                      >
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit
                                      </Button>
                                    )}
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-0">
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`flightnum-${selectedPirep.id}`}
                                      >
                                        Flight Number
                                      </Label>
                                      <Input
                                        id={`flightnum-${selectedPirep.id}`}
                                        value={editForm.flightnum}
                                        disabled={!isEditingPirep}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "flightnum",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Date</Label>
                                      <Input
                                        value={selectedPirep.date}
                                        disabled
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`departure-${selectedPirep.id}`}
                                      >
                                        Departure ICAO
                                      </Label>
                                      <Input
                                        id={`departure-${selectedPirep.id}`}
                                        maxLength={4}
                                        value={editForm.departure}
                                        disabled={!isEditingPirep}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "departure",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`arrival-${selectedPirep.id}`}
                                      >
                                        Arrival ICAO
                                      </Label>
                                      <Input
                                        id={`arrival-${selectedPirep.id}`}
                                        maxLength={4}
                                        value={editForm.arrival}
                                        disabled={!isEditingPirep}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "arrival",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`duration-${selectedPirep.id}`}
                                      >
                                        Duration
                                      </Label>
                                      <Input
                                        id={`duration-${selectedPirep.id}`}
                                        placeholder="1:30"
                                        value={editForm.flighttime}
                                        disabled={!isEditingPirep}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "flighttime",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`fuel-${selectedPirep.id}`}
                                      >
                                        Fuel Used (KG)
                                      </Label>
                                      <Input
                                        id={`fuel-${selectedPirep.id}`}
                                        type="number"
                                        min="0"
                                        value={editForm.fuelused}
                                        disabled={!isEditingPirep}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "fuelused",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="min-w-0 space-y-2 md:col-span-2">
                                      <Label
                                        htmlFor={`aircraft-${selectedPirep.id}`}
                                      >
                                        Aircraft Type
                                      </Label>
                                      <Select
                                        value={editForm.aircraftid}
                                        disabled={!isEditingPirep}
                                        onValueChange={(value) =>
                                          handleEditFormChange(
                                            "aircraftid",
                                            value,
                                          )
                                        }
                                      >
                                        <SelectTrigger
                                          id={`aircraft-${selectedPirep.id}`}
                                          className="w-full min-w-0 max-w-full [&_[data-slot=select-value]]:block [&_[data-slot=select-value]]:truncate"
                                        >
                                          <SelectValue placeholder="Select aircraft" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[240px] max-w-[min(760px,calc(100vw-3rem))] bg-white">
                                          {selectedPirep.Aircraft &&
                                            !aircraftOptions.some(
                                              (aircraft) =>
                                                aircraft.id ===
                                                selectedPirep.aircraftid,
                                            ) && (
                                              <SelectItem
                                                value={String(
                                                  selectedPirep.aircraftid,
                                                )}
                                                className="max-w-full"
                                              >
                                                <span className="block max-w-full truncate">
                                                  {selectedPirep.Aircraft.name}{" "}
                                                  -{" "}
                                                  {
                                                    selectedPirep.Aircraft
                                                      .liveryname
                                                  }
                                                </span>
                                              </SelectItem>
                                            )}
                                          {aircraftOptions.map((aircraft) => (
                                            <SelectItem
                                              key={aircraft.id}
                                              value={String(aircraft.id)}
                                              className="max-w-full"
                                            >
                                              <span className="block max-w-full truncate">
                                                {aircraft.name} -{" "}
                                                {aircraft.liveryname}
                                              </span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader className="">
                                  <CardTitle className="text-sm font-medium">
                                    Status Information
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-0">
                                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`status-${selectedPirep.id}`}
                                      >
                                        Status
                                      </Label>
                                      <Select
                                        value={editForm.status}
                                        disabled={!isEditingPirep}
                                        onValueChange={(value) =>
                                          handleEditFormChange("status", value)
                                        }
                                      >
                                        <SelectTrigger
                                          id={`status-${selectedPirep.id}`}
                                          className="w-full"
                                        >
                                          <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                          <SelectItem value="0">
                                            Pending
                                          </SelectItem>
                                          <SelectItem value="1">
                                            Approved
                                          </SelectItem>
                                          <SelectItem value="2">
                                            Rejected
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`multi-${selectedPirep.id}`}
                                      >
                                        Multiplier
                                      </Label>
                                      <Input
                                        id={`multi-${selectedPirep.id}`}
                                        value={editForm.multi}
                                        disabled={!isEditingPirep}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "multi",
                                            event.target.value,
                                          )
                                        }
                                      />
                                    </div>
                                  </div>

                                  {updateError && (
                                    <p className="text-sm text-red-600">
                                      {updateError}
                                    </p>
                                  )}
                                </CardContent>
                              </Card>

                              <Card>
                                <CardHeader>
                                  <CardTitle className="text-sm font-medium">
                                    Admin Comments
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-0">
                                  {selectedPirep.Comments?.filter(
                                    (comment) =>
                                      !deletedCommentIds.includes(comment.id),
                                  ).length ? (
                                    <div className="space-y-3 text-sm">
                                      {selectedPirep.Comments.filter(
                                        (comment) =>
                                          !deletedCommentIds.includes(
                                            comment.id,
                                          ),
                                      ).map((comment) => (
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
                                            <div className="flex items-center gap-2">
                                              <span>
                                                {new Date(
                                                  comment.dateposted,
                                                ).toLocaleString()}
                                              </span>
                                              {isEditingPirep && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 px-2 text-red-600 hover:text-red-700"
                                                  onClick={() =>
                                                    handleDeleteComment(
                                                      comment.id,
                                                    )
                                                  }
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                          </div>
                                          <p className="mt-2 text-sm text-slate-700">
                                            {comment.content}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">
                                      No admin comments yet.
                                    </p>
                                  )}

                                  {isEditingPirep && (
                                    <div className="space-y-2">
                                      <Label
                                        htmlFor={`comment-${selectedPirep.id}`}
                                      >
                                        Add Admin Comment
                                      </Label>
                                      <Textarea
                                        id={`comment-${selectedPirep.id}`}
                                        placeholder="Enter a comment for the pilot..."
                                        value={editForm.newComment}
                                        onChange={(event) =>
                                          handleEditFormChange(
                                            "newComment",
                                            event.target.value,
                                          )
                                        }
                                      />
                                      <p className="flex items-center text-xs text-muted-foreground">
                                        <Plus className="mr-1 h-3 w-3" />
                                        The comment will be added when changes
                                        are saved.
                                      </p>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            </div>

                            {selectedPirep.status === 0 && !isEditingPirep && (
                              <div className="space-y-2">
                                <Label htmlFor="admin-remarks">
                                  Admin Remarks (Required to Reject a PIREP)
                                </Label>
                                <Textarea
                                  id="admin-remarks"
                                  placeholder="Enter remarks for the pilot..."
                                  ref={remarkRef}
                                  onChange={(event) =>
                                    setHasRemark(
                                      event.currentTarget.value.trim().length >
                                        0,
                                    )
                                  }
                                />

                                <div className="flex justify-end gap-2 mt-4">
                                  <Button
                                    className="bg-red-600 hover:bg-red-700"
                                    onClick={() =>
                                      handleRejectPirep(selectedPirep)
                                    }
                                    disabled={!hasRemark}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Reject PIREP
                                  </Button>

                                  <Button
                                    onClick={() =>
                                      handleApprovePirep(selectedPirep)
                                    }
                                  >
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Approve PIREP
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </>
                      ) : null}
                    </DialogContent>
                  </Dialog>
                </CardContent>
                <CardFooter className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {currentPageStart}-{currentPageEnd} of{" "}
                    {pagination.total} PIREPs
                  </div>
                  {totalPages > 1 && (
                    <Pagination className="mx-0 w-auto">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage((page) => Math.max(page - 1, 1));
                            }}
                            aria-disabled={currentPage === 1}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : ""
                            }
                          />
                        </PaginationItem>

                        {Array.from({ length: totalPages }).map((_, index) => {
                          const page = index + 1;
                          const shouldShowPage =
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1);

                          if (shouldShowPage) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  isActive={page === currentPage}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    setCurrentPage(page);
                                  }}
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
                            onClick={(event) => {
                              event.preventDefault();
                              setCurrentPage((page) =>
                                Math.min(page + 1, totalPages),
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
          </Tabs>
        </div>
      </main>
    </CrewHeader>
  );
}
