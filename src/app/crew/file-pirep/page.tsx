"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PlaneIcon,
  RefreshCw,
  Calendar as CalendarIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { AirlineLogo } from "@/components/airline-logo";
import { CrewHeader } from "@/components/crew-header";
import {
  CrewCallsign,
  CrewMeta,
  CrewPageHeader,
  CrewPanel,
  CrewSector,
} from "@/components/crew-ui";
import { useRouter, useSearchParams } from "next/navigation";
import { airportCity } from "@/lib/airports";
import { useI18n } from "@/lib/i18n";
import { authFetch } from "@/lib/utils/api";
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
    error: (issue) =>
      issue.input === undefined ? "Please select a date." : undefined,
  }),
  aircraftId: z.string({
    error: (issue) =>
      issue.input === undefined ? "Please select an aircraft." : undefined,
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
  const { t } = useI18n();
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
  const sectorReady =
    Boolean(watchedValues.departure) && Boolean(watchedValues.arrival);
  const selectedAircraft = originalAircraftData.find(
    (aircraft) => aircraft.id === watchedValues.aircraftId,
  );
  const departureCity = airportCity(watchedValues.departure);
  const arrivalCity = airportCity(watchedValues.arrival);

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

      try {
        window.sessionStorage.removeItem("acars:last-flight-id");
      } catch {
        // ignore storage error
      }

      form.reset();
      router.push("/crew/view-pireps?submitted=1");
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
      const explicitFlightId = searchParams.get("flightId")?.trim();
      const params = new URLSearchParams({
        pilotId: String(user.id),
        refresh: "true",
      });
      if (explicitFlightId) params.set("flightId", explicitFlightId);

      const response = await authFetch(`/api/acars/current-flight?${params}`);
      const data: AcarsResponse = await response.json();

      if (!response.ok || !data.acars) {
        throw new Error(data.error || "Failed to fetch ACARS data");
      }

      try {
        window.sessionStorage.removeItem("acars:last-flight-id");
      } catch {
        // ignore storage error
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
        ? "bg-[var(--v2-state-bg-success,#e3fae1)]"
        : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    <CrewHeader>
      <div className="space-y-6 pb-24 md:pb-6">
        <CrewPageHeader
          title="File PIREP"
          meta={
            <CrewMeta
              items={[
                <CrewCallsign key="cs">
                  {user?.callsign || "——"}
                </CrewCallsign>,
                isLoadingAircraft
                  ? "Loading fleet"
                  : `${originalAircraftData.length} unlocked aircraft`,
                watchedValues.flightnum
                  ? <span key="fn" className="font-mono tabular-nums">{watchedValues.flightnum}</span>
                  : null,
              ]}
            />
          }
          actions={
            <Button
              type="button"
              variant="outline"
              onClick={fetchAcarsData}
              disabled={
                isFetchingAcars ||
                isLoadingAircraft ||
                Boolean(aircraftLoadError)
              }
            >
              {isFetchingAcars || isLoadingAircraft ? (
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              ) : (
                <RefreshCw className="size-3.5" strokeWidth={1.5} />
              )}
              {aircraftLoadError ? "Aircraft unavailable" : "Import ACARS"}
            </Button>
          }
        />

        <CrewSector
          departure={watchedValues.departure || "————"}
          arrival={watchedValues.arrival || "————"}
          departureName={departureCity}
          arrivalName={arrivalCity}
          duration={watchedValues.flightTime || undefined}
          durationHint={watchedValues.flightTime ? "Block time" : undefined}
          size="lg"
          eyebrow={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                {watchedValues.flightnum ? (
                  <AirlineLogo
                    flightnum={watchedValues.flightnum}
                    liveryname={selectedAircraft?.liveryname}
                    className="h-5 w-auto max-w-[72px] shrink-0 object-contain"
                  />
                ) : null}
                {watchedValues.flightnum ? (
                  <span className="font-mono text-[15px] font-medium tabular-nums text-[var(--v2-text-text-base,#171717)]">
                    {watchedValues.flightnum}
                  </span>
                ) : (
                  <span>Enter flight details to preview the sector</span>
                )}
                {sectorReady ? (
                  <span className="text-[var(--v2-text-text-faint,#737373)]">
                    · Active sector
                  </span>
                ) : null}
              </div>
              {watchedValues.date ? (
                <span className="font-mono tabular-nums text-[var(--v2-text-text-muted,#525252)]">
                  {watchedValues.date}
                </span>
              ) : null}
            </div>
          }
          footer={
            selectedAircraft || watchedValues.fuelUsed || user?.callsign ? (
              <CrewMeta
                className="mt-0"
                items={[
                  selectedAircraft
                    ? [selectedAircraft.name, selectedAircraft.liveryname]
                        .filter(Boolean)
                        .join(" · ")
                    : null,
                  watchedValues.fuelUsed
                    ? `Fuel ${watchedValues.fuelUsed} kg`
                    : null,
                  user?.callsign ? (
                    <CrewCallsign key="cs">{user.callsign}</CrewCallsign>
                  ) : null,
                ]}
              />
            ) : undefined
          }
        />

        {acarsMessage ? (
          <div
            className={
              acarsFilledFields.length > 0
                ? "rounded-[12px] bg-[var(--v2-state-bg-success,#e3fae1)] px-4 py-3 text-[13px] text-[var(--v2-state-fg-success,#196b2b)]"
                : "rounded-[12px] bg-[var(--v2-state-bg-warning,#fcefd0)] px-4 py-3 text-[13px] text-[var(--v2-state-fg-warning,#8e6518)]"
            }
          >
            <div className="flex items-start gap-2.5">
              {acarsFilledFields.length > 0 ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.5}
                />
              ) : (
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  strokeWidth={1.5}
                />
              )}
              <div className="space-y-1">
                <p className="font-medium">{acarsMessage}</p>
                {acarsFilledFields.length > 0 ? (
                  <p className="text-[12px] opacity-80">
                    Filled:{" "}
                    {acarsFilledFields
                      .map((fieldName) => acarsFieldLabels[fieldName])
                      .join(", ")}
                  </p>
                ) : null}
                {acarsMissingFields.length > 0 ? (
                  <p className="text-[12px] opacity-80">
                    Still needed:{" "}
                    {acarsMissingFields
                      .map((fieldName) => acarsFieldLabels[fieldName])
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {submitMessage ? (
          <div className="rounded-[12px] bg-[var(--v2-state-bg-danger,#fceceb)] px-4 py-3 text-[13px] text-[var(--v2-state-fg-danger,#c8102e)]">
            {submitMessage}
          </div>
        ) : null}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-8"
          >
            <CrewPanel title="Sector details">
              <div className="space-y-4 rounded-[16px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] p-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="flightnum"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Flight number</FormLabel>
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
                        <FormLabel>Date</FormLabel>
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
                              <CalendarIcon
                                className="size-4 opacity-60"
                                strokeWidth={1.5}
                              />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={
                                field.value ? parseISO(field.value) : undefined
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="departure"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departure</FormLabel>
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
                        <FormLabel>Arrival</FormLabel>
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
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="flightTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Block time</FormLabel>
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
                        <FormLabel>Fuel used (kg)</FormLabel>
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
                </div>
              </div>
            </CrewPanel>

            <CrewPanel title="Aircraft and remarks">
              <div className="grid grid-cols-1 gap-4 rounded-[16px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] p-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="aircraftId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger
                            className={fieldClass("aircraftId", "w-full")}
                          >
                            <SelectValue placeholder="Select aircraft" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-[220px] overflow-y-auto">
                          <div className="sticky top-0 z-10 bg-white p-1">
                            <Input
                              placeholder="Filter"
                              onKeyDown={(event) => {
                                // Keep typing and caret movement out of Select's typeahead.
                                if (!["ArrowUp", "ArrowDown", "Escape", "Tab"].includes(event.key)) {
                                  event.stopPropagation();
                                }
                              }}
                              onChange={(e) => {
                                const searchTerm =
                                  e.target.value.toLowerCase();
                                setFilteredAircraftData(
                                  originalAircraftData.filter(
                                    (aircraft) =>
                                      aircraft.name
                                        .toLowerCase()
                                        .includes(searchTerm) ||
                                      aircraft.liveryname
                                        ?.toLowerCase()
                                        .includes(searchTerm),
                                  ),
                                );
                              }}
                            />
                          </div>
                          {isLoadingAircraft ? (
                            <div className="flex h-10 items-center justify-center">
                              <Loader2 className="size-4 animate-spin" />
                            </div>
                          ) : null}
                          {filteredAircraftData.map((aircraft) => (
                            <SelectItem
                              key={aircraft.id}
                              value={"" + aircraft.id}
                            >
                              {aircraft.name}
                              {aircraft.liveryname
                                ? ` · ${aircraft.liveryname}`
                                : ""}
                            </SelectItem>
                          ))}
                          {!isLoadingAircraft &&
                          filteredAircraftData.length === 0 ? (
                            <div className="p-3 text-[13px] text-[var(--v2-text-text-muted,#525252)]">
                              No aircraft available for your rank
                            </div>
                          ) : null}
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
                      <FormLabel>Multiplier</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Optional"
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
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Optional remarks for reviewers"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Posted as the first comment on this PIREP
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CrewPanel>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <p className="max-w-xl text-[12px] leading-relaxed text-[var(--v2-text-text-faint,#737373)]">
                {t(
                  "Review usually takes about 48 hours. Keep flying and file more PIREPs while you wait — no need to pause.",
                  "审核通常约需 48 小时。期间可照常飞行并继续提交飞行报告，无需等待。",
                )}
              </p>
              <Button type="submit" disabled={isLoading} className="shrink-0">
                {isLoading ? (
                  <>
                    <Loader2
                      className="size-3.5 animate-spin"
                      strokeWidth={1.5}
                    />
                    {t("Submitting", "提交中")}
                  </>
                ) : (
                  <>
                    <PlaneIcon className="size-3.5" strokeWidth={1.5} />
                    {t("Submit PIREP", "提交飞行报告")}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </CrewHeader>
  );
}
