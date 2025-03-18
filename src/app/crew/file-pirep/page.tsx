"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import {
  CalendarIcon,
  ChevronDown,
  Loader2,
  PlaneIcon,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CrewHeader } from "@/components/crew-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// Mock data - in a real app, this would come from an API
const userData = {
  name: "John Doe",
  email: "john.doe@example.com",
  avatar: "",
  rank: "Captain",
  flightTime: 256.5, // hours
  pirepsFiled: 42,
  joinDate: "January 15, 2023",
};

// Mock aircraft data - in a real app, this would come from an API
const aircraftData = [
  { id: "1", registration: "N12345", type: "B738", name: "Boeing 737-800" },
  { id: "2", registration: "N54321", type: "A320", name: "Airbus A320" },
  { id: "3", registration: "N78901", type: "B77W", name: "Boeing 777-300ER" },
  { id: "4", registration: "N45678", type: "A359", name: "Airbus A350-900" },
  { id: "5", registration: "N98765", type: "E190", name: "Embraer E190" },
];

// Form schema with validation
const formSchema = z.object({
  flightNumber: z.string().min(2, {
    message: "Flight number must be at least 2 characters.",
  }),
  departureIcao: z.string().length(4, {
    message: "Departure ICAO must be exactly 4 characters.",
  }),
  arrivalIcao: z.string().length(4, {
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
  multiplier: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function FilePirep() {
  const [date, setDate] = useState<Date>();
  const userName = "John Doe"; // This should be replaced with actual user data
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAcars, setIsFetchingAcars] = useState(false);

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      flightNumber: "",
      departureIcao: "",
      arrivalIcao: "",
      flightTime: "",
      date: new Date(), // Default to today
      aircraftId: "",
      fuelUsed: "",
      multiplier: "",
    },
  });

  // Handle form submission
  async function onSubmit(data: FormValues) {
    setIsLoading(true);

    try {
      // In a real app, you would send this data to your API
      console.log("Form data:", data);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Optionally reset form after successful submission
      // form.reset()
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
      // In a real app, you would fetch data from your ACARS API
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Mock ACARS data
      const acarsData = {
        flightNumber: "VA143",
        departureIcao: "KLAX",
        arrivalIcao: "KSFO",
        flightTime: "1:15",
        date: new Date(),
        aircraftId: "1", // ID of B738
        fuelUsed: "2450.5",
        multiplier: "1.5",
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
    <CrewHeader userName={userName}>
      <Card className="max-w-2xl mx-auto mt-4 z-0 overflow-visible">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Submit PIREP</CardTitle>
              <CardDescription>
                File a Pilot Report for your completed flight
              </CardDescription>
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
                  name="flightNumber"
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
                  name="departureIcao"
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
                  name="arrivalIcao"
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
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select aircraft" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-white">
                          {aircraftData.map((aircraft) => (
                            <SelectItem key={aircraft.id} value={aircraft.id}>
                              {aircraft.type} - {aircraft.registration}
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
                  name="multiplier"
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
