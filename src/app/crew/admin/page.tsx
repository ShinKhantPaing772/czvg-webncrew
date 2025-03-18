"use client";

import { useState } from "react";
import {
  BarChart3,
  PieChart,
  LineChart,
  Users,
  Plane,
  FileText,
  Clock,
  ArrowUp,
  ArrowDown,
  MapPin,
  Download,
  Filter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

// Mock data for dashboard statistics
const dashboardStats = {
  totalPilots: 156,
  activePilots: 98,
  totalFlights: 3427,
  flightsThisMonth: 342,
  pendingPireps: 12,
  totalHours: 8945.5,
  hoursThisMonth: 856.2,
  averageFlightTime: 2.6,
  mostPopularAircraft: "B738",
  mostPopularRoute: "KLAX-KSFO",
  totalFuelUsed: 1245680,
  percentChangeFlights: 8.5,
  percentChangeHours: 12.3,
  percentChangePilots: -2.1,
};

// Mock data for flight activity over time
const flightActivityData = [
  { month: "Jan", flights: 280, hours: 728 },
  { month: "Feb", flights: 250, hours: 650 },
  { month: "Mar", flights: 310, hours: 806 },
  { month: "Apr", flights: 290, hours: 754 },
  { month: "May", flights: 320, hours: 832 },
  { month: "Jun", flights: 350, hours: 910 },
  { month: "Jul", flights: 380, hours: 988 },
  { month: "Aug", flights: 400, hours: 1040 },
  { month: "Sep", flights: 360, hours: 936 },
  { month: "Oct", flights: 330, hours: 858 },
  { month: "Nov", flights: 320, hours: 832 },
  { month: "Dec", flights: 342, hours: 856 },
];

// Mock data for aircraft usage
const aircraftUsageData = [
  { aircraft: "B738", flights: 1245, hours: 3237, percentage: 36 },
  { aircraft: "A320", flights: 876, hours: 2278, percentage: 25 },
  { aircraft: "B77W", flights: 432, hours: 1728, percentage: 13 },
  { aircraft: "A359", flights: 324, hours: 1296, percentage: 9 },
  { aircraft: "CRJ7", flights: 280, hours: 560, percentage: 8 },
  { aircraft: "E190", flights: 270, hours: 540, percentage: 8 },
];

// Mock data for top routes
const topRoutesData = [
  { route: "KLAX-KSFO", flights: 245, hours: 306, percentage: 7.2 },
  { route: "KJFK-KBOS", flights: 198, hours: 218, percentage: 5.8 },
  { route: "KATL-KMIA", flights: 187, hours: 224, percentage: 5.5 },
  { route: "KORD-KDFW", flights: 165, hours: 248, percentage: 4.8 },
  { route: "KDEN-KLAS", flights: 142, hours: 156, percentage: 4.1 },
];

// Mock data for top pilots
const topPilotsData = [
  {
    id: "P001",
    name: "John Doe",
    rank: "Captain",
    flights: 87,
    hours: 226.2,
    avatar: "/placeholder.svg?height=40&width=40",
    lastFlight: "2023-03-15",
  },
  {
    id: "P002",
    name: "Jane Smith",
    rank: "First Officer",
    flights: 76,
    hours: 197.6,
    avatar: "/placeholder.svg?height=40&width=40",
    lastFlight: "2023-03-14",
  },
  {
    id: "P003",
    name: "Robert Wilson",
    rank: "Captain",
    flights: 72,
    hours: 187.2,
    avatar: "/placeholder.svg?height=40&width=40",
    lastFlight: "2023-03-12",
  },
  {
    id: "P004",
    name: "Emily Davis",
    rank: "First Officer",
    flights: 68,
    hours: 176.8,
    avatar: "/placeholder.svg?height=40&width=40",
    lastFlight: "2023-03-10",
  },
  {
    id: "P005",
    name: "Michael Johnson",
    rank: "Captain",
    flights: 65,
    hours: 169.0,
    avatar: "/placeholder.svg?height=40&width=40",
    lastFlight: "2023-03-08",
  },
];

// Mock data for recent activity
const recentActivityData = [
  {
    id: "ACT-1001",
    type: "PIREP",
    pilot: "John Doe",
    details: "Submitted PIREP for flight VA101 (KLAX-KSFO)",
    timestamp: "2023-03-15T18:30:00Z",
    status: "Pending",
  },
  {
    id: "ACT-1002",
    type: "Flight",
    pilot: "Jane Smith",
    details: "Completed flight VA202 (KSFO-KDEN)",
    timestamp: "2023-03-15T16:45:00Z",
    status: "Completed",
  },
  {
    id: "ACT-1003",
    type: "Application",
    pilot: "New Applicant",
    details: "Submitted application to join the airline",
    timestamp: "2023-03-15T14:20:00Z",
    status: "Pending",
  },
  {
    id: "ACT-1004",
    type: "PIREP",
    pilot: "Robert Wilson",
    details: "PIREP for flight VA303 (KDEN-KATL) approved",
    timestamp: "2023-03-15T12:10:00Z",
    status: "Approved",
  },
  {
    id: "ACT-1005",
    type: "Flight",
    pilot: "Emily Davis",
    details: "Started flight VA404 (KATL-KJFK)",
    timestamp: "2023-03-15T10:30:00Z",
    status: "In Progress",
  },
  {
    id: "ACT-1006",
    type: "PIREP",
    pilot: "Michael Johnson",
    details: "PIREP for flight VA505 (KJFK-KBOS) rejected",
    timestamp: "2023-03-15T08:15:00Z",
    status: "Rejected",
  },
];

export default function AdminDashboard() {
  const [timeRange, setTimeRange] = useState("month");

  // Format flight time
  const formatFlightTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  // Get status badge variant
  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "approved":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Approved
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="outline"
            className="bg-amber-50 text-amber-700 border-amber-200"
          >
            Pending
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-700 border-red-200"
          >
            Rejected
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-700 border-green-200"
          >
            Completed
          </Badge>
        );
      case "in progress":
        return (
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200"
          >
            In Progress
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get percentage change indicator
  const getPercentageIndicator = (value: number) => {
    if (value > 0) {
      return (
        <div className="flex items-center text-green-600">
          <ArrowUp className="mr-1 h-4 w-4" />
          <span>{value}%</span>
        </div>
      );
    } else if (value < 0) {
      return (
        <div className="flex items-center text-red-600">
          <ArrowDown className="mr-1 h-4 w-4" />
          <span>{Math.abs(value)}%</span>
        </div>
      );
    } else {
      return <span>0%</span>;
    }
  };

  return (
    <CrewHeader userName="Admin User" isAdmin={true}>
      <main className="flex-1 p-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h1 className="text-2xl font-bold">Dashboard</h1>

            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Last 24 Hours</SelectItem>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">Last 30 Days</SelectItem>
                  <SelectItem value="quarter">Last 3 Months</SelectItem>
                  <SelectItem value="year">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filter</span>
              </Button>

              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                <span>Export</span>
              </Button>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Pilots
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.totalPilots}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.activePilots} active this month
                  </p>
                  {getPercentageIndicator(dashboardStats.percentChangePilots)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Flights
                </CardTitle>
                <Plane className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.totalFlights}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.flightsThisMonth} flights this month
                  </p>
                  {getPercentageIndicator(dashboardStats.percentChangeFlights)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Hours
                </CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatFlightTime(dashboardStats.totalHours)}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {formatFlightTime(dashboardStats.hoursThisMonth)} this month
                  </p>
                  {getPercentageIndicator(dashboardStats.percentChangeHours)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Pending PIREPs
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboardStats.pendingPireps}
                </div>
                <p className="text-xs text-muted-foreground">Awaiting review</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="pilots">Pilots</TabsTrigger>
              <TabsTrigger value="aircraft">Aircraft</TabsTrigger>
              <TabsTrigger value="routes">Routes</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {/* Flight Activity Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Flight Activity</CardTitle>
                  <CardDescription>
                    Number of flights and hours over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] w-full">
                  <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-md">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <LineChart className="h-16 w-16" />
                      <span>Flight activity chart would appear here</span>
                      <span className="text-xs">
                        Showing data for {flightActivityData.length} months
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2">
                {/* Recent Activity */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>
                      Latest actions across the platform
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recentActivityData.slice(0, 5).map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-4"
                        >
                          <div className="rounded-full bg-primary/10 p-2">
                            {activity.type === "PIREP" && (
                              <FileText className="h-4 w-4 text-primary" />
                            )}
                            {activity.type === "Flight" && (
                              <Plane className="h-4 w-4 text-primary" />
                            )}
                            {activity.type === "Application" && (
                              <Users className="h-4 w-4 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {activity.pilot}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {new Date(
                                  activity.timestamp
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {activity.details}
                            </p>
                            <div>{getStatusBadge(activity.status)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      View All Activity
                    </Button>
                  </CardFooter>
                </Card>

                {/* Top Pilots */}
                <Card className="md:col-span-1">
                  <CardHeader>
                    <CardTitle>Top Pilots</CardTitle>
                    <CardDescription>
                      Most active pilots this month
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topPilotsData.slice(0, 5).map((pilot, index) => (
                        <div key={pilot.id} className="flex items-center gap-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-bold">
                              {index + 1}
                            </span>
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={pilot.avatar} alt={pilot.name} />
                            <AvatarFallback>
                              {pilot.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {pilot.name}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {pilot.flights} flights
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {pilot.rank}
                              </span>
                              <span className="text-xs font-medium">
                                {formatFlightTime(pilot.hours)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      View All Pilots
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="pilots" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Pilot Activity Distribution */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Pilot Activity Distribution</CardTitle>
                    <CardDescription>
                      Flight hours by pilot rank
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] w-full">
                    <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-md">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <BarChart3 className="h-16 w-16" />
                        <span>
                          Pilot activity distribution chart would appear here
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Pilot Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Pilot Statistics</CardTitle>
                    <CardDescription>Key pilot metrics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Active Pilots
                          </span>
                          <span className="text-sm font-medium">
                            {dashboardStats.activePilots} /{" "}
                            {dashboardStats.totalPilots}
                          </span>
                        </div>
                        <Progress
                          value={
                            (dashboardStats.activePilots /
                              dashboardStats.totalPilots) *
                            100
                          }
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Average Hours/Pilot
                          </span>
                          <span className="text-sm font-medium">
                            {formatFlightTime(
                              dashboardStats.totalHours /
                                dashboardStats.totalPilots
                            )}
                          </span>
                        </div>
                        <Progress value={70} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Average Flights/Pilot
                          </span>
                          <span className="text-sm font-medium">
                            {(
                              dashboardStats.totalFlights /
                              dashboardStats.totalPilots
                            ).toFixed(1)}
                          </span>
                        </div>
                        <Progress value={65} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            PIREP Approval Rate
                          </span>
                          <span className="text-sm font-medium">94%</span>
                        </div>
                        <Progress value={94} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Pilots Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Pilots</CardTitle>
                  <CardDescription>
                    Pilots with the most flight activity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Pilot</TableHead>
                        <TableHead>Flights</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Last Flight</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPilotsData.map((pilot, index) => (
                        <TableRow key={pilot.id}>
                          <TableCell className="font-medium">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={pilot.avatar}
                                  alt={pilot.name}
                                />
                                <AvatarFallback>
                                  {pilot.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{pilot.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {pilot.rank}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{pilot.flights}</TableCell>
                          <TableCell>{formatFlightTime(pilot.hours)}</TableCell>
                          <TableCell>{pilot.lastFlight}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/admin/pilots/${pilot.id}`}>View</a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    View All Pilots
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="aircraft" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Aircraft Usage Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Aircraft Usage</CardTitle>
                    <CardDescription>
                      Distribution of flights by aircraft type
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px] w-full">
                    <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-md">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <PieChart className="h-16 w-16" />
                        <span>Aircraft usage chart would appear here</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Aircraft Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Aircraft Statistics</CardTitle>
                    <CardDescription>
                      Usage metrics by aircraft type
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {aircraftUsageData.map((aircraft) => (
                        <div
                          key={aircraft.aircraft}
                          className="flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Plane className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {aircraft.aircraft}
                              </span>
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {aircraft.flights} flights
                            </span>
                          </div>
                          <Progress value={aircraft.percentage} />
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatFlightTime(aircraft.hours)}</span>
                            <span>{aircraft.percentage}% of total</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Aircraft Details Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Aircraft Fleet Details</CardTitle>
                  <CardDescription>
                    Performance metrics by aircraft type
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Aircraft</TableHead>
                        <TableHead>Flights</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Avg. Flight Time</TableHead>
                        <TableHead>Usage %</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {aircraftUsageData.map((aircraft) => (
                        <TableRow key={aircraft.aircraft}>
                          <TableCell className="font-medium">
                            {aircraft.aircraft}
                          </TableCell>
                          <TableCell>{aircraft.flights}</TableCell>
                          <TableCell>
                            {formatFlightTime(aircraft.hours)}
                          </TableCell>
                          <TableCell>
                            {formatFlightTime(
                              aircraft.hours / aircraft.flights
                            )}
                          </TableCell>
                          <TableCell>{aircraft.percentage}%</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/admin/aircraft/${aircraft.aircraft}`}>
                                View
                              </a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="routes" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Route Map */}
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Route Network</CardTitle>
                    <CardDescription>
                      Visual map of all active routes
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-[400px] w-full">
                    <div className="h-full w-full flex items-center justify-center bg-muted/20 rounded-md">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <MapPin className="h-16 w-16" />
                        <span>Route network map would appear here</span>
                        <span className="text-xs">
                          Showing connections between {topRoutesData.length * 2}{" "}
                          airports
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Top Routes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top Routes</CardTitle>
                    <CardDescription>
                      Most frequently flown routes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {topRoutesData.map((route, index) => (
                        <div
                          key={route.route}
                          className="flex items-center gap-4"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-sm font-bold">
                              {index + 1}
                            </span>
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {route.route}
                              </p>
                              <span className="text-xs text-muted-foreground">
                                {route.flights} flights
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {formatFlightTime(route.hours)}
                              </span>
                              <span className="text-xs font-medium">
                                {route.percentage}% of total
                              </span>
                            </div>
                            <Progress value={route.percentage * 2} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button variant="outline" className="w-full">
                      View All Routes
                    </Button>
                  </CardFooter>
                </Card>

                {/* Route Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Route Statistics</CardTitle>
                    <CardDescription>
                      Key metrics for route performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Average Route Distance
                          </span>
                          <span className="text-sm font-medium">685 nm</span>
                        </div>
                        <Progress value={68} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Average Flight Time
                          </span>
                          <span className="text-sm font-medium">
                            {formatFlightTime(dashboardStats.averageFlightTime)}
                          </span>
                        </div>
                        <Progress value={75} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Route Coverage
                          </span>
                          <span className="text-sm font-medium">78%</span>
                        </div>
                        <Progress value={78} />
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            On-Time Performance
                          </span>
                          <span className="text-sm font-medium">92%</span>
                        </div>
                        <Progress value={92} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Route Details Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Route Details</CardTitle>
                  <CardDescription>
                    Performance metrics by route
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Route</TableHead>
                        <TableHead>Flights</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Avg. Flight Time</TableHead>
                        <TableHead>Usage %</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topRoutesData.map((route) => (
                        <TableRow key={route.route}>
                          <TableCell className="font-medium">
                            {route.route}
                          </TableCell>
                          <TableCell>{route.flights}</TableCell>
                          <TableCell>{formatFlightTime(route.hours)}</TableCell>
                          <TableCell>
                            {formatFlightTime(route.hours / route.flights)}
                          </TableCell>
                          <TableCell>{route.percentage}%</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <a href={`/admin/routes/${route.route}`}>View</a>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">
                    View All Routes
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </CrewHeader>
  );
}
