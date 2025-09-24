"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, PlaneIcon, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrewHeader } from "@/components/crew-header";

interface aircraft {
  id: string;
  name: string;
  liveryname: string;
  ifaircraftid: string;
  ifliveryid: string;
  notes: string;
}
import { useSession } from "@/hooks/use-session";

// Form schema with validation
const formSchema = z.object({
  flightnum: z.string().min(2, {
    message: "Flight number must be at least 2 characters.",
  }),
  departure: z.string().length(4, {
    message: "Departure ICAO must be exactly 4 characters.",
  }),
  arrival: z.string().length(4, {
    message: "Arrival ICAO must be exactly 4 characters.",
  }),
  flightTime: z.string().regex(/^\d+:\d{2}$/, {
    message: "Flight time must be in format HH:MM.",
  }),
  date: z.date({
    required_error: "Please select a date.",
  }),
  aircraftId: z.string({
    required_error: "Please select an aircraft.",
  }),
  fuelUsed: z.string().regex(/^\d+(\.\d+)?$/, {
    message: "Fuel used must be a number.",
  }),
  multi: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function FilePirep() {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAcars, setIsFetchingAcars] = useState(false);
  // State for aircraft data
  const [originalAircraftData, setOriginalAircraftData] = useState<aircraft[]>(
    []
  );
  const [filteredAircraftData, setFilteredAircraftData] = useState<aircraft[]>(
    []
  );
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(false);

  // Fetch aircraft data from API
  useEffect(() => {
    const fetchAircraft = async () => {
      setIsLoadingAircraft(true);
      try {
        const response = await fetch("/api/aircraft");

        if (!response.ok) {
          throw new Error("Failed to fetch aircraft data");
        }
        const data = await response.json();
        setOriginalAircraftData(data.aircrafts);
        setFilteredAircraftData(data.aircrafts);
      } catch (error) {
        console.error("Error fetching aircraft:", error);
      } finally {
        setIsLoadingAircraft(false);
      }
    };

    fetchAircraft();
  }, []);

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });

  // Handle form submission
  async function onSubmit(data: FormValues) {
    setIsLoading(true);

    try {
      const response = await fetch("/api/pireps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          pilotid: user?.id, // pass user id directly
          pilotname: user?.name,
          pilotcallsign: user?.callsign,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit PIREP");
      }

      form.reset();
      window.location.href = "/crew/view-pireps";
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  // Function to fetch ACARS data
  async function fetchAcarsData() {
    setIsFetchingAcars(true);

    try {
      // TODO: Implement ACARS data fetching
      const acarsData = {
        flightnum: "",
        departure: "",
        arrival: "",
        flightTime: "",
        date: new Date(),
        aircraftId: "",
        fuelUsed: "",
        multi: "",
      };

      // Update form with fetched data
      form.reset(acarsData);
    } catch (error) {
      console.error(error);
    } finally {
      setIsFetchingAcars(false);
    }
  }

  return (
    <CrewHeader>
      <Card className="max-w-2xl mx-auto mt-4 z-0 overflow-visible">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Submit PIREP</CardTitle>
            </div>
            <Button
              variant="outline"
              onClick={fetchAcarsData}
              disabled={isFetchingAcars}
              className="flex items-center gap-2"
            >
              {isFetchingAcars ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Fetch ACARS
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="flightnum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flight Number</FormLabel>
                      <FormControl>
                        <Input placeholder="VA123" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flight Date</FormLabel>
                      <Popover>
                        <PopoverTrigger className="text-left">
                          <Input
                            placeholder={
                              field.value
                                ? format(field.value, "PPP")
                                : "Pick a date"
                            }
                          />
                        </PopoverTrigger>
                        <PopoverContent className="bg-white">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="departure"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departure ICAO</FormLabel>
                      <FormControl>
                        <Input placeholder="KLAX" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="arrival"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Arrival ICAO</FormLabel>
                      <FormControl>
                        <Input placeholder="KSFO" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="flightTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Flight Time</FormLabel>
                      <FormControl>
                        <Input placeholder="1:30" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="aircraftId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Aircraft</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <div className="flex space-x-2">
                            <SelectTrigger>
                              <SelectValue
                                placeholder={
                                  originalAircraftData.find(
                                    (aircraft: { id: string }) =>
                                      aircraft.id === field.value
                                  )?.name || "Select aircraft.."
                                }
                              />
                            </SelectTrigger>

                            <Input
                              placeholder="Search aircraft..."
                              className="mb-2"
                              onChange={(e) => {
                                const searchTerm = e.target.value.toLowerCase();
                                const filtered = originalAircraftData.filter(
                                  (aircraft) =>
                                    aircraft.name
                                      .toLowerCase()
                                      .includes(searchTerm) ||
                                    aircraft.liveryname
                                      .toLowerCase()
                                      .includes(searchTerm)
                                );
                                setFilteredAircraftData(filtered);
                              }}
                            />
                          </div>
                        </FormControl>
                        <SelectContent className="bg-white max-h-[200px] overflow-y-auto">
                          {isLoadingAircraft && (
                            <div className="flex items-center justify-center h-10">
                              <Loader2 className="h-4 w-4 animate-spin" />
                            </div>
                          )}
                          {filteredAircraftData.map((aircraft) => (
                            <SelectItem
                              key={aircraft.id}
                              value={"" + aircraft.id}
                            >
                              {aircraft.name} - {aircraft.liveryname}
                              {aircraft.notes && (
                                <span className="text-xs text-muted-foreground block">
                                  Notes: {aircraft.notes}
                                </span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fuelUsed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fuel Used (KG)</FormLabel>
                      <FormControl>
                        <Input placeholder="1200.5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="multi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Multiplier (if available)</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <PlaneIcon className="mr-2 h-4 w-4" />
                      Submit PIREP
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="flex flex-col text-sm text-muted-foreground">
          <p>All flight times are recorded in hours:minutes format.</p>
          <p>ACARS data will automatically populate this form if available.</p>
        </CardFooter>
      </Card>
    </CrewHeader>
  );
}
