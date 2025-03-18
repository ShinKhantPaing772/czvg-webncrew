"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Plane,
  Clock,
  MapPin,
  Info,
  Users,
  BarChart,
  Download,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Mock route data - in a real app, this would come from an API based on the route ID
const routeData = {
  id: "3",
  airline: "VA",
  flightNumber: "303",
  departure: {
    icao: "KDEN",
    name: "Denver International Airport",
    city: "Denver",
    country: "United States",
    timezone: "America/Denver",
    coordinates: { lat: 39.8561, lng: -104.6737 },
  },
  arrival: {
    icao: "KATL",
    name: "Hartsfield-Jackson Atlanta International Airport",
    city: "Atlanta",
    country: "United States",
    timezone: "America/New_York",
    coordinates: { lat: 33.6407, lng: -84.4277 },
  },
  aircraft: [
    { code: "B738", name: "Boeing 737-800", seats: 162 },
    { code: "B77W", name: "Boeing 777-300ER", seats: 368 },
  ],
  distance: 1199,
  duration: "2:45",
  frequency: "Daily",
  schedule: [
    { day: "Monday", departureTime: "14:15", arrivalTime: "17:00" },
    { day: "Tuesday", departureTime: "14:15", arrivalTime: "17:00" },
    { day: "Wednesday", departureTime: "14:15", arrivalTime: "17:00" },
    { day: "Thursday", departureTime: "14:15", arrivalTime: "17:00" },
    { day: "Friday", departureTime: "14:15", arrivalTime: "17:00" },
    { day: "Saturday", departureTime: "14:15", arrivalTime: "17:00" },
    { day: "Sunday", departureTime: "14:15", arrivalTime: "17:00" },
  ],
  flightHistory: [
    {
      date: "2023-03-15",
      aircraft: "B738",
      pilot: "John Smith",
      status: "Completed",
      onTime: true,
    },
    {
      date: "2023-03-14",
      aircraft: "B738",
      pilot: "Sarah Johnson",
      status: "Completed",
      onTime: true,
    },
    {
      date: "2023-03-13",
      aircraft: "B77W",
      pilot: "Michael Brown",
      status: "Completed",
      onTime: false,
    },
    {
      date: "2023-03-12",
      aircraft: "B738",
      pilot: "Emily Davis",
      status: "Completed",
      onTime: true,
    },
    {
      date: "2023-03-11",
      aircraft: "B77W",
      pilot: "Robert Wilson",
      status: "Completed",
      onTime: true,
    },
  ],
  notes:
    "This route connects Denver, a major hub in the Mountain West, with Atlanta, the busiest airport in the world. The route is popular for both business and leisure travelers.",
};

export default function ViewRoute() {
  const [selectedAircraft, setSelectedAircraft] = useState(
    routeData.aircraft[0].code
  );

  return (
    <CrewHeader
      userName="John Doe"
      userAvatar="/placeholder.svg?height=80&width=80"
    >
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild>
              <a href="/find-routes">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to routes</span>
              </a>
            </Button>
            <h1 className="text-2xl font-bold">
              {routeData.airline}
              {routeData.flightNumber}: {routeData.departure.icao} to{" "}
              {routeData.arrival.icao}
            </h1>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle>Route Information</CardTitle>
                <CardDescription>
                  Flight details and schedule information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col items-center">
                      <div className="text-sm text-muted-foreground">
                        Departure
                      </div>
                      <div className="text-2xl font-bold">
                        {routeData.departure.icao}
                      </div>
                      <div className="text-sm">{routeData.departure.city}</div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-2">
                        <div className="h-0.5 w-12 bg-muted-foreground/30"></div>
                        <Plane className="h-5 w-5 text-primary" />
                        <div className="h-0.5 w-12 bg-muted-foreground/30"></div>
                      </div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {routeData.distance} nm
                      </div>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        <span>{routeData.duration}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <div className="text-sm text-muted-foreground">
                        Arrival
                      </div>
                      <div className="text-2xl font-bold">
                        {routeData.arrival.icao}
                      </div>
                      <div className="text-sm">{routeData.arrival.city}</div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-2 font-semibold">Departure Airport</h3>
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{routeData.departure.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {routeData.departure.city},{" "}
                              {routeData.departure.country}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="mb-2 font-semibold">Arrival Airport</h3>
                      <div className="space-y-1">
                        <div className="flex items-start gap-2">
                          <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>{routeData.arrival.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {routeData.arrival.city},{" "}
                              {routeData.arrival.country}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold">Schedule</h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Day</TableHead>
                            <TableHead>Departure</TableHead>
                            <TableHead>Arrival</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {routeData.schedule.map((schedule) => (
                            <TableRow key={schedule.day}>
                              <TableCell>{schedule.day}</TableCell>
                              <TableCell>{schedule.departureTime}</TableCell>
                              <TableCell>{schedule.arrivalTime}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Aircraft</CardTitle>
                <CardDescription>Aircraft used for this route</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Select
                    value={selectedAircraft}
                    onValueChange={setSelectedAircraft}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select aircraft" />
                    </SelectTrigger>
                    <SelectContent>
                      {routeData.aircraft.map((ac) => (
                        <SelectItem key={ac.code} value={ac.code}>
                          {ac.code} - {ac.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="rounded-lg border p-4">
                    {routeData.aircraft
                      .filter((ac) => ac.code === selectedAircraft)
                      .map((ac) => (
                        <div key={ac.code} className="space-y-3">
                          <div className="flex justify-center">
                            <div className="h-40 w-64 bg-muted rounded-lg flex items-center justify-center">
                              <Plane className="h-20 w-20 text-muted-foreground/50" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Aircraft Type
                              </div>
                              <div>{ac.name}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                ICAO Code
                              </div>
                              <div>{ac.code}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">
                                Seats
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{ac.seats}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <Button className="w-full" variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download Aircraft Manual
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="history" className="space-y-4">
            <TabsList>
              <TabsTrigger value="history">Flight History</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>

            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Flight History</CardTitle>
                  <CardDescription>
                    Recent flights on this route
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Aircraft</TableHead>
                        <TableHead>Pilot</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>On Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {routeData.flightHistory.map((flight) => (
                        <TableRow key={flight.date}>
                          <TableCell>{flight.date}</TableCell>
                          <TableCell>{flight.aircraft}</TableCell>
                          <TableCell>{flight.pilot}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                            >
                              {flight.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {flight.onTime ? (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200"
                              >
                                On Time
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="bg-amber-50 text-amber-700 border-amber-200"
                              >
                                Delayed
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardHeader>
                  <CardTitle>Route Notes</CardTitle>
                  <CardDescription>
                    Additional information about this route
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <p>{routeData.notes}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <Card>
                <CardHeader>
                  <CardTitle>Route Statistics</CardTitle>
                  <CardDescription>
                    Performance metrics for this route
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        On-Time Performance
                      </span>
                      <span className="text-2xl font-bold">92%</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Average Load Factor
                      </span>
                      <span className="text-2xl font-bold">87%</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Monthly Flights
                      </span>
                      <span className="text-2xl font-bold">30</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Average Fuel Used
                      </span>
                      <span className="text-2xl font-bold">3,250 kg</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Most Common Aircraft
                      </span>
                      <span className="text-2xl font-bold">B738</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">
                        Revenue Per Flight
                      </span>
                      <span className="text-2xl font-bold">$24,680</span>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <div className="h-64 w-full rounded-lg border bg-muted flex items-center justify-center">
                      <BarChart className="h-16 w-16 text-muted-foreground/50" />
                      <span className="ml-2 text-muted-foreground">
                        Performance charts would appear here
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-between">
            <Button variant="outline" asChild>
              <a href="/find-routes">Back to Routes</a>
            </Button>
            <Button asChild>
              <a href="/pirep-form?route=3">Fly This Route</a>
            </Button>
          </div>
        </div>
      </main>
    </CrewHeader>
  );
}
