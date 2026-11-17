import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AirlineLogo } from "@/components/airline-logo";
import { airportCity } from "@/lib/airports";
import { cn } from "@/lib/utils";

/** Dot-separated meta line — callsign / rank / counts */
export function CrewMeta({
  items,
  className,
}: {
  items: Array<ReactNode | null | undefined | false>;
  className?: string;
}) {
  const visible = items.filter(Boolean);
  if (visible.length === 0) return null;

  return (
    <p
      className={cn(
        "mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--v2-text-text-muted,#525252)]",
        className,
      )}
    >
      {visible.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-2">
          {index > 0 ? (
            <span className="text-[var(--v2-text-text-faint,#737373)]" aria-hidden>
              ·
            </span>
          ) : null}
          <span>{item}</span>
        </span>
      ))}
    </p>
  );
}

export function CrewCallsign({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono tabular-nums text-[var(--v2-text-text-base,#171717)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Page title row used across crew surfaces */
export function CrewPageHeader({
  title,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-[28px] font-medium leading-tight tracking-[-0.02em] text-[var(--v2-text-text-base,#171717)] md:text-[32px]">
          {title}
        </h1>
        {meta}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

/** Quiet stat — numbers only; pass accent for the one figure that matters */
export function CrewStat({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[14px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-4 py-4",
        className,
      )}
    >
      <p className="text-[12px] text-[var(--v2-text-text-muted,#525252)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-[28px] font-medium leading-none tabular-nums tracking-tight",
          accent
            ? "text-[#0052a5]"
            : "text-[var(--v2-text-text-base,#171717)]",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-[12px] text-[var(--v2-text-text-faint,#737373)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Signature moment: ICAO pair with a drawn route line.
 * This is the one place the page is allowed to feel “aviation”.
 */
export function CrewSector({
  departure,
  arrival,
  departureName,
  arrivalName,
  duration,
  durationHint,
  eyebrow,
  footer,
  className,
  size = "md",
}: {
  departure: string;
  arrival: string;
  departureName?: string;
  arrivalName?: string;
  duration?: string;
  durationHint?: string;
  eyebrow?: ReactNode;
  footer?: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dep = (departure || "————").toUpperCase();
  const arr = (arrival || "————").toUpperCase();
  const depLabel = departureName || airportCity(dep);
  const arrLabel = arrivalName || airportCity(arr);
  const typeSize =
    size === "lg"
      ? "text-[36px] md:text-[40px]"
      : size === "sm"
        ? "text-[20px]"
        : "text-[28px] md:text-[32px]";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[16px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-5 py-5 md:px-6 md:py-6",
        className,
      )}
    >
      {/* Soft sky wash — stays inside the moment, not the chrome */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(0,82,165,0.08),transparent_55%)]"
      />

      {eyebrow ? (
        <div className="relative mb-5 text-[12px] text-[var(--v2-text-text-muted,#525252)]">
          {eyebrow}
        </div>
      ) : null}

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-end gap-3 md:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--v2-text-text-faint,#737373)]">
            Dep
          </p>
          <p
            className={cn(
              "mt-1 font-mono font-medium tabular-nums tracking-tight text-[var(--v2-text-text-base,#171717)]",
              typeSize,
            )}
          >
            {dep}
          </p>
          {depLabel ? (
            <p className="mt-1 truncate text-[13px] text-[var(--v2-text-text-muted,#525252)]">
              {depLabel}
            </p>
          ) : null}
        </div>

        <div className="mb-1 flex min-w-[88px] flex-col items-center gap-2 px-1 md:min-w-[140px]">
          <div className="flex w-full items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full bg-[#0052a5]" />
            <span className="h-px flex-1 bg-[#0052a5]/40" />
            <ArrowRight
              className="size-4 shrink-0 text-[#0052a5]"
              strokeWidth={1.5}
            />
            <span className="h-px flex-1 bg-[#0052a5]/40" />
            <span className="size-1.5 shrink-0 rounded-full bg-[#0052a5]" />
          </div>
          {duration ? (
            <p className="font-mono text-[13px] font-medium tabular-nums text-[var(--v2-text-text-base,#171717)]">
              {duration}
            </p>
          ) : null}
          {durationHint ? (
            <p className="text-[11px] text-[var(--v2-text-text-faint,#737373)]">
              {durationHint}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 text-right">
          <p className="text-[11px] uppercase tracking-[0.08em] text-[var(--v2-text-text-faint,#737373)]">
            Arr
          </p>
          <p
            className={cn(
              "mt-1 font-mono font-medium tabular-nums tracking-tight text-[var(--v2-text-text-base,#171717)]",
              typeSize,
            )}
          >
            {arr}
          </p>
          {arrLabel ? (
            <p className="mt-1 truncate text-[13px] text-[var(--v2-text-text-muted,#525252)]">
              {arrLabel}
            </p>
          ) : null}
        </div>
      </div>

      {footer ? (
        <div className="relative mt-5 border-t border-black/[0.06] pt-3 text-[12px] text-[var(--v2-text-text-muted,#525252)]">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function CrewPanel({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || action) && (
        <div className="flex items-end justify-between gap-3">
          <div>
            {title ? (
              <h2 className="text-[13px] font-medium text-[var(--v2-text-text-muted,#525252)]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-1 text-[12px] text-[var(--v2-text-text-faint,#737373)]">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function CrewListRow({
  children,
  className,
  onClick,
  href,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
}) {
  const classes = cn(
    "grid w-full gap-4 rounded-[14px] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-4 py-4 text-left transition-colors duration-150 hover:bg-[var(--v2-background-bg-layer-02,#eef0f3)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_rgba(0,82,165,0.28)]",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}

/** Compact itinerary strip for list rows — same language as CrewSector */
export function CrewSectorInline({
  departure,
  arrival,
  duration,
  meta,
  className,
}: {
  departure: string;
  arrival: string;
  duration?: string;
  meta?: ReactNode;
  className?: string;
}) {
  const dep = (departure || "————").toUpperCase();
  const arr = (arrival || "————").toUpperCase();
  const depCity = airportCity(dep);
  const arrCity = airportCity(arr);
  const centerLine = [duration, meta].filter(Boolean);

  return (
    <div
      className={cn(
        "grid min-w-0 grid-cols-[1fr_auto_1fr] items-center gap-3",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="font-mono text-[20px] font-medium tabular-nums tracking-tight text-[var(--v2-text-text-base,#171717)] md:text-[22px]">
          {dep}
        </p>
        {depCity ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--v2-text-text-faint,#737373)]">
            {depCity}
          </p>
        ) : null}
      </div>

      <div className="flex min-w-[72px] flex-col items-center gap-1 px-1 md:min-w-[108px]">
        <div className="flex w-full items-center gap-1.5">
          <span className="size-1 shrink-0 rounded-full bg-[#0052a5]" />
          <span className="h-px flex-1 bg-[#0052a5]/35" />
          <ArrowRight
            className="size-3.5 shrink-0 text-[#0052a5]"
            strokeWidth={1.5}
          />
          <span className="h-px flex-1 bg-[#0052a5]/35" />
          <span className="size-1 shrink-0 rounded-full bg-[#0052a5]" />
        </div>
        {centerLine.length > 0 ? (
          <p className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-[var(--v2-text-text-faint,#737373)]">
            {centerLine.map((item, index) => (
              <span key={index} className="inline-flex items-center gap-1.5">
                {index > 0 ? <span aria-hidden>·</span> : null}
                <span>{item}</span>
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 text-right">
        <p className="font-mono text-[20px] font-medium tabular-nums tracking-tight text-[var(--v2-text-text-base,#171717)] md:text-[22px]">
          {arr}
        </p>
        {arrCity ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--v2-text-text-faint,#737373)]">
            {arrCity}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shared flight / route list card — quiet left, sector moment, one trailing action.
 */
export function CrewFlightRow({
  flightnum,
  liveryname,
  badge,
  subtitle,
  departure,
  arrival,
  duration,
  routeMeta,
  trailing,
  href,
  onClick,
  className,
}: {
  flightnum?: string | null;
  liveryname?: string | null;
  badge?: ReactNode;
  subtitle?: ReactNode;
  departure: string;
  arrival: string;
  duration?: string;
  routeMeta?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <CrewListRow
      href={href}
      onClick={onClick}
      className={cn(
        "items-center gap-3 px-4 py-3.5 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.4fr)_auto] md:gap-5",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          {flightnum ? (
            <AirlineLogo
              flightnum={flightnum}
              liveryname={liveryname}
              className="h-3.5 w-auto max-w-[48px] shrink-0 object-contain"
            />
          ) : null}
          {flightnum ? (
            <span className="font-mono text-[13px] font-medium tabular-nums text-[var(--v2-text-text-base,#171717)]">
              {flightnum}
            </span>
          ) : null}
          {badge}
        </div>
        {subtitle ? (
          <p className="mt-1 truncate text-[12px] text-[var(--v2-text-text-faint,#737373)]">
            {subtitle}
          </p>
        ) : null}
      </div>

      <CrewSectorInline
        departure={departure}
        arrival={arrival}
        duration={duration}
        meta={routeMeta}
      />

      {trailing ? (
        <div className="flex shrink-0 items-center gap-2 md:justify-end">
          {trailing}
        </div>
      ) : null}
    </CrewListRow>
  );
}

export function CrewEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-dashed border-black/[0.08] bg-[var(--v2-background-bg-layer-01,#f7f8fa)] px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-[var(--v2-text-text-base,#171717)]">
        {title}
      </p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--v2-text-text-muted,#525252)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
