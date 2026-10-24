"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  PlaneIcon,
  RefreshCw,
  ArrowRight,
  Calendar as CalendarIcon,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/lib/utils/api";
import { AirlineLogo } from "@/components/airline-logo";
import { useSession } from "@/hooks/use-session";

interface aircraft {
  id: string;
  name: string;
  liveryname: string | null;
  ifaircraftid: string | null;
  ifliveryid: string | null;
  notes: string | null;
  rankreq: number | null;
  awardreq: number | null;
}
type PilotEligibility = {
  rank?: { eligibleRankIds?: number[] };
  awards?: { ownedAwardIds?: number[] };
};

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
  flightTime: z.string().regex(/^\d+:[0-5]\d$/, {
    message: "Flight time must be in format HH:MM.",
  }),
  date: z.string({
    required_error: "Please select a date.",
  }),
  aircraftId: z.string({
    required_error: "Please select an aircraft.",
  }),
  fuelUsed: z.string().regex(/^\d+(\.\d+)?$/, {
    message: "Fuel used must be a number.",
  }),
  multi: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type AcarsResponse = {
  acars?: Partial<FormValues>;
  meta?: {
    source?: "active" | "recent";
    flightId?: string;
    aircraftMatched?: boolean;
    flightTimeEstimated?: boolean;
    fuelPending?: boolean;
  };
  error?: string;
};

const acarsFieldLabels: Record<keyof FormValues, string> = {
  flightnum: "Flight number",
  departure: "Departure",
  arrival: "Arrival",
  flightTime: "Flight time",
  date: "Date",
  aircraftId: "Aircraft",
  fuelUsed: "Fuel used",
  multi: "Multiplier",
  notes: "Notes",
};

export default function FilePirep() {
  const { user } = useSession();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingAcars, setIsFetchingAcars] = useState(false);
  const [acarsMessage, setAcarsMessage] = useState<string | null>(null);
  const [acarsFilledFields, setAcarsFilledFields] = useState<
    Array<keyof FormValues>
  >([]);
  const [acarsMissingFields, setAcarsMissingFields] = useState<
    Array<keyof FormValues>
  >([]);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [originalAircraftData, setOriginalAircraftData] = useState<aircraft[]>(
    [],
  );
  const [filteredAircraftData, setFilteredAircraftData] = useState<aircraft[]>(
    [],
  );
  const [isLoadingAircraft, setIsLoadingAircraft] = useState(true);
  const [aircraftLoadError, setAircraftLoadError] = useState<string | null>(
    null,
  );
  const searchParams = useSearchParams();

  const initialValues = {
    flightnum: searchParams.get("flightnum") || "",
    departure: searchParams.get("departure") || "",
    arrival: searchParams.get("arrival") || "",
    flightTime: searchParams.get("flightTime") || "",
    date: searchParams.get("date")
      ? format(new Date(searchParams.get("date")!), "yyyy-MM-dd")
      : format(new Date(), "yyyy-MM-dd"),
    aircraftId: searchParams.get("aircraftId") || "",
    fuelUsed: searchParams.get("fuelUsed") || "",
    multi: searchParams.get("multi") || "",
    notes: "",
  };

  useEffect(() => {
    const fetchAircraft = async () => {
      if (!user?.id) return;
      setIsLoadingAircraft(true);
      setAircraftLoadError(null);
      try {
        const [response, eligibilityResponse] = await Promise.all([
          authFetch("/api/aircraft"),
          authFetch(`/api/pilots/${user.id}/dashboard`),
        ]);

        if (!response.ok) {
          throw new Error("Failed to fetch aircraft data");
        }
        if (!eligibilityResponse.ok) {
          throw new Error("Failed to fetch aircraft eligibility");
        }
        const data = await response.json();
        const eligibility: PilotEligibility = await eligibilityResponse.json();
        const eligibleRankIds = eligibility.rank?.eligibleRankIds || [];
        const ownedAwardIds = eligibility.awards?.ownedAwardIds || [];
        const eligibleAircraft = (data.aircrafts || [])
          .map((item: aircraft) => ({ ...item, id: String(item.id) }))
          .filter((item: aircraft) => {
            const rankRequirement = Number(item.rankreq) || null;
            const awardRequirement = Number(item.awardreq) || null;
            if (!rankRequirement && !awardRequirement) return false;
            return Boolean(
              (rankRequirement && eligibleRankIds.includes(rankRequirement)) ||
                (awardRequirement && ownedAwardIds.includes(awardRequirement)),
            );
          });
        setOriginalAircraftData(eligibleAircraft);
        setFilteredAircraftData(eligibleAircraft);
      } catch (error) {
        console.error("Error fetching aircraft:", error);
        const message =
          error instanceof Error ? error.message : "Failed to load aircraft";
        setAircraftLoadError(message);
        setSubmitMessage(message);
      } finally {
        setIsLoadingAircraft(false);
      }
    };

    fetchAircraft();
  }, [user?.id]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialValues,
  });

  const watchedValues = form.watch();
  const selectedAircraft = originalAircraftData.find(
    (item) => item.id === watchedValues.aircraftId,
  );

  useEffect(() => {
    if (isLoadingAircraft) return;
    const selectedId = form.getValues("aircraftId");
    if (
      selectedId &&
      !originalAircraftData.some((aircraft) => aircraft.id === selectedId)
    ) {
      form.setValue("aircraftId", "", { shouldValidate: false });
    }
  }, [form, isLoadingAircraft, originalAircraftData]);

  async function onSubmit(data: FormValues) {
    setIsLoading(true);
    setSubmitMessage(null);

    if (!user?.id) {
      setIsLoading(false);
      setSubmitMessage("User not authenticated.");
      return;
    }

    try {
      const response = await authFetch("/api/pireps", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...data,
          pilotid: user?.id,
          pilotname: user?.name,
          pilotcallsign: user?.callsign,
        }),
      });
      if (!response.ok) {
        const responseData = await response.json().catch(() => null);
        throw new Error(responseData?.error || "Failed to submit PIREP");
      }

      form.reset();
      router.push("/crew/view-pireps");
    } catch (error) {
      console.error(error);
      setSubmitMessage(
        error instanceof Error ? error.message : "Failed to submit PIREP",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchAcarsData() {
    if (!user?.id) {
      setAcarsMessage("Please sign in before fetching ACARS data.");
      return;
    }
    if (isLoadingAircraft) {
      setAcarsMessage(
        "Please wait for the available aircraft list to finish loading.",
      );
      return;
    }
    if (aircraftLoadError) {
      setAcarsMessage(
        "The available aircraft list could not be loaded. Refresh the page before importing ACARS.",
      );
      return;
    }

    setIsFetchingAcars(true);
    setAcarsMessage(null);
    setAcarsFilledFields([]);
    setAcarsMissingFields([]);

    try {
      const params = new URLSearchParams({ pilotId: String(user.id) });
      const savedFlightId = window.sessionStorage.getItem(
        "acars:last-flight-id",
      );
      if (savedFlightId) params.set("flightId", savedFlightId);

      let response = await authFetch(`/api/acars/current-flight?${params}`);
      let data: AcarsResponse = await response.json();

      if (!response.ok && response.status === 404 && savedFlightId) {
        window.sessionStorage.removeItem("acars:last-flight-id");
        params.delete("flightId");
        response = await authFetch(`/api/acars/current-flight?${params}`);
        data = await response.json();
      }

      if (!response.ok || !data.acars) {
        throw new Error(data.error || "Failed to fetch ACARS data");
      }
      if (data.meta?.flightId) {
        window.sessionStorage.setItem(
          "acars:last-flight-id",
          data.meta.flightId,
        );
      }

      const acarsValues = Object.fromEntries(
        Object.entries(data.acars).filter(([, value]) => value),
      ) as Partial<FormValues>;
      if (
        acarsValues.aircraftId &&
        !originalAircraftData.some(
          (aircraft) => aircraft.id === acarsValues.aircraftId,
        )
      ) {
        delete acarsValues.aircraftId;
      }
      const filledFields = Object.keys(acarsValues) as Array<keyof FormValues>;
      const expectedFields: Array<keyof FormValues> = [
        "flightnum",
        "departure",
        "arrival",
        "flightTime",
        "date",
        "aircraftId",
        "fuelUsed",
      ];
      const missingFields = expectedFields.filter(
        (fieldName) => !filledFields.includes(fieldName),
      );

      form.reset({
        ...form.getValues(),
        ...acarsValues,
      });
      setAcarsFilledFields(filledFields);
      setAcarsMissingFields(missingFields);

      const acarsMessages = [
        data.meta?.source === "recent"
          ? "ACARS data loaded from your most recent Infinite Flight flight."
          : "ACARS data loaded from your current Infinite Flight flight.",
      ];
      if (data.meta?.flightTimeEstimated) {
        acarsMessages.push(
          "Flight time is currently estimated from the flight start time.",
        );
      }
      if (data.meta?.fuelPending) {
        acarsMessages.push(
          "Infinite Flight has not finalized fuel used yet; import again after it finalizes the logbook entry.",
        );
      }
      setAcarsMessage(acarsMessages.join(" "));
    } catch (error) {
      console.error(error);
      setAcarsMessage(
        error instanceof Error ? error.message : "Failed to fetch ACARS data",
      );
    } finally {
      setIsFetchingAcars(false);
    }
  }

  function fieldClass(fieldName: keyof FormValues, baseClassName = "") {
    return [
      baseClassName,
      acarsFilledFields.includes(fieldName)
        ? "border-emerald-500/40 bg-emerald-500/5"
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <CrewHeader>
      <div className="space-y-5 pb-24 md:pb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">File PIREP</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit a flight report manually or import active telemetry from
              Infinite Flight ACARS.
            </p>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={fetchAcarsData}
            disabled={
              isFetchingAcars ||
              isLoadingAircraft ||
              Boolean(aircraftLoadError)
            }
          >
            {isFetchingAcars || isLoadingAircraft ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 size-3.5" />
            )}
            {isLoadingAircraft
              ? "Loading aircraft"
              : aircraftLoadError
                ? "Aircraft unavailable"
                : "Import ACARS"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-4">
          <SummaryCard
            icon={PlaneIcon}
            label="Selected sector"
            value={
              watchedValues.departure || watchedValues.arrival
                ? `${(watchedValues.departure || "----").toUpperCase()} → ${(watchedValues.arrival || "----").toUpperCase()}`
                : "Not set"
            }
          />
          <SummaryCard
            icon={Clock}
            label="Block time"
            value={watchedValues.flightTime || "00:00"}
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Unlocked fleet"
            value={isLoadingAircraft ? "—" : originalAircraftData.length}
          />
        </div>

        <div className="grid gap-4 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3.5 md:grid-cols-[1fr_1.3fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AirlineLogo
                flightnum={watchedValues.flightnum}
                liveryname={selectedAircraft?.liveryname}
                className="h-4 w-auto max-w-[54px] shrink-0 object-contain"
              />
              <span className="font-mono text-lg font-semibold">
                {watchedValues.flightnum || "CSN----"}
              </span>
              {acarsFilledFields.length > 0 && (
                <Badge variant="default">ACARS linked</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedAircraft
                ? `${selectedAircraft.name}${selectedAircraft.liveryname ? ` · ${selectedAircraft.liveryname}` : ""}`
                : "Select an unlocked aircraft below"}
            </p>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <span className="font-mono text-base">
                {(watchedValues.departure || "----").toUpperCase()}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-base">
                {(watchedValues.arrival || "----").toUpperCase()}
              </span>
              {watchedValues.flightTime && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({watchedValues.flightTime})
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Flight date: {watchedValues.date || "Not selected"}
              {watchedValues.fuelUsed
                ? ` · Fuel: ${watchedValues.fuelUsed} kg`
                : ""}
            </p>
          </div>

          <div className="flex flex-col justify-between gap-2 md:items-end">
            <div className="text-xs text-muted-foreground md:text-right">
              {user?.name ? `${user.name} (${user.callsign})` : "Active pilot"}
              {watchedValues.multi ? ` · Multiplier ${watchedValues.multi}` : ""}
            </div>
          </div>
        </div>

        <div>
          {acarsMessage && (
            <div
              className={
                acarsFilledFields.length > 0
                  ? "mb-5 rounded-[6px] bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200"
                  : "mb-5 rounded-[6px] bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
              }
            >
              <div className="flex items-start gap-2.5">
                {acarsFilledFields.length > 0 ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div className="space-y-1">
                  <p className="font-medium">{acarsMessage}</p>
                  {acarsFilledFields.length > 0 && (
                    <p className="text-xs opacity-80">
                      Filled:{" "}
                      {acarsFilledFields
                        .map((fieldName) => acarsFieldLabels[fieldName])
                        .join(", ")}
                    </p>
                  )}
                  {acarsMissingFields.length > 0 && (
                    <p className="text-xs opacity-80">
                      Still needed:{" "}
                      {acarsMissingFields
                        .map((fieldName) => acarsFieldLabels[fieldName])
                        .join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {submitMessage && (
            <div className="mb-5 rounded-[6px] bg-red-500/10 px-4 py-3 text-sm text-red-700">
              {submitMessage}
            </div>
          )}

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <div className="grid gap-5 lg:grid-cols-2">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Sector & Telemetry
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 gap-4 p-4 pt-2 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="flightnum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Flight Number (Not Callsign)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="CZ3101"
                              className={fieldClass(
                                "flightnum",
                                "font-mono tabular-nums",
                              )}
                              {...field}
                            />
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
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                className={fieldClass(
                                  "date",
                                  "w-full justify-between font-mono tabular-nums text-left",
                                )}
                              >
                                <span>
                                  {field.value ? field.value : "Pick a date"}
                                </span>
                                <CalendarIcon className="size-4 opacity-60" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={
                                  field.value
                                    ? parseISO(field.value)
                                    : undefined
                                }
                                onSelect={(date) => {
                                  if (date) {
                                    field.onChange(format(date, "yyyy-MM-dd"));
                                  }
                                }}
                                disabled={(date) =>
                                  date > new Date() ||
                                  date < new Date("1900-01-01")
                                }
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
                            <Input
                              placeholder="ZGGG"
                              className={fieldClass(
                                "departure",
                                "font-mono uppercase tabular-nums",
                              )}
                              {...field}
                            />
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
                            <Input
                              placeholder="ZBAA"
                              className={fieldClass(
                                "arrival",
                                "font-mono uppercase tabular-nums",
                              )}
                              {...field}
                            />
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
                          <FormLabel>Flight Time (HH:MM)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="02:55"
                              className={fieldClass(
                                "flightTime",
                                "font-mono tabular-nums",
                              )}
                              {...field}
                            />
                          </FormControl>
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
                            <Input
                              placeholder="12850"
                              className={fieldClass(
                                "fuelUsed",
                                "font-mono tabular-nums",
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-semibold">
                      Aircraft & Dispatch Remarks
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 pt-2">
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
                              <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr]">
                                <SelectTrigger
                                  className={fieldClass("aircraftId", "w-full")}
                                >
                                  <SelectValue
                                    placeholder={
                                      originalAircraftData.find(
                                        (aircraft: { id: string }) =>
                                          aircraft.id === field.value,
                                      )?.name || "Select aircraft.."
                                    }
                                  />
                                </SelectTrigger>

                                <Input
                                  placeholder="Filter aircraft fleet..."
                                  onChange={(e) => {
                                    const searchTerm =
                                      e.target.value.toLowerCase();
                                    const filtered =
                                      originalAircraftData.filter(
                                        (aircraft) =>
                                          aircraft.name
                                            .toLowerCase()
                                            .includes(searchTerm) ||
                                          aircraft.liveryname
                                            ?.toLowerCase()
                                            .includes(searchTerm),
                                      );
                                    setFilteredAircraftData(filtered);
                                  }}
                                />
                              </div>
                            </FormControl>
                            <SelectContent className="max-h-[220px] overflow-y-auto">
                              {isLoadingAircraft && (
                                <div className="flex h-10 items-center justify-center">
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
                                    <span className="block text-xs text-muted-foreground">
                                      Notes: {aircraft.notes}
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                              {!isLoadingAircraft &&
                                filteredAircraftData.length === 0 && (
                                  <div className="p-3 text-sm text-muted-foreground">
                                    No aircraft are available for your rank or
                                    awards.
                                  </div>
                                )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="multi"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Multiplier Code (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="1001"
                              className={fieldClass(
                                "multi",
                                "font-mono tabular-nums",
                              )}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Add any details for the PIREP review team..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Your notes will be posted as the first comment on
                            this PIREP.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">
                  All flight times are recorded in hours:minutes format.
                </span>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <PlaneIcon className="mr-1.5 h-3.5 w-3.5" />
                      Submit PIREP
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </CrewHeader>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof PlaneIcon;
  label: string;
  value: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <div className="shrink-0 rounded-md bg-[#eef4fb] p-2 text-[#0052a5]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words font-mono text-lg font-semibold leading-tight tabular-nums sm:text-xl">
            {value}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {label}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
