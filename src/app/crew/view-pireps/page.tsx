"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import {
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  ArrowRight,
  CalendarClock,
  Plus,
} from "lucide-react";
import { CrewHeader } from "@/components/crew-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { getAirlineLogoForFlight } from "@/lib/group-airlines";
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
  icon,
  label,
  count,
}: {
  icon: ReactNode;
  label: string;
  count: number | string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-3 sm:p-4">
        <span className="hidden rounded-md bg-[#eef4fb] p-2 text-[#0052a5] sm:block">
          {icon}
        </span>
        <div>
          <p className="text-xl font-semibold sm:text-2xl">{count}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
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
  const [selectedPirep, setSelectedPirep] = useState<Pirep | null>(null);
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

  const [searchTerm, setSearchTerm] = useState("");

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

    const pirep = pirepsData.find((item) => item.id === pirepId);
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">My PIREPs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your submitted pilot reports, check approval status, and
              discuss with staff.
            </p>
          </div>
          <Button asChild>
            <Link href="/crew/file-pirep">
              <Plus className="mr-1 h-4 w-4" />
              File PIREP
            </Link>
          </Button>
        </div>

        {/* Summary Row — Matches `Live aircraft scheduling` */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <SummaryCard
            icon={<FileText className="h-4 w-4" />}
            label="Total submitted"
            count={pagination.total}
          />
          <SummaryCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Approved on page"
            count={pirepsData.filter((item) => item.status === 1).length}
          />
          <SummaryCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Awaiting review"
            count={pirepsData.filter((item) => item.status === 0).length}
          />
        </div>

        {/* Search & Filter Bar — Matches `Live aircraft scheduling` */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <Input
            id="pirep-search"
            aria-label="Search PIREPs"
            placeholder="Search route, flight number, or aircraft"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
          <select
            aria-label="Filter status"
            className="h-8 rounded-[6px] border-0 bg-[var(--v2-background-bg-layer-02,#f2f2f2)]/75 px-2.5 text-[13px] outline-none"
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
            className="h-8 rounded-[6px] border-0 bg-[var(--v2-background-bg-layer-02,#f2f2f2)]/75 px-2.5 text-[13px] outline-none"
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
          <div className="rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-6 py-10 text-center">
            <FileText className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-[13px] font-medium">No PIREPs to show</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Try another filter, or file a new pilot report.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visiblePireps.map((pirep) => (
              <Card key={pirep.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPirep(pirep);
                    setNewComment("");
                    setCommentError(null);
                  }}
                  className="grid w-full gap-4 rounded-[6px] bg-[var(--v2-background-bg-layer-01,#fafafa)] px-4 py-3.5 text-left transition-colors hover:bg-[var(--v2-background-bg-layer-02,#f2f2f2)] focus-visible:outline-none md:grid-cols-[1fr_1.3fr_1fr]"
                >
                  <div>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          getAirlineLogoForFlight(
                            pirep.flightnum,
                            pirep.Aircraft?.liveryname,
                          ).logo
                        }
                        alt=""
                        className="h-4 w-auto max-w-[54px] shrink-0 object-contain"
                      />
                      <span className="font-semibold">{pirep.flightnum}</span>
                      <StatusBadge status={pirep.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pirep.Aircraft?.name || "Fleet aircraft"}
                      {pirep.Aircraft?.liveryname
                        ? ` · ${pirep.Aircraft.liveryname}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Logged {pirep.date}
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center gap-3 text-xl font-semibold tracking-tight">
                      <span>{pirep.departure}</span>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      <span>{pirep.arrival}</span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Block duration {pirep.flighttime}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Fuel {Number(pirep.fuelused || 0).toLocaleString()} kg ·
                      Multiplier {pirep.multi}x
                    </p>
                  </div>

                  <div className="space-y-2 md:text-right">
                    <p className="text-sm">
                      {user?.name || "Pilot"}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {user?.callsign}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pirep.Comments?.length || 0} comment
                      {(pirep.Comments?.length || 0) === 1 ? "" : "s"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Click to inspect &amp; comment
                    </p>
                  </div>
                </button>
              </Card>
            ))}
          </div>
        )}

        {/* PIREP Detail Dialog */}
        {selectedPirep && (
          <Dialog
            open={Boolean(selectedPirep)}
            onOpenChange={(open) => {
              if (!open) setSelectedPirep(null);
            }}
          >
            <DialogContent className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 tabular-nums">
                  {getStatusIcon(selectedPirep.status)}
                  <span>PIREP #{selectedPirep.id}</span>
                  <StatusBadge status={selectedPirep.status} />
                </DialogTitle>
                <DialogDescription>
                  {selectedPirep.flightnum} · {selectedPirep.departure} →{" "}
                  {selectedPirep.arrival}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 rounded-lg bg-[var(--v2-background-bg-layer-01,#fafafa)] p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Flight number</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedPirep.flightnum}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedPirep.date}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Block duration</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedPirep.flighttime}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Aircraft</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedPirep.Aircraft?.name} (
                    {selectedPirep.Aircraft?.liveryname})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fuel used</p>
                  <p className="mt-1 text-sm font-medium">
                    {Number(selectedPirep.fuelused || 0).toLocaleString()} kg
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Multiplier</p>
                  <p className="mt-1 text-sm font-medium">
                    {selectedPirep.multi}x
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Comments</h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedPirep.Comments?.length ?? 0}/{MAX_PIREP_COMMENTS}
                  </span>
                </div>

                {selectedPirep.Comments && selectedPirep.Comments.length > 0 ? (
                  <div className="space-y-2">
                    {selectedPirep.Comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-md bg-[var(--v2-background-bg-layer-01,#fafafa)] p-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {comment.User
                              ? `${comment.User.name} (${comment.User.callsign})`
                              : `User #${comment.userid}`}
                          </span>
                          <span>
                            {new Date(comment.dateposted).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">
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
            Showing {currentPageStart}-{currentPageEnd} of {pagination.total}{" "}
            PIREPs
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
