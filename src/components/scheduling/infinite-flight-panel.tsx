"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LiveAircraft, ScheduledFlight, SchedulingPilot } from "./types";
import { errorMessage, formatUtc } from "./utils";
import { schedulingResponse } from "./use-scheduling";

type IntegrationStatus = {
  enabled: boolean;
  autoPublishEnabled: boolean;
  durableBindingsAllowed: boolean;
  configured: boolean;
  disabledReasons: string[];
  connection: { state: string; organizationId: string | null; expiresAt: string | null } | null;
};
type IfOrganization = { id: string; name: string };
type IfAircraft = { id: string; aircraftId: string; organizationId: string; registration: string; isFleetActiveSlot: boolean; visibility: number };
type IfSchedule = { id: string; callsign: string; originIcao: string; destinationIcao: string; scheduledDepartureUtc: string; scheduledArrivalUtc: string; crew?: Array<{ userId: string; role: number }> };
type Inspection = { aircraft: IfAircraft; position: { latitude?: number; longitude?: number; isOnGround?: boolean; updatedAt?: string } | null; schedules: IfSchedule[] };

async function ifRequest(path: string, body?: Record<string, unknown>) {
  const response = await authFetch("/api/admin/scheduling/if/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  return schedulingResponse(response);
}

export function InfiniteFlightPanel({ aircraft, flights, pilots = [], onRefresh }: { aircraft: LiveAircraft[]; flights: ScheduledFlight[]; pilots?: SchedulingPilot[]; onRefresh: () => Promise<void> }) {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [organizations, setOrganizations] = useState<IfOrganization[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [remoteAircraft, setRemoteAircraft] = useState<IfAircraft[]>([]);
  const [fleetLoaded, setFleetLoaded] = useState(false);
  const [selectedTails, setSelectedTails] = useState<Record<string, string>>({});
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [recovery, setRecovery] = useState<{ flight: ScheduledFlight; action: "overwrite" | "recreate" } | null>(null);
  const lastInteraction = useRef(Date.now());

  const loadStatus = useCallback(async () => {
    const result = await ifRequest("status");
    setStatus(result.data);
    setOrganizationId((current) => current || result.data.connection?.organizationId || "");
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try { if (active) await loadStatus(); }
      catch (loadError) { if (active) setError(errorMessage(loadError)); }
      finally { if (active) setLoading(false); }
    };
    void load();
    const callback = new URLSearchParams(window.location.search).get("if");
    if (callback === "connected") setMessage("Infinite Flight connected. Select the organization to use for this fleet.");
    if (callback === "error") setError("Infinite Flight authorization did not complete. Check the connection setup and try again.");
    const onInteraction = () => { lastInteraction.current = Date.now(); };
    const onFocus = () => { onInteraction(); void load(); };
    const interval = window.setInterval(() => { if (document.visibilityState === "visible" && Date.now() - lastInteraction.current < 15 * 60 * 1000) void load(); }, 30000);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pointerdown", onInteraction);
    window.addEventListener("keydown", onInteraction);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener("focus", onFocus); window.removeEventListener("pointerdown", onInteraction); window.removeEventListener("keydown", onInteraction); };
  }, [loadStatus]);

  useEffect(() => {
    if (!organizations.length) return;
    const timer = window.setTimeout(() => setOrganizations([]), 60000);
    return () => window.clearTimeout(timer);
  }, [organizations]);

  useEffect(() => {
    if (!remoteAircraft.length) return;
    const timer = window.setTimeout(() => { setRemoteAircraft([]); setFleetLoaded(false); setSelectedTails({}); setMessage("The IF fleet view expired. Load the fleet again for current data."); }, 60000);
    return () => window.clearTimeout(timer);
  }, [remoteAircraft]);

  useEffect(() => {
    if (!inspection) return;
    const timer = window.setTimeout(() => { setInspection(null); setRecovery(null); setMessage("The IF status view expired. Refresh it before reviewing a conflict."); }, 60000);
    return () => window.clearTimeout(timer);
  }, [inspection]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (actionError) { setError(errorMessage(actionError)); }
    finally { setBusy(false); }
  }

  const connected = status?.connection?.state === "connected";
  const canConnect = Boolean(status?.enabled && status.configured);
  const canBind = Boolean(connected && status?.durableBindingsAllowed && status.connection?.organizationId === organizationId);
  const connectionLabel = connected ? "Connected" : status?.connection?.state === "reauth_required" ? "Reconnect required" : status?.connection?.state === "access_suspended" ? "Admin access changed" : "Disconnected";

  if (loading) return <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking Infinite Flight connection…</div>;
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}
    <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Infinite Flight Live preview</h2><Badge variant={connected ? "default" : "secondary"}>{connectionLabel}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Connect an IF organization admin account to publish approved flights and crew assignments.</p></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(loadStatus)}><RefreshCw className="mr-2 h-4 w-4" />Refresh status</Button></div>
      {status?.disabledReasons?.length ? <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><p className="font-medium">IF publishing needs setup</p>{status.disabledReasons.map((reason, index) => <p key={index}>{reason}</p>)}<p className="pt-1 text-muted-foreground">Manual scheduling remains available from the live fleet tab.</p></div> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{status?.autoPublishEnabled ? "Automatic publishing is enabled for linked aircraft." : "Automatic publishing is currently disabled."}</p><div className="flex gap-2">{status?.connection && status.connection.state !== "disconnected" ? <Button variant="outline" disabled={busy || !canConnect} onClick={() => setDisconnectOpen(true)}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button> : <Button disabled={busy || !canConnect} onClick={() => void run(async () => {
        const result = await ifRequest("connect", {});
        if (typeof result.authorizationUrl !== "string" || new URL(result.authorizationUrl).protocol !== "https:") throw new Error("The IF authorization link was unavailable.");
        window.location.assign(result.authorizationUrl);
      })}><ExternalLink className="mr-2 h-4 w-4" />Connect Infinite Flight</Button>}</div></div>
    </CardContent></Card>
    {connected && <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Organization and live fleet</h3><p className="mt-1 text-sm text-muted-foreground">View current IF aircraft, then link each one to a manually configured aircraft in this site.</p></div><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { const result = await ifRequest("fleet"); setOrganizations(result.data.organizations || []); })}>Load organizations</Button></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="if-organization">Organization</Label><select id="if-organization" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setRemoteAircraft([]); setFleetLoaded(false); setInspection(null); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={busy}><option value="">Select an organization</option>{organizationId && !organizations.some((item) => item.id === organizationId) && <option value={organizationId}>Connected organization</option>}{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><Button variant="outline" disabled={busy || !organizationId || !status?.durableBindingsAllowed || organizationId === status.connection?.organizationId} onClick={() => void run(async () => { await ifRequest("configure", { organizationId }); await loadStatus(); setMessage("Organization selected for IF publishing."); })}>Save organization</Button><Button disabled={busy || !organizationId} onClick={() => void run(async () => { const result = await ifRequest("fleet?organizationId=" + encodeURIComponent(organizationId)); setRemoteAircraft(result.data.aircraft || []); setFleetLoaded(true); setInspection(null); })}>Load IF fleet</Button></div>
      {!status?.durableBindingsAllowed && <p className="text-sm text-muted-foreground">Aircraft linking is unavailable until IF permits saving the required identifiers.</p>}
      {fleetLoaded && !remoteAircraft.length && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">This organization has no live aircraft.</p>}
      {remoteAircraft.length > 0 && <div className="space-y-3">{remoteAircraft.map((remote) => {
        const linked = aircraft.find((tail) => tail.if_aircraft_id?.toLowerCase() === remote.id.toLowerCase());
        const selected = selectedTails[remote.id] || String(linked?.id || "");
        return <div key={remote.id} className="space-y-3 rounded-md border p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-medium">{remote.registration}</p><p className="text-xs text-muted-foreground">{remote.isFleetActiveSlot ? "Active IF fleet slot" : "IF fleet aircraft"}{linked ? " · Linked to " + linked.registration : ""}</p></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { const result = await ifRequest("fleet?organizationId=" + encodeURIComponent(organizationId) + "&aircraftId=" + encodeURIComponent(remote.id)); setInspection({ aircraft: remote, position: result.data.position, schedules: result.data.schedules || [] }); })}>View IF status</Button></div><div className="flex flex-col gap-2 sm:flex-row"><select aria-label={"Local aircraft for " + remote.registration} value={selected} onChange={(event) => setSelectedTails({ ...selectedTails, [remote.id]: event.target.value })} disabled={busy || !canBind} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"><option value="">Select a local aircraft</option>{aircraft.filter((tail) => !tail.if_aircraft_id || tail.if_aircraft_id.toLowerCase() === remote.id.toLowerCase()).map((tail) => <option key={tail.id} value={tail.id}>{tail.registration} · {tail.name}</option>)}</select><Button size="sm" disabled={busy || !canBind || !selected || Boolean(linked && linked.id === Number(selected))} onClick={() => void run(async () => { await schedulingResponse(await authFetch("/api/admin/scheduling", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit_aircraft", live_aircraft_id: Number(selected), if_aircraft_id: remote.id }) })); await onRefresh(); setMessage(remote.registration + " linked to the local fleet."); })}><Link2 className="mr-2 h-4 w-4" />Link aircraft</Button>{linked && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { await schedulingResponse(await authFetch("/api/admin/scheduling", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit_aircraft", live_aircraft_id: linked.id, if_aircraft_id: null }) })); await onRefresh(); setMessage("Aircraft unlinked from IF."); })}>Unlink</Button>}</div></div>;
      })}</div>}
    </CardContent></Card>}
    {inspection && <Card><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">{inspection.aircraft.registration} · IF status</h3><Badge variant="outline">Current IF data</Badge></div>{inspection.position ? <div className="grid gap-2 text-sm sm:grid-cols-2"><p>{inspection.position.isOnGround === undefined ? "Ground state unavailable" : inspection.position.isOnGround ? "On the ground" : "Airborne"}</p><p className="text-muted-foreground">Position {typeof inspection.position.latitude === "number" ? inspection.position.latitude.toFixed(4) : "—"}, {typeof inspection.position.longitude === "number" ? inspection.position.longitude.toFixed(4) : "—"}</p>{inspection.position.updatedAt && <p className="text-xs text-muted-foreground sm:col-span-2">Updated {formatUtc(inspection.position.updatedAt)}</p>}</div> : <p className="text-sm text-muted-foreground">IF position is unavailable.</p>}<p className="text-xs text-muted-foreground">The local airport is recorded from actual arrivals. Review any external flights before resolving a scheduling conflict.</p><div className="space-y-2">{inspection.schedules.length ? inspection.schedules.map((schedule) => <div key={schedule.id} className="rounded-md border p-3"><p className="text-sm font-medium">{schedule.callsign || "IF flight"} · {schedule.originIcao} → {schedule.destinationIcao}</p><p className="mt-1 text-xs text-muted-foreground">{formatUtc(schedule.scheduledDepartureUtc)} — {formatUtc(schedule.scheduledArrivalUtc)}</p><p className="mt-1 text-xs text-muted-foreground">{schedule.crew?.length || 0} crew</p></div>) : <p className="text-sm text-muted-foreground">No schedules returned by IF.</p>}</div>
      {flights.filter((flight) => aircraft.find((tail) => tail.id === flight.live_aircraft_id)?.if_aircraft_id === inspection.aircraft.id && ["failed", "partial", "conflict", "reconciliation"].includes(flight.publishing_state || "")).map((flight) => {
        const remote = inspection.schedules.find((schedule) => schedule.id === flight.if_schedule_id);
        return <div key={flight.id} className="space-y-3 rounded-md border border-amber-500/30 p-4"><div><p className="text-sm font-medium">Local flight: {flight.callsign || "Flight"} · {flight.departure} → {flight.arrival}</p><p className="mt-1 text-xs text-muted-foreground">{formatUtc(flight.scheduled_departure)} — {formatUtc(flight.scheduled_arrival)}</p>{flight.error && <p className="mt-2 text-sm text-destructive">{flight.error}</p>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(async () => { await ifRequest("retry", { flightId: flight.id, action: "retry" }); await onRefresh(); setMessage("IF reconciliation and publishing queued."); })}>Retry or reconcile</Button>{flight.status === "approved" && flight.if_schedule_id && <Button size="sm" disabled={busy} onClick={() => setRecovery({ flight, action: remote ? "overwrite" : "recreate" })}>{remote ? "Review overwrite" : "Review recreation"}</Button>}</div></div>;
      })}
    </CardContent></Card>}
    {recovery && <Dialog open onOpenChange={(open) => { if (!open && !busy) setRecovery(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{recovery.action === "overwrite" ? "Overwrite the linked IF schedule?" : "Recreate the missing IF schedule?"}</DialogTitle><DialogDescription>{recovery.action === "overwrite" ? "Review the current local and IF plans. Confirming will replace the linked IF flight’s fields and crew with the local approved plan." : "The linked schedule was not returned by IF. Confirming queues a checked recreation using the local approved plan."}</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 rounded-md border p-4"><h4 className="font-semibold">Approved local plan</h4><p className="text-sm">{recovery.flight.callsign || "No callsign"} · {recovery.flight.departure} → {recovery.flight.arrival}</p><p className="text-xs text-muted-foreground">{formatUtc(recovery.flight.scheduled_departure)}</p><p className="text-xs text-muted-foreground">{formatUtc(recovery.flight.scheduled_arrival)}</p><p className="text-sm">Captain: {recovery.flight.captain?.name}</p>{recovery.flight.members.filter((member) => member.status === "approved").map((member) => <p key={member.id} className="text-sm">Crew: {member.pilot?.name}</p>)}</div><div className="space-y-2 rounded-md border p-4"><h4 className="font-semibold">Current IF plan</h4>{(() => { const remote = inspection?.schedules.find((schedule) => schedule.id === recovery.flight.if_schedule_id); return remote ? <><p className="text-sm">{remote.callsign || "No callsign"} · {remote.originIcao} → {remote.destinationIcao}</p><p className="text-xs text-muted-foreground">{formatUtc(remote.scheduledDepartureUtc)}</p><p className="text-xs text-muted-foreground">{formatUtc(remote.scheduledArrivalUtc)}</p>{remote.crew?.map((member) => <p key={member.userId} className="break-all text-sm">{member.role === 0 ? "Captain" : "Crew"}: {pilots.find((pilot) => pilot.ifuserid === member.userId)?.name || member.userId}</p>)}</> : <p className="text-sm text-muted-foreground">Linked schedule is absent from the current IF results.</p>; })()}</div></div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setRecovery(null)}>Back</Button><Button disabled={busy} onClick={() => void run(async () => { await ifRequest("retry", { flightId: recovery.flight.id, action: recovery.action }); setRecovery(null); await onRefresh(); setMessage("The reviewed IF recovery action is queued."); })}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{recovery.action === "overwrite" ? "Confirm overwrite" : "Confirm recreation"}</Button></DialogFooter></DialogContent></Dialog>}
    <Dialog open={disconnectOpen} onOpenChange={(open) => { if (!busy) setDisconnectOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Disconnect Infinite Flight?</DialogTitle><DialogDescription>Publishing will stop until an organization admin connects again. Existing flight schedules and the local fleet will remain available.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDisconnectOpen(false)}>Back</Button><Button disabled={busy} onClick={() => void run(async () => { await ifRequest("disconnect", {}); setDisconnectOpen(false); setRemoteAircraft([]); setInspection(null); setOrganizations([]); await loadStatus(); setMessage("Infinite Flight disconnected."); })}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
