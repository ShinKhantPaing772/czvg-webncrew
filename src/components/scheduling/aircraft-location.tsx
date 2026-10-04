"use client";

import { ExternalLink, Loader2, MapPin } from "lucide-react";
import type { AircraftPositionView } from "./use-if-positions";
import { formatUtc } from "./utils";

const stateLabels: Record<number, string> = { 0: "Unknown state", 1: "On the ground", 2: "In flight", 3: "Cancelled", 4: "Stopped", 5: "Maintenance" };

export function AircraftLocation({ row, loading, error, expired, confirmedAirport }: {
  row?: AircraftPositionView;
  loading: boolean;
  error?: string;
  expired: boolean;
  confirmedAirport?: string | null;
}) {
  const position = row?.position;
  const nearby = row?.nearbyAirport;
  return <section aria-label="IF aircraft location" className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
    <p className="flex items-center gap-2 font-medium"><MapPin className="h-4 w-4 text-muted-foreground" />Last IF position</p>
    {loading ? <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Loading IF location…</p> : position ? <>
      <p>{stateLabels[position.state] || "Unknown state"}{position.state !== 1 && position.state !== 2 ? position.isOnGround ? " · On the ground" : " · Airborne" : ""}</p>
      {nearby && <p className="font-medium">Near {nearby.icao} <span className="font-normal text-muted-foreground">· {nearby.distanceNm.toFixed(1)} NM (estimate)</span></p>}
      <p className="text-xs text-muted-foreground">{position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}</p>
      <p className="text-xs text-muted-foreground">Last reported {formatUtc(position.updatedAt)}</p>
      <a href={`https://www.openstreetmap.org/?mlat=${position.latitude}&mlon=${position.longitude}#map=13/${position.latitude}/${position.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4">View position on map<ExternalLink className="h-3 w-3" /></a>
      {nearby && confirmedAirport && nearby.icao !== confirmedAirport && <p className="text-xs text-amber-700 dark:text-amber-400">The nearby airport differs from {confirmedAirport}. Review and confirm the actual airport before scheduling.</p>}
    </> : <p className="text-xs text-muted-foreground">{error || row?.error || (expired ? "The IF location expired. Refresh locations to load it again." : "IF location is unavailable.")}</p>}
  </section>;
}
