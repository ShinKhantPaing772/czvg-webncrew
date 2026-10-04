"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Link2, Loader2, Plus, RefreshCw, Unplug } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { LiveAircraft, ScheduledFlight, SchedulingData, SchedulingPilot } from "./types";
import { AircraftEditor } from "./aircraft-editor";
import { errorMessage, formatUtc, ifScheduleStatusLabel } from "./utils";
import { schedulingResponse } from "./use-scheduling";

type IntegrationStatus = {
  enabled: boolean;
  autoPublishEnabled: boolean;
  durableBindingsAllowed: boolean;
  configured: boolean;
  disabledReasons: string[];
  revocationConfigured: boolean;
  publishingReady: boolean;
  publishingDisabledReasons: string[];
  bindingReady: boolean;
  bindingDisabledReasons: string[];
  disconnectMode: "revoke" | "local";
  canDisconnect: boolean;
  oauthSetup: { callbackUrl: string | null; checks: Array<{ id: string; label: string; ready: boolean; required: boolean }> };
  connection: { state: string; organizationId: string | null; expiresAt: string | null } | null;
};
type IfOrganization = { id: string; name: string };
type IfAircraft = { id: string; aircraftId: string; organizationId: string; registration: string; isFleetActiveSlot: boolean; visibility: number };
type IfSchedule = { id: string; status?: number; sequence?: number; callsign: string; originIcao: string; destinationIcao: string; scheduledDepartureUtc: string; scheduledArrivalUtc: string; crew?: Array<{ userId: string; role: number }> };
type Inspection = { aircraft: IfAircraft; position: { latitude?: number; longitude?: number; isOnGround?: boolean; updatedAt?: string } | null; positionError?: string | null; schedules: IfSchedule[] };
type PublishResult = { processed: number; published: number; disabled: boolean; reasons?: string[]; states?: Record<string, number> };

function publishingResultMessage(result: PublishResult) {
  if (result.disabled) return "IF publishing is unavailable." + (result.reasons?.length ? " " + result.reasons.join("; ") : " Refresh the connection status to review its setup.");
  if (!result.processed) return "No queued IF flights were ready to publish. Refresh flights to review their status.";
  const labels: Record<string, string> = { queued: "queued for retry", conflict: "need conflict review", reconciliation: "need reconciliation", failed: "failed", partial: "partially synchronized", skipped: "skipped", done: "superseded" };
  const details = Object.entries(result.states || {}).filter(([state, count]) => state !== "published" && count > 0).map(([state, count]) => count + " " + (labels[state] || "need review"));
  return "IF publishing processed " + result.processed + " queued " + (result.processed === 1 ? "job" : "jobs") + ": " + result.published + " synchronized" + (details.length ? "; " + details.join("; ") : "") + ". Any remaining queued flights need another publishing run.";
}

const authorizationErrors: Record<string, string> = {
  oauth_state: "The connection request expired or could not be verified. Start the connection again from this page.",
  authentication: "Your admin session expired or lost scheduling access. Sign in again before connecting Infinite Flight.",
  consent: "Infinite Flight authorization was declined. Connect again when you are ready to authorize access.",
  oauth_code: "Infinite Flight did not return an authorization code. Start the connection again.",
  oauth_exchange: "Infinite Flight could not complete the token exchange. Check the OAuth client setup and try again.",
  reauth_required: "Infinite Flight did not authorize this client. Check its scopes and approved test users, then connect again.",
  already_connected: "An Infinite Flight account is already connected. Refresh the status before continuing.",
  configuration: "The Infinite Flight connection setup is incomplete. Review the setup checks below.",
  callback_origin: "Open this page on the same website as the registered callback, then start the connection again.",
  forbidden: "The authorized Infinite Flight account cannot access the selected organization. Connect an organization admin account.",
};

async function ifRequest(path: string, body?: Record<string, unknown>) {
  const response = await authFetch("/api/admin/scheduling/if/" + path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  return schedulingResponse(response);
}

export function InfiniteFlightPanel({ aircraft, flights, pilots = [], catalog = [], onRefresh }: { aircraft: LiveAircraft[]; flights: ScheduledFlight[]; pilots?: SchedulingPilot[]; catalog?: SchedulingData["catalog"]; onRefresh: () => Promise<void> }) {
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
  const [creationAircraft, setCreationAircraft] = useState<IfAircraft | null>(null);
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
    const callbackUrl = new URL(window.location.href);
    const callback = callbackUrl.searchParams.get("if");
    if (callback === "connected") setMessage("Infinite Flight connected. Load organizations to view the live fleet.");
    if (callback === "error") setError(authorizationErrors[callbackUrl.searchParams.get("reason") || ""] || "Infinite Flight authorization did not complete. Check the connection setup and try again.");
    if (callback === "connected" || callback === "error") {
      callbackUrl.searchParams.delete("if"); callbackUrl.searchParams.delete("reason");
      window.history.replaceState(window.history.state, "", callbackUrl.pathname + callbackUrl.search + callbackUrl.hash);
    }
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
    const timer = window.setTimeout(() => { setRemoteAircraft([]); setFleetLoaded(false); setSelectedTails({}); setCreationAircraft(null); setMessage("The IF fleet view expired. Load the fleet again for current data."); }, 60000);
    return () => window.clearTimeout(timer);
  }, [remoteAircraft]);

  useEffect(() => {
    if (!inspection) return;
    const timer = window.setTimeout(() => { setInspection(null); setRecovery(null); setMessage("The IF status view expired. Refresh it before reviewing a conflict."); }, 60000);
    return () => window.clearTimeout(timer);
  }, [inspection]);

  useEffect(() => {
    if (status && (!status.enabled || !status.configured || status.connection?.state !== "connected")) setCreationAircraft(null);
  }, [status]);

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await action(); }
    catch (actionError) { setError(errorMessage(actionError)); }
    finally { setBusy(false); }
  }

  const connected = status?.connection?.state === "connected";
  const canConnect = Boolean(status?.enabled && status.configured);
  const canRead = connected && canConnect;
  const canPublish = Boolean(canRead && status?.publishingReady && status.autoPublishEnabled && status.connection?.organizationId);
  const canBind = Boolean(canRead && status?.bindingReady && status.connection?.organizationId === organizationId);
  const localDisconnect = status?.disconnectMode === "local";
  const connectionLabel = connected ? "Connected" : status?.connection?.state === "reauth_required" ? "Reconnect required" : status?.connection?.state === "access_suspended" ? "Admin access changed" : "Disconnected";

  if (loading) return <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Checking Infinite Flight connection…</div>;
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {message && <p role="status" className="rounded-md border bg-muted/30 p-3 text-sm">{message}</p>}
    <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Infinite Flight Live preview</h2><Badge variant={connected ? "default" : "secondary"}>{connectionLabel}</Badge></div><p className="mt-1 text-sm text-muted-foreground">Connect an IF organization admin account to publish approved flights and crew assignments.</p></div><Button variant="outline" size="sm" disabled={busy} onClick={() => void run(loadStatus)}><RefreshCw className="mr-2 h-4 w-4" />Refresh status</Button></div>
      {status && (!status.configured || !connected) && <div className="space-y-3 rounded-md border bg-muted/20 p-4 text-sm"><div><h3 className="font-medium">OAuth connection setup</h3><p className="mt-1 text-muted-foreground">Configure the connection in your hosting environment, then authorize an IF organization owner or admin. Client secrets stay on the server.</p></div><ul className="grid gap-2 sm:grid-cols-2">{status.oauthSetup.checks.map((check) => <li key={check.id} className="flex items-center gap-2"><span className={"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border " + (check.ready ? "border-green-600/30 bg-green-600/10 text-green-700 dark:text-green-400" : "text-muted-foreground")} aria-hidden="true">{check.ready ? <Check className="h-3 w-3" /> : "·"}</span><span>{check.label}{check.required === false && !check.ready ? <span className="text-muted-foreground">: optional — unavailable</span> : <span className="sr-only">{check.ready ? ": ready" : ": required"}</span>}</span></li>)}</ul><div className="space-y-1"><p className="text-muted-foreground">Registered callback</p><p className="break-all rounded-md border bg-background p-2 font-mono text-xs">{status.oauthSetup.callbackUrl || "https://YOUR_DOMAIN/oauth/callback"}</p><p className="text-xs text-muted-foreground">Start the connection on the website registered for this callback. Testing clients require IF-approved users; your pilots use the existing site login.</p></div><a className="inline-flex items-center gap-1 font-medium underline underline-offset-4" href="https://infiniteflight.com/guide/developer-reference/live-api/v3-oauth-live-preview#how-to-gain-access" target="_blank" rel="noreferrer">IF client setup and review<ExternalLink className="h-3 w-3" /></a></div>}
      {status?.connection?.state === "reauth_required" && <p role="status" className="text-sm text-muted-foreground">Authorization needs to be renewed. Disconnect this grant, then connect the organization admin account again.</p>}
      {status?.connection?.state === "access_suspended" && <p role="status" className="text-sm text-muted-foreground">The admin who connected this account lost scheduling access. Disconnect it, then have a scheduling admin connect again.</p>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-muted-foreground">{status?.publishingReady ? "IF schedule publishing is enabled. Queued changes publish when an admin or the automatic worker runs publishing." : "Automatic publishing is currently disabled."}</p><div className="flex flex-wrap gap-2"><Button disabled={busy || !canPublish} onClick={() => void run(async () => {
        const result = await ifRequest("publish", {});
        setMessage(publishingResultMessage(result.data));
        if (result.data.processed > 0) { setInspection(null); setRecovery(null); }
        await Promise.all([onRefresh(), loadStatus()]);
      })}><RefreshCw className="mr-2 h-4 w-4" />Publish queued flights</Button>{status?.connection && status.connection.state !== "disconnected" ? <Button variant="outline" disabled={busy || !status.canDisconnect} onClick={() => { setError(""); setDisconnectOpen(true); }}><Unplug className="mr-2 h-4 w-4" />Disconnect</Button> : <Button disabled={busy || !canConnect} onClick={() => void run(async () => {
        const result = await ifRequest("connect", {});
        if (typeof result.authorizationUrl !== "string" || new URL(result.authorizationUrl).protocol !== "https:") throw new Error("The IF authorization link was unavailable.");
        window.location.assign(result.authorizationUrl);
      })}><ExternalLink className="mr-2 h-4 w-4" />Connect Infinite Flight</Button>}</div></div>
      {status && !status.publishingReady && <div className="space-y-2 text-xs text-muted-foreground"><p>OAuth connects the organization account for temporary fleet reads. Publishing also requires IF permission to save the aircraft links and publishing enabled in the server settings.</p>{status.publishingDisabledReasons?.length > 0 && <ul className="list-disc space-y-1 pl-4">{status.publishingDisabledReasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>}
      {connected && localDisconnect && <p className="text-xs text-muted-foreground">Disconnecting here removes the Crew Center’s saved credentials. This does not revoke your authorization at Infinite Flight.</p>}
      {status?.connection && status.connection.state !== "disconnected" && !status.canDisconnect && <p className="text-sm text-destructive">{localDisconnect ? "This connection could not be cleared. Refresh its status or ask a server administrator to review the connection." : "Revoking this connection needs the original client credentials, encryption key, and supported IF revocation URL in the server settings."}</p>}
    </CardContent></Card>
    {connected && <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">Organization and live fleet</h3><p className="mt-1 text-sm text-muted-foreground">View current IF aircraft, add a local aircraft, or link one that is already in the local fleet.</p></div><Button size="sm" variant="outline" disabled={busy || !canRead} onClick={() => void run(async () => { const result = await ifRequest("fleet"); setOrganizations(result.data.organizations || []); })}>Load organizations</Button></div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-2"><Label htmlFor="if-organization">Organization</Label><select id="if-organization" value={organizationId} onChange={(event) => { setOrganizationId(event.target.value); setRemoteAircraft([]); setFleetLoaded(false); setInspection(null); setCreationAircraft(null); setRecovery(null); setSelectedTails({}); }} className="h-10 w-full rounded-md border bg-background px-3 text-sm" disabled={busy || !canRead}><option value="">Select an organization</option>{organizationId && !organizations.some((item) => item.id === organizationId) && <option value={organizationId}>Connected organization</option>}{organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><Button variant="outline" disabled={busy || !canRead || !organizationId || !status?.durableBindingsAllowed || organizationId === status.connection?.organizationId} onClick={() => void run(async () => { await ifRequest("configure", { organizationId }); await loadStatus(); setMessage("Organization selected for aircraft linking."); })}>Save organization</Button><Button disabled={busy || !canRead || !organizationId} onClick={() => void run(async () => { const result = await ifRequest("fleet?organizationId=" + encodeURIComponent(organizationId)); setRemoteAircraft(result.data.aircraft || []); setFleetLoaded(true); setInspection(null); setCreationAircraft(null); })}>Load IF fleet</Button></div>
      {!status?.bindingReady && <div className="space-y-2 text-sm text-muted-foreground"><p>Aircraft linking requires a connected organization and IF permission to save the aircraft identifiers. You can still add an unlinked aircraft for local scheduling.</p>{Boolean(status?.bindingDisabledReasons?.length) && <ul className="list-disc space-y-1 pl-4">{status?.bindingDisabledReasons?.map(reason => <li key={reason}>{reason}</li>)}</ul>}</div>}
      {status?.bindingReady && status.connection?.organizationId !== organizationId && <p className="text-sm text-muted-foreground">Save this organization before linking its aircraft.</p>}
      {!status?.publishingReady && <p className="text-sm text-muted-foreground">Linked aircraft flights must be published to IF before they can start. Publishing is currently disabled; unlinked aircraft remain available for local scheduling.</p>}
      {fleetLoaded && !remoteAircraft.length && <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">This organization has no live aircraft.</p>}
      {remoteAircraft.length > 0 && <div className="space-y-3">{remoteAircraft.map((remote) => {
        const linked = aircraft.find(tail => tail.if_aircraft_id?.toLowerCase() === remote.id.toLowerCase());
        const registered = aircraft.find(tail => tail.registration.trim().toUpperCase() === remote.registration.trim().toUpperCase());
        const existing = registered && (!registered.if_aircraft_id || registered.if_aircraft_id.toLowerCase() === remote.id.toLowerCase()) ? registered : null;
        const selected = selectedTails[remote.id] ?? String((linked || existing)?.id || "");
        const remoteCanBind = canBind && remote.isFleetActiveSlot;
        return <div key={remote.id} className="space-y-3 rounded-md border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-medium">{remote.registration}</p><p className="text-xs text-muted-foreground">{remote.isFleetActiveSlot ? "Active IF fleet slot" : "IF fleet aircraft in storage"}{linked ? " · Linked to " + linked.registration : ""}</p></div>
            <div className="flex flex-wrap gap-2">
              {!linked && !registered && <Button size="sm" disabled={busy || !canRead || !catalog.length} onClick={() => { setError(""); setMessage(""); setCreationAircraft(remote); }}><Plus className="mr-2 h-4 w-4" />Add to local fleet</Button>}
              {!linked && registered && <span className="self-center text-sm text-muted-foreground">Already in local fleet</span>}
              <Button variant="outline" size="sm" disabled={busy || !canRead} onClick={() => void run(async () => {
                const result = await ifRequest("fleet?organizationId=" + encodeURIComponent(organizationId) + "&aircraftId=" + encodeURIComponent(remote.id));
                setInspection({ aircraft: remote, position: result.data.position, positionError: result.data.positionError, schedules: result.data.schedules || [] });
              })}>View IF status</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select aria-label={"Local aircraft for " + remote.registration} value={selected} onChange={event => setSelectedTails({ ...selectedTails, [remote.id]: event.target.value })} disabled={busy || !remoteCanBind} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm">
              <option value="">Select a local aircraft</option>
              {aircraft.filter(tail => !tail.if_aircraft_id || tail.if_aircraft_id.toLowerCase() === remote.id.toLowerCase()).map(tail => <option key={tail.id} value={tail.id}>{tail.registration} · {tail.name}</option>)}
            </select>
            <Button size="sm" disabled={busy || !remoteCanBind || !selected || Boolean(linked && linked.id === Number(selected))} onClick={() => void run(async () => {
              await schedulingResponse(await authFetch("/api/admin/scheduling", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit_aircraft", live_aircraft_id: Number(selected), if_aircraft_id: remote.id }) }));
              await onRefresh(); setMessage(remote.registration + " linked to the local fleet.");
            })}><Link2 className="mr-2 h-4 w-4" />Link aircraft</Button>
            {linked && <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => {
              await schedulingResponse(await authFetch("/api/admin/scheduling", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "edit_aircraft", live_aircraft_id: linked.id, if_aircraft_id: null }) }));
              await onRefresh(); setMessage("Aircraft unlinked from IF.");
            })}>Unlink</Button>}
          </div>
          {!catalog.length && !linked && !registered && <p className="text-xs text-muted-foreground">Add an aircraft type to the local catalog before creating a fleet aircraft.</p>}
        </div>;
      })}</div>}
    </CardContent></Card>}
    {creationAircraft && <AircraftEditor catalog={catalog} ifAircraft={{ id: creationAircraft.id, registration: creationAircraft.registration }} canLink={canBind && creationAircraft.isFleetActiveSlot} publishingReady={Boolean(status?.publishingReady)} onClose={() => setCreationAircraft(null)} onSave={async input => {
      await schedulingResponse(await authFetch("/api/admin/scheduling", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }));
      await onRefresh();
      setMessage(input.if_aircraft_id ? "Aircraft added to the local fleet and linked to Infinite Flight." : "Aircraft added to the local fleet for manual scheduling.");
    }} />}
    {inspection && <Card><CardContent className="space-y-4 p-5"><div className="flex items-center justify-between"><h3 className="font-semibold">{inspection.aircraft.registration} · IF status</h3><Badge variant="outline">Current IF data</Badge></div>{inspection.position ? <div className="grid gap-2 text-sm sm:grid-cols-2"><p>{inspection.position.isOnGround === undefined ? "Ground state unavailable" : inspection.position.isOnGround ? "On the ground" : "Airborne"}</p><p className="text-muted-foreground">Position {typeof inspection.position.latitude === "number" ? inspection.position.latitude.toFixed(4) : "—"}, {typeof inspection.position.longitude === "number" ? inspection.position.longitude.toFixed(4) : "—"}</p>{inspection.position.updatedAt && <p className="text-xs text-muted-foreground sm:col-span-2">Updated {formatUtc(inspection.position.updatedAt)}</p>}</div> : <p className="text-sm text-muted-foreground">{inspection.positionError || "IF position is unavailable."}</p>}<p className="text-xs text-muted-foreground">The local airport is recorded from actual arrivals. Review any external flights before resolving a scheduling conflict.</p><div className="space-y-2">{inspection.schedules.length ? inspection.schedules.map((schedule) => <div key={schedule.id} className="rounded-md border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{schedule.callsign || "IF flight"} · {schedule.originIcao} → {schedule.destinationIcao}</p><Badge variant="outline">{ifScheduleStatusLabel(schedule.status ?? 0)}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatUtc(schedule.scheduledDepartureUtc)} — {formatUtc(schedule.scheduledArrivalUtc)}</p><p className="mt-1 text-xs text-muted-foreground">{schedule.sequence !== undefined ? "Queue position " + schedule.sequence + " · " : ""}{schedule.crew?.length || 0} crew</p></div>) : <p className="text-sm text-muted-foreground">No schedules returned by IF.</p>}</div>
      {flights.filter((flight) => aircraft.find((tail) => tail.id === flight.live_aircraft_id)?.if_aircraft_id === inspection.aircraft.id && ["failed", "partial", "conflict", "reconciliation"].includes(flight.publishing_state || "")).map((flight) => {
        const remote = inspection.schedules.find((schedule) => schedule.id === flight.if_schedule_id);
        return <div key={flight.id} className="space-y-3 rounded-md border border-amber-500/30 p-4"><div><p className="text-sm font-medium">Local flight: {flight.callsign || "Flight"} · {flight.departure} → {flight.arrival}</p><p className="mt-1 text-xs text-muted-foreground">{formatUtc(flight.scheduled_departure)} — {formatUtc(flight.scheduled_arrival)}</p>{flight.error && <p className="mt-2 text-sm text-destructive">{flight.error}</p>}</div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy || !canPublish} onClick={() => void run(async () => { await ifRequest("retry", { flightId: flight.id, action: "retry" }); await onRefresh(); setMessage("IF reconciliation and publishing queued."); })}>Retry or reconcile</Button>{flight.status === "approved" && flight.if_schedule_id && <Button size="sm" disabled={busy || !canPublish} onClick={() => { setError(""); setRecovery({ flight, action: remote ? "overwrite" : "recreate" }); }}>{remote ? "Review overwrite" : "Review recreation"}</Button>}</div></div>;
      })}
    </CardContent></Card>}
    {recovery && <Dialog open onOpenChange={(open) => { if (!open && !busy) setRecovery(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{recovery.action === "overwrite" ? "Overwrite the linked IF schedule?" : "Recreate the missing IF schedule?"}</DialogTitle><DialogDescription>{recovery.action === "overwrite" ? "Review the current local and IF plans. Confirming will replace the linked IF flight’s fields and crew with the local approved plan." : "The linked schedule was not returned by IF. Confirming queues a checked recreation using the local approved plan."}</DialogDescription></DialogHeader>{error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2 rounded-md border p-4"><h4 className="font-semibold">Approved local plan</h4><p className="text-sm">{recovery.flight.callsign || "No callsign"} · {recovery.flight.departure} → {recovery.flight.arrival}</p><p className="text-xs text-muted-foreground">{formatUtc(recovery.flight.scheduled_departure)}</p><p className="text-xs text-muted-foreground">{formatUtc(recovery.flight.scheduled_arrival)}</p><p className="text-sm">Captain: {recovery.flight.captain?.name}</p>{recovery.flight.members.filter((member) => member.status === "approved").map((member) => <p key={member.id} className="text-sm">Crew: {member.pilot?.name}</p>)}</div><div className="space-y-2 rounded-md border p-4"><h4 className="font-semibold">Current IF plan</h4>{(() => { const remote = inspection?.schedules.find((schedule) => schedule.id === recovery.flight.if_schedule_id); return remote ? <><p className="text-sm">{remote.callsign || "No callsign"} · {remote.originIcao} → {remote.destinationIcao}</p><p className="text-xs text-muted-foreground">{formatUtc(remote.scheduledDepartureUtc)}</p><p className="text-xs text-muted-foreground">{formatUtc(remote.scheduledArrivalUtc)}</p>{remote.crew?.map((member) => <p key={member.userId} className="break-all text-sm">{member.role === 0 ? "Captain" : "Crew"}: {pilots.find((pilot) => pilot.ifuserid === member.userId)?.name || member.userId}</p>)}</> : <p className="text-sm text-muted-foreground">Linked schedule is absent from the current IF results.</p>; })()}</div></div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => setRecovery(null)}>Back</Button><Button disabled={busy || !canPublish} onClick={() => void run(async () => { await ifRequest("retry", { flightId: recovery.flight.id, action: recovery.action }); setRecovery(null); await onRefresh(); setMessage("The reviewed IF recovery action is queued."); })}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{recovery.action === "overwrite" ? "Confirm overwrite" : "Confirm recreation"}</Button></DialogFooter></DialogContent></Dialog>}
    <Dialog open={disconnectOpen} onOpenChange={(open) => { if (!busy) setDisconnectOpen(open); }}><DialogContent><DialogHeader><DialogTitle>Disconnect Infinite Flight?</DialogTitle><DialogDescription>{localDisconnect ? "This removes only the Crew Center’s saved IF credentials. It does not revoke your authorization at Infinite Flight. Existing schedules and aircraft links remain saved locally." : "This revokes the saved IF authorization and removes the Crew Center’s saved credentials. Publishing will stop until an organization admin connects again. Existing flight schedules and the local fleet will remain available."}</DialogDescription></DialogHeader>{error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={busy} onClick={() => setDisconnectOpen(false)}>Back</Button><Button disabled={busy} onClick={() => void run(async () => { const result = await ifRequest("disconnect", {}); setDisconnectOpen(false); setRemoteAircraft([]); setFleetLoaded(false); setSelectedTails({}); setInspection(null); setRecovery(null); setCreationAircraft(null); setOrganizations([]); setOrganizationId(""); await loadStatus(); setMessage(result.revocation === "local_only" ? "Crew Center disconnected. Its saved IF credentials were removed; authorization was not revoked at Infinite Flight." : result.revocation === "revoked" ? "Infinite Flight disconnected and its saved authorization revoked." : "Crew Center disconnected. IF authorization revocation was not confirmed."); })}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Disconnect</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
