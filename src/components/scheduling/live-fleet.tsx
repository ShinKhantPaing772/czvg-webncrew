"use client";

import { useState } from "react";
import { ArrowRight, CalendarClock, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import type { LiveAircraft } from "./types";
import { AircraftLocation } from "./aircraft-location";
import { useIfPositions } from "./use-if-positions";
import { formatUtc } from "./utils";

const FLEET_PAGE_SIZE = 6;

export function LiveFleet({ aircraft, admin, onAdd, onEdit, onRequest, onSchedules, title = "Persistent live aircraft", description }: {
  aircraft: LiveAircraft[];
  admin: boolean;
  onAdd: () => void;
  onEdit: (aircraft: LiveAircraft) => void;
  onRequest: (aircraft: LiveAircraft) => void;
  onSchedules: (aircraft: LiveAircraft) => void;
  title?: string;
  description?: string;
}) {
  const { t } = useI18n();
  const [selectedPage, setSelectedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(aircraft.length / FLEET_PAGE_SIZE));
  const page = Math.min(selectedPage, pageCount);
  const visibleAircraft = aircraft.slice((page - 1) * FLEET_PAGE_SIZE, page * FLEET_PAGE_SIZE);
  const positions = useIfPositions(visibleAircraft, admin);

  return <div className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="font-semibold">{title === "Persistent live aircraft" ? t("Persistent live aircraft", "持久化机队") : title}</h2><p className="mt-1 text-sm text-muted-foreground">{description || t("Confirmed airports change on arrival or admin correction.", "停场机场将在航班确认到达或管理员校准后更新。")}{admin && t(" Request IF positions using Refresh IF locations.", " 管理员可点击「刷新 IF 位置」查看实时坐标。")}</p></div>
      <div className="flex flex-wrap gap-2">{positions.hasLinkedAircraft && <Button variant="outline" disabled={positions.loading} onClick={() => void positions.refresh()}><RefreshCw className={"mr-2 h-4 w-4 " + (positions.loading ? "animate-spin" : "")} />{t("Refresh IF locations", "刷新 IF 位置")}</Button>}{admin && <Button onClick={onAdd}><Plus className="mr-2 h-4 w-4" />{t("Add aircraft", "添加飞机")}</Button>}</div>
    </div>
    {positions.error && <p role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">{positions.error}</p>}
    {positions.snapshot && <p className="text-xs text-muted-foreground">{t("Positions last refreshed", "位置最近刷新于")} {formatUtc(positions.snapshot.loadedAt)}.</p>}
    {positions.snapshot?.airportLookupError && <p className="text-xs text-muted-foreground">{t("Nearby-airport estimates are unavailable. IF coordinates are shown where available.", "附近机场估算暂不可用，当前仅显示 IF 坐标。")}</p>}
    {!aircraft.length ? <div className="rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-6 py-10 text-center"><p className="text-[13px] font-medium">{t("No live aircraft yet", "暂无实时机队飞机")}</p><p className="mt-1 text-[12px] text-muted-foreground">{admin ? t("Add an aircraft with its registration, type, and last known airport.", "请添加飞机注册号、机型涂装及当前停场机场。") : t("An admin can add aircraft to the live fleet.", "请联系管理员添加实时运营飞机。")}</p></div> : <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{visibleAircraft.map(tail => <Card key={tail.id}><CardContent className="space-y-3 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] p-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">{tail.registration}</h3><p className="text-sm text-muted-foreground">{tail.name}</p>{tail.liveryname && <p className="text-xs text-muted-foreground">{tail.liveryname}</p>}</div><Badge variant={tail.active ? "secondary" : "outline"}>{tail.active ? t("Active", "运营中") : t("Inactive", "已停用")}</Badge></div>
      <div className="space-y-2 text-sm"><p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{t("Confirmed airport", "当前停场机场")} <span className="ml-auto font-medium">{tail.current_airport || t("Unknown", "未知")}</span></p><p className="flex items-center gap-2"><ArrowRight className="h-4 w-4 text-muted-foreground" />{t("After approved flights", "已批航段终点")} <span className="ml-auto font-medium">{tail.projected_airport || tail.current_airport || t("Unknown", "未知")}</span></p></div>
      {admin && tail.if_aircraft_id && <AircraftLocation row={positions.snapshot?.aircraft.find(row => row.id === tail.id)} loading={positions.loading} error={positions.error} expired={positions.expired} confirmedAirport={tail.current_airport} />}
      <p className="text-xs text-muted-foreground">{tail.if_aircraft_id ? t("Linked to Infinite Flight", "已关联 Infinite Flight") : t("Manual scheduling", "本地排班")}</p>
      {tail.pending_request_count === 0 && tail.approved_schedule_count === 0 && tail.in_progress_count === 0 && <p className="text-sm text-muted-foreground">{t("No scheduled flights", "暂无排队航段")}</p>}
      <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" onClick={() => onSchedules(tail)}><CalendarClock className="mr-2 h-3 w-3" />{t("View schedules", "查看排班")}</Button>{admin ? <Button size="sm" variant="outline" onClick={() => onEdit(tail)}><Pencil className="mr-2 h-3 w-3" />{t("Edit", "编辑")}</Button> : <Button size="sm" variant="outline" disabled={!tail.active} onClick={() => onRequest(tail)}>{t("Request flight", "申请执飞")}</Button>}</div>
    </CardContent></Card>)}</div>}
    {pageCount > 1 && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Aircraft {(page - 1) * FLEET_PAGE_SIZE + 1}–{Math.min(page * FLEET_PAGE_SIZE, aircraft.length)} of {aircraft.length}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setSelectedPage(page - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setSelectedPage(page + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
    {positions.hasLinkedAircraft && <p className="text-xs text-muted-foreground">IF positions refresh only when requested. A parked aircraft may have an older report. Nearby airports are estimates from IF’s 3D airport list; confirm the actual airport before changing it.</p>}
  </div>;
}
