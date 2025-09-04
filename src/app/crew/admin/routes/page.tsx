"use client";

import { useState, useEffect } from "react";
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

// Helper function to convert seconds to HH:MM format
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
};

export default function RoutesPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalRoutes, setTotalRoutes] = useState(0);
  const [aircraftOptions, setAircraftOptions] = useState<Aircraft[]>([]);

  const [aircraftFilter, setAircraftFilter] = useState("all");
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [isEditingRoute, setIsEditingRoute] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [newRoute, setNewRoute] = useState({
    fltnum: "",
    dep: "",
    arr: "",
    duration: "",
    notes: "",
    aircraft: [],
  });

  interface Route {
    id: number;
    fltnum: string;
    dep: string;
    arr: string;
    duration: number;
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

  // Fetch routes from API
  const fetchRoutes = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/admin/routes?fltnum=${searchQuery}&aircraftId=${
          aircraftFilter === "all" ? "" : aircraftFilter
        }`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch routes");
      }

      const data = await response.json();
      setRoutes(data.data.routes);
      setTotalRoutes(data.data.total);
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
      const response = await fetch("/api/aircraft");

      if (!response.ok) {
        throw new Error("Failed to fetch aircraft");
      }

      const data = await response.json();
      setAircraftOptions(
        data.aircrafts.map((aircraft: any) => ({
          id: aircraft.id,
          name: aircraft.name,
          liveryname: aircraft.liveryname,
        }))
      );
    } catch (err) {
      console.error("Error fetching aircraft:", err);
    }
  };

  // Load data on component mount
  useEffect(() => {
    fetchRoutes();
    fetchAircraft();
  }, []);

  // Reload when search or filter changes
  useEffect(() => {
    fetchRoutes();
  }, [searchQuery, aircraftFilter]);

  const filteredRoutes = routes;
  const sortedRoutes = [...filteredRoutes];

  const pageCount = Math.ceil(sortedRoutes.length / itemsPerPage);
  const paginatedRoutes = sortedRoutes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleAddRoute = async () => {
    if (
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

    try {
      const response = await fetch("/api/admin/routes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newRoute),
      });

      if (!response.ok) {
        throw new Error("Failed to add route");
      }

      setNewRoute({
        fltnum: "",
        dep: "",
        arr: "",
        duration: "",
        notes: "",
        aircraft: [],
      });
      setIsAddingRoute(false);
      Toast({
        title: "Route added successfully.",
      });
      fetchRoutes();
    } catch (err) {
      console.error("Error adding route:", err);
      Toast({
        title: "Failed to add route. Please try again.",
      });
    }
  };

  const handleEditRoute = async () => {
    if (!selectedRoute) return;

    try {
      const response = await fetch("/api/admin/routes", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(selectedRoute),
      });

      if (!response.ok) {
        throw new Error("Failed to update route");
      }

      setIsEditingRoute(false);
      Toast({
        title: "Route updated successfully.",
      });
      fetchRoutes();
    } catch (err) {
      console.error("Error updating route:", err);
      Toast({
        title: "Failed to update route. Please try again.",
      });
    }
  };

  const handleDeleteRoute = async () => {
    if (!selectedRoute) return;

    try {
      const response = await fetch(
        `/api/admin/routes?id=${(selectedRoute as any).id}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete route");
      }

      setShowDeleteDialog(false);
      Toast({
        title: "Route deleted successfully.",
      });
      fetchRoutes();
    } catch (err) {
      console.error("Error deleting route:", err);
      Toast({
        title: "Failed to delete route. Please try again.",
      });
    }
  };

  const initEditForm = async (route: any) => {
    try {
      // Fetch the full route details including aircraft
      const response = await fetch(`/api/admin/routes/${route.id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch route details");
      }

      const data = await response.json();
      setSelectedRoute(data.data);
      setIsEditingRoute(true);
    } catch (err) {
      console.error("Error fetching route details:", err);
      Toast({
        title: "Failed to load route details. Please try again.",
      });
    }
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

          <Select value={aircraftFilter} onValueChange={setAircraftFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by aircraft" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Aircraft</SelectItem>
              {aircraftOptions.map((aircraft) => (
                <SelectItem key={aircraft.id} value={aircraft.id + ""}>
                  {aircraft.name} - {aircraft.liveryname}
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
                              onClick={() => {
                                setSelectedRoute(route as any);
                                initEditForm(route as any);
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
                <div className="space-y-2 col-span-2">
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
                  <Input
                    id="dep"
                    value={newRoute.dep}
                    onChange={(e) =>
                      setNewRoute({
                        ...newRoute,
                        dep: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Enter departure ICAO code"
                    maxLength={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arr">Arrival Airport *</Label>
                  <Input
                    id="arr"
                    value={newRoute.arr}
                    onChange={(e) =>
                      setNewRoute({
                        ...newRoute,
                        arr: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Enter arrival ICAO code"
                    maxLength={4}
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

                <div className="space-y-2 col-span-2">
                  <Label htmlFor="aircraft">Aircraft</Label>
                  <Select
                    onValueChange={(value) => {
                      const selectedAircraft = aircraftOptions.find(
                        (ac: any) => ac.id.toString() === value
                      );
                      if (selectedAircraft) {
                        setNewRoute({
                          ...newRoute,
                          aircraft: [...(newRoute.aircraft || [])],
                        });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select aircraft" />
                    </SelectTrigger>
                    <SelectContent>
                      {aircraftOptions.map((aircraft: any) => (
                        <SelectItem
                          key={aircraft.id}
                          value={aircraft.id.toString()}
                        >
                          {" "}
                          {aircraft.name} - {aircraft.liveryname}
                          {aircraft.notes ? ` - ${aircraft.notes}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {newRoute.aircraft &&
                      newRoute.aircraft.map((aircraftId: number) => {
                        const aircraft = aircraftOptions.find(
                          (ac: any) => ac.id === aircraftId
                        );
                        return aircraft ? (
                          <Badge
                            key={aircraftId}
                            variant="secondary"
                            className="mr-1"
                          >
                            <button
                              className="ml-1 text-xs"
                              onClick={() => {
                                setNewRoute({
                                  ...newRoute,
                                  aircraft: newRoute.aircraft.filter(
                                    (id: number) => id !== aircraftId
                                  ),
                                });
                              }}
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })}
                  </div>
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
                      disabled
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

                  <div className="space-y-2">
                    <Label htmlFor="edit-aircraft">Aircraft</Label>
                    <Select
                      onValueChange={(value) => {
                        const selectedAircraft = aircraftOptions.find(
                          (ac: any) => ac.id.toString() === value
                        );
                        if (selectedAircraft) {
                          const currentAircraftIds = (
                            selectedRoute as any
                          ).aircraft.map((a: any) => a.id);
                          if (!currentAircraftIds.includes(parseInt(value))) {
                            setSelectedRoute({
                              ...(selectedRoute as any),
                              aircraft: [
                                ...(selectedRoute as any).aircraft,
                                selectedAircraft,
                              ],
                            });
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Add aircraft" />
                      </SelectTrigger>
                      <SelectContent>
                        {aircraftOptions.map((aircraft: any) => (
                          <SelectItem
                            key={aircraft.id}
                            value={aircraft.id.toString()}
                          >
                            {aircraft.name} - {aircraft.liveryname}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(selectedRoute as any).aircraft &&
                        (selectedRoute as any).aircraft.map((aircraft: any) => (
                          <Badge
                            key={aircraft.id}
                            variant="secondary"
                            className="mr-1"
                          >
                            {aircraft.name} - {aircraft.liveryname}
                            <button
                              className="ml-1 text-xs"
                              onClick={() => {
                                setSelectedRoute({
                                  ...(selectedRoute as any),
                                  aircraft: (
                                    selectedRoute as any
                                  ).aircraft.filter(
                                    (a: any) => a.id !== aircraft.id
                                  ),
                                });
                              }}
                            >
                              ×
                            </button>
                          </Badge>
                        ))}
                    </div>
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
