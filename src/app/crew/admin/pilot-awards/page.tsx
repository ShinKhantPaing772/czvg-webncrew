"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ImageOff, Loader2, Search, Trophy, UserRoundCheck } from "lucide-react";
import Image from "next/image";

import { CrewHeader } from "@/components/crew-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { authFetch } from "@/lib/utils/api";

type Award = {
  id: number;
  name: string | null;
  description: string | null;
  imageurl: string | null;
};

type Grant = {
  awardId: number;
  dateAwarded: string;
};

type Pilot = {
  id: number;
  name: string;
  callsign: string;
  email: string;
  status: number;
  grants: Grant[];
};

type AwardRecipient = Omit<Pilot, "grants"> & {
  dateAwarded: string;
};

function formatAwardDate(value: string) {
  const dateOnly = value.slice(0, 10);
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString();
}

function displayImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function AwardArtwork({ award }: { award: Award }) {
  const imageUrl = displayImageUrl(award.imageurl);

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 rounded-md object-contain"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
      <ImageOff className="h-4 w-4 text-muted-foreground" />
    </span>
  );
}

async function responseData(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || fallback);
  return data;
}

export default function PilotAwardsPage() {
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [selectedPilotId, setSelectedPilotId] = useState<number | null>(null);
  const [selectedAwardIds, setSelectedAwardIds] = useState<number[]>([]);
  const [pilotQuery, setPilotQuery] = useState("");
  const [awardQuery, setAwardQuery] = useState("");
  const [selectedLookupAwardId, setSelectedLookupAwardId] = useState<
    number | null
  >(null);
  const [recipients, setRecipients] = useState<AwardRecipient[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientRefreshKey, setRecipientRefreshKey] = useState(0);
  const [loadingPilots, setLoadingPilots] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async (search = "") => {
    setLoadingPilots(true);
    setError("");

    try {
      const response = await authFetch(
        `/api/admin/pilot-awards?query=${encodeURIComponent(search)}`,
      );
      const data = await responseData(response, "Failed to load pilot awards");
      const nextPilots = Array.isArray(data.pilots) ? data.pilots : [];
      const nextAwards = Array.isArray(data.awards) ? data.awards : [];

      setPilots(nextPilots);
      setAwards(nextAwards);
      setSelectedPilotId((current) =>
        current &&
        nextPilots.some((pilot: Pilot) => pilot.id === current)
          ? current
          : null,
      );
      setSelectedLookupAwardId((current) =>
        current && nextAwards.some((award: Award) => award.id === current)
          ? current
          : null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load pilot awards",
      );
    } finally {
      setLoadingPilots(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedLookupAwardId === null) {
      setRecipients([]);
      return;
    }

    const controller = new AbortController();

    async function loadRecipients() {
      setLoadingRecipients(true);
      setRecipients([]);
      setError("");

      try {
        const response = await authFetch(
          `/api/admin/pilot-awards?awardId=${selectedLookupAwardId}`,
          { signal: controller.signal },
        );
        const data = await responseData(
          response,
          "Failed to load award recipients",
        );

        setRecipients(
          Array.isArray(data.recipients) ? data.recipients : [],
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load award recipients",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRecipients(false);
        }
      }
    }

    void loadRecipients();
    return () => controller.abort();
  }, [recipientRefreshKey, selectedLookupAwardId]);

  const selectedPilot = useMemo(
    () =>
      pilots.find((pilot) => pilot.id === selectedPilotId) || null,
    [pilots, selectedPilotId],
  );

  const selectedLookupAward = useMemo(
    () =>
      awards.find((award) => award.id === selectedLookupAwardId) || null,
    [awards, selectedLookupAwardId],
  );

  const filteredAwards = useMemo(() => {
    const normalizedQuery = awardQuery.trim().toLowerCase();
    if (!normalizedQuery) return awards;

    return awards.filter((award) =>
      `${award.name || ""} ${award.description || ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [awardQuery, awards]);

  const filteredRecipients = useMemo(() => {
    const normalizedQuery = recipientQuery.trim().toLowerCase();
    if (!normalizedQuery) return recipients;

    return recipients.filter((recipient) =>
      `${recipient.name} ${recipient.callsign} ${recipient.email}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [recipientQuery, recipients]);

  function choosePilot(pilot: Pilot) {
    setSelectedPilotId(pilot.id);
    setSelectedAwardIds(pilot.grants.map((grant) => grant.awardId));
    setMessage("");
    setError("");
  }

  function chooseLookupAward(awardId: number) {
    setSelectedLookupAwardId(awardId);
    setRecipientQuery("");
    setMessage("");
    setError("");
  }

  function toggleAward(id: number, checked: boolean) {
    setSelectedAwardIds((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((awardId) => awardId !== id),
    );
  }

  async function saveAwards() {
    if (!selectedPilot) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilotId: selectedPilot.id,
          awardIds: selectedAwardIds,
        }),
      });
      await responseData(response, "Failed to update pilot awards");

      setMessage(`Awards updated for ${selectedPilot.name}.`);
      await loadData(pilotQuery);
      if (selectedLookupAwardId !== null) {
        setRecipientRefreshKey((current) => current + 1);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update pilot awards",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <CrewHeader>
      <main className="flex-1 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Pilot Awards</h1>
          <p className="text-sm text-muted-foreground">
            Grant or revoke awards for individual pilots, or review recipients
            by award.
          </p>
        </div>

        {error || message ? (
          <div
            className={`rounded-md border p-3 text-sm ${
              error
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        ) : null}

        <Tabs defaultValue="assign">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="assign">
              <UserRoundCheck />
              Assign by pilot
            </TabsTrigger>
            <TabsTrigger value="recipients">
              <Trophy />
              Browse by award
            </TabsTrigger>
          </TabsList>

          <TabsContent value="assign" className="mt-2">
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="text-base">Select a pilot</CardTitle>
                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadData(pilotQuery);
                    }}
                  >
                    <div className="relative flex-1">
                      <Label htmlFor="pilot-award-search" className="sr-only">
                        Search pilots
                      </Label>
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pilot-award-search"
                        className="pl-8"
                        value={pilotQuery}
                        onChange={(event) => setPilotQuery(event.target.value)}
                        placeholder="Name, callsign, or email"
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      Search
                    </Button>
                  </form>
                </CardHeader>
                <CardContent className="max-h-[620px] space-y-2 overflow-y-auto">
                  {loadingPilots ? (
                    <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" />
                  ) : pilots.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No pilots found.
                    </p>
                  ) : (
                    pilots.map((pilot) => (
                      <button
                        key={pilot.id}
                        type="button"
                        onClick={() => choosePilot(pilot)}
                        className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                          pilot.id === selectedPilotId
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarFallback>
                            {pilot.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {pilot.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pilot.callsign} · {pilot.email}
                          </p>
                        </div>
                        {pilot.grants.length ? (
                          <Badge variant="secondary">
                            {pilot.grants.length}
                          </Badge>
                        ) : null}
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    {selectedPilot
                      ? `Awards for ${selectedPilot.name}`
                      : "Award assignments"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!selectedPilot ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Select a pilot to manage their awards.
                    </div>
                  ) : awards.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Create an award definition before assigning awards.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        {awards.map((award) => {
                          const grant = selectedPilot.grants.find(
                            (item) => item.awardId === award.id,
                          );

                          return (
                            <label
                              key={award.id}
                              htmlFor={`pilot-award-${award.id}`}
                              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                            >
                              <Checkbox
                                id={`pilot-award-${award.id}`}
                                checked={selectedAwardIds.includes(award.id)}
                                onCheckedChange={(checked) =>
                                  toggleAward(award.id, checked === true)
                                }
                              />
                              <AwardArtwork award={award} />
                              <div className="min-w-0">
                                <p className="font-medium">
                                  {award.name || "Unnamed award"}
                                </p>
                                <p className="line-clamp-2 text-xs text-muted-foreground">
                                  {award.description || "No description"}
                                </p>
                                {grant ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Awarded{" "}
                                    {formatAwardDate(grant.dateAwarded)}
                                  </p>
                                ) : null}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex justify-end">
                        <Button
                          onClick={() => void saveAwards()}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Save Awards
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recipients" className="mt-2">
            <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3">
                  <CardTitle className="text-base">Select an award</CardTitle>
                  <div className="relative">
                    <Label htmlFor="award-recipient-search" className="sr-only">
                      Search awards
                    </Label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="award-recipient-search"
                      className="pl-8"
                      value={awardQuery}
                      onChange={(event) => setAwardQuery(event.target.value)}
                      placeholder="Search awards"
                    />
                  </div>
                </CardHeader>
                <CardContent className="max-h-[620px] space-y-2 overflow-y-auto">
                  {awards.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No award definitions found.
                    </p>
                  ) : filteredAwards.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No awards match your search.
                    </p>
                  ) : (
                    filteredAwards.map((award) => (
                      <button
                        key={award.id}
                        type="button"
                        onClick={() => chooseLookupAward(award.id)}
                        className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                          award.id === selectedLookupAwardId
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <AwardArtwork award={award} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {award.name || "Unnamed award"}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {award.description || "No description"}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {selectedLookupAward
                        ? `Pilots with ${selectedLookupAward.name || "this award"}`
                        : "Award recipients"}
                    </CardTitle>
                    {selectedLookupAward && !loadingRecipients ? (
                      <Badge variant="secondary">
                        {recipients.length}{" "}
                        {recipients.length === 1 ? "pilot" : "pilots"}
                      </Badge>
                    ) : null}
                  </div>
                  {selectedLookupAward && recipients.length > 0 ? (
                    <div className="relative">
                      <Label
                        htmlFor="award-pilot-search"
                        className="sr-only"
                      >
                        Search award recipients
                      </Label>
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="award-pilot-search"
                        className="pl-8"
                        value={recipientQuery}
                        onChange={(event) =>
                          setRecipientQuery(event.target.value)
                        }
                        placeholder="Search recipients by name, callsign, or email"
                      />
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {!selectedLookupAward ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Select an award to see every pilot who has received it.
                    </div>
                  ) : loadingRecipients ? (
                    <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin" />
                  ) : recipients.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      No pilots have received this award yet.
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      No recipients match your search.
                    </div>
                  ) : (
                    <div className="max-h-[540px] space-y-2 overflow-y-auto">
                      {filteredRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-3 rounded-md border p-3"
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>
                              {recipient.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {recipient.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {recipient.callsign} · {recipient.email}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-muted-foreground">
                              Awarded
                            </p>
                            <p className="text-sm font-medium">
                              {formatAwardDate(recipient.dateAwarded)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </CrewHeader>
  );
}
