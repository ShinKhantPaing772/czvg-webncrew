"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Edit, Loader2, Plus, Search, Trash2 } from "lucide-react";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type Multiplier = {
  id: number;
  code: number;
  multiplier: number;
  name: string;
  minrankid: number | null;
  minRankName: string | null;
};

type Rank = {
  id: number;
  name: string;
  timereq: number;
};

type MultiplierForm = {
  name: string;
  code: string;
  multiplier: string;
  minrankid: string;
};

const emptyForm: MultiplierForm = {
  name: "",
  code: "",
  multiplier: "1",
  minrankid: "none",
};

async function responseData(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || fallback);
  }
  return data;
}

export default function AdminMultipliersPage() {
  const [multipliers, setMultipliers] = useState<Multiplier[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [selected, setSelected] = useState<Multiplier | null>(null);
  const [form, setForm] = useState<MultiplierForm>(emptyForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const loadMultipliers = useCallback(async () => {
    const response = await authFetch("/api/admin/multipliers");
    const data = await responseData(response, "Failed to load multipliers");
    setMultipliers(
      Array.isArray(data.multipliers) ? data.multipliers : [],
    );
    setRanks(Array.isArray(data.ranks) ? data.ranks : []);
  }, []);

  useEffect(() => {
    loadMultipliers()
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load multipliers",
        ),
      )
      .finally(() => setLoading(false));
  }, [loadMultipliers]);

  const filteredMultipliers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return multipliers;

    return multipliers.filter((multiplier) =>
      [
        multiplier.name,
        String(multiplier.code),
        String(multiplier.multiplier),
        multiplier.minRankName ?? "no minimum rank",
      ].some((value) => value.toLowerCase().includes(query)),
    );
  }, [multipliers, searchQuery]);

  function openAdd() {
    setSelected(null);
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(multiplier: Multiplier) {
    setSelected(multiplier);
    setForm({
      name: multiplier.name,
      code: String(multiplier.code),
      multiplier: String(multiplier.multiplier),
      minrankid:
        multiplier.minrankid === null
          ? "none"
          : String(multiplier.minrankid),
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function saveMultiplier() {
    setSaving(true);
    setFormError("");

    try {
      const response = await authFetch("/api/admin/multipliers", {
        method: selected ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selected ? { id: selected.id } : {}),
          name: form.name.trim(),
          code: Number(form.code),
          multiplier: Number(form.multiplier),
          minrankid:
            form.minrankid === "none" ? null : Number(form.minrankid),
        }),
      });

      await responseData(
        response,
        `Failed to ${selected ? "update" : "create"} multiplier`,
      );
      await loadMultipliers();
      setDialogOpen(false);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save multiplier",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteMultiplier(multiplier: Multiplier) {
    setDeletingId(multiplier.id);
    setError("");

    try {
      const response = await authFetch(
        `/api/admin/multipliers?id=${multiplier.id}`,
        { method: "DELETE" },
      );
      await responseData(response, "Failed to delete multiplier");
      await loadMultipliers();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete multiplier",
      );
    } finally {
      setDeletingId(null);
    }
  }

  const code = Number(form.code);
  const factor = Number(form.multiplier);
  const canSave = Boolean(
    form.name.trim() &&
      Number.isInteger(code) &&
      code > 0 &&
      code <= 2_147_483_647 &&
      Number.isFinite(factor) &&
      factor > 0,
  );
  return (
    <CrewHeader>
      <main className="flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Multipliers</h1>
            <p className="text-sm text-muted-foreground">
              Manage PIREP credit multipliers, redemption codes, and rank
              requirements.
            </p>
          </div>
          <Button onClick={openAdd} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />
            Add Multiplier
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="max-w-md space-y-2">
          <Label htmlFor="multiplier-search">Search Multipliers</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="multiplier-search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by name, code, factor, or rank..."
              className="pl-8"
            />
          </div>
        </div>

        <Card>
          <CardHeader className="p-4">
            <CardTitle>PIREP Multipliers</CardTitle>
            <CardDescription>
              Codes are entered by pilots when filing a PIREP. Existing reports
              retain their stored multiplier labels after edits or deletion.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Factor</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Minimum Rank
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : filteredMultipliers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {multipliers.length === 0
                        ? "No multipliers found."
                        : "No multipliers match your search."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMultipliers.map((multiplier) => (
                    <TableRow key={multiplier.id}>
                      <TableCell className="font-medium">
                        {multiplier.name}
                      </TableCell>
                      <TableCell className="font-mono">
                        {multiplier.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {multiplier.multiplier}×
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {multiplier.minRankName ?? "No minimum rank"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(multiplier)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">
                              Edit {multiplier.name}
                            </span>
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={deletingId === multiplier.id}
                              >
                                {deletingId === multiplier.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span className="sr-only">
                                  Delete {multiplier.name}
                                </span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete {multiplier.name}?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Pilots will no longer be able to use code{" "}
                                  {multiplier.code}. Existing PIREPs will retain
                                  their stored multiplier text. This action
                                  cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteMultiplier(multiplier)
                                  }
                                >
                                  Delete
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selected ? "Edit Multiplier" : "Add Multiplier"}
              </DialogTitle>
              <DialogDescription>
                Configure how the code adjusts credited PIREP flight time.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-2">
              {formError ? (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="multiplier-name">Name</Label>
                <Input
                  id="multiplier-name"
                  value={form.name}
                  maxLength={120}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="Double Flight Time"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="multiplier-code">Redemption Code</Label>
                  <Input
                    id="multiplier-code"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="2147483647"
                    step="1"
                    value={form.code}
                    onChange={(event) =>
                      setForm({ ...form, code: event.target.value })
                    }
                    placeholder="888888"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="multiplier-factor">Flight Time Factor</Label>
                  <Input
                    id="multiplier-factor"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={form.multiplier}
                    onChange={(event) =>
                      setForm({ ...form, multiplier: event.target.value })
                    }
                    placeholder="2"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="multiplier-rank">Minimum Rank</Label>
                <Select
                  value={form.minrankid}
                  onValueChange={(minrankid) =>
                    setForm({ ...form, minrankid })
                  }
                >
                  <SelectTrigger id="multiplier-rank">
                    <SelectValue placeholder="Select minimum rank" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No minimum rank</SelectItem>
                    {ranks.map((rank) => (
                      <SelectItem key={rank.id} value={String(rank.id)}>
                        {rank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Pilots must meet this rank&apos;s required approved flight
                  time before using the code.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                onClick={saveMultiplier}
                disabled={!canSave || saving}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                {selected ? "Save Changes" : "Create Multiplier"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
