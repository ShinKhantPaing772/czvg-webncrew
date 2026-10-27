"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ImageOff,
  Loader2,
  Search,
  Sparkles,
  Square,
  Trash2,
  Trophy,
  User,
  UserPlus,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";

import { CrewHeader } from "@/components/crew-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";
import { authFetch } from "@/lib/utils/api";

type Award = {
  id: number;
  name: string | null;
  description: string | null;
  imageurl: string | null;
};

type Grant = {
  awardId: number;
  dateAwarded: string;
};

type Pilot = {
  id: number;
  name: string;
  callsign: string;
  ifc: string;
  email: string;
  status: number;
  grants: Grant[];
};

type AwardRecipient = Omit<Pilot, "grants"> & {
  dateAwarded: string;
};

function formatAwardDate(value: string) {
  const dateOnly = value.slice(0, 10);
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString();
}

function displayImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return trimmed;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function AwardArtwork({ award }: { award: Award }) {
  const imageUrl = displayImageUrl(award.imageurl);

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="h-10 w-10 shrink-0 rounded-md object-contain"
      />
    );
  }

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
      <ImageOff className="h-4 w-4 text-muted-foreground" />
    </span>
  );
}

async function responseData(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || fallback);
  return data;
}

export default function PilotAwardsPage() {
  const { t, locale } = useI18n();
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);

  // Single-pilot mode state
  const [selectedPilotId, setSelectedPilotId] = useState<number | null>(null);
  const [selectedAwardIds, setSelectedAwardIds] = useState<number[]>([]);

  // Batch-pilot mode state (Tab 1)
  const [batchMode, setBatchMode] = useState(false);
  const [selectedBatchPilotIds, setSelectedBatchPilotIds] = useState<number[]>([]);
  const [selectedBatchAwardIds, setSelectedBatchAwardIds] = useState<number[]>([]);

  // Filters & searches
  const [pilotQuery, setPilotQuery] = useState("");
  const [awardQuery, setAwardQuery] = useState("");

  // Tab 2 browse state
  const [selectedLookupAwardId, setSelectedLookupAwardId] = useState<number | null>(null);
  const [recipients, setRecipients] = useState<AwardRecipient[]>([]);
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipientRefreshKey, setRecipientRefreshKey] = useState(0);

  // Tab 2 Batch Grant Dialog state
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [grantPilotIds, setGrantPilotIds] = useState<number[]>([]);
  const [modalPilotQuery, setModalPilotQuery] = useState("");
  const [hideExistingInModal, setHideExistingInModal] = useState(true);

  // Status indicators
  const [loadingPilots, setLoadingPilots] = useState(true);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [revokingPilotId, setRevokingPilotId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(
    async (search = "") => {
      setLoadingPilots(true);
      setError("");

      try {
        const response = await authFetch(
          `/api/admin/pilot-awards?query=${encodeURIComponent(search)}&limit=200`,
        );
        const data = await responseData(
          response,
          t("Failed to load pilot awards", "加载飞行员勋章数据失败"),
        );
        const nextPilots = Array.isArray(data.pilots) ? data.pilots : [];
        const nextAwards = Array.isArray(data.awards) ? data.awards : [];

        setPilots(nextPilots);
        setAwards(nextAwards);

        setSelectedPilotId((current) =>
          current && nextPilots.some((pilot: Pilot) => pilot.id === current)
            ? current
            : null,
        );
        setSelectedLookupAwardId((current) =>
          current && nextAwards.some((award: Award) => award.id === current)
            ? current
            : null,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("Failed to load pilot awards", "加载飞行员勋章数据失败"),
        );
      } finally {
        setLoadingPilots(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (selectedLookupAwardId === null) {
      setRecipients([]);
      return;
    }

    const controller = new AbortController();

    async function loadRecipients() {
      setLoadingRecipients(true);
      setRecipients([]);
      setError("");

      try {
        const response = await authFetch(
          `/api/admin/pilot-awards?awardId=${selectedLookupAwardId}`,
          { signal: controller.signal },
        );
        const data = await responseData(
          response,
          t("Failed to load award recipients", "加载勋章获颁人员失败"),
        );

        setRecipients(
          Array.isArray(data.recipients) ? data.recipients : [],
        );
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : t("Failed to load award recipients", "加载勋章获颁人员失败"),
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingRecipients(false);
        }
      }
    }

    void loadRecipients();
    return () => controller.abort();
  }, [recipientRefreshKey, selectedLookupAwardId, t]);

  const selectedPilot = useMemo(
    () => pilots.find((pilot) => pilot.id === selectedPilotId) || null,
    [pilots, selectedPilotId],
  );

  const selectedLookupAward = useMemo(
    () => awards.find((award) => award.id === selectedLookupAwardId) || null,
    [awards, selectedLookupAwardId],
  );

  const filteredAwards = useMemo(() => {
    const normalizedQuery = awardQuery.trim().toLowerCase();
    if (!normalizedQuery) return awards;

    return awards.filter((award) =>
      `${award.name || ""} ${award.description || ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [awardQuery, awards]);

  const filteredRecipients = useMemo(() => {
    const normalizedQuery = recipientQuery.trim().toLowerCase();
    if (!normalizedQuery) return recipients;

    return recipients.filter((recipient) =>
      `${recipient.name} ${recipient.callsign} ${recipient.ifc} ${recipient.email}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [recipientQuery, recipients]);

  // Pilots available for batch grant in Tab 2 Dialog
  const recipientPilotIdSet = useMemo(
    () => new Set(recipients.map((r) => r.id)),
    [recipients],
  );

  const modalFilteredPilots = useMemo(() => {
    const query = modalPilotQuery.trim().toLowerCase();
    return pilots.filter((pilot) => {
      if (hideExistingInModal && recipientPilotIdSet.has(pilot.id)) {
        return false;
      }
      if (!query) return true;
      return `${pilot.name} ${pilot.callsign} ${pilot.ifc} ${pilot.email}`
        .toLowerCase()
        .includes(query);
    });
  }, [hideExistingInModal, modalPilotQuery, pilots, recipientPilotIdSet]);

  function choosePilot(pilot: Pilot) {
    setSelectedPilotId(pilot.id);
    setSelectedAwardIds(pilot.grants.map((grant) => grant.awardId));
    setMessage("");
    setError("");
  }

  function chooseLookupAward(awardId: number) {
    setSelectedLookupAwardId(awardId);
    setRecipientQuery("");
    setMessage("");
    setError("");
  }

  function toggleAward(id: number, checked: boolean) {
    setSelectedAwardIds((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((awardId) => awardId !== id),
    );
  }

  function toggleBatchPilot(pilotId: number) {
    setSelectedBatchPilotIds((current) =>
      current.includes(pilotId)
        ? current.filter((id) => id !== pilotId)
        : [...current, pilotId],
    );
  }

  function toggleSelectAllBatchPilots() {
    const visibleIds = pilots.map((p) => p.id);
    const allSelected = visibleIds.every((id) => selectedBatchPilotIds.includes(id));
    if (allSelected) {
      setSelectedBatchPilotIds([]);
    } else {
      setSelectedBatchPilotIds(Array.from(new Set([...selectedBatchPilotIds, ...visibleIds])));
    }
  }

  function toggleBatchAward(id: number, checked: boolean) {
    setSelectedBatchAwardIds((current) =>
      checked
        ? Array.from(new Set([...current, id]))
        : current.filter((awardId) => awardId !== id),
    );
  }

  // Save single pilot awards (synchronizes exact award list)
  async function saveSinglePilotAwards() {
    if (!selectedPilot) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilotId: selectedPilot.id,
          awardIds: selectedAwardIds,
        }),
      });
      await responseData(
        response,
        t("Failed to update pilot awards", "更新飞行员勋章失败"),
      );

      setMessage(
        locale === "zh"
          ? `${selectedPilot.name} 的勋章设置已更新。`
          : `Awards updated for ${selectedPilot.name}.`,
      );
      await loadData(pilotQuery);
      if (selectedLookupAwardId !== null) {
        setRecipientRefreshKey((current) => current + 1);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("Failed to update pilot awards", "更新飞行员勋章失败"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Batch grant awards to multiple selected pilots (Tab 1)
  async function saveBatchAwards() {
    if (selectedBatchPilotIds.length === 0 || selectedBatchAwardIds.length === 0) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilotIds: selectedBatchPilotIds,
          awardIds: selectedBatchAwardIds,
        }),
      });
      const data = await responseData(
        response,
        t("Failed to batch grant awards", "批量授予勋章失败"),
      );

      setMessage(
        locale === "zh"
          ? `已成功向 ${selectedBatchPilotIds.length} 位飞行员授予勋章（新增 ${data.createdCount ?? 0} 条记录）。`
          : `Successfully granted awards to ${selectedBatchPilotIds.length} pilot(s) (${data.createdCount ?? 0} new assignment(s)).`,
      );
      await loadData(pilotQuery);
      if (selectedLookupAwardId !== null) {
        setRecipientRefreshKey((current) => current + 1);
      }
      setSelectedBatchAwardIds([]);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("Failed to batch grant awards", "批量授予勋章失败"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Batch grant award to multiple pilots from Tab 2 Modal
  async function saveModalGrantAwards() {
    if (!selectedLookupAward || grantPilotIds.length === 0) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pilotIds: grantPilotIds,
          awardId: selectedLookupAward.id,
        }),
      });
      const data = await responseData(
        response,
        t("Failed to grant award", "授予勋章失败"),
      );

      setMessage(
        locale === "zh"
          ? `已成功向 ${grantPilotIds.length} 位飞行员授予「${selectedLookupAward.name}」（新增 ${data.createdCount ?? 0} 条记录）。`
          : `Successfully granted "${selectedLookupAward.name}" to ${grantPilotIds.length} pilot(s) (${data.createdCount ?? 0} new assignment(s)).`,
      );
      setGrantDialogOpen(false);
      setGrantPilotIds([]);
      setRecipientRefreshKey((current) => current + 1);
      await loadData(pilotQuery);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("Failed to grant award", "授予勋章失败"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Revoke award from a single recipient (Tab 2)
  async function revokeAwardFromRecipient(pilotId: number, pilotName: string) {
    if (!selectedLookupAward) return;

    setRevokingPilotId(pilotId);
    setError("");
    setMessage("");

    try {
      const response = await authFetch(
        `/api/admin/pilot-awards?awardId=${selectedLookupAward.id}&pilotId=${pilotId}`,
        { method: "DELETE" },
      );
      await responseData(
        response,
        t("Failed to revoke award", "撤销勋章失败"),
      );

      setMessage(
        locale === "zh"
          ? `已成功从 ${pilotName} 撤销「${selectedLookupAward.name}」。`
          : `Revoked "${selectedLookupAward.name}" from ${pilotName}.`,
      );
      setRecipientRefreshKey((current) => current + 1);
      await loadData(pilotQuery);
    } catch (revokeError) {
      setError(
        revokeError instanceof Error
          ? revokeError.message
          : t("Failed to revoke award", "撤销勋章失败"),
      );
    } finally {
      setRevokingPilotId(null);
    }
  }

  function openGrantModal() {
    setGrantPilotIds([]);
    setModalPilotQuery("");
    setGrantDialogOpen(true);
  }

  function toggleModalPilot(pilotId: number) {
    setGrantPilotIds((current) =>
      current.includes(pilotId)
        ? current.filter((id) => id !== pilotId)
        : [...current, pilotId],
    );
  }

  function toggleSelectAllModalPilots() {
    const selectable = modalFilteredPilots
      .filter((p) => !recipientPilotIdSet.has(p.id))
      .map((p) => p.id);
    const allSelected = selectable.length > 0 && selectable.every((id) => grantPilotIds.includes(id));
    if (allSelected) {
      setGrantPilotIds([]);
    } else {
      setGrantPilotIds(selectable);
    }
  }

  const handleSyncAndBackfill = async () => {
    setBackfilling(true);
    setError("");
    setMessage("");

    try {
      const response = await authFetch("/api/admin/pilot-awards/backfill", {
        method: "POST",
      });
      const data = await responseData(
        response,
        t("Failed to sync and backfill awards", "同步与补发勋章失败"),
      );
      setMessage(
        data.message ||
          t(
            "Successfully synced awards and completed backfill.",
            "成功同步勋章库并完成全员历史成就补发。",
          ),
      );
      await loadData(pilotQuery);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("Failed to sync and backfill awards", "同步与补发勋章失败"),
      );
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <CrewHeader>
      <main className="flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">
              {t("Pilot Awards", "飞行勋章管理")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "Grant awards to multiple pilots simultaneously, manage individual pilots, or review recipients by award.",
                "支持向多位飞行员批量授予勋章、管理个别飞行员荣誉，或按勋章浏览获颁人员。",
              )}
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5 self-start sm:self-auto"
                disabled={backfilling || loadingPilots}
              >
                {backfilling ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4 text-primary" />
                )}
                <span>
                  {backfilling
                    ? t("Scanning & Syncing...", "正在同步与全员扫描...")
                    : t("Sync Catalog & Backfill All", "一键同步勋章并全员补发")}
                </span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t(
                    "Sync Badge Catalog & Run Retroactive Backfill?",
                    "同步勋章库并全员扫描补发？",
                  )}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    "This will ensure all 102 master badges are synchronized to the database, then scan all registered pilots to automatically grant newly earned awards based on historical flight records. Existing awards will not be duplicated.",
                    "系统将自动把全量 102 枚最新勋章标准同步入库，并自动扫描全部机长历史审核通过的飞行记录，为达成要求的飞行员一次性增发相应勋章（已有勋章不受影响）。",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("Cancel", "取消")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleSyncAndBackfill}>
                  {t("Start Backfill", "确认开始扫描补发")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {error || message ? (
          <div
            className={`rounded-md border p-3 text-sm ${
              error
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {error || message}
          </div>
        ) : null}

        <Tabs defaultValue="assign">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="assign">
              <UserRoundCheck className="mr-1.5 h-4 w-4" />
              {t("Assign by pilot", "按飞行员授勋")}
            </TabsTrigger>
            <TabsTrigger value="recipients">
              <Trophy className="mr-1.5 h-4 w-4" />
              {t("Browse by award", "按勋章浏览")}
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Assign by pilot (supports Single & Batch Mode) */}
          <TabsContent value="assign" className="mt-2">
            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3 pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {batchMode
                        ? t("Select pilots (Batch)", "选择获颁飞行员 (批量)")
                        : t("Select a pilot", "选择获颁飞行员")}
                    </CardTitle>
                    <Button
                      variant={batchMode ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setBatchMode(!batchMode);
                        setSelectedBatchPilotIds([]);
                        setSelectedBatchAwardIds([]);
                      }}
                    >
                      {batchMode ? (
                        <>
                          <Users className="mr-1.5 h-3.5 w-3.5" />
                          {t("Batch Mode", "批量模式")}
                        </>
                      ) : (
                        <>
                          <User className="mr-1.5 h-3.5 w-3.5" />
                          {t("Multi-select", "批量多选")}
                        </>
                      )}
                    </Button>
                  </div>

                  <form
                    className="flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void loadData(pilotQuery);
                    }}
                  >
                    <div className="relative flex-1">
                      <Label htmlFor="pilot-award-search" className="sr-only">
                        {t("Search pilots", "搜索飞行员")}
                      </Label>
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="pilot-award-search"
                        className="pl-8"
                        value={pilotQuery}
                        onChange={(event) => setPilotQuery(event.target.value)}
                        placeholder={t(
                          "Name, callsign, IFC, email",
                          "姓名、呼号、IFC、邮箱",
                        )}
                      />
                    </div>
                    <Button type="submit" variant="outline">
                      {t("Search", "搜索")}
                    </Button>
                  </form>

                  {batchMode && pilots.length > 0 ? (
                    <div className="flex items-center justify-between border-t pt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={toggleSelectAllBatchPilots}
                        >
                          {pilots.every((p) => selectedBatchPilotIds.includes(p.id)) ? (
                            <>
                              <Square className="mr-1 h-3.5 w-3.5" />
                              {t("Deselect all", "取消全选")}
                            </>
                          ) : (
                            <>
                              <CheckSquare className="mr-1 h-3.5 w-3.5" />
                              {t("Select all visible", "全选当前可见")}
                            </>
                          )}
                        </Button>
                        {selectedBatchPilotIds.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-muted-foreground"
                            onClick={() => setSelectedBatchPilotIds([])}
                          >
                            {t("Clear", "清空")}
                          </Button>
                        ) : null}
                      </div>
                      <Badge variant="secondary">
                        {locale === "zh"
                          ? `已选择 ${selectedBatchPilotIds.length} 人`
                          : `${selectedBatchPilotIds.length} selected`}
                      </Badge>
                    </div>
                  ) : null}
                </CardHeader>

                <CardContent className="max-h-[600px] space-y-2 overflow-y-auto">
                  {loadingPilots ? (
                    <Loader2 className="mx-auto my-8 h-5 w-5 animate-spin" />
                  ) : pilots.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("No pilots found.", "未找到飞行员。")}
                    </p>
                  ) : (
                    pilots.map((pilot) => {
                      const isBatchSelected = selectedBatchPilotIds.includes(pilot.id);
                      const isSingleSelected = pilot.id === selectedPilotId;

                      if (batchMode) {
                        return (
                          <div
                            key={pilot.id}
                            onClick={() => toggleBatchPilot(pilot.id)}
                            className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition-colors hover:bg-muted ${
                              isBatchSelected ? "border-primary bg-primary/5" : ""
                            }`}
                          >
                            <Checkbox
                              checked={isBatchSelected}
                              onCheckedChange={() => toggleBatchPilot(pilot.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <Avatar className="h-9 w-9 shrink-0">
                              <AvatarFallback>
                                {pilot.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {pilot.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {pilot.callsign} · IFC: {pilot.ifc}
                              </p>
                            </div>
                            {pilot.grants.length ? (
                              <Badge variant="outline" className="text-xs">
                                {locale === "zh"
                                  ? `${pilot.grants.length} 项勋章`
                                  : `${pilot.grants.length} awards`}
                              </Badge>
                            ) : null}
                          </div>
                        );
                      }

                      return (
                        <button
                          key={pilot.id}
                          type="button"
                          onClick={() => choosePilot(pilot)}
                          className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                            isSingleSelected ? "border-primary bg-primary/5" : ""
                          }`}
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback>
                              {pilot.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {pilot.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {pilot.callsign} · IFC: {pilot.ifc}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {pilot.email}
                            </p>
                          </div>
                          {pilot.grants.length ? (
                            <Badge variant="secondary">
                              {pilot.grants.length}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Right Column: Batch Mode view OR Single Pilot view */}
              <Card>
                {batchMode ? (
                  <>
                    <CardHeader>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <CardTitle className="text-base">
                          {locale === "zh"
                            ? `批量授予勋章 (已选择 ${selectedBatchPilotIds.length} 位飞行员)`
                            : `Batch Grant Awards (${selectedBatchPilotIds.length} pilots selected)`}
                        </CardTitle>
                        {selectedBatchPilotIds.length > 0 ? (
                          <Badge variant="outline">
                            {locale === "zh"
                              ? `已勾选 ${selectedBatchAwardIds.length} 项勋章`
                              : `${selectedBatchAwardIds.length} awards checked`}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t(
                          "Select the awards below to grant to all selected pilots at once. This adds awards without removing their existing awards.",
                          "在下方勾选要赋予的勋章，将一次性为所选飞行员全量增授（不会影响其已有的其他勋章）。",
                        )}
                      </p>
                    </CardHeader>
                    <CardContent>
                      {selectedBatchPilotIds.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          {t(
                            "Please select one or more pilots from the list on the left.",
                            "请在左侧列表中勾选一位或多位飞行员。",
                          )}
                        </div>
                      ) : awards.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          {t(
                            "No award definitions available.",
                            "暂无可用的勋章定义。",
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Selected pilots summary chips */}
                          <div className="rounded-md border bg-muted/40 p-3">
                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                              {locale === "zh"
                                ? `目标飞行员 (${selectedBatchPilotIds.length})：`
                                : `Target Pilots (${selectedBatchPilotIds.length}):`}
                            </p>
                            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                              {selectedBatchPilotIds.map((id) => {
                                const p = pilots.find((pilot) => pilot.id === id);
                                if (!p) return null;
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-1 rounded bg-background px-2 py-0.5 text-xs font-medium shadow-sm"
                                  >
                                    <span>{p.name} ({p.callsign})</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleBatchPilot(id)}
                                      className="text-muted-foreground hover:text-foreground"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            {awards.map((award) => (
                              <label
                                key={award.id}
                                htmlFor={`batch-award-${award.id}`}
                                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                              >
                                <Checkbox
                                  id={`batch-award-${award.id}`}
                                  checked={selectedBatchAwardIds.includes(award.id)}
                                  onCheckedChange={(checked) =>
                                    toggleBatchAward(award.id, checked === true)
                                  }
                                />
                                <AwardArtwork award={award} />
                                <div className="min-w-0">
                                  <p className="font-medium">
                                    {locale === "zh"
                                      ? (award as any).name_zh ||
                                        (award as any).nameZh ||
                                        t(award.name || "", award.name || "") ||
                                        t("Unnamed award", "未命名勋章")
                                      : award.name || t("Unnamed award", "未命名勋章")}
                                  </p>
                                  <p className="line-clamp-2 text-xs text-muted-foreground">
                                    {locale === "zh"
                                      ? (award as any).description_zh ||
                                        (award as any).descriptionZh ||
                                        t(award.description || "", award.description || "") ||
                                        t("No description", "暂无说明")
                                      : award.description || t("No description", "暂无说明")}
                                  </p>
                                </div>
                              </label>
                            ))}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedBatchPilotIds([]);
                                setSelectedBatchAwardIds([]);
                              }}
                            >
                              {t("Clear", "清空")}
                            </Button>
                            <Button
                              onClick={() => void saveBatchAwards()}
                              disabled={
                                saving ||
                                selectedBatchPilotIds.length === 0 ||
                                selectedBatchAwardIds.length === 0
                              }
                            >
                              {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="mr-2 h-4 w-4" />
                              )}
                              {locale === "zh"
                                ? `向 ${selectedBatchPilotIds.length} 位飞行员授予勋章 (${selectedBatchAwardIds.length})`
                                : `Grant Awards (${selectedBatchAwardIds.length}) to ${selectedBatchPilotIds.length} Pilots`}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {selectedPilot
                          ? locale === "zh"
                            ? `${selectedPilot.name} 的荣誉勋章`
                            : `Awards for ${selectedPilot.name}`
                          : t("Award assignments", "勋章分配")}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {!selectedPilot ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          {t(
                            "Select a pilot from the left to view and edit their awards.",
                            "请在左侧选择一位飞行员以查看和编辑其勋章。",
                          )}
                        </div>
                      ) : awards.length === 0 ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                          {t(
                            "Create an award definition before assigning awards.",
                            "授勋前请先创建勋章定义。",
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid gap-3 md:grid-cols-2">
                            {awards.map((award) => {
                              const grant = selectedPilot.grants.find(
                                (item) => item.awardId === award.id,
                              );

                              return (
                                <label
                                  key={award.id}
                                  htmlFor={`pilot-award-${award.id}`}
                                  className="flex cursor-pointer items-start gap-3 rounded-md border p-3 hover:bg-muted/50"
                                >
                                  <Checkbox
                                    id={`pilot-award-${award.id}`}
                                    checked={selectedAwardIds.includes(award.id)}
                                    onCheckedChange={(checked) =>
                                      toggleAward(award.id, checked === true)
                                    }
                                  />
                                  <AwardArtwork award={award} />
                                  <div className="min-w-0">
                                    <p className="font-medium">
                                      {locale === "zh"
                                        ? (award as any).name_zh ||
                                          (award as any).nameZh ||
                                          t(award.name || "", award.name || "") ||
                                          t("Unnamed award", "未命名勋章")
                                        : award.name || t("Unnamed award", "未命名勋章")}
                                    </p>
                                    <p className="line-clamp-2 text-xs text-muted-foreground">
                                      {locale === "zh"
                                        ? (award as any).description_zh ||
                                          (award as any).descriptionZh ||
                                          t(award.description || "", award.description || "") ||
                                          t("No description", "暂无说明")
                                        : award.description || t("No description", "暂无说明")}
                                    </p>
                                    {grant ? (
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {locale === "zh"
                                          ? `获颁于 ${formatAwardDate(grant.dateAwarded)}`
                                          : `Awarded ${formatAwardDate(grant.dateAwarded)}`}
                                      </p>
                                    ) : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          <div className="flex justify-end">
                            <Button
                              onClick={() => void saveSinglePilotAwards()}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              {t("Save Awards", "保存勋章设置")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: Browse by award & Batch Grant to Pilots */}
          <TabsContent value="recipients" className="mt-2">
            <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
              <Card>
                <CardHeader className="space-y-3 pb-3">
                  <CardTitle className="text-base">
                    {t("Select an award", "选择荣誉勋章")}
                  </CardTitle>
                  <div className="relative">
                    <Label htmlFor="award-recipient-search" className="sr-only">
                      {t("Search awards", "搜索荣誉勋章")}
                    </Label>
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="award-recipient-search"
                      className="pl-8"
                      value={awardQuery}
                      onChange={(event) => setAwardQuery(event.target.value)}
                      placeholder={t("Search awards", "搜索荣誉勋章")}
                    />
                  </div>
                </CardHeader>
                <CardContent className="max-h-[600px] space-y-2 overflow-y-auto">
                  {awards.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("No award definitions found.", "未找到勋章定义。")}
                    </p>
                  ) : filteredAwards.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t("No awards match your search.", "未找到匹配的勋章。")}
                    </p>
                  ) : (
                    filteredAwards.map((award) => (
                      <button
                        key={award.id}
                        type="button"
                        onClick={() => chooseLookupAward(award.id)}
                        className={`flex w-full items-start gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted ${
                          award.id === selectedLookupAwardId
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                      >
                        <AwardArtwork award={award} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {locale === "zh"
                              ? (award as any).name_zh ||
                                (award as any).nameZh ||
                                t(award.name || "", award.name || "") ||
                                t("Unnamed award", "未命名勋章")
                              : award.name || t("Unnamed award", "未命名勋章")}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {locale === "zh"
                              ? (award as any).description_zh ||
                                (award as any).descriptionZh ||
                                t(award.description || "", award.description || "") ||
                                t("No description", "暂无说明")
                              : award.description || t("No description", "暂无说明")}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">
                      {selectedLookupAward
                        ? locale === "zh"
                          ? `拥有「${selectedLookupAward.name || "此勋章"}」的飞行员`
                          : `Pilots with ${selectedLookupAward.name || "this award"}`
                        : t("Award recipients", "勋章获颁人员")}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {selectedLookupAward && !loadingRecipients ? (
                        <Badge variant="secondary">
                          {locale === "zh"
                            ? `${recipients.length} 位飞行员`
                            : `${recipients.length} ${recipients.length === 1 ? "pilot" : "pilots"}`}
                        </Badge>
                      ) : null}
                      {selectedLookupAward ? (
                        <Button
                          size="sm"
                          onClick={openGrantModal}
                        >
                          <UserPlus className="mr-1.5 h-4 w-4" />
                          {t("Grant to Pilots", "批量授予飞行员")}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {selectedLookupAward && recipients.length > 0 ? (
                    <div className="relative">
                      <Label
                        htmlFor="award-pilot-search"
                        className="sr-only"
                      >
                        {t("Search award recipients", "搜索获颁飞行员")}
                      </Label>
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="award-pilot-search"
                        className="pl-8"
                        value={recipientQuery}
                        onChange={(event) =>
                          setRecipientQuery(event.target.value)
                        }
                        placeholder={t(
                          "Search by name, callsign, IFC, or email",
                          "按姓名、呼号、IFC 或邮箱搜索",
                        )}
                      />
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent>
                  {!selectedLookupAward ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      {t(
                        "Select an award to view recipients and grant it to pilots.",
                        "选择荣誉勋章以查看获颁人员并批量授予飞行员。",
                      )}
                    </div>
                  ) : loadingRecipients ? (
                    <Loader2 className="mx-auto my-16 h-5 w-5 animate-spin" />
                  ) : recipients.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      <p>
                        {t(
                          "No pilots have received this award yet.",
                          "尚无飞行员获得此勋章。",
                        )}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={openGrantModal}
                      >
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        {t("Grant to Pilots", "批量授予飞行员")}
                      </Button>
                    </div>
                  ) : filteredRecipients.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                      {t(
                        "No recipients match your search.",
                        "没有符合搜索条件的获得者。",
                      )}
                    </div>
                  ) : (
                    <div className="max-h-[540px] space-y-2 overflow-y-auto">
                      {filteredRecipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-3 rounded-md border p-3"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback>
                              {recipient.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {recipient.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {recipient.callsign} · IFC: {recipient.ifc}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {recipient.email}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs text-muted-foreground">
                              {t("Awarded", "获颁于")}
                            </p>
                            <p className="text-sm font-medium">
                              {formatAwardDate(recipient.dateAwarded)}
                            </p>
                          </div>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={revokingPilotId === recipient.id}
                                title={t("Revoke award", "撤销勋章")}
                              >
                                {revokingPilotId === recipient.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                                <span className="sr-only">
                                  {locale === "zh"
                                    ? `撤销 ${recipient.name} 的勋章`
                                    : `Revoke award from ${recipient.name}`}
                                </span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {locale === "zh"
                                    ? `确认从 ${recipient.name} 撤销此勋章？`
                                    : `Revoke award from ${recipient.name}?`}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  {locale === "zh"
                                    ? `此操作将从 ${recipient.name} (${recipient.callsign}) 撤销「${selectedLookupAward?.name}」荣誉勋章。`
                                    : `This will revoke "${selectedLookupAward?.name}" from ${recipient.name} (${recipient.callsign}).`}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  {t("Cancel", "取消")}
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    void revokeAwardFromRecipient(
                                      recipient.id,
                                      recipient.name,
                                    )
                                  }
                                >
                                  {t("Revoke", "确认撤销")}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Modal: Grant Award to Multiple Pilots */}
        <Dialog open={grantDialogOpen} onOpenChange={setGrantDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                {locale === "zh"
                  ? `向飞行员授予「${selectedLookupAward?.name}」`
                  : `Grant "${selectedLookupAward?.name}" to Pilots`}
              </DialogTitle>
              <DialogDescription>
                {t(
                  "Select multiple pilots to award this badge simultaneously.",
                  "选择多位飞行员，一次性批量授予此勋章。",
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={modalPilotQuery}
                  onChange={(e) => setModalPilotQuery(e.target.value)}
                  placeholder={t(
                    "Search pilots by name, callsign, IFC, or email",
                    "按姓名、呼号、IFC 或邮箱搜索飞行员",
                  )}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
                  <Checkbox
                    checked={hideExistingInModal}
                    onCheckedChange={(checked) => setHideExistingInModal(checked === true)}
                  />
                  <span>
                    {t(
                      "Hide pilots who already have this award",
                      "隐藏已获得此勋章的飞行员",
                    )}
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={toggleSelectAllModalPilots}
                  >
                    {t("Select all eligible", "全选可选飞行员")}
                  </Button>
                  {grantPilotIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setGrantPilotIds([])}
                    >
                      {t("Clear", "清空")}
                    </Button>
                  ) : null}
                  <Badge variant="secondary">
                    {locale === "zh"
                      ? `已选 ${grantPilotIds.length} 人`
                      : `${grantPilotIds.length} selected`}
                  </Badge>
                </div>
              </div>

              {/* Scrollable pilots list */}
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {modalFilteredPilots.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {t("No matching pilots found.", "未找到匹配的飞行员。")}
                  </p>
                ) : (
                  modalFilteredPilots.map((pilot) => {
                    const alreadyAwarded = recipientPilotIdSet.has(pilot.id);
                    const isChecked = grantPilotIds.includes(pilot.id);

                    return (
                      <div
                        key={pilot.id}
                        onClick={() => {
                          if (!alreadyAwarded) {
                            toggleModalPilot(pilot.id);
                          }
                        }}
                        className={`flex items-center gap-3 rounded-md border p-2.5 transition-colors ${
                          alreadyAwarded
                            ? "cursor-not-allowed bg-muted/40 opacity-70"
                            : "cursor-pointer hover:bg-muted"
                        } ${isChecked ? "border-primary bg-primary/5" : ""}`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={alreadyAwarded}
                          onCheckedChange={() => toggleModalPilot(pilot.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs">
                            {pilot.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {pilot.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pilot.callsign} · IFC: {pilot.ifc}
                          </p>
                        </div>
                        {alreadyAwarded ? (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            {t("Already has award", "已拥有此勋章")}
                          </Badge>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
              <span className="text-xs text-muted-foreground">
                {locale === "zh"
                  ? `已选择 ${grantPilotIds.length} 位飞行员`
                  : `${grantPilotIds.length} pilot${grantPilotIds.length === 1 ? "" : "s"} selected`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setGrantDialogOpen(false)}
                >
                  {t("Cancel", "取消")}
                </Button>
                <Button
                  onClick={() => void saveModalGrantAwards()}
                  disabled={saving || grantPilotIds.length === 0}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="mr-2 h-4 w-4" />
                  )}
                  {locale === "zh"
                    ? `确认授予 (${grantPilotIds.length})`
                    : `Grant Award (${grantPilotIds.length})`}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
