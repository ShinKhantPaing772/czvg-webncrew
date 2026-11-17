"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const trickleTimer = useRef<number | null>(null);
  const finishTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);

  const clearAllTimers = useCallback(() => {
    if (trickleTimer.current !== null) {
      window.clearInterval(trickleTimer.current);
      trickleTimer.current = null;
    }
    if (finishTimer.current !== null) {
      window.clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
    if (safetyTimer.current !== null) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  const startProgress = useCallback(() => {
    clearAllTimers();
    setIsVisible(true);
    setProgress(18);

    // Realistic progressive trickle: 18% -> 45% -> 68% -> 85%
    trickleTimer.current = window.setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        const remaining = 90 - prev;
        const increment = Math.max(remaining * 0.18, 1.2);
        return Math.min(prev + increment, 88);
      });
    }, 180);

    // Safety timeout: prevent spinner from hanging if route aborts
    safetyTimer.current = window.setTimeout(() => {
      clearAllTimers();
      setProgress(100);
      finishTimer.current = window.setTimeout(() => {
        setIsVisible(false);
        setProgress(0);
      }, 250);
    }, 3000);
  }, [clearAllTimers]);

  const completeProgress = useCallback(() => {
    clearAllTimers();
    setProgress(100);
    finishTimer.current = window.setTimeout(() => {
      setIsVisible(false);
      setProgress(0);
    }, 280);
  }, [clearAllTimers]);

  // Complete progress whenever the active route updates
  useEffect(() => {
    completeProgress();
  }, [pathname, searchParams, completeProgress]);

  // Listen to user link clicks and browser history navigation
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // Left click only, without modifier keys
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore external links, downloads, mailto, tel, target="_blank", or hash jumps
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(anchor.href, window.location.href);

        // Ignore external hosts
        if (targetUrl.origin !== currentUrl.origin) return;

        // Ignore same URL (including hash-only scrolls)
        if (
          targetUrl.pathname === currentUrl.pathname &&
          targetUrl.search === currentUrl.search
        ) {
          return;
        }

        // Internal page navigation initiated -> show spinner immediately!
        startProgress();
      } catch {
        // Invalid URL fallback
      }
    };

    const handlePopState = () => {
      startProgress();
    };

    // Patch history pushState and replaceState to catch programmatic router.push calls
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = function (...args) {
      try {
        const targetUrlStr = args[2] ? String(args[2]) : null;
        if (targetUrlStr) {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(targetUrlStr, window.location.href);
          if (
            targetUrl.pathname !== currentUrl.pathname ||
            targetUrl.search !== currentUrl.search
          ) {
            startProgress();
          }
        }
      } catch {
        // Ignored
      }
      return originalPushState(...args);
    };

    window.history.replaceState = function (...args) {
      try {
        const targetUrlStr = args[2] ? String(args[2]) : null;
        if (targetUrlStr) {
          const currentUrl = new URL(window.location.href);
          const targetUrl = new URL(targetUrlStr, window.location.href);
          if (
            targetUrl.pathname !== currentUrl.pathname ||
            targetUrl.search !== currentUrl.search
          ) {
            startProgress();
          }
        }
      } catch {
        // Ignored
      }
      return originalReplaceState(...args);
    };

    document.addEventListener("click", handleDocumentClick, { capture: true });
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
      window.removeEventListener("popstate", handlePopState);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      clearAllTimers();
    };
  }, [clearAllTimers, startProgress]);

  return (
    <>
      {/* Top progress line — solid accent, no glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 right-0 z-[99999] h-0.5 overflow-hidden"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: "opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="h-full bg-[#0052a5] transition-[width] duration-200 ease-out"
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      {/* Quiet loading chip */}
      <div
        aria-hidden={!isVisible}
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed top-3 right-4 z-[99999] flex items-center gap-2 rounded-[8px] bg-[var(--v2-background-bg-base,#ffffff)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--v2-text-text-muted,#525252)] shadow-[var(--v2-elevation-floating)] transition-[opacity,transform] duration-200 ease-out select-none ${
          isVisible
            ? "translate-y-0 opacity-100"
            : "-translate-y-1 opacity-0"
        }`}
      >
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-[#0052a5]"
          strokeWidth={1.5}
        />
        <span>{t("Loading...", "加载中...")}</span>
      </div>
    </>
  );
}

export function NavigationProgress() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressInner />
    </Suspense>
  );
}
