"use client";

import { useState, type ReactNode } from "react";
import { Award, Bell, CheckCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PilotNotificationsInbox } from "@/hooks/use-pilot-notifications";
import { useI18n, type Locale } from "@/lib/i18n";
import type { PilotNotification } from "@/lib/notifications";

type Translate = (en: string, zh: string) => string;

const MINUTE: [Intl.RelativeTimeFormatUnit, number] = ["minute", 60];
const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  MINUTE,
];

export function formatNotificationTime(
  iso: string | null,
  locale: Locale,
  t: Translate,
  now = Date.now(),
) {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";

  const elapsedSeconds = Math.max(0, Math.round((now - time) / 1000));
  if (elapsedSeconds < 60) return t("Just now", "刚刚");

  const language = locale === "zh" ? "zh-CN" : "en";
  if (elapsedSeconds < 7 * 24 * 60 * 60) {
    const [unit, seconds] =
      RELATIVE_UNITS.find(([, size]) => elapsedSeconds >= size) ?? MINUTE;
    return new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(
      -Math.floor(elapsedSeconds / seconds),
      unit,
    );
  }

  return new Date(time).toLocaleDateString(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function describeNotification(
  notification: PilotNotification,
  t: Translate,
) {
  if (notification.kind === "message") {
    return { title: notification.subject, body: notification.content };
  }

  const title = t("New badge unlocked", "获得新勋章");
  const award = notification.award;
  if (!award) {
    return { title, body: t("You unlocked a new badge.", "你解锁了一枚新勋章。") };
  }

  return {
    title,
    body: t(
      `You unlocked the “${award.name}” badge.`,
      `祝贺你解锁了成就勋章【${award.nameZh || award.name}】！`,
    ),
  };
}

function NotificationGlyph({ notification }: { notification: PilotNotification }) {
  const imageurl =
    notification.kind === "award" ? notification.award?.imageurl : null;
  if (imageurl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={imageurl} alt="" className="size-9 shrink-0 object-contain" />
    );
  }

  const Icon = notification.kind === "award" ? Award : Bell;
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#0052a5]/[0.08] text-[#0052a5]">
      <Icon className="size-4" />
    </span>
  );
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: PilotNotification;
  onMarkRead: (id: number) => void;
}) {
  const { t, locale } = useI18n();
  const unread = !notification.readAt;
  const { title, body } = describeNotification(notification, t);
  const when = formatNotificationTime(notification.createdAt, locale, t);

  const content = (
    <>
      <NotificationGlyph notification={notification} />
      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span
            className={`min-w-0 flex-1 break-words text-[13px] leading-5 ${
              unread
                ? "font-semibold text-[var(--v2-text-text-base,#0f172a)]"
                : "font-medium text-[var(--v2-text-text-muted,#475569)]"
            }`}
          >
            {title}
          </span>
          {unread && (
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#0052a5]">
              <span className="sr-only">{t("Unread", "未读")}</span>
            </span>
          )}
        </span>
        <span className="mt-0.5 block break-words text-[12px] leading-[18px] text-[var(--v2-text-text-muted,#475569)]">
          {body}
        </span>
        {when && (
          <time
            dateTime={notification.createdAt ?? undefined}
            className="mt-1 block text-[11px] text-[var(--v2-text-text-faint,#64748b)]"
          >
            {when}
          </time>
        )}
      </span>
    </>
  );

  if (!unread) {
    return <div className="flex gap-3 px-4 py-3">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onMarkRead(notification.id)}
      title={t("Mark as read", "标为已读")}
      className="flex w-full gap-3 bg-[#0052a5]/[0.03] px-4 py-3 text-left transition-colors hover:bg-[#0052a5]/[0.06] focus-visible:bg-[#0052a5]/[0.08] focus-visible:outline-none"
    >
      {content}
    </button>
  );
}

function InboxMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[13px] text-[var(--v2-text-text-muted,#475569)]">
      {children}
    </div>
  );
}

export function NotificationBell({
  inbox,
  side = "right",
  align = "end",
  className = "",
}: {
  inbox: PilotNotificationsInbox;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, status, refresh, markRead } = inbox;

  const label =
    unreadCount > 0
      ? t(`Notifications, ${unreadCount} unread`, `通知，${unreadCount} 条未读`)
      : t("Notifications", "通知");

  let body: ReactNode;
  if (notifications.length > 0) {
    body = (
      <ul className="max-h-[min(26rem,60vh)] divide-y divide-[var(--v2-grey-200,#f2f2f2)] overflow-y-auto overscroll-contain">
        {notifications.map((notification) => (
          <li key={notification.id}>
            <NotificationRow
              notification={notification}
              onMarkRead={(id) => void markRead([id])}
            />
          </li>
        ))}
      </ul>
    );
  } else if (status === "error") {
    body = (
      <InboxMessage>
        <p>{t("Couldn't load notifications.", "通知加载失败。")}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-8 items-center rounded-[6px] px-2.5 text-[13px] font-medium text-[#0052a5] hover:bg-[#0052a5]/[0.06]"
        >
          {t("Try again", "重试")}
        </button>
      </InboxMessage>
    );
  } else if (status === "ready") {
    body = (
      <InboxMessage>
        <Bell className="size-5 text-[var(--v2-icon-icon-muted,#64748b)]" />
        <p className="font-medium text-[var(--v2-text-text-base,#0f172a)]">
          {t("No notifications yet", "暂无通知")}
        </p>
        <p className="text-[12px]">
          {t(
            "New badges you earn will show up here.",
            "获得新勋章时会在这里通知你。",
          )}
        </p>
      </InboxMessage>
    );
  } else {
    body = <InboxMessage>{t("Loading…", "加载中…")}</InboxMessage>;
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void refresh();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={`relative flex size-8 shrink-0 items-center justify-center rounded-[6px] text-[var(--v2-icon-icon-muted,#64748b)] transition-colors hover:bg-[#0052a5]/[0.06] hover:text-[#0052a5] ${className}`}
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--v2-state-fg-danger,#c8102e)] px-1 text-[10px] font-semibold leading-none text-white tabular-nums"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={8}
        aria-label={t("Notifications", "通知")}
        className="w-[min(20rem,calc(100vw-1rem))] overflow-hidden p-0"
      >
        <div className="flex h-11 items-center justify-between gap-2 border-b border-[var(--v2-grey-200,#f2f2f2)] pl-4 pr-2">
          <p className="text-[13px] font-semibold text-[var(--v2-text-text-base,#0f172a)]">
            {t("Notifications", "通知")}
          </p>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markRead()}
              className="inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] font-medium text-[#0052a5] hover:bg-[#0052a5]/[0.06]"
            >
              <CheckCheck className="size-3.5" />
              {t("Mark all read", "全部标为已读")}
            </button>
          )}
        </div>
        {body}
      </PopoverContent>
    </Popover>
  );
}
