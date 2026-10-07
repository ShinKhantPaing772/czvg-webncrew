"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { authFetch } from "@/lib/utils/api";
import { Button } from "@/components/ui/button";
import { schedulingResponse } from "./use-scheduling";
import { errorMessage, formatUtc } from "./utils";

type FlightPublication = {
  id: number;
  state: string;
  message: string;
  revision: number;
  publishedRevision: number;
  nextAttemptAt?: string;
};
type PublicationResult = {
  processed: number;
  published: number;
  disabled: boolean;
  reasons?: string[];
  states?: Record<string, number>;
  flight?: FlightPublication;
};

function publicationMessage(result: PublicationResult, flightId: number): string {
  if (!result || !Number.isSafeInteger(result.processed) || result.processed < 0 || !Number.isSafeInteger(result.published) || result.published < 0 || typeof result.disabled !== "boolean") {
    throw new Error("IF publishing returned an unexpected response. Refresh this flight before retrying.");
  }
  const labels: Record<string, string> = { queued: "queued for retry", processing: "still processing", conflict: "need conflict review", reconciliation: "need reconciliation", failed: "failed", partial: "partially synchronized", blocked: "blocked by earlier schedules", skipped: "skipped", done: "superseded" };
  const details = Object.entries(result.states || {}).filter(([state, count]) => state !== "published" && Number.isSafeInteger(count) && count > 0).map(([state, count]) => `${count} ${labels[state] || "need review"}`);
  if (result.flight) {
    const flight = result.flight;
    if (flight.id !== flightId || typeof flight.state !== "string" || typeof flight.message !== "string" ||
      (flight.state === "published" && (!Number.isSafeInteger(flight.revision) || flight.revision < 1 || flight.revision !== flight.publishedRevision))) {
      throw new Error("IF publishing did not confirm this flight’s latest revision. Refresh this flight before retrying.");
    }
    const message = flight.message || (flight.state === "published" ? "This flight’s latest approved schedule and crew are published to IF." : "This flight is not confirmed published. Refresh it to review its publishing status.");
    return message + (details.length ? " This run: " + details.join("; ") + "." : "");
  }
  if (result.disabled) return "IF publishing is unavailable." + (result.reasons?.length ? " " + result.reasons.join("; ") : " Review the IF connection settings.");
  if (!result.processed) return "This flight was not published during this run. Refresh it to review blockers or publishing status.";
  return `Selected flight publishing processed ${result.processed} ${result.processed === 1 ? "job" : "jobs"}: ${result.published} synchronized ${result.published === 1 ? "revision" : "revisions"}${details.length ? "; " + details.join("; ") : ""}. Refresh the flight to confirm its latest approved revision.`;
}

export function PublishFlightButton({ flightId, disabled = false, onRefresh, onDenied, onBusyChange }: {
  flightId: number;
  disabled?: boolean;
  onRefresh: () => Promise<void>;
  onDenied?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retryAfter, setRetryAfter] = useState<string | null>(null);
  const mounted = useRef(true);
  const pending = useRef(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const notifyBusy = useRef(onBusyChange);
  notifyBusy.current = onBusyChange;

  const cancel = useCallback(() => {
    mounted.current = false; ++generation.current; controller.current?.abort();
    if (pending.current) notifyBusy.current?.(false);
    pending.current = false;
  }, []);
  useEffect(() => {
    mounted.current = true;
    setBusy(false); setError(""); setMessage(""); setRetryAfter(null);
    return cancel;
  }, [flightId, cancel]);

  async function publish() {
    if (pending.current || disabled || !Number.isSafeInteger(flightId) || flightId < 1) return;
    pending.current = true; setBusy(true); setError(""); setMessage(""); setRetryAfter(null); notifyBusy.current?.(true);
    const current = ++generation.current;
    const next = new AbortController(); controller.current = next;
    const timeout = window.setTimeout(() => next.abort(), 25000);
    const isCurrent = () => mounted.current && current === generation.current;
    try {
      const response = await authFetch("/api/admin/scheduling/if/publish", {
        method: "POST", signal: next.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flightId }),
      });
      if ([401, 403].includes(response.status) && isCurrent()) {
        setMessage(""); onDenied?.();
        await onRefresh().catch(() => undefined);
      }
      const result = await schedulingResponse(response);
      if (!isCurrent()) return;
      const outcome = publicationMessage(result?.data, flightId);
      window.clearTimeout(timeout);
      setMessage(outcome);
      const retryAt = result?.data?.flight?.nextAttemptAt;
      setRetryAfter(typeof retryAt === "string" && Number.isFinite(Date.parse(retryAt)) ? retryAt : null);
      try { await onRefresh(); }
      catch (refreshError) { if (isCurrent()) setError("The publishing result was received, but local flight status could not be refreshed: " + errorMessage(refreshError)); }
    } catch (publishError) {
      if (isCurrent()) setError(next.signal.aborted ? "IF publishing took too long. Refresh this flight and IF schedules to check the outcome before retrying." : errorMessage(publishError));
    } finally {
      window.clearTimeout(timeout);
      if (isCurrent()) { pending.current = false; setBusy(false); notifyBusy.current?.(false); }
    }
  }

  return <div className="space-y-2">
    <Button type="button" disabled={disabled || busy || !Number.isSafeInteger(flightId) || flightId < 1} onClick={() => void publish()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Publish to IF</Button>
    {message && <p role="status" className="max-w-prose text-sm text-muted-foreground">{message}</p>}
    {retryAfter && <p role="status" className="text-sm text-muted-foreground">Retry after <time dateTime={retryAfter}>{formatUtc(retryAfter)}</time>.</p>}
    {error && <p role="alert" className="max-w-prose text-sm text-destructive">{error}</p>}
  </div>;
}
