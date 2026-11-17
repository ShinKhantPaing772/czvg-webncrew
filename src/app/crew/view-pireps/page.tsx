"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { AirlineLogo } from "@/components/airline-logo";
import {
  CrewCallsign,
  CrewEmpty,
  CrewFlightRow,
  CrewPageHeader,
  CrewSector,
  CrewStat,
} from "@/components/crew-ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useI18n } from "@/lib/i18n";
import {
  MAX_PIREP_COMMENTS,
  PIREP_COMMENT_LIMIT_MESSAGE,
} from "@/lib/pirep-comments";
import { authFetch } from "@/lib/utils/api";

interface PirepComment {
  id: number;
  userid: number;
  content: string;
  dateposted: string;
  User?: {
    id: number;
    callsign: string;
    name: string;
  };
}

interface Pirep {
  id: number;
  flightnum: string;
  departure: string;
  arrival: string;
  flighttime: string;
  pilotid: number;
  date: string;
  aircraftid: number;
  Aircraft: {
    name: string;
    liveryname: string;
  };
  fuelused: number;
  multi: number;
  status: number;
  Comments?: PirepComment[];
}

function formatMultiplierLabel(multi: string | number | null | undefined) {
  const value = String(multi ?? "").trim();
  if (!value || value.toLowerCase() === "none") return "None";
  return `${value}x`;
}

interface PaginationData {
  total: number;
  totalPages: number;
  currentPage: number;
  limit: number;
}

interface PirepsResponse {
  pireps: Pirep[];
  pagination?: PaginationData;
}

function SummaryCard({
  label,
  count,
  accent = false,
}: {
  label: string;
  count: number | string;
  accent?: boolean;
}) {
  return <CrewStat label={label} value={count} accent={accent} />;
}

function StatusBadge({ status }: { status: number }) {
  if (status === 1) {
    return <Badge variant="default">Approved</Badge>;
  }
  if (status === 0) {
    return <Badge variant="secondary">Awaiting approval</Badge>;
  }
  return <Badge variant="destructive">Rejected</Badge>;
}

export default function ViewPireps() {
  const { user } = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedPirepId = searchParams.get("pirepId");
  const [selectedPirep, setSelectedPirep] = useState<Pirep | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState("all");

  const [pirepsData, setPirepsData] = useState<Pirep[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 10,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [submittingCommentId, setSubmittingCommentId] = useState<number | null>(
    null,
  );
  const [showSubmittedNotice, setShowSubmittedNotice] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (searchParams.get("submitted") !== "1") return;
    setShowSubmittedNotice(true);
    router.replace("/crew/view-pireps", { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    if (!user?.id || linkedPirepId === null) {
      setDetailLoading(false);
      setDetailError(null);
      return;
    }
    const pilotId = user.id;
    const params = new URLSearchParams({ pirepId: linkedPirepId });
    let cancelled = false;

    async function fetchLinkedPirep() {
      setDetailLoading(true);
      setDetailError(null);
      setSelectedPirep(null);
      try {
        const response = await authFetch(
          `/api/pilots/${pilotId}/pireps?${params}`,
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Failed to load PIREP details");
        }
        if (!cancelled) {
          setSelectedPirep(data.pirep);
          setNewComment("");
          setCommentError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setDetailError(
            err instanceof Error ? err.message : "Failed to load PIREP details",
          );
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }

    void fetchLinkedPirep();
    return () => {
      cancelled = true;
    };
  }, [user?.id, linkedPirepId]);

  useEffect(() => {
    const fetchPireps = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: String(currentPage),
          limit: String(itemsPerPage),
        });

        if (searchTerm.trim()) {
          params.set("search", searchTerm.trim());
        }

        const response = await authFetch(
          `/api/pilots/${user?.id}/pireps?${params}`,
        );
        if (!response.ok) throw new Error("Failed to fetch PIREPs");
        const data: PirepsResponse = await response.json();
        setPirepsData(data.pireps || []);
        setPagination(
          data.pagination ?? {
            total: (data.pireps || []).length,
            totalPages: 1,
            currentPage: 1,
            limit: itemsPerPage,
          },
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    if (user?.id) void fetchPireps();
  }, [user?.id, currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    const lastPage = Math.max(pagination.totalPages, 1);
    if (currentPage > lastPage) {
      setCurrentPage(lastPage);
    }
  }, [currentPage, pagination.totalPages]);

  const visiblePireps = pirepsData.filter((pirep) =>
    statusFilter === "all" ? true : String(pirep.status) === statusFilter,
  );

  const totalPages = Math.max(pagination.totalPages, 1);
  const currentPageStart =
    pagination.total === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.limit + 1;
  const currentPageEnd = Math.min(
    pagination.currentPage * pagination.limit,
    pagination.total,
  );

  const getStatusIcon = (status: number) => {
    if (status === 1) return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    if (status === 0) return <AlertCircle className="h-4 w-4 text-amber-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const handleAddComment = async (pirepId: number) => {
    const content = newComment.trim();
    if (!content) {
      setCommentError("Enter a comment before posting.");
      return;
    }

    const pirep =
      selectedPirep?.id === pirepId
        ? selectedPirep
        : pirepsData.find((item) => item.id === pirepId);
    if ((pirep?.Comments?.length ?? 0) >= MAX_PIREP_COMMENTS) {
      setCommentError(PIREP_COMMENT_LIMIT_MESSAGE);
      return;
    }

    if (!user?.id) {
      setCommentError(
        "Your session could not be verified. Please sign in again.",
      );
      return;
    }

    setSubmittingCommentId(pirepId);
    setCommentError(null);

    try {
      const response = await authFetch(`/api/pilots/${user.id}/pireps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pirepId, content }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to add comment");
      }

      const comment = (data.comment ?? data.data?.comment) as
        | PirepComment
        | undefined;
      if (!comment) {
        throw new Error("Invalid comment response");
      }

      setPirepsData((currentPireps) =>
        currentPireps.map((item) =>
          item.id === pirepId
            ? {
                ...item,
                Comments: [...(item.Comments ?? []), comment],
              }
            : item,
        ),
      );
      setSelectedPirep((current) =>
        current && current.id === pirepId
          ? {
              ...current,
              Comments: [...(current.Comments ?? []), comment],
            }
          : current,
      );
      setNewComment("");
    } catch (err) {
      setCommentError(
        err instanceof Error ? err.message : "Failed to add comment",
      );
    } finally {
      setSubmittingCommentId(null);
    }
  };

  return (
    <CrewHeader>
      <main className="flex-1 space-y-5 pb-24 md:pb-6">
        {/* Top Header — Matches `Live aircraft scheduling` */}
        <CrewPageHeader
          title="My PIREPs"
          meta={<p className="mt-2 text-[13px] text-[var(--v2-text-text-muted,#525252)]">Submitted reports and staff comments</p>}
          actions={
            <Button asChild>
              <Link href="/crew/file-pirep">
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                File PIREP
              </Link>
            </Button>
          }
        />

        {showSubmittedNotice ? (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-[14px] bg-[var(--v2-state-bg-success,#e3fae1)] px-4 py-3 text-[13px] text-[var(--v2-state-fg-success,#196b2b)]"
          >
            <CheckCircle2
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.5}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">
                {t("PIREP submitted", "飞行报告已提交")}
              </p>
              <p className="text-[12px] opacity-90">
                {t(
                  "Review usually takes about 48 hours. Keep flying and file more PIREPs while you wait — no need to pause.",
                  "审核通常约需 48 小时。期间可照常飞行并继续提交飞行报告，无需等待。",
                )}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 text-[12px] underline-offset-2 hover:underline"
              onClick={() => setShowSubmittedNotice(false)}
            >
              {t("Dismiss", "知道了")}
            </button>
          </div>
        ) : null}

        {/* Summary Row — Matches `Live aircraft scheduling` */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="Submitted" count={pagination.total} />
          <SummaryCard
            label="Approved"
            count={pirepsData.filter((item) => item.status === 1).length}
            accent
          />
          <SummaryCard
            label="Awaiting"
            count={pirepsData.filter((item) => item.status === 0).length}
          />
        </div>

        {/* Search & Filter Bar — Matches `Live aircraft scheduling` */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input
            id="pirep-search"
            aria-label="Search PIREPs"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            aria-label="Filter status"
            className="h-8 rounded-[8px] border-0 bg-[var(--v2-background-bg-layer-02,#eef0f3)] px-2.5 text-[13px] outline-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="1">Approved</option>
            <option value="0">Awaiting approval</option>
            <option value="2">Rejected</option>
          </select>
          <select
            aria-label="Items per page"
            className="h-8 rounded-[8px] border-0 bg-[var(--v2-background-bg-layer-02,#eef0f3)] px-2.5 text-[13px] outline-none"
            value={String(itemsPerPage)}
            onChange={(event) => {
              setItemsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
          >
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>
        </div>

        {/* PIREP Cards — Matches `FlightList` in `Live aircraft scheduling` 1:1 */}
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 py-16 text-muted-foreground"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading PIREPs…
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </div>
        ) : visiblePireps.length === 0 ? (
          <CrewEmpty
            title="No PIREPs to show"
            description="Try another filter, or file a new pilot report"
            action={
              <Button asChild>
                <Link href="/crew/file-pirep">File PIREP</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-1.5">
            {visiblePireps.map((pirep) => (
              <CrewFlightRow
                key={pirep.id}
                flightnum={pirep.flightnum}
                liveryname={pirep.Aircraft?.liveryname}
                badge={<StatusBadge status={pirep.status} />}
                subtitle={pirep.Aircraft?.name || "Fleet aircraft"}
                departure={pirep.departure}
                arrival={pirep.arrival}
                duration={pirep.flighttime}
                routeMeta={pirep.date}
                onClick={() => {
                  setSelectedPirep(pirep);
                  setNewComment("");
                  setCommentError(null);
                }}
                trailing={
                  <span className="text-[12px] text-[var(--v2-text-text-faint,#737373)]">
                    {pirep.Comments?.length || 0} comments
                  </span>
                }
              />
            ))}
          </div>
        )}

        {detailLoading && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("Loading PIREP details…", "正在加载飞行报告详情…")}
          </p>
        )}
        {detailError && (
          <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {detailError}
          </p>
        )}

        {/* PIREP Detail Dialog */}
        {selectedPirep && (
          <Dialog
            open={Boolean(selectedPirep)}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedPirep(null);
                if (linkedPirepId !== null) {
                  const params = new URLSearchParams(searchParams.toString());
                  params.delete("pirepId");
                  const query = params.toString();
                  router.replace(`/crew/view-pireps${query ? `?${query}` : ""}`, {
                    scroll: false,
                  });
                }
              }
            }}
          >
            <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-none gap-5 overflow-y-auto rounded-[20px] p-3 sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100%-3rem)] sm:max-w-3xl sm:p-6">
              <DialogHeader className="px-1 pt-1 pr-10 text-left sm:px-0 sm:pt-0 sm:pr-10">
                <DialogTitle className="flex flex-wrap items-center gap-2.5 tabular-nums">
                  {getStatusIcon(selectedPirep.status)}
                  <span>PIREP #{selectedPirep.id}</span>
                  <StatusBadge status={selectedPirep.status} />
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {selectedPirep.flightnum} · {selectedPirep.departure} →{" "}
                  {selectedPirep.arrival}
                </DialogDescription>
              </DialogHeader>

              <CrewSector
                departure={selectedPirep.departure}
                arrival={selectedPirep.arrival}
                duration={selectedPirep.flighttime}
                durationHint={t("Block time", "轮挡时间")}
                className="px-3 sm:px-5 md:px-6"
                eyebrow={
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                      <AirlineLogo
                        flightnum={selectedPirep.flightnum}
                        liveryname={selectedPirep.Aircraft?.liveryname}
                        className="h-5 w-auto max-w-[72px] shrink-0 object-contain"
                      />
                      <span className="break-words font-mono text-[15px] font-medium tabular-nums text-[var(--v2-text-text-base,#171717)]">
                        {selectedPirep.flightnum}
                      </span>
                    </div>
                    <time dateTime={selectedPirep.date} className="font-mono tabular-nums">
                      {selectedPirep.date}
                    </time>
                  </div>
                }
                footer={
                  <div className="flex flex-col gap-3 text-[12px] leading-5 text-[var(--v2-text-text-muted,#525252)] sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-2">
                    <div className="min-w-0 space-y-1 sm:contents">
                      <p className="min-w-0 break-words">
                        {[selectedPirep.Aircraft?.name, selectedPirep.Aircraft?.liveryname]
                          .filter(Boolean)
                          .join(" · ") || t("Fleet aircraft", "机队机型")}
                      </p>
                      {user?.callsign ? (
                        <p className="min-w-0 break-words">
                          <CrewCallsign>{user.callsign}</CrewCallsign>
                        </p>
                      ) : null}
                    </div>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:gap-x-5">
                      <div className="min-w-0 sm:flex sm:items-baseline sm:gap-1.5">
                        <dt>{t("Fuel used", "消耗燃油")}</dt>
                        <dd className="whitespace-nowrap font-mono tabular-nums text-[var(--v2-text-text-base,#171717)]">
                          {Number(selectedPirep.fuelused || 0).toLocaleString()} kg
                        </dd>
                      </div>
                      <div className="min-w-0 sm:flex sm:items-baseline sm:gap-1.5">
                        <dt>{t("Multiplier", "积分倍率")}</dt>
                        <dd className="break-words font-mono tabular-nums text-[var(--v2-text-text-base,#171717)]">
                          {formatMultiplierLabel(selectedPirep.multi)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                }
              />

              <div className="space-y-4 border-t border-black/[0.06] px-1 pt-5 sm:px-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-medium">Comments</h3>
                  <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                    {selectedPirep.Comments?.length ?? 0}/{MAX_PIREP_COMMENTS}
                  </span>
                </div>

                {selectedPirep.Comments && selectedPirep.Comments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPirep.Comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-[14px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] p-4"
                      >
                        <div className="flex flex-col gap-1 text-[12px] text-muted-foreground sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                          <span className="min-w-0 break-words font-medium text-foreground">
                            {comment.User
                              ? `${comment.User.name} (${comment.User.callsign})`
                              : `User #${comment.userid}`}
                          </span>
                          <time dateTime={comment.dateposted} className="shrink-0 text-[11px] tabular-nums">
                            {new Date(comment.dateposted).toLocaleString()}
                          </time>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed [overflow-wrap:anywhere]">
                          {comment.content}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No comments yet.
                  </p>
                )}

                {(selectedPirep.Comments?.length ?? 0) >=
                MAX_PIREP_COMMENTS ? (
                  <p className="text-xs text-muted-foreground">
                    This PIREP has reached the {MAX_PIREP_COMMENTS}-comment
                    limit.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label
                      htmlFor={`pirep-comment-${selectedPirep.id}`}
                      className="text-xs"
                    >
                      Add a comment
                    </Label>
                    <Textarea
                      id={`pirep-comment-${selectedPirep.id}`}
                      value={newComment}
                      onChange={(event) => {
                        setNewComment(event.target.value);
                        setCommentError(null);
                      }}
                      placeholder="Write a comment about this PIREP..."
                      className="min-h-[100px] rounded-[12px] text-[13px]"
                      disabled={submittingCommentId === selectedPirep.id}
                      aria-invalid={Boolean(commentError)}
                    />
                    {commentError && (
                      <p className="text-xs text-red-600" role="alert">
                        {commentError}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => handleAddComment(selectedPirep.id)}
                        disabled={
                          submittingCommentId === selectedPirep.id ||
                          !newComment.trim()
                        }
                      >
                        {submittingCommentId === selectedPirep.id && (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        )}
                        Post comment
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground tabular-nums">
            {`Showing ${currentPageStart}-${currentPageEnd} of ${pagination.total} PIREPs`}
          </div>

          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((p) => Math.max(p - 1, 1));
                    }}
                    aria-disabled={currentPage === 1}
                    className={
                      currentPage === 1 ? "pointer-events-none opacity-50" : ""
                    }
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const page = i + 1;
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  }
                  if (
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <PaginationItem key={page}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentPage((p) => Math.min(p + 1, totalPages));
                    }}
                    aria-disabled={currentPage === totalPages}
                    className={
                      currentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : ""
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </main>
    </CrewHeader>
  );
}
