"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, LockKeyhole, Pencil, RefreshCw, Send } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LiveAircraft, ScheduledFlight } from "./types";
import { schedulingResponse } from "./use-scheduling";
import { crewCount, errorMessage, formatIfScheduleTimeRange, formatUtc, ifScheduleStatusLabel, publishingLabel, statusLabels } from "./utils";
import { IfScheduleEditor, type RemoteSchedule } from "./if-schedule-editor";
import { flightTypeLabel, ifFlightTypeLabel } from "@/lib/scheduling/flight-types";

type AircraftIfSchedules = {
  schedules: RemoteSchedule[];
  loadedAt: string;
  expiresAt: string;
  publishingReady: boolean;
  publishingDisabledReasons: string[];
};

function newestSchedulesFirst(schedules: RemoteSchedule[]) {
  const reversed = [...schedules].reverse();
  const sequenced = reversed.filter(schedule => typeof schedule.sequence === "number" && Number.isFinite(schedule.sequence))
    .sort((left, right) => right.sequence! - left.sequence!);
  let cursor = 0;
  return reversed.map(schedule => typeof schedule.sequence === "number" && Number.isFinite(schedule.sequence) ? sequenced[cursor++] : schedule);
}

export function AircraftSchedulesDialog({ aircraft, flights, admin, onClose, onSelect, onRefresh }: {
  aircraft: LiveAircraft;
  flights: ScheduledFlight[];
  admin: boolean;
  onClose: () => void;
  onSelect: (flight: ScheduledFlight) => void;
  onRefresh: () => Promise<void>;
}) {
  const [snapshot, setSnapshot] = useState<AircraftIfSchedules | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<RemoteSchedule | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const scope = useRef(0);
  const mounted = useRef(true);
  const linked = Boolean(aircraft.if_aircraft_id);
  const localFlights = flights.filter(flight => flight.live_aircraft_id === aircraft.id)
    .sort((left, right) => (left.queue_order ?? Number.POSITIVE_INFINITY) - (right.queue_order ?? Number.POSITIVE_INFINITY) || left.id - right.id);

  const cancelRequests = useCallback(() => {
    mounted.current = false;
    ++scope.current; ++generation.current;
    controller.current?.abort();
  }, []);

  const load = useCallback(async () => {
    const current = ++generation.current;
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    setLoading(true); setError("");
    const timeout = window.setTimeout(() => next.abort(), 25000);
    try {
      const path = admin ? "/api/admin/scheduling/if/schedules" : "/api/scheduling/if/schedules";
      const response = await authFetch(`${path}?aircraftId=${aircraft.id}`, { cache: "no-store", signal: next.signal });
      if (mounted.current && current === generation.current && [401, 403].includes(response.status)) {
        setSnapshot(null); setEditing(null); setStale(false);
      }
      if (!response.ok && response.status === 409) {
        const failure = await response.clone().json().catch(() => null);
        if (["binding", "connection_changed"].includes(failure?.code) && mounted.current && current === generation.current) {
          setSnapshot(null); setEditing(null); setStale(false);
        }
      }
      const result = await schedulingResponse(response);
      const payload = result?.data;
      if (!Array.isArray(payload?.schedules) || !Number.isFinite(Date.parse(payload.loadedAt))) {
        throw new Error("IF schedules returned an unexpected response. Please refresh.");
      }
      if (mounted.current && current === generation.current) {
        setSnapshot(payload); setStale(Date.now() - Date.parse(payload.loadedAt) >= 60000); setMessage("");
      }
    } catch (loadError) {
      if (mounted.current && current === generation.current) {
        setError(next.signal.aborted ? "IF schedules took too long to load. Please refresh." : errorMessage(loadError));
      }
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current && current === generation.current) setLoading(false);
    }
  }, [admin, aircraft.id]);

  useEffect(() => {
    mounted.current = true;
    ++scope.current;
    setSnapshot(null); setError(""); setMessage(""); setStale(false); setPublishing(false); setLoading(false); setEditing(null);
    return cancelRequests;
  }, [linked, aircraft.if_aircraft_id, aircraft.aircraft_id, load, cancelRequests]);

  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => setStale(true), Math.max(0, Math.min(60000, Date.parse(snapshot.loadedAt) + 60000 - Date.now())));
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  async function publish() {
    if (publishing || !snapshot?.publishingReady) return;
    const currentScope = scope.current;
    setPublishing(true); setMessage(""); setError("");
    try {
      const response = await authFetch("/api/admin/scheduling/if/publish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aircraftId: aircraft.id }),
      });
      if ([401, 403].includes(response.status) && mounted.current && currentScope === scope.current) setSnapshot(null);
      const result = await schedulingResponse(response);
      if (!mounted.current || currentScope !== scope.current) return;
      const outcome = result.data;
      const states = outcome?.states || {};
      const issues = ["conflict", "reconciliation", "failed", "queued"].filter(state => Number(states[state]) > 0)
        .map(state => `${Number(states[state])} ${state === "queued" ? "waiting to retry" : state}`).join("; ");
      setMessage(outcome?.disabled ? "Publishing is unavailable. Refresh the IF connection settings." :
        `${Number(outcome?.published || 0)} of ${Number(outcome?.processed || 0)} processed jobs synchronized with IF.${issues ? " " + issues + "." : ""} Refresh IF schedules to see the latest queue. Additional queued flights need another run or the automatic worker.`);
      setStale(true);
      await onRefresh();
    } catch (publishError) {
      if (mounted.current && currentScope === scope.current) setError(errorMessage(publishError));
    } finally { if (mounted.current && currentScope === scope.current) setPublishing(false); }
  }

  return <>
    <Dialog open onOpenChange={open => { if (!open && !publishing && !editing) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{aircraft.registration} · Aircraft schedules</DialogTitle>
          <DialogDescription>Review Crew Center flights alongside the aircraft’s Infinite Flight schedules. IF schedules load when you request them. All times are UTC.</DialogDescription>
        </DialogHeader>
        {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}
        {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <section className="space-y-3" aria-label="Crew Center schedules">
          <h3 className="font-semibold">Crew Center flights</h3>
          {!localFlights.length ? <p className="text-sm text-muted-foreground">No local flights for this aircraft.</p> : localFlights.map(flight => <button key={flight.id} type="button" disabled={publishing} onClick={() => onSelect(flight)} className="w-full space-y-2 rounded-md border p-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{flight.callsign || "Flight"} · {flight.departure} → {flight.arrival}</p><Badge variant="secondary">{statusLabels[flight.status]}</Badge></div>
            <p className="text-xs text-muted-foreground">{formatIfScheduleTimeRange(flight.scheduled_departure, flight.scheduled_arrival)}</p>
            <p className="text-xs text-muted-foreground">{flightTypeLabel(flight.flight_type)} · {flight.captain?.name || "Captain unavailable"} · {crewCount(flight)}/3 crew · {publishingLabel(flight.publishing_state)}</p>
            {flight.error && <p className="text-xs text-destructive">{flight.error}</p>}
          </button>)}
        </section>
        <section className="space-y-3 border-t pt-4" aria-label="Infinite Flight schedules">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Infinite Flight schedules</h3>{linked && <Button variant="outline" size="sm" disabled={loading || publishing || Boolean(editing)} onClick={() => void load()}><RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} />{snapshot ? "Refresh IF schedules" : "Load IF schedules"}</Button>}</div>
          {!linked ? <p className="text-sm text-muted-foreground">This aircraft uses local scheduling. An admin can link it to an IF aircraft to load its schedules.</p> : <>
            {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading IF schedules…</p>}
            {!snapshot && !loading && <p className="text-sm text-muted-foreground">Select Load IF schedules to request the aircraft’s current itinerary.</p>}
            {snapshot && <>
              <p className="text-xs text-muted-foreground">Last successful refresh: {formatUtc(snapshot.loadedAt)}. Newest queue entries appear first. Actual arrivals still confirm the local airport.</p>
              {stale && <p role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">These IF schedules may have changed. The last refresh is over 60 seconds old, or a schedule was changed. Refresh IF schedules before relying on this view.</p>}
              {snapshot.schedules.length ? newestSchedulesFirst(snapshot.schedules).map(schedule => {
                const managed = localFlights.find(flight => flight.id === schedule.managedFlightId || flight.if_schedule_id?.toLowerCase() === schedule.id.toLowerCase());
                return <div key={schedule.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{schedule.callsign || "IF flight"} · {schedule.originIcao} → {schedule.destinationIcao}</p><Badge variant="outline">{ifScheduleStatusLabel(schedule.status)}</Badge></div>
                  <p className="text-xs text-muted-foreground">{formatIfScheduleTimeRange(schedule.scheduledDepartureUtc, schedule.scheduledArrivalUtc)}</p>
                  <p className="text-xs text-muted-foreground">{ifFlightTypeLabel(schedule.flightType)} · {schedule.crew.length} assigned crew · {schedule.crew.some(member => member.role === 0) ? "Captain assigned" : "No captain assigned"} · {managed || schedule.managedFlightId ? "Linked to Crew Center" : "No local flight link"}{typeof schedule.sequence === "number" ? ` · Queue position ${schedule.sequence}` : ""}</p>
                  {schedule.status === 11 || schedule.editDisabledReason === "Arrived flights are locked" ? <p className="flex items-center gap-1 text-xs text-muted-foreground"><LockKeyhole className="h-3 w-3" />Arrived flights are locked.</p> : admin && !managed && !schedule.managedFlightId && !schedule.editable && <p className="text-xs text-muted-foreground">{schedule.editDisabledReason || "This IF flight cannot be edited in its current state."}</p>}
                  <div className="flex flex-wrap gap-3">
                    {managed && <Button variant="link" size="sm" className="h-auto p-0" disabled={publishing} onClick={() => onSelect(managed)}>{admin && schedule.status !== 11 ? "View or amend local flight" : "View local flight"}</Button>}
                    {admin && !managed && !schedule.managedFlightId && schedule.editable && schedule.fingerprint && schedule.status !== 11 && <Button variant="outline" size="sm" disabled={loading || publishing} onClick={() => setEditing(schedule)}><Pencil className="mr-2 h-4 w-4" />Edit IF schedule</Button>}
                  </div>
                </div>;
              }) : <p className="text-sm text-muted-foreground">No schedules returned by IF.</p>}
              {admin && <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">Publish approved flights and crew changes queued for this aircraft. Edit an unfinished external IF flight using its edit button; Crew Center flights use local amendments.</p>
                {!snapshot.publishingReady && <ul className="list-disc pl-4 text-xs text-muted-foreground">{snapshot.publishingDisabledReasons?.map(reason => <li key={reason}>{reason}</li>)}</ul>}
                <Button disabled={publishing || loading || !snapshot.publishingReady} onClick={() => void publish()}>{publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publish queued flights</Button>
              </div>}
            </>}
          </>}
        </section>
      </DialogContent>
    </Dialog>
    {editing && admin && <IfScheduleEditor key={`${aircraft.id}:${editing.id}:${editing.fingerprint}`} aircraftId={aircraft.id} schedule={editing} onClose={() => setEditing(null)} onDenied={() => { setSnapshot(null); setEditing(null); }} onSave={saved => {
      setSnapshot(current => current ? { ...current, schedules: current.schedules.map(schedule => schedule.id === saved.id ? saved : schedule) } : null);
      setEditing(null); setStale(true); setMessage("IF schedule updated. Refresh IF schedules to check the full aircraft queue.");
    }} />}
  </>;
}
