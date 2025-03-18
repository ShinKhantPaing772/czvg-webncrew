"use client"

import { useState } from "react"
import { Award, Clock, FileText, Plane, UserIcon, ChevronDown, Calendar, MapPin, Timer } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

// Mock data - in a real app, this would come from an API
const userData = {
  name: "John Doe",
  email: "john.doe@example.com",
  avatar: "/placeholder.svg?height=80&width=80",
  rank: "Captain",
  flightTime: 256.5, // hours
  pirepsFiled: 42,
  joinDate: "January 15, 2023",
}

const recentFlights = [
  {
    id: "FL-1234",
    date: "2023-03-15",
    departure: "KLAX",
    arrival: "KSFO",
    aircraft: "B738",
    duration: "1:15",
    status: "Approved",
  },
  {
    id: "FL-1235",
    date: "2023-03-10",
    departure: "KSFO",
    arrival: "KDEN",
    aircraft: "A320",
    duration: "2:30",
    status: "Approved",
  },
  {
    id: "FL-1236",
    date: "2023-03-05",
    departure: "KDEN",
    arrival: "KATL",
    aircraft: "B738",
    duration: "2:45",
    status: "Approved",
  },
  {
    id: "FL-1237",
    date: "2023-03-01",
    departure: "KATL",
    arrival: "KJFK",
    aircraft: "B738",
    duration: "2:10",
    status: "Approved",
  },
  {
    id: "FL-1238",
    date: "2023-02-25",
    departure: "KJFK",
    arrival: "KBOS",
    aircraft: "CRJ7",
    duration: "1:05",
    status: "Approved",
  },
]

export default function UserDashboard() {
  const [activeTab, setActiveTab] = useState("overview")

  const formatFlightTime = (hours: number) => {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    return `${wholeHours}h ${minutes}m`
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <div className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <h1 className="text-xl font-semibold">Crew Center</h1>
          <div className="ml-auto flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={userData.avatar} alt={userData.name} />
                    <AvatarFallback>{userData.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline-flex">{userData.name}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem>Settings</DropdownMenuItem>
                <DropdownMenuItem>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Flight Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatFlightTime(userData.flightTime)}</div>
                <p className="text-xs text-muted-foreground">Across all flights</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">PIREPs Filed</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userData.pirepsFiled}</div>
                <p className="text-xs text-muted-foreground">Total reports submitted</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Current Rank</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userData.rank}</div>
                <p className="text-xs text-muted-foreground">Based on flight hours</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Member Since</CardTitle>
                <UserIcon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{userData.joinDate}</div>
                <p className="text-xs text-muted-foreground">Active crew member</p>
              </CardContent>
            </Card>
          </div>
          <Tabs defaultValue="overview" className="space-y-4" onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="flights">Recent Flights</TabsTrigger>
              <TabsTrigger value="stats">Detailed Stats</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Pilot Profile</CardTitle>
                  <CardDescription>View your pilot information and recent activity</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={userData.avatar} alt={userData.name} />
                      <AvatarFallback>{userData.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-1">
                      <h3 className="font-semibold">{userData.name}</h3>
                      <p className="text-sm text-muted-foreground">{userData.email}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{userData.rank}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Flights</CardTitle>
                  <CardDescription>Your last 5 completed flights</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Flight</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Aircraft</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentFlights.map((flight) => (
                        <TableRow key={flight.id}>
                          <TableCell className="font-medium">{flight.id}</TableCell>
                          <TableCell>{flight.date}</TableCell>
                          <TableCell>
                            {flight.departure} → {flight.arrival}
                          </TableCell>
                          <TableCell>{flight.aircraft}</TableCell>
                          <TableCell>{flight.duration}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {flight.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="flights" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Flight History</CardTitle>
                  <CardDescription>Complete record of your flights</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentFlights.map((flight) => (
                      <div key={flight.id} className="flex flex-col gap-2 rounded-lg border p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Plane className="h-5 w-5 text-primary" />
                            <span className="font-semibold">{flight.id}</span>
                          </div>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {flight.status}
                          </Badge>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{flight.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">
                              {flight.departure} → {flight.arrival}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Timer className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{flight.duration}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="stats" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Flight Statistics</CardTitle>
                  <CardDescription>Detailed breakdown of your flight activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">Total Flights</span>
                      <span className="text-2xl font-bold">{userData.pirepsFiled}</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">Average Flight Time</span>
                      <span className="text-2xl font-bold">
                        {formatFlightTime(userData.flightTime / userData.pirepsFiled)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">Most Flown Aircraft</span>
                      <span className="text-2xl font-bold">B738</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">Most Visited Airport</span>
                      <span className="text-2xl font-bold">KLAX</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">Longest Flight</span>
                      <span className="text-2xl font-bold">4h 15m</span>
                    </div>
                    <div className="flex flex-col gap-1 rounded-lg border p-4">
                      <span className="text-sm font-medium text-muted-foreground">Total Distance</span>
                      <span className="text-2xl font-bold">24,568 nm</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  )
}

