"use client";

import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LiveAircraft, SchedulingData } from "./types";
import { errorMessage } from "./utils";

export function AircraftEditor({ catalog, aircraft, ifAircraft, canLink = false, publishingReady = false, allowUnpublishedIfStarts = false, onClose, onSave }: {
  catalog?: SchedulingData["catalog"];
  aircraft?: LiveAircraft;
  ifAircraft?: { id: string; registration: string };
  canLink?: boolean;
  publishingReady?: boolean;
  allowUnpublishedIfStarts?: boolean;
  onClose: () => void;
  onSave: (input: Record<string, unknown>) => Promise<void>;
}) {
  // IF details remain a temporary reference. The admin authors the local record.
  const [registration, setRegistration] = useState(aircraft?.registration || "");
  const [catalogId, setCatalogId] = useState(String(aircraft?.aircraft_id || ""));
  const [airport, setAirport] = useState(aircraft?.current_airport || "");
  const [active, setActive] = useState(aircraft ? Boolean(aircraft.active) : true);
  const [linkToIf, setLinkToIf] = useState(Boolean(ifAircraft && canLink));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!canLink) setLinkToIf(false); }, [canLink]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!registration.trim() || !Number(catalogId)) { setError("Enter a registration and select an aircraft type."); return; }
    if (airport.trim() && !/^[A-Z0-9]{4}$/.test(airport.trim())) { setError("Enter a four-character ICAO airport code, or leave the airport unknown."); return; }
    if (linkToIf && !canLink) { setError("Aircraft linking is unavailable. Choose local scheduling or refresh the IF connection."); return; }
    setSaving(true);
    try {
      await onSave({
        action: aircraft ? "edit_aircraft" : "add_aircraft",
        ...(aircraft ? { live_aircraft_id: aircraft.id } : {}),
        registration: registration.trim().toUpperCase(), aircraft_id: Number(catalogId),
        current_airport: airport.trim() || null, active,
        ...(ifAircraft && linkToIf ? { if_aircraft_id: ifAircraft.id } : {}),
      });
      onClose();
    } catch (saveError) { setError(errorMessage(saveError)); }
    finally { setSaving(false); }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader>
    <DialogTitle>{aircraft ? "Edit live aircraft" : ifAircraft ? "Add to local fleet" : "Add live aircraft"}</DialogTitle>
    <DialogDescription>{aircraft ? "Location corrections can require later flights to be reviewed." : ifAircraft ? "Enter your local aircraft registration, select its type and livery, and confirm its airport. IF position and schedule data are shown separately." : "Create a persistent aircraft from the existing aircraft catalog."}</DialogDescription>
  </DialogHeader><form onSubmit={submit} className="space-y-4">
    {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {ifAircraft && <p className="rounded-md border bg-muted/20 p-3 text-sm">IF aircraft: <span className="font-medium">{ifAircraft.registration}</span></p>}
    <div className="space-y-2"><Label htmlFor="tail-registration">Registration</Label><Input id="tail-registration" value={registration} onChange={(event) => setRegistration(event.target.value.toUpperCase())} required maxLength={24} disabled={saving} placeholder={ifAircraft?.registration || "e.g. C-WNCB"} /></div>
    <div className="space-y-2"><Label htmlFor="tail-catalog">Aircraft type and livery</Label><select id="tail-catalog" value={catalogId} onChange={(event) => setCatalogId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required disabled={saving}><option value="">Select an aircraft</option>{catalog?.map((item) => <option key={item.id} value={item.id}>{item.name}{item.liveryname ? " · " + item.liveryname : ""}</option>)}</select>{!catalog?.length && <p className="text-xs text-muted-foreground">Add a type to the aircraft catalog before creating a live aircraft.</p>}</div>
    <div className="space-y-2"><Label htmlFor="tail-airport">Current airport <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="tail-airport" value={airport} onChange={(event) => setAirport(event.target.value.toUpperCase())} maxLength={4} placeholder="ICAO, or leave unknown" disabled={saving} /></div>
    <div className="flex items-center gap-2"><Checkbox id="tail-active" checked={active} disabled={saving} onCheckedChange={(checked) => setActive(checked === true)} /><Label htmlFor="tail-active">Available for scheduling</Label></div>
    {ifAircraft && <div className="space-y-2 rounded-md border p-3"><div className="flex items-center gap-2"><Checkbox id="tail-if-link" checked={linkToIf} disabled={saving || !canLink} onCheckedChange={(checked) => setLinkToIf(checked === true)} /><Label htmlFor="tail-if-link">Link to this IF aircraft</Label></div>{!canLink && <p className="text-xs text-muted-foreground">This creates a local aircraft. Save the IF organization and enable aircraft linking to add its IF link later.</p>}{linkToIf && !publishingReady && <p className="text-sm text-amber-700 dark:text-amber-400">{allowUnpublishedIfStarts ? "Automatic publishing is disabled. The start policy permits linked aircraft flights to start locally without IF publication or departure checks." : "Automatic publishing is disabled. Flights for a linked aircraft must be published before they can start."}</p>}</div>}
    <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || !catalog?.length}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{aircraft ? "Save aircraft" : "Add aircraft"}</Button></DialogFooter>
  </form></DialogContent></Dialog>;
}
