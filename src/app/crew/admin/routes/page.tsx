"use client";

import { useState } from "react";
import { Plus, Edit, Trash, ArrowRight } from "lucide-react";
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
import { Toast } from "@radix-ui/react-toast";
import { CrewHeader } from "@/components/crew-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Mock data for airports
const airportsData = [
  { code: "KLAX", name: "Los Angeles International Airport" },
  { code: "KSFO", name: "San Francisco International Airport" },
  { code: "KDEN", name: "Denver International Airport" },
  { code: "KATL", name: "Hartsfield-Jackson Atlanta International Airport" },
  { code: "KJFK", name: "John F. Kennedy International Airport" },
  { code: "KBOS", name: "Boston Logan International Airport" },
  { code: "KMIA", name: "Miami International Airport" },
  { code: "KORD", name: "O'Hare International Airport" },
  { code: "KDFW", name: "Dallas/Fort Worth International Airport" },
];

// Mock data for aircraft
const aircraftData = [
  {
    id: "AC-001",
    code: "B738",
    name: "Boeing 737-800",
    seats: 162,
    status: "Active",
    notes: "Popular narrow-body aircraft for short to medium-haul routes",
  },
  {
    id: "AC-002",
    code: "B77W",
    name: "Boeing 777-300ER",
    seats: 368,
    status: "Active",
    notes: "Long-haul wide-body aircraft for international routes",
  },
  {
    id: "AC-003",
    code: "A320",
    name: "Airbus A320",
    seats: 180,
    status: "Active",
    notes: "Versatile narrow-body aircraft for regional routes",
  },
];

// Mock data for route-aircraft relationships
const routeAircraftData = [
  { routeId: "RT-1001", aircraftId: "AC-001" },
  { routeId: "RT-1001", aircraftId: "AC-003" },
  { routeId: "RT-1002", aircraftId: "AC-001" },
  { routeId: "RT-1002", aircraftId: "AC-003" },
  { routeId: "RT-1003", aircraftId: "AC-001" },
  { routeId: "RT-1003", aircraftId: "AC-002" },
  { routeId: "RT-1004", aircraftId: "AC-003" },
  { routeId: "RT-1005", aircraftId: "AC-001" },
  { routeId: "RT-1006", aircraftId: "AC-002" },
];

// Mock data for routes
const routesData = [
  {
    id: "RT-1001",
    fltnum: "VA101",
    dep: "KLAX",
    arr: "KSFO",
    duration: "1:15",
    notes: "Popular commuter route with high demand.",
    status: "Active",
  },
  {
    id: "RT-1002",
    fltnum: "VA202",
    dep: "KSFO",
    arr: "KDEN",
    duration: "2:30",
    notes: "Mountain crossing route with occasional turbulence.",
    status: "Active",
  },
  {
    id: "RT-1003",
    fltnum: "VA303",
    dep: "KDEN",
    arr: "KATL",
    duration: "2:45",
    notes: "Cross-country route connecting mountain west to southeast.",
    status: "Active",
  },
  {
    id: "RT-1004",
    fltnum: "VA404",
    dep: "KATL",
    arr: "KJFK",
    duration: "2:10",
    notes: "East coast connector between major hubs.",
    status: "Active",
  },
  {
    id: "RT-1005",
    fltnum: "VA505",
    dep: "KJFK",
    arr: "KBOS",
    duration: "1:05",
    notes: "Short northeast corridor route, popular with business travelers.",
    status: "Active",
  },
  {
    id: "RT-1006",
    fltnum: "VA606",
    dep: "KBOS",
    arr: "KLAX",
    duration: "6:15",
    notes:
      "Transcontinental red-eye flight. Currently inactive due to seasonal adjustments.",
    status: "Inactive",
  },
  {
    id: "RT-1007",
    fltnum: "VA707",
    dep: "KMIA",
    arr: "KJFK",
    duration: "2:50",
    notes: "Popular route connecting south Florida to New York.",
  },
  {
    id: "RT-1008",
    fltnum: "VA808",
    dep: "KORD",
    arr: "KDFW",
    duration: "2:15",
    notes: "Midwest to south central route, connecting major hubs.",
  },
];

const statusOptions = ["active", "inactive", "pending"];
const aircraftOptions = ["B737", "A320", "B777", "A350"];

// Helper function to get aircraft for a route
const getAircraftForRoute = (routeId: string) => {
  const aircraftIds = routeAircraftData
    .filter((ra) => ra.routeId === routeId)
    .map((ra) => ra.aircraftId);
  return aircraftData.filter((ac) => aircraftIds.includes(ac.id));
};

const getStatusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case "active":
      return <Badge variant="default">Active</Badge>;
    case "inactive":
      return <Badge variant="destructive">Inactive</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState(routesData);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [aircraftFilter, setAircraftFilter] = useState("all");
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [newRoute, setNewRoute] = useState({
    id: "",
    fltnum: "",
    dep: "",
    arr: "",
    duration: "",
    notes: "",
  });

  const filteredRoutes = routesData.filter((route) => {
    const matchesSearch =
      route.fltnum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.dep.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.arr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesAircraft =
      aircraftFilter === "all"
        ? true
        : getAircraftForRoute(route.id).some(
            (ac) => ac.code === aircraftFilter
          );

    return matchesSearch && matchesAircraft;
  });

  const sortedRoutes = [...filteredRoutes].sort((a, b) => {
    return a.fltnum.localeCompare(b.fltnum);
  });

  const pageCount = Math.ceil(sortedRoutes.length / itemsPerPage);
  const paginatedRoutes = sortedRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAddRoute = () => {
    if (
      !newRoute.id ||
      !newRoute.fltnum ||
      !newRoute.dep ||
      !newRoute.arr ||
      !newRoute.duration
    ) {
      Toast({
        title: "Please fill in all required fields.",
      });
      return;
    }

    setRoutes([...routes, { ...newRoute }]);
    setNewRoute({
      id: "",
      fltnum: "",
      dep: "",
      arr: "",
      duration: "",
      notes: "",
    });
    setIsAddingRoute(false);
    Toast({
      title: "Route added successfully.",
    });
  };

  const handleEditRoute = () => {
    if (!selectedRoute) return;

    const updatedRoutes = routes.map((route) =>
      route.id === (selectedRoute as any).id ? selectedRoute : route
    );
    setRoutes(updatedRoutes);
    setIsEditingRoute(false);
    Toast({
      title: "Route updated successfully.",
    });
  };

  const handleDeleteRoute = () => {
    if (!selectedRoute) return;

    const updatedRoutes = routes.filter(
      (route) => route.id !== (selectedRoute as any).id
    );
    setRoutes(updatedRoutes);
    setShowDeleteDialog(false);
    Toast({
      title: "Route deleted successfully.",
    });
  };

  const initEditForm = (route: {
    id: string;
    fltnum: string;
    dep: string;
    arr: string;
    duration: string;
    notes: string;
    status?: string;
  }) => {
    setSelectedRoute(route as any);
    setIsEditingRoute(true);
  };

  return (
    <CrewHeader userName="Admin User" isAdmin={true}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Routes</h1>
          <Button onClick={() => setIsAddingRoute(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Button>
        </div>

        <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-4">
          <Input
            type="text"
            placeholder="Search routes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by aircraft" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Aircraft</SelectItem>
              {aircraftOptions.map((aircraft) => (
                <SelectItem key={aircraft} value={aircraft}>
                  {aircraft}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                    <TableHead>ID</TableHead>
                    <TableHead>Flight Number</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Duration
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Notes
                    </TableHead>
                    <TableHead>Aircraft</TableHead>
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
                          {route.id}
                        </TableCell>
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
                          {getAircraftForRoute(route.id).map((ac) => (
                            <Badge
                              key={ac.id}
                              variant="outline"
                              className="mr-1"
                            >
                              {ac.code}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell>
                          {route.status ? (
                            getStatusBadge(route.status)
                          ) : (
                            <Badge variant="outline">Unknown</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedRoute(route as any);
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
          <DialogTrigger asChild>
            {/* This trigger is not needed as the dialog is opened programmatically */}
          </DialogTrigger>
          <DialogContent className="max-w-3xl bg-white">
            <DialogHeader>
              <DialogTitle>Add New Route</DialogTitle>
              <DialogDescription>
                Create a new flight route in the system. All fields marked with
                * are required.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="id">ID *</Label>
                  <Input
                    id="id"
                    value={newRoute.id}
                    onChange={(e) =>
                      setNewRoute({
                        ...newRoute,
                        id: e.target.value,
                      })
                    }
                    placeholder="RT-1001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fltnum">Flight Number *</Label>
                  <Input
                    id="fltnum"
                    value={newRoute.fltnum}
                    onChange={(e) =>
                      setNewRoute({
                        ...newRoute,
                        fltnum: e.target.value,
                      })
                    }
                    placeholder="VA101"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dep">Departure Airport *</Label>
                  <Select
                    value={newRoute.dep}
                    onValueChange={(value) =>
                      setNewRoute({ ...newRoute, dep: value })
                    }
                  >
                    <SelectTrigger id="dep">
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
                  <Label htmlFor="arr">Arrival Airport *</Label>
                  <Select
                    value={newRoute.arr}
                    onValueChange={(value) =>
                      setNewRoute({ ...newRoute, arr: value })
                    }
                  >
                    <SelectTrigger id="arr">
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
              <Button variant="outline" onClick={() => setIsAddingRoute(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddRoute}
                disabled={
                  !newRoute.id ||
                  !newRoute.fltnum ||
                  !newRoute.dep ||
                  !newRoute.arr ||
                  !newRoute.duration
                }
              >
                Add Route
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Route Dialog */}
        <Dialog open={isEditingRoute} onOpenChange={setIsEditingRoute}>
          <DialogTrigger asChild>
            {/* This trigger is not needed as the dialog is opened programmatically */}
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-white">
            <DialogHeader>
              <DialogTitle>Edit Route</DialogTitle>
              <DialogDescription>
                Update the details for route {(selectedRoute as any)?.id}.
              </DialogDescription>
            </DialogHeader>

            {selectedRoute && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-id">ID</Label>
                    <Input
                      id="edit-id"
                      value={(selectedRoute as any).id}
                      onChange={(e) =>
                        setSelectedRoute({
                          ...(selectedRoute as any),
                          id: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-fltnum">Flight Number</Label>
                    <Input
                      id="edit-fltnum"
                      value={(selectedRoute as any).fltnum}
                      onChange={(e) =>
                        setSelectedRoute({
                          ...(selectedRoute as any),
                          fltnum: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-dep">Departure Airport</Label>
                    <Input
                      id="edit-dep"
                      value={(selectedRoute as any).dep}
                      onChange={(e) =>
                        setSelectedRoute({
                          ...(selectedRoute as any),
                          dep: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Enter departure airport code"
                      maxLength={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-arr">Arrival Airport</Label>
                    <Input
                      id="edit-arr"
                      value={(selectedRoute as any).arr}
                      onChange={(e) =>
                        setSelectedRoute({
                          ...(selectedRoute as any),
                          arr: e.target.value.toUpperCase(),
                        })
                      }
                      placeholder="Enter arrival airport code"
                      maxLength={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-duration">Duration (HH:MM)</Label>
                    <Input
                      id="edit-duration"
                      value={(selectedRoute as any).duration}
                      onChange={(e) =>
                        setSelectedRoute({
                          ...(selectedRoute as any),
                          duration: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    value={(selectedRoute as any).notes}
                    onChange={(e) =>
                      setSelectedRoute({
                        ...(selectedRoute as any),
                        notes: e.target.value,
                      })
                    }
                    rows={3}
                  />
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
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Route</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete route{" "}
                {(selectedRoute as any)?.id}? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteRoute}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CrewHeader>
  );
}
