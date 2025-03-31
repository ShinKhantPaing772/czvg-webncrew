"use client";

import { useState, useEffect } from "react";
import { Search, Filter, Plane, ArrowRight, Clock } from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

// Mock data for routes
const routesData = [
  {
    id: "1",
    fltnum: "VA101",
    dep: "KLAX",
    arr: "KSFO",
    duration: "1:15",
    notes: "Short-haul West Coast route",
  },
  {
    id: "2",
    fltnum: "VA202",
    dep: "KSFO",
    arr: "KDEN",
    duration: "2:30",
    notes: "Mountain crossing route",
  },
  {
    id: "3",
    fltnum: "VA303",
    dep: "KDEN",
    arr: "KATL",
    duration: "2:45",
    notes: "Cross-country route",
  },
  {
    id: "4",
    fltnum: "VA404",
    dep: "KATL",
    arr: "KJFK",
    duration: "2:10",
    notes: "East coast connector",
  },
  {
    id: "5",
    fltnum: "VA505",
    dep: "KJFK",
    arr: "KBOS",
    duration: "1:05",
    notes: "Northeast corridor route",
  },
  {
    id: "6",
    fltnum: "VA606",
    dep: "KBOS",
    arr: "KLAX",
    duration: "6:15",
    notes: "Transcontinental red-eye flight",
  },
];

// Mock data for airports
const airports = [
  { code: "KLAX", name: "Los Angeles International Airport" },
  { code: "KSFO", name: "San Francisco International Airport" },
  { code: "KDEN", name: "Denver International Airport" },
  { code: "KATL", name: "Hartsfield-Jackson Atlanta International Airport" },
  { code: "KJFK", name: "John F. Kennedy International Airport" },
  { code: "KBOS", name: "Boston Logan International Airport" },
];

// Mock data for aircraft
const aircraft = [
  {
    id: "1",
    name: "Boeing 737-800",
    ifaircraftid: "B738",
    liveryname: "Default",
    ifliveryid: "B738_DEFAULT",
    notes: "Popular narrow-body aircraft for short to medium-haul routes",
    rankreq: "First Officer",
    awardreq: "None",
    status: "Active",
  },
  {
    id: "2",
    name: "Airbus A320",
    ifaircraftid: "A320",
    liveryname: "Default",
    ifliveryid: "A320_DEFAULT",
    notes: "Versatile narrow-body aircraft for regional routes",
    rankreq: "First Officer",
    awardreq: "None",
    status: "Active",
  },
  {
    id: "3",
    name: "Boeing 777-300ER",
    ifaircraftid: "B77W",
    liveryname: "Default",
    ifliveryid: "B77W_DEFAULT",
    notes: "Long-haul wide-body aircraft for international routes",
    rankreq: "Captain",
    awardreq: "1000 Hours",
    status: "Active",
  },
  {
    id: "4",
    name: "Airbus A350-900",
    ifaircraftid: "A359",
    liveryname: "Default",
    ifliveryid: "A359_DEFAULT",
    notes: "Modern long-haul aircraft with excellent fuel efficiency",
    rankreq: "Captain",
    awardreq: "1000 Hours",
    status: "Active",
  },
  {
    id: "5",
    name: "Bombardier CRJ-700",
    ifaircraftid: "CRJ7",
    liveryname: "Default",
    ifliveryid: "CRJ7_DEFAULT",
    notes: "Regional jet for shorter routes",
    rankreq: "First Officer",
    awardreq: "None",
    status: "Active",
  },
  {
    id: "6",
    name: "Embraer E190",
    ifaircraftid: "E190",
    liveryname: "Default",
    ifliveryid: "E190_DEFAULT",
    notes: "Regional jet ideal for short to medium routes",
    rankreq: "First Officer",
    awardreq: "None",
    status: "Active",
  },
];

// Mock data for route_aircraft mapping
const routeAircraft = [
  { id: "1", routeid: "1", aircraftid: "1" },
  { id: "2", routeid: "1", aircraftid: "2" },
  { id: "3", routeid: "2", aircraftid: "1" },
  { id: "4", routeid: "2", aircraftid: "2" },
  { id: "5", routeid: "3", aircraftid: "1" },
  { id: "6", routeid: "3", aircraftid: "3" },
  { id: "7", routeid: "4", aircraftid: "2" },
  { id: "8", routeid: "4", aircraftid: "3" },
  { id: "9", routeid: "5", aircraftid: "5" },
  { id: "10", routeid: "5", aircraftid: "6" },
  { id: "11", routeid: "6", aircraftid: "3" },
  { id: "12", routeid: "6", aircraftid: "4" },
];

export default function FindRoutes() {
  const [searchQuery, setSearchQuery] = useState("");
  const [departureFilter, setDepartureFilter] = useState("");
  const [arrivalFilter, setArrivalFilter] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("table");

  // Function to get aircraft for a route
  const getAircraftForRoute = (routeId: string) => {
    const aircraftIds = routeAircraft
      .filter((ra) => ra.routeid === routeId)
      .map((ra) => ra.aircraftid);

    return aircraft.filter((ac) => aircraftIds.includes(ac.id));
  };

  // Filter routes based on search and filters
  const filteredRoutes = routesData.filter((route) => {
    const matchesSearch =
      route.fltnum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.dep.toLowerCase().includes(searchQuery.toLowerCase()) ||
      route.arr.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDeparture =
      !departureFilter ||
      departureFilter === "any" ||
      route.dep === departureFilter;
    const matchesArrival =
      !arrivalFilter || arrivalFilter === "any" || route.arr === arrivalFilter;

    // Check if route has matching aircraft if filter is applied
    const matchesAircraft =
      !aircraftFilter ||
      aircraftFilter === "any" ||
      routeAircraft
        .filter((ra) => ra.routeid === route.id)
        .some((ra) => ra.aircraftid === aircraftFilter);

    return (
      matchesSearch && matchesDeparture && matchesArrival && matchesAircraft
    );
  });

  useEffect(() => {
    console.log("Filtered Routes:", filteredRoutes);
    console.log("Filters:", {
      searchQuery,
      departureFilter,
      arrivalFilter,
      aircraftFilter,
    });
  }, [
    filteredRoutes,
    searchQuery,
    departureFilter,
    arrivalFilter,
    aircraftFilter,
  ]);

  return (
    <CrewHeader
      userName="John Doe"
      userAvatar="/placeholder.svg?height=80&width=80"
    >
      <main className="flex flex-1 flex-col gap-4  md:gap-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">Find Routes</h1>

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

            <Tabs
              defaultValue="table"
              className="w-[200px] md:w-[250px]"
              onValueChange={setActiveTab}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="cards">Cards</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {showFilters && (
            <Card>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="departure">Departure Airport</Label>
                  <Select
                    value={departureFilter}
                    onValueChange={setDepartureFilter}
                  >
                    <SelectTrigger id="departure">
                      <SelectValue placeholder="Any departure" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any departure</SelectItem>
                      {airports.map((airport) => (
                        <SelectItem key={airport.code} value={airport.code}>
                          {airport.code} - {airport.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="arrival">Arrival Airport</Label>
                  <Select
                    value={arrivalFilter}
                    onValueChange={setArrivalFilter}
                  >
                    <SelectTrigger id="arrival">
                      <SelectValue placeholder="Any arrival" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any arrival</SelectItem>
                      {airports.map((airport) => (
                        <SelectItem key={airport.code} value={airport.code}>
                          {airport.code} - {airport.name}
                        </SelectItem>
                      ))}
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
                      <SelectValue placeholder="Any aircraft" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any aircraft</SelectItem>
                      {aircraft.map((ac) => (
                        <SelectItem key={ac.id} value={ac.id}>
                          {ac.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="rounded-lg bg-card">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="table">
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Flight</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead>Aircraft</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRoutes.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={6}
                              className="text-center text-muted-foreground"
                            >
                              No routes found matching your criteria
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredRoutes.map((route) => (
                            <TableRow key={route.id}>
                              <TableCell className="font-medium">
                                {route.fltnum}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <span>{route.dep}</span>
                                  <ArrowRight className="h-3 w-3" />
                                  <span>{route.arr}</span>
                                </div>
                              </TableCell>
                              <TableCell>{route.duration}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {getAircraftForRoute(route.id).map((ac) => (
                                    <Badge
                                      key={ac.id}
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {ac.ifaircraftid}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>{route.notes}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" asChild>
                                  <a href={`/crew/route/${route.id}`}>View</a>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="cards" className="m-0 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRoutes.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No routes found matching your criteria
                    </div>
                  ) : (
                    filteredRoutes.map((route) => (
                      <Card key={route.id} className="overflow-hidden">
                        <CardContent className="p-0">
                          <div className="bg-primary/10 p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Plane className="h-5 w-5 text-primary" />
                                <span className="font-bold">
                                  {route.fltnum}
                                </span>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <div className="text-2xl font-bold">
                                {route.dep}
                              </div>
                              <ArrowRight className="h-5 w-5 text-muted-foreground" />
                              <div className="text-2xl font-bold">
                                {route.arr}
                              </div>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="space-y-4">
                              <div>
                                <div className="text-sm text-muted-foreground">
                                  Duration
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {route.duration}
                                </div>
                              </div>
                              <div>
                                <div className="text-sm text-muted-foreground">
                                  Notes
                                </div>
                                <div>{route.notes}</div>
                              </div>
                            </div>

                            <div className="mt-4">
                              <div className="text-sm text-muted-foreground">
                                Aircraft
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {getAircraftForRoute(route.id).map((ac) => (
                                  <Badge key={ac.id} variant="secondary">
                                    {ac.name}
                                  </Badge>
                                ))}
                              </div>
                            </div>

                            <Button className="mt-4 w-full" asChild>
                              <a href={`/crew/route/${route.id}`}>
                                View Details
                              </a>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
    </CrewHeader>
  );
}
