"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plane,
  MapPin,
  Info,
  Users,
  Shield,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

// Mock data for routes
const routesData = [
  {
    id: "1",
    fltnum: "VA101",
    dep: "KLAX",
    arr: "KSFO",
    duration: "1:15",
    notes: "Short-haul West Coast route",
    departureTime: "08:00",
    arrivalTime: "09:15",
    distance: "337 nm",
    frequency: "Daily",
    status: "Active",
  },
  {
    id: "2",
    fltnum: "VA202",
    dep: "KSFO",
    arr: "KDEN",
    duration: "2:30",
    notes: "Mountain crossing route",
    departureTime: "10:30",
    arrivalTime: "13:00",
    distance: "967 nm",
    frequency: "Daily",
    status: "Active",
  },
  {
    id: "3",
    fltnum: "VA303",
    dep: "KDEN",
    arr: "KATL",
    duration: "2:45",
    notes: "Cross-country route",
    departureTime: "14:15",
    arrivalTime: "17:00",
    distance: "1,199 nm",
    frequency: "Mon, Wed, Fri",
    status: "Active",
  },
  {
    id: "4",
    fltnum: "VA404",
    dep: "KATL",
    arr: "KJFK",
    duration: "2:10",
    notes: "East coast connector",
    departureTime: "18:30",
    arrivalTime: "20:40",
    distance: "760 nm",
    frequency: "Daily",
    status: "Active",
  },
  {
    id: "5",
    fltnum: "VA505",
    dep: "KJFK",
    arr: "KBOS",
    duration: "1:05",
    notes: "Northeast corridor route",
    departureTime: "07:45",
    arrivalTime: "08:50",
    distance: "187 nm",
    frequency: "Daily",
    status: "Active",
  },
  {
    id: "6",
    fltnum: "VA606",
    dep: "KBOS",
    arr: "KLAX",
    duration: "6:15",
    notes: "Transcontinental red-eye flight",
    departureTime: "22:30",
    arrivalTime: "04:45",
    distance: "2,611 nm",
    frequency: "Tue, Thu, Sat",
    status: "Active",
  },
];

// Mock data for airports
const airports = [
  {
    code: "KLAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    state: "CA",
    country: "USA",
    lat: 33.9416,
    lon: -118.4085,
  },
  {
    code: "KSFO",
    name: "San Francisco International Airport",
    city: "San Francisco",
    state: "CA",
    country: "USA",
    lat: 37.6213,
    lon: -122.379,
  },
  {
    code: "KDEN",
    name: "Denver International Airport",
    city: "Denver",
    state: "CO",
    country: "USA",
    lat: 39.8561,
    lon: -104.6737,
  },
  {
    code: "KATL",
    name: "Hartsfield-Jackson Atlanta International Airport",
    city: "Atlanta",
    state: "GA",
    country: "USA",
    lat: 33.6407,
    lon: -84.4277,
  },
  {
    code: "KJFK",
    name: "John F. Kennedy International Airport",
    city: "New York",
    state: "NY",
    country: "USA",
    lat: 40.6413,
    lon: -73.7781,
  },
  {
    code: "KBOS",
    name: "Boston Logan International Airport",
    city: "Boston",
    state: "MA",
    country: "USA",
    lat: 42.3656,
    lon: -71.0096,
  },
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
    seats: 189,
    range: "3,060 nm",
    cruiseSpeed: "450 kts",
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
    seats: 180,
    range: "3,300 nm",
    cruiseSpeed: "447 kts",
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
    seats: 396,
    range: "7,370 nm",
    cruiseSpeed: "490 kts",
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
    seats: 325,
    range: "8,100 nm",
    cruiseSpeed: "488 kts",
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
    seats: 78,
    range: "1,378 nm",
    cruiseSpeed: "414 kts",
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
    seats: 114,
    range: "2,450 nm",
    cruiseSpeed: "447 kts",
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

// Mock data for recent flights on this route
const recentFlights = [
  {
    id: "101",
    routeId: "1",
    date: "2023-05-15",
    pilot: "John Smith",
    aircraft: "Boeing 737-800",
    status: "Completed",
  },
  {
    id: "102",
    routeId: "1",
    date: "2023-05-14",
    pilot: "Sarah Johnson",
    aircraft: "Airbus A320",
    status: "Completed",
  },
  {
    id: "103",
    routeId: "1",
    date: "2023-05-13",
    pilot: "Michael Brown",
    aircraft: "Boeing 737-800",
    status: "Completed",
  },
  {
    id: "201",
    routeId: "2",
    date: "2023-05-15",
    pilot: "Emily Davis",
    aircraft: "Boeing 737-800",
    status: "Completed",
  },
  {
    id: "202",
    routeId: "2",
    date: "2023-05-14",
    pilot: "Robert Wilson",
    aircraft: "Airbus A320",
    status: "Completed",
  },
  {
    id: "301",
    routeId: "3",
    date: "2023-05-15",
    pilot: "Jennifer Lee",
    aircraft: "Boeing 737-800",
    status: "Completed",
  },
  {
    id: "302",
    routeId: "3",
    date: "2023-05-13",
    pilot: "David Martinez",
    aircraft: "Boeing 777-300ER",
    status: "Completed",
  },
  {
    id: "401",
    routeId: "4",
    date: "2023-05-15",
    pilot: "Lisa Anderson",
    aircraft: "Airbus A320",
    status: "Completed",
  },
  {
    id: "402",
    routeId: "4",
    date: "2023-05-14",
    pilot: "James Taylor",
    aircraft: "Boeing 777-300ER",
    status: "Completed",
  },
  {
    id: "501",
    routeId: "5",
    date: "2023-05-15",
    pilot: "Patricia Thomas",
    aircraft: "Bombardier CRJ-700",
    status: "Completed",
  },
  {
    id: "502",
    routeId: "5",
    date: "2023-05-14",
    pilot: "Christopher Harris",
    aircraft: "Embraer E190",
    status: "Completed",
  },
  {
    id: "601",
    routeId: "6",
    date: "2023-05-15",
    pilot: "Jessica Clark",
    aircraft: "Boeing 777-300ER",
    status: "Completed",
  },
  {
    id: "602",
    routeId: "6",
    date: "2023-05-13",
    pilot: "Daniel Lewis",
    aircraft: "Airbus A350-900",
    status: "Completed",
  },
];

export default function ViewRoute() {
  const params = useParams();
  const routeId = params.id as string;
  const [route, setRoute] = useState<any>(null);
  const [departureAirport, setDepartureAirport] = useState<any>(null);
  const [arrivalAirport, setArrivalAirport] = useState<any>(null);
  const [routeAircraftList, setRouteAircraftList] = useState<any[]>([]);
  const [routeRecentFlights, setRouteRecentFlights] = useState<any[]>([]);

  useEffect(() => {
    // Find the route
    const foundRoute = routesData.find((r) => r.id === routeId);
    setRoute(foundRoute);

    if (foundRoute) {
      // Find departure and arrival airports
      setDepartureAirport(airports.find((a) => a.code === foundRoute.dep));
      setArrivalAirport(airports.find((a) => a.code === foundRoute.arr));

      // Find aircraft for this route
      const aircraftIds = routeAircraft
        .filter((ra) => ra.routeid === routeId)
        .map((ra) => ra.aircraftid);

      setRouteAircraftList(
        aircraft.filter((ac) => aircraftIds.includes(ac.id))
      );

      // Find recent flights for this route
      setRouteRecentFlights(recentFlights.filter((f) => f.routeId === routeId));
    }
  }, [routeId]);

  if (!route) {
    return (
      <CrewHeader
        userName="John Doe"
        userAvatar="/placeholder.svg?height=80&width=80"
      >
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/find-routes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <h1 className="text-2xl font-bold">Route Not Found</h1>
          </div>
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <p>The requested route could not be found.</p>
            </CardContent>
          </Card>
        </main>
      </CrewHeader>
    );
  }

  return (
    <CrewHeader
      userName="John Doe"
      userAvatar="/placeholder.svg?height=80&width=80"
    >
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/crew/find-routes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Route {route.fltnum}</h1>
          <Badge variant="outline" className="ml-auto">
            {route.status}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="text-2xl font-bold">
                    {departureAirport?.code}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {departureAirport?.name}
                  </div>
                  <div className="text-sm">
                    {departureAirport?.city}, {departureAirport?.state}
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Plane className="h-5 w-5 rotate-45 text-primary" />
                    <div className="text-sm font-medium">{route.distance}</div>
                  </div>
                  <div className="my-2 h-0.5 w-24 bg-border"></div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <div className="text-sm">{route.duration}</div>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center md:items-end md:text-right">
                  <div className="text-2xl font-bold">
                    {arrivalAirport?.code}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {arrivalAirport?.name}
                  </div>
                  <div className="text-sm">
                    {arrivalAirport?.city}, {arrivalAirport?.state}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Route Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Flight Number
                    </div>
                    <div>{route.fltnum}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Frequency
                    </div>
                    <div>{route.frequency}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Departure Time
                    </div>
                    <div>{route.departureTime}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">
                      Arrival Time
                    </div>
                    <div>{route.arrivalTime}</div>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Notes
                  </div>
                  <div className="mt-1">{route.notes}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
              <CardDescription>Flight path visualization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-video rounded-md bg-muted flex items-center justify-center">
                <MapPin className="h-8 w-8 text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">
                  Map visualization would appear here
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Available Aircraft</CardTitle>
              <CardDescription>
                Aircraft that can be used for this route
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {routeAircraftList.map((ac) => (
                  <div key={ac.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{ac.name}</div>
                      <Badge variant="outline">{ac.ifaircraftid}</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <div className="text-muted-foreground">Seats</div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {ac.seats}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Range</div>
                        <div>{ac.range}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Rank Required
                        </div>
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          {ac.rankreq}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          Award Required
                        </div>
                        <div>{ac.awardreq}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Recent Flights</CardTitle>
              <CardDescription>Latest flights on this route</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="list">
                <TabsList className="mb-4">
                  <TabsTrigger value="list">List View</TabsTrigger>
                  <TabsTrigger value="calendar">Calendar View</TabsTrigger>
                </TabsList>
                <TabsContent value="list">
                  <div className="rounded-md border">
                    <div className="grid grid-cols-4 gap-4 p-4 font-medium border-b">
                      <div>Date</div>
                      <div>Pilot</div>
                      <div>Aircraft</div>
                      <div>Status</div>
                    </div>
                    {routeRecentFlights.map((flight) => (
                      <div
                        key={flight.id}
                        className="grid grid-cols-4 gap-4 p-4 border-b last:border-0"
                      >
                        <div>{flight.date}</div>
                        <div>{flight.pilot}</div>
                        <div>{flight.aircraft}</div>
                        <div>
                          <Badge
                            variant="outline"
                            className="bg-green-50 text-green-700 hover:bg-green-50 hover:text-green-700"
                          >
                            {flight.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="calendar">
                  <div className="flex items-center justify-center rounded-md border p-8">
                    <div className="flex flex-col items-center">
                      <Calendar className="h-12 w-12 text-muted-foreground" />
                      <p className="mt-2 text-center text-muted-foreground">
                        Calendar view would appear here
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Book This Flight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 md:flex-row">
                <div className="flex-1 rounded-lg border p-4">
                  <div className="flex items-center gap-2">
                    <Info className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">
                      Ready to fly this route?
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Book this flight to add it to your schedule. You'll be able
                    to fly it at your convenience and submit a PIREP after
                    completion.
                  </p>
                </div>
                <Button className="md:self-end" size="lg">
                  Book Flight
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </CrewHeader>
  );
}
