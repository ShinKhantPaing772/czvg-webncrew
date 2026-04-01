"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Loader2, ArrowRight } from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { useSession } from "@/hooks/use-session";
import { formatFlightTimeHM } from "@/lib/utils/format-flight-time";

interface Route {
  id: number;
  fltnum: string;
  dep: string;
  arr: string;
  duration: string;
  notes: string;
  aircraft: {
    id: number | null;
    name: string | null;
    notes: string | null;
    status: string | null;
    rankreq: string | null;
    awardreq: string | null;
    ifliveryid: string | null;
    liveryname: string | null;
    ifaircraftid: string | null;
  }[];
  recentFlights: any[];
}

export default function ViewRoute() {
  const { user } = useSession();
  const params = useParams();
  const routeId = params.id as string;
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRouteData = async () => {
      try {
        const response = await fetch(`/api/routes/${routeId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch route data");
        }
        const data = await response.json();
        const formattedRoute = {
          ...data.data,
          duration: formatFlightTimeHM(data.data.duration),
        };
        if (data.success) {
          setRoute(formattedRoute);
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRouteData();
  }, [params.id]);

  if (loading) {
    return (
      <CrewHeader>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/crew/find-routes">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
          <Card>
            <CardContent className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin" />
            </CardContent>
          </Card>
        </main>
      </CrewHeader>
    );
  }

  if (!route) {
    return (
      <CrewHeader>
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
              <Link href="/crew/find-routes">
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
    <CrewHeader>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/crew/find-routes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">Flight {route.fltnum}</h1>
          <div className="flex items-end">
            <Button variant="link" className="px-4 py-2">
              <Link
                href={`/crew/file-pirep?flightnum=${route.fltnum}&departure=${route.dep}&arrival=${route.arr}`}
              >
                File Pirep
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <div className="text-sm font-medium text-muted-foreground">
                    Departure
                  </div>
                  <div className="text-2xl font-bold">{route.dep}</div>
                </div>

                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <div className="text-sm">{route.duration}</div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="flex flex-col items-center text-center md:items-end md:text-right">
                  <div className="text-sm font-medium text-muted-foreground">
                    Arrival
                  </div>
                  <div className="text-2xl font-bold">{route.arr}</div>
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
                      Flight Time
                    </div>
                    <div>{route.duration}</div>
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
              <CardTitle>Aircraft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 ">
                {route.aircraft.map((ac) => (
                  <div key={ac.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{ac.name}</div>
                      <Badge variant="outline">
                        {ac.liveryname}
                        {ac.notes && " - " + ac.notes}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          {route.recentFlights.length !== 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Recent Flights</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 grid-cols-1 ">
                  {route.recentFlights.map((flight) => (
                    <div key={flight.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">
                            {flight.pilot} ({flight.pilotCallsign})
                          </Badge>
                          <div className="flex gap-3">
                            <Badge variant="outline">
                              {formatFlightTimeHM(flight.flightTime)}
                            </Badge>
                            <Badge variant="outline">
                              {new Date(flight.date).toLocaleDateString()}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </CrewHeader>
  );
}
