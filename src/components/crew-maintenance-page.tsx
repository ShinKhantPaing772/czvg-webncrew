"use client";

import Link from "next/link";
import { Header } from "@/components/layout/header";
import { useI18n } from "@/lib/i18n";

export function CrewMaintenancePage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--v2-background-bg-deep)]">
      <Header />
      <main className="mx-auto max-w-xl px-4 py-16" data-no-i18n>
        <div className="space-y-4 rounded-[10px] bg-[var(--v2-background-bg-base)] p-6 shadow-[var(--v2-elevation-raised)] sm:p-8">
          <h1 className="text-2xl font-semibold">
            {t("Crew Center maintenance", "机组中心维护中")}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              "The Crew Center is temporarily unavailable, including sign-in, applications and access for signed-in users. Please check back after maintenance.",
              "维护期间，机组中心暂时关闭，登录、飞行员申请及已登录用户的访问均已暂停。请在维护结束后再试。",
            )}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("You can continue browsing the public website.", "您仍可浏览公开网站。")}
          </p>
          <Link href="/" className="inline-block text-sm font-medium underline underline-offset-4">
            {t("Return to the website", "返回网站")}
          </Link>
        </div>
      </main>
    </div>
  );
}
