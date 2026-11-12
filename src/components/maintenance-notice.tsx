"use client";

import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function MaintenanceNotice() {
  const { t } = useI18n();

  return (
    <section
      aria-labelledby="maintenance-notice-title"
      data-no-i18n
      className="border-b border-current/15 bg-[var(--v2-state-bg-warning)] text-[var(--v2-state-fg-warning)]"
    >
      <div className="mx-auto max-w-[1440px] space-y-2 px-4 py-3 text-xs leading-relaxed md:px-6 sm:text-sm">
        <p id="maintenance-notice-title" className="flex items-center gap-2 font-semibold">
          <Wrench className="size-4 shrink-0" aria-hidden="true" />
          {t("Planned website & Crew Center maintenance", "网站及机组中心维护预告")}
        </p>
        <p>
          {t(
            "Monday, November 16, 2026 · Estimated duration: 3 hours. Times are approximate.",
            "2026 年 11 月 16 日（周一）· 预计持续 3 小时，实际时间可能调整。",
          )}
        </p>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-3">
          <div className="flex flex-wrap gap-x-2 sm:block">
            <dt className="font-semibold">{t("Toronto · EST (UTC−5)", "多伦多 · EST（UTC−5）")}</dt>
            <dd>
              <time dateTime="2026-11-16T10:00:00-05:00">{t("Nov 16, 10:00 a.m.", "11 月 16 日 10:00")}</time>
              {" – "}
              <time dateTime="2026-11-16T13:00:00-05:00">{t("1:00 p.m.", "13:00")}</time>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2 sm:block">
            <dt className="font-semibold">UTC</dt>
            <dd>
              <time dateTime="2026-11-16T15:00:00Z">{t("Nov 16, 15:00", "11 月 16 日 15:00")}</time>
              {" – "}
              <time dateTime="2026-11-16T18:00:00Z">18:00</time>
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2 sm:block">
            <dt className="font-semibold">{t("Beijing (UTC+8)", "北京（UTC+8）")}</dt>
            <dd>
              <time dateTime="2026-11-16T23:00:00+08:00">{t("Nov 16, 23:00", "11 月 16 日 23:00")}</time>
              {" – "}
              <time dateTime="2026-11-17T02:00:00+08:00">{t("Nov 17, 02:00", "11 月 17 日 02:00")}</time>
            </dd>
          </div>
        </dl>
        <p>
          {t(
            "Sign-in, applications, PIREP submissions and live scheduling may be temporarily unavailable. Please save unfinished flight reports beforehand.",
            "维护期间，登录、飞行员申请、飞行报告（PIREP）提交及实时航班排班等功能可能暂时无法使用。请提前保存尚未提交的飞行报告。",
          )}
        </p>
      </div>
    </section>
  );
}
