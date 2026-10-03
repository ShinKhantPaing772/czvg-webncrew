"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlightInput, ScheduledFlight, SchedulingData } from "./types";
import { departureForTime, errorMessage, inputToIso, utcInput } from "./utils";

type Props = {
  data: SchedulingData;
  flight?: ScheduledFlight;
  aircraftId?: number;
  admin?: boolean;
  onClose: () => void;
  onSave: (input: FlightInput) => Promise<void>;
};

export function FlightForm({ data, flight, aircraftId, admin, onClose, onSave }: Props) {
  const [form, setForm] = useState(() => {
    const departure = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const arrival = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    return {
      live_aircraft_id: String(flight?.live_aircraft_id || aircraftId || data.aircraft.find((item) => item.active)?.id || ""),
      callsign: flight?.callsign || "", departure: flight?.departure || "", arrival: flight?.arrival || "",
      scheduled_departure: utcInput(flight?.scheduled_departure || departure),
      scheduled_arrival: utcInput(flight?.scheduled_arrival || arrival), notes: flight?.notes || "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const aircraft = data.aircraft.find((item) => item.id === Number(form.live_aircraft_id));
  const inferredDeparture = departureForTime(aircraft, data.flights, inputToIso(form.scheduled_departure) || "", flight?.id);
  const departure = inferredDeparture || form.departure;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const scheduledDeparture = inputToIso(form.scheduled_departure);
    const scheduledArrival = inputToIso(form.scheduled_arrival);
    if (!aircraft || !scheduledDeparture || !scheduledArrival) {
      setError("Choose an aircraft and enter both scheduled times.");
      return;
    }
    if (new Date(scheduledArrival) <= new Date(scheduledDeparture)) {
      setError("Scheduled arrival must be after departure.");
      return;
    }
    if (!/^[A-Z0-9]{4}$/.test(departure.trim()) || !/^[A-Z0-9]{4}$/.test(form.arrival.trim())) {
      setError("Enter a four-character ICAO airport code for departure and destination.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        live_aircraft_id: aircraft.id, callsign: form.callsign.trim(), departure: departure.trim(), arrival: form.arrival.trim(),
        scheduled_departure: scheduledDeparture, scheduled_arrival: scheduledArrival, notes: form.notes.trim(),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{flight ? admin ? "Amend flight" : "Edit flight request" : "Request a flight"}</DialogTitle>
        <DialogDescription>{flight && admin ? "Changes are checked against the aircraft’s flight sequence and published to IF when linked." : "Your request needs admin approval. All scheduled times are in UTC."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          <Label htmlFor="flight-aircraft">Aircraft</Label>
          <select id="flight-aircraft" value={form.live_aircraft_id} onChange={(event) => setForm({ ...form, live_aircraft_id: event.target.value, departure: "" })} required disabled={saving || Boolean(flight)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select an aircraft</option>
            {data.aircraft.filter((item) => item.active || item.id === flight?.live_aircraft_id).map((item) => <option key={item.id} value={item.id} disabled={!item.active}>{item.registration} · {item.name}{!item.active ? " (inactive)" : ""}</option>)}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="flight-departure-time">Scheduled departure (UTC)</Label><Input id="flight-departure-time" type="datetime-local" value={form.scheduled_departure} onChange={(event) => setForm({ ...form, scheduled_departure: event.target.value })} required disabled={saving} /></div>
          <div className="space-y-2"><Label htmlFor="flight-arrival-time">Scheduled arrival (UTC)</Label><Input id="flight-arrival-time" type="datetime-local" value={form.scheduled_arrival} onChange={(event) => setForm({ ...form, scheduled_arrival: event.target.value })} required disabled={saving} /></div>
          <div className="space-y-2"><Label htmlFor="flight-departure">Departure airport</Label><Input id="flight-departure" placeholder="ICAO" value={departure} onChange={(event) => setForm({ ...form, departure: event.target.value.toUpperCase() })} maxLength={4} required readOnly={Boolean(inferredDeparture)} disabled={saving} /><p className="text-xs text-muted-foreground">{inferredDeparture ? "Based on the aircraft’s location and earlier approved flights." : "Location is unknown. Enter the actual departure airport for review."}</p></div>
          <div className="space-y-2"><Label htmlFor="flight-arrival">Destination airport</Label><Input id="flight-arrival" placeholder="ICAO" value={form.arrival} onChange={(event) => setForm({ ...form, arrival: event.target.value.toUpperCase() })} maxLength={4} required disabled={saving} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor="flight-callsign">Flight callsign <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="flight-callsign" value={form.callsign} onChange={(event) => setForm({ ...form, callsign: event.target.value })} maxLength={32} placeholder="e.g. WNC123" disabled={saving} /></div>
        <div className="space-y-2"><Label htmlFor="flight-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="flight-notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} maxLength={2000} disabled={saving} placeholder="Flight plan or useful information for your crew" /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving || !aircraft}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{flight ? "Save changes" : "Submit request"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
