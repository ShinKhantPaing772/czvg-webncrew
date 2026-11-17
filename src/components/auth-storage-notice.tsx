"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function AuthStorageNotice() {
  const { t } = useI18n();

  return (
    <p className="text-xs leading-5 text-[var(--v2-text-text-muted,#525252)]">
      {t(
        "We use browser storage to keep you signed in and remember your settings and saved route filters.",
        "我们使用浏览器存储来保持您的登录状态，并记住您的设置和已保存的航线筛选条件。",
      )}{" "}
      <Link
        href="/privacy-policy#browser-storage"
        className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800"
      >
        {t("Cookies and browser storage", "Cookie 与浏览器存储说明")}
      </Link>
    </p>
  );
}
