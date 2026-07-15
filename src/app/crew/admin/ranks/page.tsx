"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
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

type Rank = {
  id: number;
  name: string;
  timereq: number;
  imageurl: string | null;
  barcount: number;
  bartone: "gold" | "white";
  starcount: number;
};

type RankForm = {
  name: string;
  timereq: string;
  imageurl: string;
  barcount: string;
  bartone: "gold" | "white";
  starcount: string;
};

const emptyForm: RankForm = {
  name: "",
  timereq: "0",
  imageurl: "",
  barcount: "1",
  bartone: "gold",
  starcount: "0",
};

async function responseData(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || fallback);
  return data;
}

function formatSeconds(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

export default function AdminRanksPage() {
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [selected, setSelected] = useState<Rank | null>(null);
  const [form, setForm] = useState<RankForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const loadRanks = useCallback(async () => {
    const response = await authFetch("/api/admin/ranks");
    const data = await responseData(response, "Failed to load ranks");
    setRanks(Array.isArray(data.ranks) ? data.ranks : []);
  }, []);

  useEffect(() => {
    loadRanks()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load ranks"))
      .finally(() => setLoading(false));
  }, [loadRanks]);

  function openAdd() {
    setSelected(null);
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  }

  function openEdit(rank: Rank) {
    setSelected(rank);
    setForm({
      name: rank.name,
      timereq: String(rank.timereq),
      imageurl: rank.imageurl || "",
      barcount: String(rank.barcount),
      bartone: rank.bartone,
      starcount: String(rank.starcount),
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function saveRank() {
    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch("/api/admin/ranks", {
        method: selected ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(selected ? { id: selected.id } : {}),
          ...form,
          timereq: Number(form.timereq),
          barcount: Number(form.barcount),
          starcount: Number(form.starcount),
        }),
      });
      await responseData(response, `Failed to ${selected ? "update" : "create"} rank`);
      await loadRanks();
      setDialogOpen(false);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "Failed to save rank");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRank(rank: Rank) {
    setDeletingId(rank.id);
    setError("");
    try {
      const response = await authFetch(`/api/admin/ranks?id=${rank.id}`, { method: "DELETE" });
      await responseData(response, "Failed to delete rank");
      await loadRanks();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete rank");
    } finally {
      setDeletingId(null);
    }
  }

  const canSave = Boolean(
    form.name.trim() && Number.isInteger(Number(form.timereq)) && Number(form.timereq) >= 0,
  );

  return (
    <CrewHeader>
      <main className="flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ranks</h1>
            <p className="text-sm text-muted-foreground">Manage pilot progression and the public rank ladder.</p>
          </div>
          <Button onClick={openAdd} disabled={loading}><Plus className="mr-2 h-4 w-4" />Add Rank</Button>
        </div>

        {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Required Seconds</TableHead><TableHead className="hidden md:table-cell">Display</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                ) : ranks.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No ranks found.</TableCell></TableRow>
                ) : ranks.map((rank) => (
                  <TableRow key={rank.id}>
                    <TableCell className="font-medium">{rank.name}</TableCell>
                    <TableCell><div>{rank.timereq.toLocaleString()}</div><div className="text-xs text-muted-foreground">{formatSeconds(rank.timereq)} flight time</div></TableCell>
                    <TableCell className="hidden md:table-cell">{rank.barcount} {rank.bartone} bar{rank.barcount === 1 ? "" : "s"}, {rank.starcount} star{rank.starcount === 1 ? "" : "s"}</TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(rank)}><Edit className="h-4 w-4" /><span className="sr-only">Edit {rank.name}</span></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={deletingId === rank.id}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete {rank.name}</span></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {rank.name}?</AlertDialogTitle><AlertDialogDescription>This is allowed only when no aircraft or multipliers use the rank.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteRank(rank)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader><DialogTitle>{selected ? "Edit Rank" : "Add Rank"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              {formError ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div> : null}
              <div className="space-y-2"><Label htmlFor="rank-name">Name</Label><Input id="rank-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="rank-time">Required flight time (seconds)</Label><Input id="rank-time" type="number" min="0" step="1" value={form.timereq} onChange={(event) => setForm({ ...form, timereq: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="rank-image">Aircraft image URL (HTTPS, optional)</Label><Input id="rank-image" type="url" placeholder="https://..." value={form.imageurl} onChange={(event) => setForm({ ...form, imageurl: event.target.value })} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Bars</Label><Select value={form.barcount} onValueChange={(barcount) => setForm({ ...form, barcount })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Bar color</Label><Select value={form.bartone} onValueChange={(bartone: "gold" | "white") => setForm({ ...form, bartone })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gold">Gold</SelectItem><SelectItem value="white">White</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Stars</Label><Select value={form.starcount} onValueChange={(starcount) => setForm({ ...form, starcount })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[0,1,2].map((value) => <SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select></div>
              </div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={saveRank} disabled={!canSave || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selected ? "Save Changes" : "Create Rank"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
