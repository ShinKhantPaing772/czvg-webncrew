"use client";

import { Award, Clock, FileText, UserIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
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
import { CrewHeader } from "@/components/crew-header";

import { formatFlightTime } from "@/lib/utils/format-flight-time";
import { useSession } from "@/hooks/use-session";
import { useEffect, useState } from "react";

interface Pirep {
  id: string;
  date: string;
  departure: string;
  arrival: string;
  aircraft: string;
  duration: string;
  status: string;
}

export default function UserDashboard() {
  const { user, loading, error } = useSession();
  // Get recent flights from user's PIREPs
  // Query pireps separately since they're not included in user data
  const [pireps, setPireps] = useState<Pirep[]>([]);

  useEffect(() => {
    const fetchPireps = async () => {
      try {
        // TODO: Replace with actual API endpoint
        const response = await fetch(`/api/pilots/${user?.id}/pireps`);
        const data = await response.json();

        const recentPireps = data.pireps
          .slice(0, 5)
          .map(
            (pirep: {
              flightnum: any;
              date: string | number | Date;
              departure: any;
              arrival: any;
              Aircraft: { name: any; liveryname: any };
              aircraftid: any;
              flighttime: any;
              status: string;
            }) => ({
              id: pirep.flightnum,
              date: new Date(pirep.date).toISOString().split("T")[0],
              departure: pirep.departure,
              arrival: pirep.arrival,
              aircraft:
                pirep.Aircraft?.name + " (" + pirep.Aircraft.liveryname + ")" ||
                pirep.aircraftid ||
                "N/A",
              duration: formatFlightTime(pirep.flighttime),
              status: pirep.status,
            })
          );

        setPireps(recentPireps);
      } catch (error) {
        console.error("Failed to fetch PIREPs:", error);
        setPireps([]);
      }
    };

    if (user?.id) {
      fetchPireps();
    }
  }, [user?.id]);

  const recentFlights = pireps;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading...
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Error: {error || "User not found"}
      </div>
    );
  }

  const userData = user;

  return (
    <CrewHeader userName={userData.name}>
      <main className="flex flex-1 flex-col gap-4 md:gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Pilot Profile</CardTitle>
            <CardDescription>
              View your pilot information and recent activity
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={userData.avatar} alt={userData.name} />
                <AvatarFallback>{userData.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="grid gap-1">
                <h3 className="font-semibold">{userData.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {userData.email}
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{userData.rank}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Total Flight Time
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatFlightTime(userData.flightTime)}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all flights
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                PIREPs Filed
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userData.pirepsFiled}</div>
              <p className="text-xs text-muted-foreground">
                Total reports submitted
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Current Rank
              </CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{userData.rank}</div>
              <p className="text-xs text-muted-foreground">
                Based on flight hours
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                Member Since
              </CardTitle>
              <UserIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Date(userData.joined).toLocaleDateString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Active crew member
              </p>
            </CardContent>
          </Card>
        </div>
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
                  <TableRow key={flight?.id}>
                    <TableCell className="font-medium">{flight?.id}</TableCell>
                    <TableCell>{flight?.date}</TableCell>
                    <TableCell>
                      {flight?.departure} → {flight?.arrival}
                    </TableCell>
                    <TableCell>{flight.aircraft}</TableCell>
                    <TableCell>{flight.duration}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          parseInt(flight.status) === 0
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : parseInt(flight.status) === 1
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-red-50 text-red-700 border-red-200"
                        }
                      >
                        {parseInt(flight.status) === 0
                          ? "Pending"
                          : parseInt(flight.status) === 1
                          ? "Accepted"
                          : "Rejected"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </CrewHeader>
  );
}
