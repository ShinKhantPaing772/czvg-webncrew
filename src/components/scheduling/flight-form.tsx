"use client";

import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FlightInput, ScheduledFlight, SchedulingData } from "./types";
import { errorMessage, inputToIso, utcInput } from "./utils";
import { orderedQueue, projectedOrigin, RESERVED_STATUSES } from "@/lib/scheduling/policy";
import { DEFAULT_FLIGHT_TYPE, FLIGHT_TYPES, isFlightType } from "@/lib/scheduling/flight-types";

type Props = {
  data: SchedulingData;
  flight?: ScheduledFlight;
  aircraftId?: number;
  admin?: boolean;
  onClose: () => void;
  onSave: (input: FlightInput) => Promise<void>;
};

function suggestedTimes(data: SchedulingData, aircraftId: number) {
  const reserved = orderedQueue(data.flights.filter((flight) => flight.live_aircraft_id === aircraftId &&
    RESERVED_STATUSES.includes(flight.status as "approved" | "in_progress")));
  const lastArrival = Math.max(0, ...reserved.map((flight) => flight.scheduled_arrival ? Date.parse(flight.scheduled_arrival) : 0).filter(Number.isFinite));
  // Round up because datetime-local inputs only retain minute precision.
  const start = Math.ceil(Math.max(Date.now() + 60 * 60 * 1000, Number.isFinite(lastArrival) ? lastArrival : 0) / 60_000) * 60_000;
  return { scheduled_departure: utcInput(new Date(start).toISOString()), scheduled_arrival: utcInput(new Date(start + 60 * 60 * 1000).toISOString()) };
}

export function FlightForm({ data, flight, aircraftId, admin, onClose, onSave }: Props) {
  const [form, setForm] = useState(() => {
    const selectedId = flight?.live_aircraft_id || aircraftId || data.aircraft.find((item) => item.active)?.id || 0;
    return {
      live_aircraft_id: selectedId ? String(selectedId) : "",
      callsign: flight?.callsign || "", departure: flight?.departure || "", arrival: flight?.arrival || "",
      flight_type: flight?.flight_type || DEFAULT_FLIGHT_TYPE,
      scheduled_departure: flight?.scheduled_departure ? utcInput(flight.scheduled_departure) : "",
      scheduled_arrival: flight?.scheduled_arrival ? utcInput(flight.scheduled_arrival) : "", notes: flight?.notes || "",
    };
  });
  const [withTimes, setWithTimes] = useState(Boolean(flight?.scheduled_departure && flight.scheduled_arrival));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const aircraft = data.aircraft.find((item) => item.id === Number(form.live_aircraft_id));
  const inferredDeparture = aircraft ? projectedOrigin(aircraft.current_airport,
    data.flights.filter((item) => item.live_aircraft_id === aircraft.id), flight?.queue_order, flight?.id) || "" : "";
  const departure = inferredDeparture || form.departure;
  const aircraftFlights = data.flights.filter(item => item.live_aircraft_id === aircraft?.id);
  const pendingRequests = aircraft?.pending_request_count ?? aircraftFlights.filter(item => item.status === "pending").length;
  const otherRequests = Math.max(0, pendingRequests - (flight?.status === "pending" ? 1 : 0));
  const approvedFlights = aircraft?.approved_schedule_count ?? aircraftFlights.filter(item => item.status === "approved").length;
  const inProgress = aircraft?.in_progress_count ?? aircraftFlights.filter(item => item.status === "in_progress").length;
  const flightsAhead = approvedFlights + inProgress;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!isFlightType(form.flight_type)) {
      setError("Choose a valid flight type.");
      return;
    }
    const scheduledDeparture = withTimes ? inputToIso(form.scheduled_departure) : null;
    const scheduledArrival = withTimes ? inputToIso(form.scheduled_arrival) : null;
    if (!aircraft || (withTimes && (!scheduledDeparture || !scheduledArrival))) {
      setError("Choose an aircraft and enter both UTC times, or leave times unspecified.");
      return;
    }
    if (scheduledDeparture && scheduledArrival && new Date(scheduledArrival) <= new Date(scheduledDeparture)) {
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
        flight_type: form.flight_type,
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
        <DialogDescription>{flight && admin ? "Changes are checked against the aircraft’s flight sequence and published to IF when linked." : "Your request needs admin approval and joins the end of the aircraft’s approved flight sequence. UTC times are optional."}</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="space-y-2">
          <Label htmlFor="flight-aircraft">Aircraft</Label>
          <select id="flight-aircraft" value={form.live_aircraft_id} onChange={(event) => setForm({ ...form, live_aircraft_id: event.target.value, departure: "", ...(!flight && withTimes ? suggestedTimes(data, Number(event.target.value)) : {}) })} required disabled={saving || Boolean(flight)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Select an aircraft</option>
            {data.aircraft.filter((item) => item.active || item.id === flight?.live_aircraft_id).map((item) => <option key={item.id} value={item.id} disabled={!item.active}>{item.registration} · {item.name}{!item.active ? " (inactive)" : ""}</option>)}
          </select>
        </div>
        {aircraft && (!flight || (!admin && flight.status === "pending")) && <div role="status" className={"space-y-1 rounded-md border p-3 text-sm " + (otherRequests ? "border-amber-500/30 bg-amber-500/10" : "bg-muted/20")}>
          <p>{otherRequests ? `${otherRequests} other flight ${otherRequests === 1 ? "request is" : "requests are"} awaiting admin approval for this aircraft. Pending requests do not reserve it.` : "No other flight requests are awaiting approval for this aircraft."}</p>
          <p>{flightsAhead ? `${flightsAhead} approved ${flightsAhead === 1 ? "flight ahead of this request is" : "flights ahead of this request are"} not completed${inProgress ? ` (${inProgress} currently in progress)` : ""}. Your flight can start only after they finish.` : "No unfinished approved flights are ahead of this request."}</p>
        </div>}
        <div className="space-y-2">
          <Label htmlFor="flight-type">Flight type</Label>
          <select id="flight-type" value={form.flight_type} onChange={(event) => {
            if (isFlightType(event.target.value)) setForm({ ...form, flight_type: event.target.value });
          }} required disabled={saving} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            {FLIGHT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        <div className="space-y-2 rounded-md border bg-muted/20 p-3"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={withTimes} disabled={saving} onChange={(event) => {
          setWithTimes(event.target.checked);
          if (event.target.checked && (!form.scheduled_departure || !form.scheduled_arrival)) setForm({ ...form, ...suggestedTimes(data, Number(form.live_aircraft_id)) });
        }} />Set UTC times (optional)</label><p className="text-xs text-muted-foreground">Without times, this flight follows the aircraft’s queue. An untimed crew assignment prevents reservations on another aircraft.</p>{withTimes && !flight && <div className="flex flex-wrap items-center justify-between gap-2"><p className="max-w-sm text-xs text-muted-foreground">Suggested times follow the queue’s planned arrivals with a one-hour slot. Adjust them to fit your flight.</p><Button type="button" variant="outline" size="sm" disabled={saving || !aircraft} onClick={() => setForm({ ...form, ...suggestedTimes(data, Number(form.live_aircraft_id)) })}>Use suggested times</Button></div>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          {withTimes && <><div className="space-y-2"><Label htmlFor="flight-departure-time">Scheduled departure (UTC)</Label><Input id="flight-departure-time" type="datetime-local" value={form.scheduled_departure} onChange={(event) => setForm({ ...form, scheduled_departure: event.target.value })} required disabled={saving} /></div>
          <div className="space-y-2"><Label htmlFor="flight-arrival-time">Scheduled arrival (UTC)</Label><Input id="flight-arrival-time" type="datetime-local" value={form.scheduled_arrival} onChange={(event) => setForm({ ...form, scheduled_arrival: event.target.value })} required disabled={saving} /></div></>}
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
