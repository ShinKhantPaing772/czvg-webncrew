"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, ImageOff, Loader2, Plus, Star, Trash2 } from "lucide-react";
import Image from "next/image";

import { CrewHeader } from "@/components/crew-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/utils/api";

type Award = {
  id: number;
  name: string | null;
  description: string | null;
  imageurl: string | null;
  featured: number | null;
};
type AwardForm = { name: string; description: string; imageurl: string; featured: boolean };
const emptyForm: AwardForm = { name: "", description: "", imageurl: "", featured: false };

async function responseData(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || fallback);
  return data;
}

function editableString(value: unknown) {
  return typeof value === "string" ? value : "";
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

export default function AdminAwardsPage() {
  const [awards, setAwards] = useState<Award[]>([]);
  const [selected, setSelected] = useState<Award | null>(null);
  const [form, setForm] = useState<AwardForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const loadAwards = useCallback(async () => {
    const response = await authFetch("/api/admin/awards");
    const data = await responseData(response, "Failed to load awards");
    setAwards(Array.isArray(data.awards) ? data.awards : []);
  }, []);

  useEffect(() => {
    loadAwards().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load awards")).finally(() => setLoading(false));
  }, [loadAwards]);

  function openAdd() { setSelected(null); setForm(emptyForm); setFormError(""); setDialogOpen(true); }
  function openEdit(award: Award) {
    setSelected(award);
    setForm({
      name: editableString(award.name),
      description: editableString(award.description),
      imageurl: editableString(award.imageurl),
      featured: award.featured === 1,
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function saveAward() {
    setSaving(true); setFormError("");
    try {
      const response = await authFetch("/api/admin/awards", { method: selected ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...(selected ? { id: selected.id } : {}), ...form }) });
      await responseData(response, `Failed to ${selected ? "update" : "create"} award`);
      await loadAwards(); setDialogOpen(false);
    } catch (saveError) { setFormError(saveError instanceof Error ? saveError.message : "Failed to save award"); }
    finally { setSaving(false); }
  }

  async function deleteAward(award: Award) {
    setDeletingId(award.id); setError("");
    try {
      const response = await authFetch(`/api/admin/awards?id=${award.id}`, { method: "DELETE" });
      await responseData(response, "Failed to delete award"); await loadAwards();
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Failed to delete award"); }
    finally { setDeletingId(null); }
  }

  const canSave = Boolean(form.name.trim() && form.description.trim() && form.imageurl.trim());

  return <CrewHeader><main className="flex-1 space-y-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">Awards</h1><p className="text-sm text-muted-foreground">Manage award definitions and the featured public reward.</p></div><Button onClick={openAdd} disabled={loading}><Plus className="mr-2 h-4 w-4" />Add Award</Button></div>
    {error ? <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Award</TableHead><TableHead className="hidden md:table-cell">Description</TableHead><TableHead>Public</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
      {loading ? <TableRow><TableCell colSpan={4} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow> : awards.length === 0 ? <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No awards found.</TableCell></TableRow> : awards.map((award) => { const imageUrl = displayImageUrl(award.imageurl); const awardName = editableString(award.name) || "Unnamed award"; return <TableRow key={award.id}><TableCell><div className="flex items-center gap-3">{imageUrl ? <Image src={imageUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-md border object-contain" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted"><ImageOff className="h-4 w-4 text-muted-foreground" /></span>}<span className="font-medium">{awardName}</span></div></TableCell><TableCell className="hidden max-w-lg md:table-cell"><p className="line-clamp-2 text-sm text-muted-foreground">{editableString(award.description) || "No description"}</p></TableCell><TableCell>{award.featured === 1 ? <Badge><Star className="mr-1 h-3 w-3" />Featured</Badge> : <span className="text-sm text-muted-foreground">—</span>}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => openEdit(award)}><Edit className="h-4 w-4" /><span className="sr-only">Edit {awardName}</span></Button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={deletingId === award.id}><Trash2 className="h-4 w-4" /><span className="sr-only">Delete {awardName}</span></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {awardName}?</AlertDialogTitle><AlertDialogDescription>This is allowed only when no aircraft or pilot grants reference the award.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteAward(award)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></TableCell></TableRow>; })}
    </TableBody></Table></CardContent></Card>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{selected ? "Edit Award" : "Add Award"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2">{formError ? <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{formError}</div> : null}<div className="space-y-2"><Label htmlFor="award-name">Name</Label><Input id="award-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="award-description">Description</Label><Textarea id="award-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="award-image">Image URL (HTTPS)</Label><Input id="award-image" type="url" placeholder="https://..." value={form.imageurl} onChange={(event) => setForm({ ...form, imageurl: event.target.value })} /></div><div className="flex items-start gap-3 rounded-md border p-3"><Checkbox id="award-featured" checked={form.featured} onCheckedChange={(checked) => setForm({ ...form, featured: checked === true })} /><div><Label htmlFor="award-featured">Feature on public rank page</Label><p className="mt-1 text-xs text-muted-foreground">Selecting this replaces the currently featured award.</p></div></div></div><DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={saveAward} disabled={!canSave || saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{selected ? "Save Changes" : "Create Award"}</Button></DialogFooter></DialogContent></Dialog>
  </main></CrewHeader>;
}
