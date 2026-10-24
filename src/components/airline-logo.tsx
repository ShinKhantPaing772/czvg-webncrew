import type React from "react";
import { getAirlineLogoForFlight } from "@/lib/group-airlines";

export interface AirlineLogoProps {
  flightnum?: string | null;
  liveryname?: string | null;
  className?: string;
  alt?: string;
}

/**
 * Theme-adaptive Airline Logo.
 * Automatically switches between standard (light) and high-contrast white (dark/halloween)
 * logo assets via CSS classes `.brand-logo-light` and `.brand-logo-dark`, preventing SSR flash.
 */
export function AirlineLogo({
  flightnum,
  liveryname,
  className = "h-4 w-auto max-w-[54px] shrink-0 object-contain",
  alt = "",
}: AirlineLogoProps) {
  const { logo, logoDark, name } = getAirlineLogoForFlight(flightnum, liveryname);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={alt || name}
        className={`brand-logo-light ${className}`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoDark}
        alt={alt || name}
        className={`brand-logo-dark ${className}`}
      />
    </>
  );
}
