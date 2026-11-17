"use client";

import { Wrench } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function MaintenanceNotice({ active = false }: { active?: boolean }) {
  const { t } = useI18n();
  if (!active) return null;

  return (
    <section
      aria-labelledby="maintenance-notice-title"
      data-no-i18n
      className="border-b border-current/15 bg-[var(--v2-state-bg-warning)] text-[var(--v2-state-fg-warning)]"
    >
      <div className="mx-auto max-w-[1440px] space-y-2 px-4 py-3 text-xs leading-relaxed md:px-6 sm:text-sm">
        <p id="maintenance-notice-title" className="flex items-center gap-2 font-semibold">
          <Wrench className="size-4 shrink-0" aria-hidden="true" />
          {t("Crew Center maintenance in progress", "机组中心维护中")}
        </p>
        <p>
          {t(
            "Crew Center access is temporarily paused for everyone, including signed-in users. You can continue browsing the public website.",
            "维护期间，所有用户（包括已登录用户）均暂时无法访问机组中心。您仍可浏览公开网站。",
          )}
        </p>
        <p>
          {t(
            "Sign-in, applications, PIREP submissions and live scheduling will reopen after the maintenance checks are complete.",
            "维护检查完成后，登录、飞行员申请、飞行报告（PIREP）提交及实时航班排班等功能将恢复使用。",
          )}
        </p>
      </div>
    </section>
  );
}
