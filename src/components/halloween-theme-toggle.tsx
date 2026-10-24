"use client";

import React from "react";
import { Ghost, MoonStar } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useI18n } from "@/lib/i18n";

export function HalloweenThemeToggle({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { isHalloween, toggleHalloween } = useTheme();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={toggleHalloween}
      aria-pressed={isHalloween}
      title={
        isHalloween
          ? t("Halloween Theme: Active (Click to switch to Standard)", "万圣节主题：已开启（点击切回标准模式）")
          : t("Halloween Theme: Inactive (Click to activate)", "万圣节主题：已关闭（点击开启）")
      }
      className={`group relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all duration-300 select-none ${
        isHalloween
          ? "border-orange-500/40 bg-orange-500/10 text-orange-400 shadow-[0_0_12px_rgba(234,88,12,0.2)] hover:border-purple-500/60 hover:bg-orange-500/20 hover:shadow-[0_0_16px_rgba(234,88,12,0.45),0_0_24px_rgba(168,85,247,0.35)]"
          : "border-slate-200/80 bg-white/60 text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-700"
      } ${className}`}
    >
      {isHalloween ? (
        <Ghost className="h-4 w-4 shrink-0 text-orange-500 transition-transform duration-200 group-hover:scale-110" />
      ) : (
        <MoonStar className="h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 group-hover:scale-110 dark:text-slate-400" />
      )}

      {!compact && (
        <span className="hidden sm:inline">
          {isHalloween ? t("Halloween", "万圣夜") : t("Theme", "主题")}
        </span>
      )}

      {/* Subtle status indicator dot */}
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${
          isHalloween
            ? "bg-orange-500 shadow-[0_0_6px_rgba(234,88,12,0.9)]"
            : "bg-slate-300 dark:bg-slate-600"
        }`}
        aria-hidden="true"
      />
    </button>
  );
}
