"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";

function NavigationProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isHalloween } = useTheme();
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
    }, 9000);
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
      {/* ── Top Glowing Progress Line ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 right-0 z-[99999] h-[3px] overflow-hidden"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.25s ease-out",
        }}
      >
        <div
          className={`h-full transition-all duration-200 ease-out ${
            isHalloween
              ? "bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600 shadow-[0_0_12px_rgba(249,115,22,0.9)]"
              : "bg-gradient-to-r from-sky-500 via-[#0052a5] to-[#00a3e0] shadow-[0_0_10px_rgba(0,82,165,0.8)]"
          }`}
          style={{
            width: `${progress}%`,
          }}
        />
      </div>

      {/* ── Floating Rotating Spinner Badge (旋转指示进度条) ── */}
      <div
        aria-hidden={!isVisible}
        role="status"
        aria-live="polite"
        className={`pointer-events-none fixed top-3 right-4 z-[99999] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xl backdrop-blur-md transition-all duration-200 select-none ${
          isVisible
            ? "translate-y-0 opacity-100 scale-100"
            : "-translate-y-2 opacity-0 scale-95"
        } ${
          isHalloween
            ? "border-orange-500/30 bg-[#1c1917]/95 text-orange-400 shadow-[0_4px_20px_rgba(249,115,22,0.25)]"
            : "border-slate-200/80 bg-white/95 text-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.12)] dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100"
        }`}
      >
        <Loader2
          className={`size-3.5 shrink-0 animate-spin ${
            isHalloween ? "text-orange-500" : "text-[#0052a5]"
          }`}
        />
        <span className="tracking-wide">
          {t("Loading...", "加载中...")}
        </span>
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
