"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { schedulingResponse } from "./use-scheduling";
import { errorMessage, hasIfScheduleTime, inputToIso, utcInput } from "./utils";
import { IF_FLIGHT_TYPES } from "@/lib/scheduling/flight-types";

export type RemoteSchedule = {
  id: string;
  callsign: string;
  flightType?: number;
  originIcao: string;
  destinationIcao: string;
  scheduledDepartureUtc: string | null;
  scheduledArrivalUtc: string | null;
  status: number;
  crew: Array<{ userId: string; role: number }>;
  sequence?: number | null;
  fingerprint?: string;
  managedFlightId?: number | null;
  editable?: boolean;
  editDisabledReason?: string | null;
};

export function IfScheduleEditor({ aircraftId, schedule, onClose, onSave, onDenied }: {
  aircraftId: number;
  schedule: RemoteSchedule;
  onClose: () => void;
  onSave: (schedule: RemoteSchedule) => void;
  onDenied: () => void;
}) {
  const [callsign, setCallsign] = useState(schedule.callsign);
  const [flightType, setFlightType] = useState(schedule.flightType ?? 1);
  const [origin, setOrigin] = useState(schedule.originIcao);
  const [destination, setDestination] = useState(schedule.destinationIcao);
  const [departure, setDeparture] = useState(hasIfScheduleTime(schedule.scheduledDepartureUtc) ? utcInput(schedule.scheduledDepartureUtc) : "");
  const [arrival, setArrival] = useState(hasIfScheduleTime(schedule.scheduledArrivalUtc) ? utcInput(schedule.scheduledArrivalUtc) : "");
  const [setTimes, setSetTimes] = useState(hasIfScheduleTime(schedule.scheduledDepartureUtc) && hasIfScheduleTime(schedule.scheduledArrivalUtc));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!schedule.editable || !schedule.fingerprint || schedule.status === 11 || schedule.managedFlightId) {
      setError("This flight cannot be edited directly in Infinite Flight. Refresh its schedules before continuing.");
      return;
    }
    if (!IF_FLIGHT_TYPES.some(type => type.value === flightType)) {
      setError("Choose a valid flight type.");
      return;
    }
    const plannedDeparture = !setTimes ? null : hasIfScheduleTime(schedule.scheduledDepartureUtc) && departure === utcInput(schedule.scheduledDepartureUtc) ? schedule.scheduledDepartureUtc : inputToIso(departure);
    const plannedArrival = !setTimes ? null : hasIfScheduleTime(schedule.scheduledArrivalUtc) && arrival === utcInput(schedule.scheduledArrivalUtc) ? schedule.scheduledArrivalUtc : inputToIso(arrival);
    if (setTimes && (!hasIfScheduleTime(plannedDeparture) || !hasIfScheduleTime(plannedArrival) || Date.parse(plannedArrival) <= Date.parse(plannedDeparture))) {
      setError("Enter valid UTC departure and arrival times, with arrival after departure.");
      return;
    }
    if (!callsign.trim() || callsign.trim().length > 32 || /[\u0000-\u001f\u007f]/.test(callsign.trim())) {
      setError("Enter a callsign with 1 to 32 characters.");
      return;
    }
    if (!/^[A-Z0-9]{1,8}$/.test(origin.trim().toUpperCase()) || !/^[A-Z0-9]{1,8}$/.test(destination.trim().toUpperCase())) {
      setError("Enter valid departure and destination airport codes.");
      return;
    }
    setSaving(true); setError("");
    const next = new AbortController(); controller.current = next;
    const timeout = window.setTimeout(() => next.abort(), 25000);
    try {
      const response = await authFetch("/api/admin/scheduling/if/schedules", {
        method: "PATCH", signal: next.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aircraftId, scheduleId: schedule.id, expectedFingerprint: schedule.fingerprint,
          changes: { callsign: callsign.trim(), flightType, originIcao: origin.trim().toUpperCase(), destinationIcao: destination.trim().toUpperCase(), scheduledDepartureUtc: plannedDeparture, scheduledArrivalUtc: plannedArrival },
        }),
      });
      if ([401, 403].includes(response.status) && mounted.current) onDenied();
      const result = await schedulingResponse(response);
      if (!result?.data?.schedule || result.data.schedule.id !== schedule.id) throw new Error("The IF update returned an unexpected response. Refresh schedules to check the result before retrying.");
      if (mounted.current) onSave(result.data.schedule);
    } catch (saveError) {
      if (mounted.current) setError(next.signal.aborted ? "The IF update took too long. Refresh schedules to check the result before retrying." : errorMessage(saveError));
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current) setSaving(false);
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit Infinite Flight schedule</DialogTitle>
        <DialogDescription>Save changes directly to this IF flight. Its crew and place in the aircraft’s queue are preserved. All times are UTC.</DialogDescription>
      </DialogHeader>
      <form onSubmit={event => void save(event)} className="space-y-4">
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="space-y-2"><Label htmlFor="if-schedule-callsign">Callsign</Label><Input id="if-schedule-callsign" value={callsign} onChange={event => setCallsign(event.target.value)} maxLength={32} required disabled={saving} /></div>
        <div className="space-y-2"><Label htmlFor="if-schedule-flight-type">Flight type</Label><select id="if-schedule-flight-type" value={flightType} onChange={event => setFlightType(Number(event.target.value))} required disabled={saving} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{IF_FLIGHT_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="if-schedule-origin">Departure airport</Label><Input id="if-schedule-origin" value={origin} onChange={event => setOrigin(event.target.value.toUpperCase())} maxLength={8} required disabled={saving} /></div>
          <div className="space-y-2"><Label htmlFor="if-schedule-destination">Destination airport</Label><Input id="if-schedule-destination" value={destination} onChange={event => setDestination(event.target.value.toUpperCase())} maxLength={8} required disabled={saving} /></div>
        </div>
        <Label htmlFor="if-schedule-set-times" className="flex items-center gap-2"><input id="if-schedule-set-times" type="checkbox" checked={setTimes} onChange={event => setSetTimes(event.target.checked)} disabled={saving} className="h-4 w-4 accent-primary" />Set planned times</Label>
        {setTimes && <>
          <div className="space-y-2"><Label htmlFor="if-schedule-departure">Planned departure (UTC)</Label><Input id="if-schedule-departure" type="datetime-local" value={departure} onChange={event => setDeparture(event.target.value)} required disabled={saving} /></div>
          <div className="space-y-2"><Label htmlFor="if-schedule-arrival">Planned arrival (UTC)</Label><Input id="if-schedule-arrival" type="datetime-local" value={arrival} onChange={event => setArrival(event.target.value)} required disabled={saving} /></div>
        </>}
        <p className="text-xs text-muted-foreground">Leave planned times off to keep this flight in the aircraft’s queue without a time reservation. Infinite Flight’s year-one default means no planned time was set.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save to Infinite Flight</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
