"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { flightTypeLabel, ifFlightTypeLabel } from "@/lib/scheduling/flight-types";
import type { LiveAircraft, ScheduledFlight, SchedulingPilot } from "./types";
import type { RemoteSchedule } from "./if-schedule-editor";
import { schedulingResponse } from "./use-scheduling";
import { errorMessage, formatIfScheduleTimeRange } from "./utils";

export function IfScheduleMatchDialog({ aircraft, schedule, flights, pilots, loadedAt, stale, onClose, onDenied, onStale, onMatched }: {
  aircraft: LiveAircraft;
  schedule: RemoteSchedule;
  flights: ScheduledFlight[];
  pilots: SchedulingPilot[];
  loadedAt: string;
  stale: boolean;
  onClose: () => void;
  onDenied: () => void;
  onStale: () => void;
  onMatched: (flightId: number) => Promise<void>;
}) {
  const candidates = flights.filter(flight => flight.live_aircraft_id === aircraft.id && flight.status === "approved" &&
    (!flight.if_schedule_id || flight.if_schedule_id.toLowerCase() === schedule.id.toLowerCase()) &&
    (!schedule.managedFlightId || schedule.managedFlightId === flight.id));
  const [flightId, setFlightId] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const flight = candidates.find(item => item.id === Number(flightId));
  const snapshotStale = stale || !Number.isFinite(Date.parse(loadedAt)) || Date.now() - Date.parse(loadedAt) >= 60000;
  const pilotName = (userId: string) => pilots.find(pilot => pilot.ifuserid?.toLowerCase() === userId.toLowerCase())?.name;
  const localIfId = (pilot: SchedulingPilot | undefined) => pilots.find(item => item.id === pilot?.id)?.ifuserid || pilot?.ifuserid;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  async function match(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !flight || !confirmed) return;
    if (snapshotStale || Date.now() - Date.parse(loadedAt) >= 60000 || !schedule.fingerprint || !schedule.matchable || schedule.status !== 1) {
      setError("Refresh IF schedules before confirming a match. Only flights that have not started can be matched.");
      onStale();
      return;
    }
    setSaving(true); setError("");
    const next = new AbortController(); controller.current = next;
    const timeout = window.setTimeout(() => next.abort(), 25000);
    try {
      const response = await authFetch("/api/admin/scheduling/if/match", {
        method: "POST", signal: next.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flightId: flight.id, scheduleId: schedule.id, expectedFingerprint: schedule.fingerprint, expectedRevision: flight.revision }),
      });
      if ([401, 403].includes(response.status) && mounted.current) onDenied();
      if (response.status === 409 && mounted.current) onStale();
      const result = await schedulingResponse(response);
      if (result?.data?.flightId !== flight.id) {
        onStale();
        throw new Error("The match returned an unexpected response. Refresh local flights and IF schedules before retrying.");
      }
      if (mounted.current) await onMatched(flight.id);
    } catch (matchError) {
      if (mounted.current) {
        if (next.signal.aborted) onStale();
        setError(next.signal.aborted ? "The match took too long. Refresh local flights and IF schedules to check whether it succeeded before retrying." : errorMessage(matchError));
      }
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current) setSaving(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Match Infinite Flight to a Crew Center flight</DialogTitle>
        <DialogDescription>Identify the same flight on {aircraft.registration}. Review both plans before confirming. All times are UTC.</DialogDescription>
      </DialogHeader>
      <form onSubmit={event => void match(event)} className="space-y-4">
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {snapshotStale && <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">The IF snapshot needs refreshing. Close this dialog and refresh IF schedules before confirming.</p>}
        <div className="space-y-2"><Label htmlFor="if-match-flight">Approved Crew Center flight</Label><select id="if-match-flight" required value={flightId} disabled={saving} onChange={event => { setFlightId(event.target.value); setConfirmed(false); setError(""); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select the corresponding flight</option>{candidates.map(item => <option key={item.id} value={item.id}>{item.callsign || `Flight ${item.id}`} · {item.departure} → {item.arrival} · {item.captain?.name || "Captain unavailable"}</option>)}</select>{!candidates.length && <p className="text-sm text-muted-foreground">No approved local flight is available to match to this IF schedule.</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-2 rounded-md border p-4" aria-label="Crew Center flight comparison"><h3 className="font-semibold">Crew Center plan</h3>{flight ? <>
            <p className="text-sm">{flight.callsign || "No callsign"} · {flight.departure} → {flight.arrival}</p>
            <p className="text-xs text-muted-foreground">{flightTypeLabel(flight.flight_type)} · {formatIfScheduleTimeRange(flight.scheduled_departure, flight.scheduled_arrival)}</p>
            <p className="text-sm">Captain: {flight.captain?.name || "Unavailable"}</p><p className="break-all text-xs text-muted-foreground">IF ID: {localIfId(flight.captain) || "Not linked"}</p>
            {flight.members.filter(member => member.status === "approved").map(member => <div key={member.id}><p className="text-sm">Crew: {member.pilot?.name || "Unavailable"}</p><p className="break-all text-xs text-muted-foreground">IF ID: {localIfId(member.pilot) || "Not linked"}</p></div>)}
            <p className="whitespace-pre-wrap text-xs text-muted-foreground">Notes: {flight.notes || "None"}</p>
          </> : <p className="text-sm text-muted-foreground">Select a local flight to compare its details.</p>}</section>
          <section className="space-y-2 rounded-md border p-4" aria-label="Infinite Flight comparison"><h3 className="font-semibold">Infinite Flight plan</h3><p className="text-sm">{schedule.callsign || "No callsign"} · {schedule.originIcao} → {schedule.destinationIcao}</p><p className="text-xs text-muted-foreground">{ifFlightTypeLabel(schedule.flightType)} · {formatIfScheduleTimeRange(schedule.scheduledDepartureUtc, schedule.scheduledArrivalUtc)}</p>{schedule.crew.length ? schedule.crew.map(member => <div key={member.userId}><p className="text-sm">{member.role === 0 ? "Captain" : "Crew"}: {pilotName(member.userId) || "IF user"}</p><p className="break-all text-xs text-muted-foreground">IF ID: {member.userId}</p></div>) : <p className="text-sm text-muted-foreground">No crew assigned.</p>}</section>
        </div>
        <p className="text-sm text-muted-foreground">Confirming updates this existing IF schedule with the Crew Center callsign, route, flight type, planned times, and notes. Its IF briefing is replaced with the Crew Center notes, and any separate IF flight plan is cleared. It creates no duplicate flight. The approved Crew Center crew becomes authoritative; any missing crew assignments are queued and run when IF publishing is enabled. The route, type, captain, and existing crew must be compatible.</p>
        <div className="flex items-start gap-2"><Checkbox id="if-match-confirm" checked={confirmed} disabled={saving || !flight || snapshotStale} onCheckedChange={checked => setConfirmed(checked === true)} /><Label htmlFor="if-match-confirm" className="text-sm leading-5">I confirm these are the same flight and Crew Center should manage this IF schedule.</Label></div>
        <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Back</Button><Button type="submit" disabled={saving || !flight || !confirmed || snapshotStale}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm flight match</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
