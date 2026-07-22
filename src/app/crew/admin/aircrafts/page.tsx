"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { authFetch } from "@/lib/utils/api";

type AircraftSource = "infinite-flight" | "manual";

type Aircraft = {
  id: number;
  name: string;
  liveryname: string | null;
  notes: string | null;
  rankreq: number | null;
  awardreq: number | null;
  ifaircraftid: string | null;
  ifliveryid: string | null;
};

type IfAircraft = { id: string; name: string };
type IfLivery = {
  id: string;
  aircraftID: string;
  aircraftName: string;
  liveryName: string;
};
type Rank = { id: number; name: string; timereq: number };
type Award = { id: number; name: string };
type IfMappingValidation = {
  id: number;
  status: "valid" | "stale" | "invalid";
  message: string;
};

type AircraftForm = {
  source: AircraftSource;
  name: string;
  liveryName: string;
  ifAircraftId: string;
  ifLiveryId: string;
  notes: string;
  rankReq: string;
  awardReq: string;
};

const emptyForm: AircraftForm = {
  source: "infinite-flight",
  name: "",
  liveryName: "",
  ifAircraftId: "",
  ifLiveryId: "",
  notes: "",
  rankReq: "",
  awardReq: "",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeIfId(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function parseIfAircraft(value: unknown): IfAircraft[] {
  if (!Array.isArray(value)) return [];

  const options = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = normalizeIfId(record.id);
    const name = typeof record.name === "string" ? record.name.trim() : "";
    return UUID_PATTERN.test(id) && name ? [{ id, name }] : [];
  });

  return [...new Map(options.map((item) => [item.id, item])).values()];
}

function parseIfLiveries(value: unknown, aircraftId: string): IfLivery[] {
  if (!Array.isArray(value)) return [];

  const normalizedAircraftId = normalizeIfId(aircraftId);
  const options = value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = normalizeIfId(record.id);
    const linkedAircraftId = normalizeIfId(
      record.aircraftID ?? record.aircraftId,
    );
    const aircraftName =
      typeof record.aircraftName === "string" ? record.aircraftName.trim() : "";
    const liveryName =
      typeof record.liveryName === "string" ? record.liveryName.trim() : "";

    return UUID_PATTERN.test(id) &&
      linkedAircraftId === normalizedAircraftId &&
      liveryName
      ? [
          {
            id,
            aircraftID: linkedAircraftId,
            aircraftName,
            liveryName,
          },
        ]
      : [];
  });

  return [...new Map(options.map((item) => [item.id, item])).values()];
}

async function responseMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || fallback);
  return data;
}

export default function AircraftPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [ifAircraft, setIfAircraft] = useState<IfAircraft[]>([]);
  const [ifLiveries, setIfLiveries] = useState<IfLivery[]>([]);
  const [selected, setSelected] = useState<Aircraft | null>(null);
  const [form, setForm] = useState<AircraftForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingReference, setLoadingReference] = useState(false);
  const [loadingLiveries, setLoadingLiveries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [ifMappings, setIfMappings] = useState<
    Record<number, IfMappingValidation>
  >({});
  const [mappingLoading, setMappingLoading] = useState(true);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const liveryRequestId = useRef(0);
  const mappingRequestId = useRef(0);

  const fetchAircraft = useCallback(async () => {
    const response = await authFetch("/api/aircraft");
    const data = await responseMessage(response, "Failed to load aircraft");
    setAircraft(Array.isArray(data.aircrafts) ? data.aircrafts : []);
  }, []);

  const fetchRequirements = useCallback(async () => {
    const response = await authFetch("/api/aircraft/requirements");
    const data = await responseMessage(response, "Failed to load requirements");
    const rankOptions = Array.isArray(data.ranks) ? data.ranks : [];
    setRanks(rankOptions);
    setAwards(Array.isArray(data.awards) ? data.awards : []);
    return rankOptions as Rank[];
  }, []);

  const fetchMappingValidation = useCallback(async () => {
    const requestId = ++mappingRequestId.current;
    setMappingLoading(true);
    setMappingError(null);
    try {
      const response = await authFetch("/api/aircraft/if/validate");
      const data = await responseMessage(
        response,
        "Failed to validate Infinite Flight aircraft mappings",
      );
      const mappings = Array.isArray(data.mappings)
        ? (data.mappings as IfMappingValidation[])
        : [];
      if (requestId !== mappingRequestId.current) return;
      setIfMappings(
        Object.fromEntries(mappings.map((mapping) => [mapping.id, mapping])),
      );
    } catch (validationError) {
      if (requestId !== mappingRequestId.current) return;
      setMappingError(
        validationError instanceof Error
          ? validationError.message
          : "Failed to validate Infinite Flight aircraft mappings",
      );
    } finally {
      if (requestId === mappingRequestId.current) {
        setMappingLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchAircraft(), fetchRequirements()])
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : "Failed to load page"),
      )
      .finally(() => setLoading(false));
    void fetchMappingValidation();
  }, [fetchAircraft, fetchMappingValidation, fetchRequirements]);

  const rankNames = useMemo(
    () => new Map(ranks.map((rank) => [rank.id, rank.name])),
    [ranks],
  );
  const awardNames = useMemo(
    () => new Map(awards.map((award) => [award.id, award.name])),
    [awards],
  );
  const mappingSummary = useMemo(
    () =>
      Object.values(ifMappings).reduce(
        (summary, mapping) => {
          summary[mapping.status] += 1;
          return summary;
        },
        { valid: 0, stale: 0, invalid: 0 },
      ),
    [ifMappings],
  );

  async function loadIfAircraft() {
    setLoadingReference(true);
    try {
      const response = await authFetch("/api/aircraft/if/aircraft");
      const data = await responseMessage(
        response,
        "Failed to load Infinite Flight aircraft",
      );
      const options = parseIfAircraft(data.result);
      if (options.length === 0) {
        throw new Error("Infinite Flight returned no valid aircraft");
      }
      setIfAircraft(options);
      return options;
    } finally {
      setLoadingReference(false);
    }
  }

  async function loadLiveries(aircraftId: string) {
    const normalizedAircraftId = normalizeIfId(aircraftId);
    if (!UUID_PATTERN.test(normalizedAircraftId)) {
      throw new Error("The selected Infinite Flight aircraft ID is invalid");
    }

    const requestId = ++liveryRequestId.current;
    setLoadingLiveries(true);
    try {
      const response = await authFetch(
        `/api/aircraft/if/liveries/${encodeURIComponent(normalizedAircraftId)}`,
      );
      const data = await responseMessage(
        response,
        "Failed to load Infinite Flight liveries",
      );
      const options = parseIfLiveries(data.result, normalizedAircraftId);
      if (requestId !== liveryRequestId.current) return null;
      setIfLiveries(options);
      return options;
    } finally {
      if (requestId === liveryRequestId.current) {
        setLoadingLiveries(false);
      }
    }
  }

  async function openAddDialog() {
    liveryRequestId.current += 1;
    setLoadingLiveries(false);
    setSelected(null);
    setFormError(null);
    setIfLiveries([]);
    const defaultRank = ranks.find((rank) => rank.id === 3) || ranks[0];
    setForm({ ...emptyForm, rankReq: defaultRank ? String(defaultRank.id) : "" });
    setDialogOpen(true);
    try {
      await loadIfAircraft();
    } catch (loadError) {
      setFormError(loadError instanceof Error ? loadError.message : "Failed to load aircraft");
    }
  }

  async function openEditDialog(item: Aircraft) {
    liveryRequestId.current += 1;
    setLoadingLiveries(false);
    const source: AircraftSource = item.ifaircraftid ? "infinite-flight" : "manual";
    setSelected(item);
    setFormError(null);
    setIfLiveries([]);
    setForm({
      source,
      name: item.name,
      liveryName: item.liveryname || "",
      ifAircraftId: item.ifaircraftid || "",
      ifLiveryId: item.ifliveryid || "",
      notes: item.notes || "",
      rankReq: item.rankreq ? String(item.rankreq) : "",
      awardReq: item.awardreq ? String(item.awardreq) : "",
    });
    setDialogOpen(true);

    if (source === "infinite-flight") {
      try {
        const aircraftOptions = await loadIfAircraft();
        const storedAircraftId = normalizeIfId(item.ifaircraftid);
        const officialAircraft = aircraftOptions.find(
          (option) => option.id === storedAircraftId,
        );

        if (!officialAircraft) {
          setForm((current) => ({
            ...current,
            name: "",
            liveryName: "",
            ifAircraftId: "",
            ifLiveryId: "",
          }));
          setFormError(
            "The stored aircraft ID is not valid in Infinite Flight. Select the aircraft and livery again before saving.",
          );
          return;
        }

        const liveryOptions = await loadLiveries(officialAircraft.id);
        if (!liveryOptions) return;

        const storedLiveryId = normalizeIfId(item.ifliveryid);
        const officialLivery = liveryOptions.find(
          (option) => option.id === storedLiveryId,
        );

        setForm((current) => ({
          ...current,
          name: officialAircraft.name,
          ifAircraftId: officialAircraft.id,
          liveryName: officialLivery?.liveryName || "",
          ifLiveryId: officialLivery?.id || "",
        }));

        if (!officialLivery) {
          setFormError(
            "The stored livery ID is not valid for this aircraft. Select a livery again before saving.",
          );
        }
      } catch (loadError) {
        setFormError(
          loadError instanceof Error ? loadError.message : "Failed to load aircraft",
        );
      }
    }
  }

  async function changeSource(source: AircraftSource) {
    liveryRequestId.current += 1;
    setLoadingLiveries(false);
    setFormError(null);
    setIfLiveries([]);
    setForm((current) => ({
      ...current,
      source,
      name: "",
      liveryName: "",
      ifAircraftId: "",
      ifLiveryId: "",
    }));
    if (source === "infinite-flight" && ifAircraft.length === 0) {
      try {
        await loadIfAircraft();
      } catch (loadError) {
        setFormError(
          loadError instanceof Error ? loadError.message : "Failed to load aircraft",
        );
      }
    }
  }

  async function selectIfAircraft(id: string) {
    const normalizedId = normalizeIfId(id);
    const option = ifAircraft.find((item) => item.id === normalizedId);
    if (!option) {
      setFormError("The selected Infinite Flight aircraft is invalid");
      return;
    }

    setFormError(null);
    setIfLiveries([]);
    setForm((current) => ({
      ...current,
      name: option.name,
      ifAircraftId: option.id,
      liveryName: "",
      ifLiveryId: "",
    }));
    try {
      await loadLiveries(option.id);
    } catch (loadError) {
      setFormError(
        loadError instanceof Error ? loadError.message : "Failed to load liveries",
      );
    }
  }

  const selectedIfAircraft = ifAircraft.find(
    (item) => item.id === normalizeIfId(form.ifAircraftId),
  );
  const selectedIfLivery = ifLiveries.find(
    (item) =>
      item.id === normalizeIfId(form.ifLiveryId) &&
      item.aircraftID === selectedIfAircraft?.id,
  );
  const canSave = Boolean(
    form.name.trim() &&
      (form.rankReq || form.awardReq) &&
      (form.source === "manual" ||
        (selectedIfAircraft && selectedIfLivery && form.liveryName)),
  );

  function renderSource(item: Aircraft) {
    if (!item.ifaircraftid) {
      return <Badge variant="secondary">Manual</Badge>;
    }

    const mapping = ifMappings[item.id];
    if (!mapping) {
      return (
        <Badge variant="outline">
          {mappingLoading ? "Checking…" : "Unverified"}
        </Badge>
      );
    }

    return (
      <div className="flex max-w-48 flex-col items-start gap-1">
        <Badge
          variant={mapping.status === "invalid" ? "destructive" : "outline"}
        >
          {mapping.status === "valid"
            ? "IF verified"
            : mapping.status === "stale"
              ? "Names outdated"
              : "Invalid mapping"}
        </Badge>
        {mapping.status !== "valid" && (
          <span className="text-xs text-muted-foreground">
            {mapping.message}
          </span>
        )}
      </div>
    );
  }

  async function saveAircraft() {
    if (!canSave) return;
    setSaving(true);
    setFormError(null);
    try {
      const response = await authFetch("/api/aircraft", {
        method: selected ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selected ? { id: selected.id } : {}),
          ...form,
          rankReq: form.rankReq || null,
          awardReq: form.awardReq || null,
        }),
      });
      await responseMessage(response, `Failed to ${selected ? "update" : "add"} aircraft`);
      await Promise.all([fetchAircraft(), fetchMappingValidation()]);
      setDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save aircraft");
    } finally {
      setSaving(false);
    }
  }

  async function deleteAircraft(item: Aircraft) {
    setDeletingId(item.id);
    setError(null);
    try {
      const response = await authFetch(`/api/aircraft?id=${item.id}`, {
        method: "DELETE",
      });
      await responseMessage(response, "Failed to deactivate aircraft");
      await Promise.all([fetchAircraft(), fetchMappingValidation()]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Failed to deactivate aircraft",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <CrewHeader>
      <main className="flex-1">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Aircraft</h1>
              <p className="text-sm text-muted-foreground">
                Manage fleet records and pilot access requirements.
              </p>
              {!mappingLoading && !mappingError &&
                (mappingSummary.invalid > 0 || mappingSummary.stale > 0) && (
                  <p className="mt-1 text-xs text-amber-700">
                    {mappingSummary.invalid} invalid mapping
                    {mappingSummary.invalid === 1 ? "" : "s"} and{" "}
                    {mappingSummary.stale} record
                    {mappingSummary.stale === 1 ? "" : "s"} with outdated
                    names need attention.
                  </p>
                )}
            </div>
            <Button onClick={openAddDialog} disabled={loading}>
              <Plus className="mr-2 h-4 w-4" /> Add Aircraft
            </Button>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {mappingError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Aircraft records loaded, but their Infinite Flight IDs could not
              be verified: {mappingError}
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Livery</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead>Award</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : aircraft.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        No active aircraft found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    aircraft.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{item.liveryname || "—"}</TableCell>
                        <TableCell>
                          {renderSource(item)}
                        </TableCell>
                        <TableCell>{item.notes || "—"}</TableCell>
                        <TableCell>
                          {item.rankreq ? rankNames.get(item.rankreq) || `#${item.rankreq}` : "—"}
                        </TableCell>
                        <TableCell>
                          {item.awardreq
                            ? awardNames.get(item.awardreq) || `#${item.awardreq}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit {item.name}</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={deletingId === item.id}>
                                  {deletingId === item.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                  <span className="sr-only">Delete {item.name}</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deactivate aircraft?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {item.name} will be hidden from active lists. Its database record and historical references will be preserved.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteAircraft(item)}>
                                    Deactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto bg-white sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selected ? "Edit Aircraft" : "Add Aircraft"}</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {formError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              )}

              <div className="grid gap-2">
                <Label>Aircraft source</Label>
                <Select value={form.source} onValueChange={(value) => changeSource(value as AircraftSource)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-white">
                    <SelectItem value="infinite-flight">Infinite Flight</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {form.source === "infinite-flight" ? (
                <>
                  <div className="grid gap-2">
                    <Label>Aircraft</Label>
                    <Select value={form.ifAircraftId} onValueChange={selectIfAircraft} disabled={loadingReference}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingReference ? "Loading aircraft…" : "Choose aircraft"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[240px] bg-white">
                        {ifAircraft.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Livery</Label>
                    <Select
                      value={form.ifLiveryId}
                      onValueChange={(id) => {
                        const livery = ifLiveries.find((item) => item.id === id);
                        setForm((current) => ({
                          ...current,
                          ifLiveryId: id,
                          liveryName: livery?.liveryName || "",
                        }));
                      }}
                      disabled={!form.ifAircraftId || loadingLiveries}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingLiveries ? "Loading liveries…" : "Choose livery"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-[240px] bg-white">
                        {ifLiveries.map((item) => (
                          <SelectItem key={item.id} value={item.id}>{item.liveryName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="aircraft-name">Aircraft name</Label>
                    <Input
                      id="aircraft-name"
                      value={form.name}
                      onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                      placeholder="Aircraft name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="livery-name">Livery name (optional)</Label>
                    <Input
                      id="livery-name"
                      value={form.liveryName}
                      onChange={(event) => setForm((current) => ({ ...current, liveryName: event.target.value }))}
                      placeholder="Livery name"
                    />
                  </div>
                </>
              )}

              <div className="grid gap-2">
                <Label htmlFor="aircraft-notes">Notes (optional)</Label>
                <Input
                  id="aircraft-notes"
                  maxLength={12}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Up to 12 characters"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Minimum rank (optional)</Label>
                  <Select
                    value={form.rankReq || "none"}
                    onValueChange={(value) => setForm((current) => ({ ...current, rankReq: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="none">No rank requirement</SelectItem>
                      {ranks.map((rank) => (
                        <SelectItem key={rank.id} value={String(rank.id)}>{rank.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Required award (optional)</Label>
                  <Select
                    value={form.awardReq || "none"}
                    onValueChange={(value) => setForm((current) => ({ ...current, awardReq: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="none">No award requirement</SelectItem>
                      {awards.map((award) => (
                        <SelectItem key={award.id} value={String(award.id)}>{award.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!form.rankReq && !form.awardReq && (
                <p className="text-sm text-destructive">Select at least a rank or an award.</p>
              )}
              <p className="text-xs text-muted-foreground">
                If both are selected, pilots can unlock the aircraft by meeting either requirement.
              </p>

              <Button onClick={saveAircraft} disabled={!canSave || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selected ? "Save Changes" : "Add Aircraft"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
