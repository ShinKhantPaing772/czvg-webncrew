"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import Image from "next/image";

import { CrewHeader } from "@/components/crew-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/utils/api";

type Award = { id: number; name: string; description: string; imageurl: string };
type Grant = { awardId: number; dateAwarded: string };
type Pilot = { id: number; name: string; callsign: string; email: string; status: number; grants: Grant[] };

function formatAwardDate(value: string) {
  const dateOnly = value.slice(0, 10);
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString();
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async (search = "") => {
    setLoading(true); setError("");
    try {
      const response = await authFetch(`/api/admin/pilot-awards?query=${encodeURIComponent(search)}`);
      const data = await responseData(response, "Failed to load pilot awards");
      const nextPilots = Array.isArray(data.pilots) ? data.pilots : [];
      setPilots(nextPilots); setAwards(Array.isArray(data.awards) ? data.awards : []);
      setSelectedPilotId((current) => current && nextPilots.some((pilot: Pilot) => pilot.id === current) ? current : null);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : "Failed to load pilot awards"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  const selectedPilot = useMemo(() => pilots.find((pilot) => pilot.id === selectedPilotId) || null, [pilots, selectedPilotId]);

  function choosePilot(pilot: Pilot) {
    setSelectedPilotId(pilot.id); setSelectedAwardIds(pilot.grants.map((grant) => grant.awardId)); setMessage(""); setError("");
  }
  function toggleAward(id: number, checked: boolean) {
    setSelectedAwardIds((current) => checked ? Array.from(new Set([...current, id])) : current.filter((awardId) => awardId !== id));
  }
  async function saveAwards() {
    if (!selectedPilot) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await authFetch("/api/admin/pilot-awards", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pilotId: selectedPilot.id, awardIds: selectedAwardIds }) });
      await responseData(response, "Failed to update pilot awards");
      setMessage(`Awards updated for ${selectedPilot.name}.`); await loadData(query);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Failed to update pilot awards"); }
    finally { setSaving(false); }
  }

  return <CrewHeader><main className="flex-1 space-y-4"><div><h1 className="text-2xl font-bold">Pilot Awards</h1><p className="text-sm text-muted-foreground">Grant or revoke awards for individual pilots.</p></div>
    {(error || message) ? <div className={`rounded-md border p-3 text-sm ${error ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-green-200 bg-green-50 text-green-700"}`}>{error || message}</div> : null}
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card><CardHeader className="space-y-3"><CardTitle className="text-base">Select a pilot</CardTitle><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); loadData(query); }}><div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, callsign, or email" /></div><Button type="submit" variant="outline">Search</Button></form></CardHeader><CardContent className="max-h-[620px] space-y-2 overflow-y-auto">{loading ? <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" /> : pilots.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">No pilots found.</p> : pilots.map((pilot) => <button key={pilot.id} type="button" onClick={() => choosePilot(pilot)} className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted ${pilot.id === selectedPilotId ? "border-primary bg-primary/5" : ""}`}><Avatar className="h-9 w-9"><AvatarFallback>{pilot.name.charAt(0)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{pilot.name}</p><p className="truncate text-xs text-muted-foreground">{pilot.callsign} · {pilot.email}</p></div>{pilot.grants.length ? <Badge variant="secondary">{pilot.grants.length}</Badge> : null}</button>)}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">{selectedPilot ? `Awards for ${selectedPilot.name}` : "Award assignments"}</CardTitle></CardHeader><CardContent>{!selectedPilot ? <div className="py-16 text-center text-sm text-muted-foreground">Select a pilot to manage their awards.</div> : awards.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">Create an award definition before assigning awards.</div> : <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2">{awards.map((award) => { const grant = selectedPilot.grants.find((item) => item.awardId === award.id); return <label key={award.id} htmlFor={`pilot-award-${award.id}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"><Checkbox id={`pilot-award-${award.id}`} checked={selectedAwardIds.includes(award.id)} onCheckedChange={(checked) => toggleAward(award.id, checked === true)} /><Image src={award.imageurl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded-md object-contain" /><div className="min-w-0"><p className="font-medium">{award.name}</p><p className="line-clamp-2 text-xs text-muted-foreground">{award.description}</p>{grant ? <p className="mt-1 text-xs text-muted-foreground">Awarded {formatAwardDate(grant.dateAwarded)}</p> : null}</div></label>; })}</div><div className="flex justify-end"><Button onClick={saveAwards} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Awards</Button></div></div>}</CardContent></Card>
    </div>
  </main></CrewHeader>;
}
