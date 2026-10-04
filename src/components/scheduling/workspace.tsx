"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Check, Loader2, MapPin, Pencil, Plane, Plus, RefreshCw, Users } from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FlightForm } from "./flight-form";
import { AircraftEditor } from "./aircraft-editor";
import { AircraftSchedulesDialog } from "./aircraft-schedules";
import { InfiniteFlightPanel } from "./infinite-flight-panel";
import { FlightInput, LiveAircraft, ScheduledFlight, SchedulingData } from "./types";
import { crewCount, errorMessage, formatUtc, publishingLabel, statusLabels } from "./utils";
import { schedulingResponse, useScheduling } from "./use-scheduling";
import { authFetch } from "@/lib/utils/api";

type Confirmation = {
  title: string;
  description: string;
  action: string;
  flight: ScheduledFlight;
  memberId?: number;
  reasonRequired?: boolean;
  completion?: boolean;
  reassign?: boolean;
};

function StatusBadge({ flight }: { flight: ScheduledFlight }) {
  return <Badge variant={flight.status === "approved" || flight.status === "in_progress" ? "default" : flight.status === "rejected" || flight.status === "needs_review" ? "destructive" : "secondary"}>{statusLabels[flight.status] || flight.status}</Badge>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center"><CalendarClock className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><p className="font-medium">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

function FlightList({ flights, aircraft, onSelect }: { flights: ScheduledFlight[]; aircraft: LiveAircraft[]; onSelect: (flight: ScheduledFlight) => void }) {
  if (!flights.length) return <EmptyState title="No flights to show" description="Try another filter, or request a flight for an available aircraft." />;
  return <div className="space-y-3">{flights.map((flight) => {
    const tail = aircraft.find((item) => item.id === flight.live_aircraft_id);
    const pendingCrew = flight.members.filter((member) => member.status === "pending").length;
    return <Card key={flight.id}><button type="button" onClick={() => onSelect(flight)} className="grid w-full gap-4 rounded-lg p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[1fr_1.3fr_1fr]">
      <div><div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-semibold">{tail?.registration || "Aircraft"}</span><StatusBadge flight={flight} /></div><p className="text-sm text-muted-foreground">{tail?.name || "Live aircraft"}</p>{flight.callsign && <p className="mt-1 text-sm">{flight.callsign}</p>}</div>
      <div><div className="flex items-center gap-3 text-xl font-semibold tracking-tight"><span>{flight.departure}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /><span>{flight.arrival}</span></div><p className="mt-2 text-xs text-muted-foreground">{formatUtc(flight.scheduled_departure)}</p><p className="mt-1 text-xs text-muted-foreground">Arrival {formatUtc(flight.scheduled_arrival)}</p></div>
      <div className="space-y-2 md:text-right"><p className="text-sm">{flight.captain?.name || "Captain unavailable"}<span className="ml-1 text-xs text-muted-foreground">{flight.captain?.callsign}</span></p><p className="text-xs text-muted-foreground">{crewCount(flight)}/3 crew{pendingCrew ? " · " + pendingCrew + " awaiting review" : ""}</p><p className={flight.error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>{publishingLabel(flight.publishing_state)}</p></div>
    </button></Card>;
  })}</div>;
}

export function SchedulingWorkspace({ admin = false }: { admin?: boolean }) {
  const { data, loading, refreshing, error, refresh, mutate } = useScheduling(admin);
  const [tab, setTab] = useState(admin ? "approvals" : "flights");
  const [query, setQuery] = useState("");
  const [aircraftFilter, setAircraftFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(admin ? "attention" : "upcoming");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [flightForm, setFlightForm] = useState<{ flight?: ScheduledFlight; aircraftId?: number } | null>(null);
  const [aircraftEditor, setAircraftEditor] = useState<{ aircraft?: LiveAircraft } | null>(null);
  const [scheduleAircraftId, setScheduleAircraftId] = useState<number | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [success, setSuccess] = useState("");
  const selectedFlight = data?.flights.find((flight) => flight.id === detailId);
  const scheduleAircraft = data?.aircraft.find(aircraft => aircraft.id === scheduleAircraftId);
  const awaitingFlights = data?.flights.filter((flight) => ["pending", "needs_review"].includes(flight.status)).length || 0;
  const awaitingCrew = data?.flights.reduce((total, flight) => total + flight.members.filter((member) => member.status === "pending").length, 0) || 0;

  useEffect(() => {
    if (admin && new URLSearchParams(window.location.search).has("if")) setTab("if");
  }, [admin]);

  const visibleFlights = useMemo(() => {
    if (!data) return [];
    const search = query.trim().toLowerCase();
    return data.flights.filter((flight) => {
      if (tab === "mine" && flight.captain_id !== data.pilotId && !flight.members.some((member) => member.pilot_id === data.pilotId)) return false;
      if (aircraftFilter !== "all" && flight.live_aircraft_id !== Number(aircraftFilter)) return false;
      if (statusFilter === "upcoming" && !["pending", "approved", "in_progress", "needs_review"].includes(flight.status)) return false;
      if (statusFilter === "attention" && !["pending", "needs_review"].includes(flight.status) && !flight.members.some((member) => member.status === "pending") && !flight.eligibility_issues?.length) return false;
      if (statusFilter === "history" && !["completed", "rejected", "cancelled"].includes(flight.status)) return false;
      if (!["all", "upcoming", "attention", "history"].includes(statusFilter) && flight.status !== statusFilter) return false;
      const tail = data.aircraft.find((item) => item.id === flight.live_aircraft_id);
      return !search || [tail?.registration, tail?.name, flight.departure, flight.arrival, flight.callsign, flight.captain?.name, flight.captain?.callsign].some((value) => value?.toLowerCase().includes(search));
    }).sort((first, second) => new Date(first.scheduled_departure).getTime() - new Date(second.scheduled_departure).getTime());
  }, [data, query, tab, aircraftFilter, statusFilter]);

  async function act(body: Record<string, unknown>, message: string) {
    if (busy) return;
    setBusy(true); setActionError(""); setSuccess("");
    try {
      if (body.action === "retry_publish" || body.action === "reconcile_publish") {
        await schedulingResponse(await authFetch("/api/admin/scheduling/if/retry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flightId: body.flight_id, action: "retry" }) }));
        await refresh();
      } else await mutate(body);
      setSuccess(message);
    } catch (actionFailure) {
      setActionError(errorMessage(actionFailure));
      throw actionFailure;
    } finally { setBusy(false); }
  }

  function ask(flight: ScheduledFlight, action: string, title: string, description: string, options: Partial<Confirmation> = {}) {
    setActionError("");
    setConfirmation({ flight, action, title, description, ...options });
  }

  async function saveFlight(input: FlightInput) {
    setActionError(""); setSuccess("");
    await mutate({ action: flightForm?.flight ? admin ? "amend" : "edit" : "request", ...(flightForm?.flight ? { flight_id: flightForm.flight.id } : {}), ...input }, flightForm?.flight ? "PATCH" : "POST");
    setSuccess(flightForm?.flight ? "Flight updated." : "Flight request submitted for admin approval.");
  }

  return <CrewHeader><main className="flex-1 space-y-5 pb-24 md:pb-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h1 className="text-2xl font-bold">{admin ? "Manage live scheduling" : "Live aircraft scheduling"}</h1><p className="mt-1 text-sm text-muted-foreground">{admin ? "Review flight requests, manage the live fleet, and connect Infinite Flight." : "Plan your next flight from the aircraft’s location or join an approved crew."}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh scheduling"><RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} /></Button>{!admin && <Button onClick={() => setFlightForm({})} disabled={!data?.aircraft.some((item) => item.active)}><Plus className="mr-2 h-4 w-4" />Request flight</Button>}</div>
    </div>
    {(error || actionError) && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{actionError || error}</div>}
    {success && <div role="status" className="flex items-center gap-2 rounded-md border bg-muted/30 p-3 text-sm"><Check className="h-4 w-4 text-green-600" />{success}</div>}
    {admin && data?.configuration?.liveAwardConfigured === false && <div role="status" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">The live pilot access award has not been configured. Set the live pilot award before approving pilots for flights.</div>}
    {loading ? <div role="status" className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading live scheduling…</div> : !data ? <Card><CardContent className="space-y-3 py-8"><h2 className="font-semibold">Scheduling is unavailable</h2><p className="text-sm text-muted-foreground">{error || "Your account needs access to live scheduling."}</p><Button variant="outline" onClick={() => void refresh()} disabled={refreshing}>Try again</Button></CardContent></Card> : <>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <SummaryCard icon={<Plane className="h-4 w-4" />} label="Live aircraft" count={data.aircraft.filter((item) => item.active).length} />
        <SummaryCard icon={<CalendarClock className="h-4 w-4" />} label={admin ? "Flights awaiting review" : "Your pending flights"} count={admin ? awaitingFlights : data.flights.filter((flight) => flight.captain_id === data.pilotId && ["pending", "needs_review"].includes(flight.status)).length} />
        <SummaryCard icon={<Users className="h-4 w-4" />} label={admin ? "Crew requests" : "Flights with crew space"} count={admin ? awaitingCrew : data.flights.filter((flight) => flight.status === "approved" && crewCount(flight) < 3).length} />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 grid w-full grid-cols-3 sm:w-auto sm:inline-flex">{admin ? <><TabsTrigger value="approvals">Approvals</TabsTrigger><TabsTrigger value="fleet">Live fleet</TabsTrigger><TabsTrigger value="if">Infinite Flight</TabsTrigger></> : <><TabsTrigger value="flights">Flights</TabsTrigger><TabsTrigger value="mine">My flights</TabsTrigger><TabsTrigger value="fleet">Live fleet</TabsTrigger></>}</TabsList>
        {(admin ? ["approvals"] : ["flights", "mine"]).map((flightTab) => <TabsContent key={flightTab} value={flightTab} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]"><Input aria-label="Search flights" placeholder="Search route, callsign, aircraft, or captain" value={query} onChange={(event) => setQuery(event.target.value)} /><select aria-label="Filter aircraft" className="h-10 rounded-md border bg-background px-3 text-sm" value={aircraftFilter} onChange={(event) => setAircraftFilter(event.target.value)}><option value="all">All aircraft</option>{data.aircraft.map((item) => <option key={item.id} value={item.id}>{item.registration}</option>)}</select><select aria-label="Filter flight status" className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{admin && <option value="attention">Awaiting review</option>}<option value="upcoming">Upcoming and in flight</option><option value="all">All flights</option><option value="history">History</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
          <p className="text-xs text-muted-foreground">All times are UTC. Each flight has one captain and up to two additional crew members.</p>
          <FlightList flights={visibleFlights} aircraft={data.aircraft} onSelect={(flight) => { setActionError(""); setDetailId(flight.id); }} />
        </TabsContent>)}
        <TabsContent value="fleet" className="space-y-4">
          <div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold">Persistent live aircraft</h2><p className="mt-1 text-sm text-muted-foreground">Location changes when a flight is completed or an admin corrects it.</p></div>{admin && <Button onClick={() => setAircraftEditor({})}><Plus className="mr-2 h-4 w-4" />Add aircraft</Button>}</div>
          {!data.aircraft.length ? <EmptyState title="No live aircraft yet" description={admin ? "Add an aircraft with its registration, type, and last known airport." : "An admin can add aircraft to the live fleet."} /> : <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{data.aircraft.map((aircraft) => <Card key={aircraft.id}><CardContent className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{aircraft.registration}</h3><p className="text-sm text-muted-foreground">{aircraft.name}</p>{aircraft.liveryname && <p className="text-xs text-muted-foreground">{aircraft.liveryname}</p>}</div><Badge variant={aircraft.active ? "secondary" : "outline"}>{aircraft.active ? "Active" : "Inactive"}</Badge></div><div className="space-y-2 text-sm"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Current airport <span className="ml-auto font-medium">{aircraft.current_airport || "Unknown"}</span></p><p className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-muted-foreground" />After approved flights <span className="ml-auto font-medium">{aircraft.projected_airport || aircraft.current_airport || "Unknown"}</span></p></div><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{aircraft.if_aircraft_id ? "Linked to Infinite Flight" : "Manual scheduling"}</span></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => setScheduleAircraftId(aircraft.id)}><CalendarClock className="mr-2 h-3 w-3" />View schedules</Button>{admin ? <Button size="sm" variant="outline" onClick={() => setAircraftEditor({ aircraft })}><Pencil className="mr-2 h-3 w-3" />Edit</Button> : <Button size="sm" variant="outline" disabled={!aircraft.active} onClick={() => setFlightForm({ aircraftId: aircraft.id })}>Request flight</Button>}</div></CardContent></Card>)}</div>}
        </TabsContent>
        {admin && <TabsContent value="if"><InfiniteFlightPanel aircraft={data.aircraft} flights={data.flights} pilots={data.pilots} catalog={data.catalog} onRefresh={refresh} /></TabsContent>}
      </Tabs>
    </>}
    {data && selectedFlight && <FlightDetail flight={selectedFlight} aircraft={data.aircraft.find((item) => item.id === selectedFlight.live_aircraft_id)} pilotId={data.pilotId} admin={admin} busy={busy} error={actionError} onClose={() => setDetailId(null)} onEdit={() => { setFlightForm({ flight: selectedFlight }); setDetailId(null); }} onAsk={ask} onAct={(body, message) => { void act(body, message).catch(() => undefined); }} />}
    {data && scheduleAircraft && <AircraftSchedulesDialog aircraft={scheduleAircraft} flights={data.flights} admin={admin} onClose={() => setScheduleAircraftId(null)} onSelect={flight => { setScheduleAircraftId(null); setActionError(""); setDetailId(flight.id); }} onRefresh={refresh} />}
    {data && flightForm && <FlightForm data={data} {...flightForm} admin={admin} onClose={() => setFlightForm(null)} onSave={saveFlight} />}
    {data && aircraftEditor && <AircraftEditor catalog={data.catalog} aircraft={aircraftEditor.aircraft} onClose={() => setAircraftEditor(null)} onSave={async (input) => { await mutate(input, aircraftEditor.aircraft ? "PATCH" : "POST"); setSuccess(aircraftEditor.aircraft ? "Aircraft updated." : "Aircraft added to the live fleet."); }} />}
    {data && confirmation && <ConfirmAction confirmation={confirmation} pilots={data.pilots || []} onClose={() => setConfirmation(null)} onConfirm={async (fields) => { await act({ action: confirmation.action, flight_id: confirmation.flight.id, ...(confirmation.memberId ? { member_id: confirmation.memberId } : {}), ...fields }, "Flight updated."); setConfirmation(null); }} />}
  </main></CrewHeader>;
}

function SummaryCard({ icon, label, count }: { icon: ReactNode; label: string; count: number }) {
  return <Card><CardContent className="flex items-center gap-3 p-3 sm:p-4"><span className="hidden rounded-md bg-muted p-2 text-muted-foreground sm:block">{icon}</span><div><p className="text-xl font-semibold sm:text-2xl">{count}</p><p className="text-xs text-muted-foreground">{label}</p></div></CardContent></Card>;
}

function FlightDetail({ flight, aircraft, pilotId, admin, busy, error, onClose, onEdit, onAsk, onAct }: {
  flight: ScheduledFlight; aircraft?: LiveAircraft; pilotId: number; admin: boolean; busy: boolean; error: string;
  onClose: () => void; onEdit: () => void;
  onAsk: (flight: ScheduledFlight, action: string, title: string, description: string, options?: Partial<Confirmation>) => void;
  onAct: (body: Record<string, unknown>, message: string) => void;
}) {
  const captain = flight.captain_id === pilotId;
  const ownMembership = flight.members.find((member) => member.pilot_id === pilotId);
  const canManageCrew = admin || captain;
  const canEdit = admin ? ["pending", "approved", "needs_review"].includes(flight.status) : captain && flight.status === "pending";
  const canApprove = admin && ["pending", "needs_review"].includes(flight.status);
  const issues = flight.eligibility_issues || [];
  const linkedNotPublished = Boolean(aircraft?.if_aircraft_id && (Number(flight.published_revision || 0) !== flight.revision || flight.publishing_state !== "published"));
  const airportMismatch = Boolean(aircraft?.current_airport && aircraft.current_airport !== flight.departure);
  const startBlocked = issues.length > 0 || linkedNotPublished || airportMismatch;

  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="flex flex-wrap items-center gap-2">{aircraft?.registration || "Live aircraft"}<StatusBadge flight={flight} /></DialogTitle><DialogDescription>{flight.callsign ? flight.callsign + " · " : ""}{flight.departure} → {flight.arrival}</DialogDescription></DialogHeader>
    {error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Scheduled departure</p><p className="mt-1 text-sm font-medium">{formatUtc(flight.scheduled_departure)}</p></div><div><p className="text-xs text-muted-foreground">Scheduled arrival</p><p className="mt-1 text-sm font-medium">{formatUtc(flight.scheduled_arrival)}</p></div><div><p className="text-xs text-muted-foreground">Aircraft current airport</p><p className="mt-1 text-sm font-medium">{aircraft?.current_airport || "Unknown"}</p></div><div><p className="text-xs text-muted-foreground">Scheduling</p><p className="mt-1 text-sm font-medium">{publishingLabel(flight.publishing_state)}</p></div>{flight.actual_arrival && <div><p className="text-xs text-muted-foreground">Actual arrival airport</p><p className="mt-1 text-sm font-medium">{flight.actual_arrival}</p></div>}</div>
    {flight.notes && <div><h3 className="mb-1 text-sm font-semibold">Flight notes</h3><p className="whitespace-pre-wrap text-sm text-muted-foreground">{flight.notes}</p></div>}
    {flight.review_reason && <div className="rounded-md border p-3"><p className="text-xs font-medium text-muted-foreground">Review note</p><p className="mt-1 whitespace-pre-wrap text-sm">{flight.review_reason}</p></div>}
    {(issues.length > 0 || flight.error || (flight.status === "approved" && (linkedNotPublished || airportMismatch))) && <div role="status" className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><p className="font-medium">This flight needs attention</p>{issues.map((issue, index) => <p key={index}>{issue}</p>)}{flight.error && <p>{flight.error}</p>}{flight.status === "approved" && linkedNotPublished && <p>The latest schedule must be published to IF before departure.</p>}{flight.status === "approved" && airportMismatch && <p>The aircraft must reach {flight.departure} before this flight can start.</p>}</div>}
    <div className="space-y-3"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Crew</h3><span className="text-xs text-muted-foreground">{crewCount(flight)} of 3 seats</span></div><div className="flex items-center justify-between rounded-md bg-muted/40 p-3"><div><p className="text-sm font-medium">{flight.captain?.name || "Captain unavailable"}</p><p className="text-xs text-muted-foreground">{flight.captain?.callsign}</p></div><Badge variant="outline">Captain</Badge></div>{flight.members.map((member) => <div key={member.id} className="flex flex-col gap-3 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{member.pilot?.name || "Pilot unavailable"}<span className="ml-2 text-xs text-muted-foreground">{member.pilot?.callsign}</span></p><p className="mt-1 text-xs text-muted-foreground">{member.status === "pending" ? "Awaiting crew approval" : member.status.charAt(0).toUpperCase() + member.status.slice(1)}{member.review_reason ? " · " + member.review_reason : ""}</p></div>{canManageCrew && ["approved", "needs_review"].includes(flight.status) && ["pending", "approved"].includes(member.status) && <div className="flex gap-2">{member.status === "pending" && flight.status === "approved" && <Button size="sm" disabled={busy || crewCount(flight) >= 3} onClick={() => onAct({ action: "approve_join", flight_id: flight.id, member_id: member.id }, "Crew request approved.")}>Approve</Button>}<Button size="sm" variant="outline" disabled={busy} onClick={() => onAsk(flight, "reject_join", member.status === "approved" ? "Remove crew member?" : "Reject crew request?", (member.pilot?.name || "This pilot") + " can see the decision on their flight request.", { memberId: member.id, reasonRequired: true })}>{member.status === "approved" ? "Remove" : "Reject"}</Button></div>}</div>)}</div>
    {ownMembership && !captain && ["pending", "approved"].includes(ownMembership.status) && ["approved", "needs_review"].includes(flight.status) && <Button variant="outline" disabled={busy} onClick={() => onAsk(flight, "withdraw_join", "Withdraw from this crew?", "Your seat or pending crew request will be removed.")}>Withdraw crew request</Button>}
    {!admin && !captain && flight.status === "approved" && (!ownMembership || ["rejected", "withdrawn"].includes(ownMembership.status)) && <Button disabled={busy || crewCount(flight) >= 3} onClick={() => onAct({ action: "join", flight_id: flight.id }, "Crew request sent to the captain and admins.")}><Users className="mr-2 h-4 w-4" />{crewCount(flight) >= 3 ? "Crew is full" : "Request to join crew"}</Button>}
    <DialogFooter className="flex-wrap sm:justify-start">
      {canEdit && <Button variant="outline" disabled={busy} onClick={onEdit}><Pencil className="mr-2 h-4 w-4" />Edit flight</Button>}
      {canApprove && <><Button disabled={busy} onClick={() => onAsk(flight, "approve", "Approve this flight?", "The aircraft’s location, existing reservations, and crew eligibility will be checked. IF-linked flights must be published before departure.")}>Approve flight</Button><Button variant="outline" disabled={busy} onClick={() => onAsk(flight, "reject", "Reject this flight?", "Give the captain a reason so they can update their plans.", { reasonRequired: true })}>Reject</Button></>}
      {!admin && captain && flight.status === "pending" && <Button variant="outline" disabled={busy} onClick={() => onAsk(flight, "withdraw", "Withdraw this request?", "The pending request will no longer be reviewed.")}>Withdraw request</Button>}
      {(admin || captain) && flight.status === "approved" && <Button disabled={busy || startBlocked} onClick={() => onAsk(flight, "start", "Start this flight?", aircraft?.if_aircraft_id ? "Confirm the aircraft is at the departure airport and the crew is ready. Its current IF location, schedule, and crew will be checked. Start here before departing in Infinite Flight." : "Confirm the aircraft is at the departure airport and the crew is ready. This records the flight as in progress.")}><Plane className="mr-2 h-4 w-4" />Start flight</Button>}
      {admin && ["approved", "needs_review"].includes(flight.status) && <Button variant="outline" disabled={busy} onClick={() => onAsk(flight, "cancel", "Cancel this flight?", "Later flights may need admin review if their departure airport depends on this flight.", { reasonRequired: true })}>Cancel flight</Button>}
      {(admin || captain) && flight.status === "in_progress" && <Button disabled={busy} onClick={() => onAsk(flight, "complete", "Complete this flight", "Enter the actual arrival airport, including any diversion. The aircraft’s location will be updated.", { completion: true })}>Record arrival</Button>}
      {admin && ["pending", "approved", "needs_review"].includes(flight.status) && <Button variant="outline" disabled={busy} onClick={() => onAsk(flight, "reassign", "Change captain", "Select an eligible live pilot. Future reservations and IF crew assignments will be checked.", { reassign: true })}>Change captain</Button>}
      {admin && aircraft?.if_aircraft_id && ["failed", "partial", "conflict", "reconcile", "reconciliation", "reconciliation_required", "needs_reconciliation"].includes(flight.publishing_state || "") && <Button variant="outline" disabled={busy} onClick={() => onAct({ action: flight.publishing_state === "failed" ? "retry_publish" : "reconcile_publish", flight_id: flight.id }, "IF synchronization queued.")}><RefreshCw className="mr-2 h-4 w-4" />{flight.publishing_state === "failed" ? "Retry IF publishing" : "Reconcile with IF"}</Button>}
    </DialogFooter>
  </DialogContent></Dialog>;
}

function ConfirmAction({ confirmation, pilots, onClose, onConfirm }: {
  confirmation: Confirmation; pilots: NonNullable<SchedulingData["pilots"]>; onClose: () => void; onConfirm: (fields: Record<string, unknown>) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [arrival, setArrival] = useState(confirmation.flight.arrival);
  const [captainId, setCaptainId] = useState(String(confirmation.flight.captain_id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (confirmation.reasonRequired && !reason.trim()) { setError("Enter a reason for this decision."); return; }
    if (confirmation.completion && !/^[A-Z0-9]{4}$/.test(arrival.trim())) { setError("Enter a four-character ICAO code for the actual arrival airport."); return; }
    if (confirmation.reassign && (!Number(captainId) || Number(captainId) === confirmation.flight.captain_id)) { setError("Select a different eligible captain."); return; }
    setSaving(true);
    try { await onConfirm({ ...(reason.trim() ? { reason: reason.trim() } : {}), ...(confirmation.completion ? { actual_arrival: arrival.trim() } : {}), ...(confirmation.reassign ? { captain_id: Number(captainId) } : {}) }); }
    catch (actionFailure) { setError(errorMessage(actionFailure)); }
    finally { setSaving(false); }
  }
  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}><DialogContent><DialogHeader><DialogTitle>{confirmation.title}</DialogTitle><DialogDescription>{confirmation.description}</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={submit}>{error && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}{confirmation.completion && <div className="space-y-2"><Label htmlFor="actual-arrival">Actual arrival airport</Label><Input id="actual-arrival" autoFocus value={arrival} onChange={(event) => setArrival(event.target.value.toUpperCase())} maxLength={4} required disabled={saving} /></div>}{confirmation.reassign && <div className="space-y-2"><Label htmlFor="new-captain">Captain</Label><select id="new-captain" value={captainId} onChange={(event) => setCaptainId(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm" required disabled={saving}><option value={confirmation.flight.captain_id}>{confirmation.flight.captain?.name} (current captain)</option>{pilots.filter((pilot) => pilot.eligible && pilot.id !== confirmation.flight.captain_id).map((pilot) => <option key={pilot.id} value={pilot.id}>{pilot.name} · {pilot.callsign}</option>)}</select></div>}{!confirmation.completion && !confirmation.reassign && <div className="space-y-2"><Label htmlFor="review-reason">Reason {confirmation.reasonRequired ? "" : "(optional)"}</Label><Textarea id="review-reason" value={reason} onChange={(event) => setReason(event.target.value)} required={confirmation.reasonRequired} maxLength={500} disabled={saving} /></div>}<DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Back</Button><Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm</Button></DialogFooter></form></DialogContent></Dialog>;
}
