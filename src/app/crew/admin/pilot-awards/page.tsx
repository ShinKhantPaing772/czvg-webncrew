"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ImageOff,
  Loader2,
  Search,
  Square,
  Trash2,
  Trophy,
  User,
  UserPlus,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";

import { CrewHeader } from "@/components/crew-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ifc: string;
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
        className="h-10 w-10 shrink-0 rounded-md object-contain"
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

  // Single-pilot mode state
  const [selectedPilotId, setSelectedPilotId] = useState<number | null>(null);
  const [selectedAwardIds, setSelectedAwardIds] = useState<number[]>([]);

  // Batch-pilot mode state (Tab 1)
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatchPilotIds, setSelectedBatchPilotIds] = useState<number[]>([]);
  const [selectedBatchAwardIds, setSelectedBatchAwardIds] = useState<number[]>([]);

  // Filters & searches
  const [pilotQuery, setPilotQuery] = useState("");
  const [awardQuery, setAwardQuery] = useState("");

  // Tab 2 browse state
  const [selectedLookupAwardId, setSelectedLookupAwardId] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<AwardRecipient[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientRefreshKey, setRecipientRefreshKey] = useState(0);

  // Tab 2 Batch Grant Dialog state
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantPilotIds, setGrantPilotIds] = useState<number[]>([]);
  const [modalPilotQuery, setModalPilotQuery] = useState("");
  const [hideExistingInModal, setHideExistingInModal] = useState(true);

  // Status indicators
  const [loadingPilots, setLoadingPilots] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokingPilotId, setRevokingPilotId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async (search = "") => {
    setLoadingPilots(true);
    setError("");

    try {
      const response = await authFetch(
        `/api/admin/pilot-awards?query=${encodeURIComponent(search)}&limit=200`,
      );
      const data = await responseData(response, "Failed to load pilot awards");
      const nextPilots = Array.isArray(data.pilots) ? data.pilots : [];
      const nextAwards = Array.isArray(data.awards) ? data.awards : [];

      setPilots(nextPilots);
      setAwards(nextAwards);

      setSelectedPilotId((current) =>
        current && nextPilots.some((pilot: Pilot) => pilot.id === current)
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
    () => pilots.find((pilot) => pilot.id === selectedPilotId) || null,
    [pilots, selectedPilotId],
  );

  const selectedLookupAward = useMemo(
    () => awards.find((award) => award.id === selectedLookupAwardId) || null,
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
      `${recipient.name} ${recipient.callsign} ${recipient.ifc} ${recipient.email}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [recipientQuery, recipients]);

  // Pilots available for batch grant in Tab 2 Dialog
  const recipientPilotIdSet = useMemo(
    () => new Set(recipients.map((r) => r.id)),
    [recipients],
  );

  const modalFilteredPilots = useMemo(() => {
    const query = modalPilotQuery.trim().toLowerCase();
    return pilots.filter((pilot) => {
      if (hideExistingInModal && recipientPilotIdSet.has(pilot.id)) {
        return false;
      }
      if (!query) return true;
      return `${pilot.name} ${pilot.callsign} ${pilot.ifc} ${pilot.email}`
        .toLowerCase()
        .includes(query);
    });
  }, [hideExistingInModal, modalPilotQuery, pilots, recipientPilotIdSet]);

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

  function toggleBatchPilot(pilotId: number) {
    setSelectedBatchPilotIds((current) =>
      current.includes(pilotId)
        ? current.filter((id) => id !== pilotId)
        : [...current, pilotId],
    );
  }

  function toggleSelectAllBatchPilots() {
    const visibleIds = pilots.map((p) => p.id);
    const allSelected = visibleIds.every((id) => selectedBatchPilotIds.includes(id));
    if (allSelected) {
      setSelectedBatchPilotIds([]);
    } else {
      setSelectedBatchPilotIds(Array.from(new Set([...selectedBatchPilotIds, ...visibleIds])));
    }
  }

  function toggleBatchAward(id: number, checked: boolean) {
    setSelectedBatchAwardIds((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((awardId) => awardId !== id),
    );
  }

  // Save single pilot awards (synchronizes exact award list)
  async function saveSinglePilotAwards() {
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

  // Batch grant awards to multiple selected pilots (Tab 1)
  async function saveBatchAwards() {
    if (selectedBatchPilotIds.length === 0 || selectedBatchAwardIds.length === 0) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilotIds: selectedBatchPilotIds,
          awardIds: selectedBatchAwardIds,
        }),
      });
      const data = await responseData(response, "Failed to grant awards");

      setMessage(
        `Successfully granted awards to ${selectedBatchPilotIds.length} pilot(s) (${data.createdCount ?? 0} new assignment(s)).`,
      );
      await loadData(pilotQuery);
      if (selectedLookupAwardId !== null) {
        setRecipientRefreshKey((current) => current + 1);
      }
      setSelectedBatchAwardIds([]);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to batch grant awards",
      );
    } finally {
      setSaving(false);
    }
  }

  // Batch grant award to multiple pilots from Tab 2 Modal
  async function saveModalGrantAwards() {
    if (!selectedLookupAward || grantPilotIds.length === 0) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilotIds: grantPilotIds,
          awardId: selectedLookupAward.id,
        }),
      });
      const data = await responseData(response, "Failed to grant award");

      setMessage(
        `Successfully granted "${selectedLookupAward.name}" to ${grantPilotIds.length} pilot(s) (${data.createdCount ?? 0} new assignment(s)).`,
      );
      setGrantDialogOpen(false);
      setGrantPilotIds([]);
      setRecipientRefreshKey((current) => current + 1);
      await loadData(pilotQuery);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to grant award",
      );
    } finally {
      setSaving(false);
    }
  }

  // Revoke award from a single recipient (Tab 2)
  async function revokeAwardFromRecipient(pilotId: number, pilotName: string) {
    if (!selectedLookupAward) return;

    setRevokingPilotId(pilotId);
    setError("");
    setMessage("");

    try {
      const response = await authFetch(
        `/api/admin/pilot-awards?awardId=${selectedLookupAward.id}&pilotId=${pilotId}`,
        { method: "DELETE" },
      );
      await responseData(response, "Failed to revoke award");

      setMessage(`Revoked "${selectedLookupAward.name}" from ${pilotName}.`);
      setRecipientRefreshKey((current) => current + 1);
      await loadData(pilotQuery);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : "Failed to revoke award",
      );
    } finally {
      setRevokingPilotId(null);
    }
  }

  function openGrantModal() {
    setGrantPilotIds([]);
    setModalPilotQuery("");
    setGrantDialogOpen(true);
  }

  function toggleModalPilot(pilotId: number) {
    setGrantPilotIds((current) =>
      current.includes(pilotId)
        ? current.filter((id) => id !== pilotId)
        : [...current, pilotId],
    );
  }

  function toggleSelectAllModalPilots() {
    const selectable = modalFilteredPilots
      .filter((p) => !recipientPilotIdSet.has(p.id))
      .map((p) => p.id);
    const allSelected = selectable.length > 0 && selectable.every((id) => grantPilotIds.includes(id));
    if (allSelected) {
      setGrantPilotIds([]);
    } else {
      setGrantPilotIds(selectable);
    }
  }

  return (
    <CrewHeader>
      <main className="flex-1 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Pilot Awards</h1>
          <p className="text-sm text-muted-foreground">
            Grant awards to multiple pilots simultaneously, manage individual pilots, or review recipients by award.
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
              <UserRoundCheck className="mr-1.5 h-4 w-4" />
              Assign by pilot
            </TabsTrigger>
            <TabsTrigger value="recipients">
              <Trophy className="mr-1.5 h-4 w-4" />
              Browse by award
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Assign by pilot (supports Single & Batch Mode) */}
          <TabsContent value="assign" className="mt-2">
            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {batchMode ? "Select pilots (Batch)" : "Select a pilot"}
                    </CardTitle>
                    <Button
                      variant={batchMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBatchMode(!batchMode);
                        setSelectedBatchPilotIds([]);
                        setSelectedBatchAwardIds([]);
                      }}
                    >
                      {batchMode ? (
                        <>
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          Batch Mode
                        </>
                      ) : (
                        <>
                          <User className="mr-1.5 h-3.5 w-3.5" />
                          Multi-select
                        </>
                      )}
                    </Button>
                  </div>

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
                        placeholder="Name, callsign, IFC, email"
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      Search
                    </Button>
                  </form>

                  {batchMode && pilots.length > 0 ? (
                    <div className="flex items-center justify-between border-t pt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={toggleSelectAllBatchPilots}
                        >
                          {pilots.every((p) => selectedBatchPilotIds.includes(p.id)) ? (
                            <>
                              <Square className="mr-1 h-3.5 w-3.5" />
                              Deselect all
                            </>
                          ) : (
                            <>
                              <CheckSquare className="mr-1 h-3.5 w-3.5" />
                              Select all visible
                            </>
                          )}
                        </Button>
                        {selectedBatchPilotIds.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => setSelectedBatchPilotIds([])}
                          >
                            Clear
                          </Button>
                        ) : null}
                      </div>
                      <Badge variant="secondary">
                        {selectedBatchPilotIds.length} selected
                      </Badge>
                    </div>
                  ) : null}
                </CardHeader>

                <CardContent className="max-h-[600px] space-y-2 overflow-y-auto">
                  {loadingPilots ? (
                    <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" />
                  ) : pilots.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No pilots found.
                    </p>
                  ) : (
                    pilots.map((pilot) => {
                      const isBatchSelected = selectedBatchPilotIds.includes(pilot.id);
                      const isSingleSelected = pilot.id === selectedPilotId;

                      if (batchMode) {
                        return (
                          <div
                            key={pilot.id}
                            onClick={() => toggleBatchPilot(pilot.id)}
                            className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted ${
                              isBatchSelected ? "border-primary bg-primary/5" : ""
                            }`}
                          >
                            <Checkbox
                              checked={isBatchSelected}
                              onCheckedChange={() => toggleBatchPilot(pilot.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback>
                                {pilot.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {pilot.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {pilot.callsign} · IFC: {pilot.ifc}
                              </p>
                            </div>
                            {pilot.grants.length ? (
                              <Badge variant="outline" className="text-xs">
                                {pilot.grants.length} awards
                              </Badge>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={pilot.id}
                          type="button"
                          onClick={() => choosePilot(pilot)}
                          className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                            isSingleSelected ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback>
                              {pilot.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {pilot.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {pilot.callsign} · IFC: {pilot.ifc}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {pilot.email}
                            </p>
                          </div>
                          {pilot.grants.length ? (
                            <Badge variant="secondary">
                              {pilot.grants.length}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Right Column: Batch Mode view OR Single Pilot view */}
              <Card>
                {batchMode ? (
                  <>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          Batch Grant Awards ({selectedBatchPilotIds.length} pilots selected)
                        </CardTitle>
                        {selectedBatchPilotIds.length > 0 ? (
                          <Badge variant="outline">
                            {selectedBatchAwardIds.length} awards checked
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select the awards below to grant to all selected pilots at once. This adds awards without removing their existing awards.
                      </p>
                    </CardHeader>
                    <CardContent>
                      {selectedBatchPilotIds.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          Please select one or more pilots from the list on the left.
                        </div>
                      ) : awards.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          No award definitions available.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Selected pilots summary chips */}
                          <div className="rounded-md border bg-muted/40 p-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              Target Pilots ({selectedBatchPilotIds.length}):
                            </p>
                            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                              {selectedBatchPilotIds.map((id) => {
                                const p = pilots.find((pilot) => pilot.id === id);
                                if (!p) return null;
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs font-medium shadow-sm"
                                  >
                                    <span>{p.name} ({p.callsign})</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleBatchPilot(id)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {awards.map((award) => (
                              <label
                                key={award.id}
                                htmlFor={`batch-award-${award.id}`}
                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                              >
                                <Checkbox
                                  id={`batch-award-${award.id}`}
                                  checked={selectedBatchAwardIds.includes(award.id)}
                                  onCheckedChange={(checked) =>
                                    toggleBatchAward(award.id, checked === true)
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
                                </div>
                              </label>
                            ))}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedBatchPilotIds([]);
                                setSelectedBatchAwardIds([]);
                              }}
                            >
                              Clear
                            </Button>
                            <Button
                              onClick={() => void saveBatchAwards()}
                              disabled={
                                saving ||
                                selectedBatchPilotIds.length === 0 ||
                                selectedBatchAwardIds.length === 0
                              }
                            >
                              {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                              )}
                              Grant Awards ({selectedBatchAwardIds.length}) to {selectedBatchPilotIds.length} Pilots
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </>
                ) : (
                  <>
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
                          Select a pilot from the left to view and edit their awards.
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
                              onClick={() => void saveSinglePilotAwards()}
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
                  </>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: Browse by award & Batch Grant to Pilots */}
          <TabsContent value="recipients" className="mt-2">
            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3 pb-3">
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
                <CardContent className="max-h-[600px] space-y-2 overflow-y-auto">
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
                    <div className="flex items-center gap-2">
                      {selectedLookupAward && !loadingRecipients ? (
                        <Badge variant="secondary">
                          {recipients.length}{" "}
                          {recipients.length === 1 ? "pilot" : "pilots"}
                        </Badge>
                      ) : null}
                      {selectedLookupAward ? (
                        <Button
                          size="sm"
                          onClick={openGrantModal}
                        >
                          <UserPlus className="mr-1.5 h-4 w-4" />
                          Grant to Pilots
                        </Button>
                      ) : null}
                    </div>
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
                        placeholder="Search by name, callsign, IFC, or email"
                      />
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {!selectedLookupAward ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      Select an award to view recipients and grant it to pilots.
                    </div>
                  ) : loadingRecipients ? (
                    <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin" />
                  ) : recipients.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      <p>No pilots have received this award yet.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={openGrantModal}
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Grant to Pilots
                      </Button>
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
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback>
                              {recipient.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {recipient.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {recipient.callsign} · IFC: {recipient.ifc}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {recipient.email}
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

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={revokingPilotId === recipient.id}
                                title="Revoke award"
                              >
                                {revokingPilotId === recipient.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span className="sr-only">
                                  Revoke award from {recipient.name}
                                </span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Revoke award from {recipient.name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will revoke &quot;{selectedLookupAward?.name}&quot; from {recipient.name} ({recipient.callsign}).
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void revokeAwardFromRecipient(
                                      recipient.id,
                                      recipient.name,
                                    )
                                  }
                                >
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal: Grant Award to Multiple Pilots */}
        <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Grant &quot;{selectedLookupAward?.name}&quot; to Pilots
              </DialogTitle>
              <DialogDescription>
                Select multiple pilots to award this badge simultaneously.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={modalPilotQuery}
                  onChange={(e) => setModalPilotQuery(e.target.value)}
                  placeholder="Search pilots by name, callsign, IFC, or email"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Checkbox
                    checked={hideExistingInModal}
                    onCheckedChange={(checked) => setHideExistingInModal(checked === true)}
                  />
                  <span>Hide pilots who already have this award</span>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={toggleSelectAllModalPilots}
                  >
                    Select all eligible
                  </Button>
                  {grantPilotIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setGrantPilotIds([])}
                    >
                      Clear
                    </Button>
                  ) : null}
                  <Badge variant="secondary">
                    {grantPilotIds.length} selected
                  </Badge>
                </div>
              </div>

              {/* Scrollable pilots list */}
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {modalFilteredPilots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No matching pilots found.
                  </p>
                ) : (
                  modalFilteredPilots.map((pilot) => {
                    const alreadyAwarded = recipientPilotIdSet.has(pilot.id);
                    const isChecked = grantPilotIds.includes(pilot.id);

                    return (
                      <div
                        key={pilot.id}
                        onClick={() => {
                          if (!alreadyAwarded) {
                            toggleModalPilot(pilot.id);
                          }
                        }}
                        className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors ${
                          alreadyAwarded
                            ? "cursor-not-allowed bg-muted/40 opacity-70"
                            : "cursor-pointer hover:bg-muted"
                        } ${isChecked ? "border-primary bg-primary/5" : ""}`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={alreadyAwarded}
                          onCheckedChange={() => toggleModalPilot(pilot.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {pilot.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {pilot.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pilot.callsign} · IFC: {pilot.ifc}
                          </p>
                        </div>
                        {alreadyAwarded ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Already has award
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {grantPilotIds.length} pilot{grantPilotIds.length === 1 ? "" : "s"} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setGrantDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void saveModalGrantAwards()}
                  disabled={saving || grantPilotIds.length === 0}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  Grant Award ({grantPilotIds.length})
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
