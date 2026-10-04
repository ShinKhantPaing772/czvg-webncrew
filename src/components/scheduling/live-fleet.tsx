"use client";

import { useState } from "react";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { LiveAircraft } from "./types";
import { AircraftLocation } from "./aircraft-location";
import { useIfPositions } from "./use-if-positions";

const FLEET_PAGE_SIZE = 6;

export function LiveFleet({ aircraft, admin, onAdd, onEdit, onRequest, onSchedules }: {
  aircraft: LiveAircraft[];
  admin: boolean;
  onAdd: () => void;
  onEdit: (aircraft: LiveAircraft) => void;
  onRequest: (aircraft: LiveAircraft) => void;
  onSchedules: (aircraft: LiveAircraft) => void;
}) {
  const [selectedPage, setSelectedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(aircraft.length / FLEET_PAGE_SIZE));
  const page = Math.min(selectedPage, pageCount);
  const visibleAircraft = aircraft.slice((page - 1) * FLEET_PAGE_SIZE, page * FLEET_PAGE_SIZE);
  const positions = useIfPositions(visibleAircraft, admin);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">Persistent live aircraft</h2><p className="mt-1 text-sm text-muted-foreground">Confirmed airports change on arrival or admin correction. Linked aircraft also show their last reported IF position.</p></div>
      <div className="flex flex-wrap gap-2">{positions.hasLinkedAircraft && <Button variant="outline" disabled={positions.loading} onClick={() => void positions.refresh()}><RefreshCw className={"mr-2 h-4 w-4 " + (positions.loading ? "animate-spin" : "")} />Refresh IF locations</Button>}{admin && <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />Add aircraft</Button>}</div>
    </div>
    {positions.error && <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{positions.error}</p>}
    {positions.snapshot?.airportLookupError && <p className="text-xs text-muted-foreground">Nearby-airport estimates are unavailable. IF coordinates are shown where available.</p>}
    {!aircraft.length ? <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center"><p className="font-medium">No live aircraft yet</p><p className="mt-1 text-sm text-muted-foreground">{admin ? "Add an aircraft with its registration, type, and last known airport." : "An admin can add aircraft to the live fleet."}</p></div> : <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{visibleAircraft.map(tail => <Card key={tail.id}><CardContent className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{tail.registration}</h3><p className="text-sm text-muted-foreground">{tail.name}</p>{tail.liveryname && <p className="text-xs text-muted-foreground">{tail.liveryname}</p>}</div><Badge variant={tail.active ? "secondary" : "outline"}>{tail.active ? "Active" : "Inactive"}</Badge></div>
      <div className="space-y-2 text-sm"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />Confirmed airport <span className="ml-auto font-medium">{tail.current_airport || "Unknown"}</span></p><p className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-muted-foreground" />After approved flights <span className="ml-auto font-medium">{tail.projected_airport || tail.current_airport || "Unknown"}</span></p></div>
      {tail.if_aircraft_id && <AircraftLocation row={positions.snapshot?.aircraft.find(row => row.id === tail.id)} loading={positions.loading} error={positions.error} expired={positions.expired} confirmedAirport={tail.current_airport} />}
      <p className="text-xs text-muted-foreground">{tail.if_aircraft_id ? "Linked to Infinite Flight" : "Manual scheduling"}</p>
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => onSchedules(tail)}><CalendarClock className="mr-2 h-3 w-3" />View schedules</Button>{admin ? <Button size="sm" variant="outline" onClick={() => onEdit(tail)}><Pencil className="mr-2 h-3 w-3" />Edit</Button> : <Button size="sm" variant="outline" disabled={!tail.active} onClick={() => onRequest(tail)}>Request flight</Button>}</div>
    </CardContent></Card>)}</div>}
    {pageCount > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Aircraft {(page - 1) * FLEET_PAGE_SIZE + 1}–{Math.min(page * FLEET_PAGE_SIZE, aircraft.length)} of {aircraft.length}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setSelectedPage(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setSelectedPage(page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
    {positions.hasLinkedAircraft && <p className="text-xs text-muted-foreground">IF positions refresh as their temporary cache expires. A parked aircraft may have an older report. Nearby airports are estimates from IF’s 3D airport list; confirm the actual airport before changing it.</p>}
  </div>;
}
