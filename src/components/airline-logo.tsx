"use client";

import { useState } from "react";

import { getAirlineLogoForFlight } from "@/lib/group-airlines";

export interface AirlineLogoProps {
  flightnum?: string | null;
  liveryname?: string | null;
  className?: string;
  alt?: string;
}

/**
 * Theme-adaptive Airline Logo.
 * Group carriers use local assets; partners resolve via IATA → Google Flights CDN.
 * Broken remote assets hide themselves instead of showing a wrong fallback.
 */
export function AirlineLogo({
  flightnum,
  liveryname,
  className = "h-4 w-auto max-w-[54px] shrink-0 object-contain",
  alt = "",
}: AirlineLogoProps) {
  const result = getAirlineLogoForFlight(flightnum, liveryname);
  const [failed, setFailed] = useState(false);

  if (!result || failed) return null;

  const { logo, logoDark, name } = result;
  const sameAsset = logo === logoDark;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={alt || name}
        className={`${sameAsset ? "" : "brand-logo-light "}${className}`}
        onError={() => setFailed(true)}
      />
      {!sameAsset ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoDark}
          alt={alt || name}
          className={`brand-logo-dark ${className}`}
          onError={() => setFailed(true)}
        />
      ) : null}
    </>
  );
}
