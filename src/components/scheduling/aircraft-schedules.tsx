"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { LiveAircraft, ScheduledFlight } from "./types";
import { schedulingResponse } from "./use-scheduling";
import { crewCount, errorMessage, formatUtc, ifScheduleStatusLabel, publishingLabel, statusLabels } from "./utils";

type RemoteSchedule = {
  id: string;
  callsign: string;
  originIcao: string;
  destinationIcao: string;
  scheduledDepartureUtc: string;
  scheduledArrivalUtc: string;
  status: number;
  crew: Array<{ userId: string; role: number }>;
};

type AircraftIfSchedules = {
  schedules: RemoteSchedule[];
  loadedAt: string;
  expiresAt: string;
  publishingReady: boolean;
  publishingDisabledReasons: string[];
};

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
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [expired, setExpired] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const scope = useRef(0);
  const mounted = useRef(true);
  const linked = Boolean(aircraft.if_aircraft_id);
  const localFlights = flights.filter(flight => flight.live_aircraft_id === aircraft.id)
    .sort((left, right) => Date.parse(left.scheduled_departure) - Date.parse(right.scheduled_departure));

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
    setSnapshot(null); setLoading(true); setError(""); setExpired(false);
    const timeout = window.setTimeout(() => next.abort(), 25000);
    try {
      const path = admin ? "/api/admin/scheduling/if/schedules" : "/api/scheduling/if/schedules";
      const result = await schedulingResponse(await authFetch(`${path}?aircraftId=${aircraft.id}`, { cache: "no-store", signal: next.signal }));
      const payload = result?.data;
      if (!Array.isArray(payload?.schedules) || !Number.isFinite(Date.parse(payload.expiresAt))) {
        throw new Error("IF schedules returned an unexpected response. Please refresh.");
      }
      if (mounted.current && current === generation.current) setSnapshot(payload);
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
    setSnapshot(null); setError(""); setMessage(""); setExpired(false); setPublishing(false);
    if (linked) void load();
    return cancelRequests;
  }, [linked, aircraft.if_aircraft_id, load, cancelRequests]);

  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => { setSnapshot(null); setExpired(true); }, Math.max(0, Math.min(60000, Date.parse(snapshot.expiresAt) - Date.now())));
    return () => window.clearTimeout(timer);
  }, [snapshot]);

  async function publish() {
    if (publishing || !snapshot?.publishingReady) return;
    const currentScope = scope.current;
    setPublishing(true); setMessage(""); setError("");
    try {
      const result = await schedulingResponse(await authFetch("/api/admin/scheduling/if/publish", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aircraftId: aircraft.id }),
      }));
      if (!mounted.current || currentScope !== scope.current) return;
      const outcome = result.data;
      const states = outcome?.states || {};
      const issues = ["conflict", "reconciliation", "failed", "queued"].filter(state => Number(states[state]) > 0)
        .map(state => `${Number(states[state])} ${state === "queued" ? "waiting to retry" : state}`).join("; ");
      setMessage(outcome?.disabled ? "Publishing is unavailable. Refresh the IF connection settings." :
        `${Number(outcome?.published || 0)} of ${Number(outcome?.processed || 0)} processed jobs synchronized with IF.${issues ? " " + issues + "." : ""} Review each flight’s publishing status; additional queued flights need another run or the automatic worker.`);
      await onRefresh();
      if (mounted.current && currentScope === scope.current) await load();
    } catch (publishError) {
      if (mounted.current && currentScope === scope.current) { setError(errorMessage(publishError)); setSnapshot(null); }
    } finally { if (mounted.current && currentScope === scope.current) setPublishing(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open && !publishing) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>{aircraft.registration} · Aircraft schedules</DialogTitle>
        <DialogDescription>Review Crew Center flights alongside the aircraft’s Infinite Flight schedules. All times are UTC.</DialogDescription>
      </DialogHeader>
      {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <section className="space-y-3" aria-label="Crew Center schedules">
        <h3 className="font-semibold">Crew Center flights</h3>
        {!localFlights.length ? <p className="text-sm text-muted-foreground">No local flights for this aircraft.</p> : localFlights.map(flight => <button key={flight.id} type="button" disabled={publishing} onClick={() => onSelect(flight)} className="w-full space-y-2 rounded-md border p-3 text-left hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{flight.callsign || "Flight"} · {flight.departure} → {flight.arrival}</p><Badge variant="secondary">{statusLabels[flight.status]}</Badge></div>
          <p className="text-xs text-muted-foreground">{formatUtc(flight.scheduled_departure)} — {formatUtc(flight.scheduled_arrival)}</p>
          <p className="text-xs text-muted-foreground">{flight.captain?.name || "Captain unavailable"} · {crewCount(flight)}/3 crew · {publishingLabel(flight.publishing_state)}</p>
          {flight.error && <p className="text-xs text-destructive">{flight.error}</p>}
        </button>)}
      </section>
      <section className="space-y-3 border-t pt-4" aria-label="Infinite Flight schedules">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Infinite Flight schedules</h3>{linked && <Button variant="outline" size="sm" disabled={loading || publishing} onClick={() => void load()}><RefreshCw className={"mr-2 h-4 w-4 " + (loading ? "animate-spin" : "")} />Refresh IF schedules</Button>}</div>
        {!linked ? <p className="text-sm text-muted-foreground">This aircraft uses local scheduling. An admin can link it to an IF aircraft to load its schedules.</p> : <>
          {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading IF schedules…</p>}
          {expired && <p role="status" className="text-sm text-muted-foreground">The temporary IF schedules expired. Refresh to load them again.</p>}
          {snapshot && <>
            <p className="text-xs text-muted-foreground">Loaded {formatUtc(snapshot.loadedAt)}. IF schedules are temporary; actual arrivals still confirm the local airport.</p>
            {snapshot.schedules.length ? snapshot.schedules.map(schedule => {
              const managed = localFlights.find(flight => flight.if_schedule_id?.toLowerCase() === schedule.id.toLowerCase());
              return <div key={schedule.id} className="space-y-2 rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{schedule.callsign || "IF flight"} · {schedule.originIcao} → {schedule.destinationIcao}</p><Badge variant="outline">{ifScheduleStatusLabel(schedule.status)}</Badge></div>
                <p className="text-xs text-muted-foreground">{formatUtc(schedule.scheduledDepartureUtc)} — {formatUtc(schedule.scheduledArrivalUtc)}</p>
                <p className="text-xs text-muted-foreground">{schedule.crew.length} assigned crew · {schedule.crew.some(member => member.role === 0) ? "Captain assigned" : "No captain assigned"} · {managed ? "Linked to Crew Center" : "No local flight link"}</p>
                {managed && <Button variant="link" size="sm" className="h-auto p-0" disabled={publishing} onClick={() => onSelect(managed)}>View local flight</Button>}
              </div>;
            }) : <p className="text-sm text-muted-foreground">No schedules returned by IF.</p>}
            {admin && <div className="space-y-2 rounded-md border bg-muted/20 p-3">
              <p className="text-sm text-muted-foreground">Publish approved flights and crew changes queued for this aircraft. Flights created outside Crew Center require separate conflict resolution and are never overwritten automatically.</p>
              {!snapshot.publishingReady && <ul className="list-disc pl-4 text-xs text-muted-foreground">{snapshot.publishingDisabledReasons?.map(reason => <li key={reason}>{reason}</li>)}</ul>}
              <Button disabled={publishing || loading || !snapshot.publishingReady} onClick={() => void publish()}>{publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publish queued flights</Button>
            </div>}
          </>}
        </>}
      </section>
    </DialogContent>
  </Dialog>;
}
