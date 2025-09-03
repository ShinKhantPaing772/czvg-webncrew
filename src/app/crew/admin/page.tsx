"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Plane,
  FileText,
  Clock,
  ArrowUp,
  ArrowDown,
  CalendarIcon,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DayPicker } from "react-day-picker";
import { cn } from "@/lib/utils";

export default function AdminDashboard() {
  const [selected, setSelected] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [date, setDate] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date(),
  });
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalPilots: 0,
    totalFlights: 0,
    pendingPireps: 0,
    totalHours: 0,
  });
  const [filteredStats, setFilteredStats] = useState({
    pilotsInRange: 0,
    pirepsInRange: 0,
    flightHours: 0,
  });

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);

        const response = await fetch(`/api/admin/dashboard/`);
        if (!response.ok) {
          throw new Error("Failed to fetch dashboard statistics");
        }
        const data = await response.json();
        if (data.success) {
          setDashboardStats(data.data);
        }
      } catch (error) {
        console.error("Error fetching dashboard statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // Fetch filtered dashboard statistics based on date range
  useEffect(() => {
    const fetchFilteredStats = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (date.from) {
          params.append("startDate", format(date.from, "yyyy-MM-dd"));
        }
        if (date.to) {
          params.append("endDate", format(date.to, "yyyy-MM-dd"));
        }

        const response = await fetch(`/api/admin/dashboard/filter?${params}`);
        if (!response.ok) {
          throw new Error("Failed to fetch filtered statistics");
        }
        const data = await response.json();
        if (data.success) {
          setFilteredStats(data.data);
        }
      } catch (error) {
        console.error("Error fetching filtered statistics:", error);
      } finally {
        setLoading(false);
      }
    };

    if (date.from && date.to) {
      fetchFilteredStats();
    }
  }, [date]);
  // Format flight time
  const formatFlightTime = (hours: number) => {
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
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
      {loading && (
        <div className="flex items-center justify-center min-h-screen">
          Loading...
        </div>
      )}
      {!loading && (
        <main className="flex-1 ">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <h1 className="text-2xl font-bold">Dashboard</h1>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-[300px] justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date?.from ? (
                        date.to ? (
                          <>
                            {format(date.from, "LLL dd, y")} -{" "}
                            {format(date.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(date.from, "LLL dd, y")
                        )
                      ) : (
                        <span>Pick a date range</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-5 bg-white" align="start">
                    <div className="flex flex-col gap-4">
                      <DayPicker
                        mode="range"
                        today={new Date()}
                        disabled={{ after: new Date() }}
                        selected={selected}
                        onSelect={(range) => {
                          if (range) {
                            setSelected({ from: range.from, to: range.to });
                          } else {
                            setSelected({ from: undefined, to: undefined });
                          }
                        }}
                        numberOfMonths={2}
                        classNames={{
                          caption: "text-blue-800",
                        }}
                      />
                      <div className="flex items-center justify-between w-full">
                        <div className="text-sm text-muted-foreground">
                          {selected.from && selected.to ? (
                            <>
                              {"Date Selected : "}
                              {format(selected.from, "LLL dd, y")} -{" "}
                              {format(selected.to, "LLL dd, y")}
                            </>
                          ) : (
                            "Select a date range"
                          )}
                        </div>
                        <Button onClick={() => setDate(selected)}>
                          <Check className="h-4 w-4" />
                          Apply
                        </Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pilots</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">
                    <p className="font-bold">{filteredStats.pilotsInRange}</p>
                    <p className="text-xs text-muted-foreground">
                      new pilots between{" "}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {date.from ? format(date.from, "LLL dd, y") : ""} -{" "}
                      {date.to ? format(date.to, "LLL dd, y") : ""}{" "}
                    </p>
                  </div>
                  <br></br>
                  <p className="text-xs text-muted-foreground">
                    Total <b>{dashboardStats.totalPilots}</b> pilots
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">PIREPs</CardTitle>
                  <Plane className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl">
                    <p className="font-bold">{filteredStats.pirepsInRange}</p>
                    <p className="text-xs text-muted-foreground">
                      new PIREPs between{" "}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {date.from ? format(date.from, "LLL dd, y") : ""} -{" "}
                      {date.to ? format(date.to, "LLL dd, y") : ""}{" "}
                    </p>
                  </div>
                  <br></br>
                  <p className="text-xs text-muted-foreground">
                    Total <b>{dashboardStats.totalFlights}</b> PIREPs
                  </p>
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
                  <div className="text-2xl">
                    <p className="font-bold">
                      {formatFlightTime(filteredStats.flightHours)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      total flight hours between{" "}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {date.from ? format(date.from, "LLL dd, y") : ""} -{" "}
                      {date.to ? format(date.to, "LLL dd, y") : ""}{" "}
                    </p>
                  </div>
                  <br></br>
                  <p className="text-xs text-muted-foreground">
                    Total <b>{formatFlightTime(dashboardStats.totalHours)}</b>{" "}
                  </p>
                  <div className="text-2xl font-bold"></div>{" "}
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
                  <p className="text-xs text-muted-foreground">
                    Awaiting review
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      )}
    </CrewHeader>
  );
}
