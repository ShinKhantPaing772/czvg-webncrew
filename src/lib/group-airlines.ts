export type GroupAirline = {
  name: string;
  description: string;
  logo: string;
  logoDark?: string;
  regionalAirlines?: readonly string[];
  type?: "cargo";
};

export type AirlineLogoResult = {
  logo: string;
  logoDark: string;
  name: string;
};

export const groupAirlines: readonly GroupAirline[] = [
  {
    name: "China Southern Airlines",
    description:
      "The group’s flagship carrier, operating an extensive domestic and international network from major hubs across China.",
    logo: "/airlines/china-southern.svg",
    logoDark: "/airlines/china-southern-white.svg",
    regionalAirlines: [
      "China Southern Henan Airlines",
      "Guizhou Airlines",
      "Zhuhai Airlines",
      "Shantou Airlines",
    ],
  },
  {
    name: "Xiamen Airlines",
    description:
      "Based in Xiamen, operating an extensive domestic network alongside services across Asia and international destinations.",
    logo: "/airlines/xiamenair.svg",
    logoDark: "/airlines/xiamenair-white.svg",
  },
  {
    name: "China Southern Cargo",
    description:
      "The group’s dedicated air-freight carrier, operating cargo services within China and internationally.",
    logo: "/airlines/china-southern.svg",
    logoDark: "/airlines/china-southern-white.svg",
    type: "cargo",
  },
  {
    name: "China Southern General Aviation",
    description: "Representing the group’s general aviation operations.",
    logo: "/airlines/china-southern.svg",
    logoDark: "/airlines/china-southern-white.svg",
  },
  {
    name: "Chongqing Airlines",
    description:
      "Based in Chongqing, connecting Southwest China with destinations across the country.",
    logo: "/airlines/chongqing.webp",
    logoDark: "/airlines/chongqing.webp",
  },
  {
    name: "Hebei Airlines",
    description:
      "Based in Shijiazhuang, connecting Hebei Province with destinations throughout China.",
    logo: "/airlines/hebei.webp",
    logoDark: "/airlines/hebei.webp",
  },
  {
    name: "Jiangxi Air",
    description:
      "Based in Nanchang, connecting Jiangxi Province with major cities across China.",
    logo: "/airlines/jiangxi.webp",
    logoDark: "/airlines/jiangxi.webp",
  },
];

/** Local branded assets for CZVG group carriers (IATA keys). */
const LOCAL_LOGOS: Record<string, AirlineLogoResult> = {
  CZ: {
    logo: "/airlines/china-southern.svg",
    logoDark: "/airlines/china-southern-white.svg",
    name: "China Southern Airlines",
  },
  MF: {
    logo: "/airlines/xiamenair.svg",
    logoDark: "/airlines/xiamenair-white.svg",
    name: "Xiamen Airlines",
  },
  OQ: {
    logo: "/airlines/chongqing.webp",
    logoDark: "/airlines/chongqing.webp",
    name: "Chongqing Airlines",
  },
  NS: {
    logo: "/airlines/hebei.webp",
    logoDark: "/airlines/hebei.webp",
    name: "Hebei Airlines",
  },
  RY: {
    logo: "/airlines/jiangxi.webp",
    logoDark: "/airlines/jiangxi.webp",
    name: "Jiangxi Air",
  },
};

/**
 * Common ICAO → IATA mappings for flight numbers stored as 3-letter codes.
 * Partner / cargo carriers included so remote logos resolve correctly.
 */
const ICAO_TO_IATA: Record<string, string> = {
  CSN: "CZ",
  CXA: "MF",
  CQN: "OQ",
  HBH: "NS",
  CJX: "RY",
  UEA: "EU",
  UPS: "5X",
  FDX: "FX",
  UAL: "UA",
  AAL: "AA",
  DAL: "DL",
  BAW: "BA",
  AFR: "AF",
  KLM: "KL",
  QTR: "QR",
  UAE: "EK",
  ETD: "EY",
  SVA: "SV",
  CPA: "CX",
  ANA: "NH",
  JAL: "JL",
  CCA: "CA",
  CES: "MU",
  CSZ: "ZH",
  CDC: "GJ",
  CQH: "9C",
};

const LIVERY_HINTS: ReadonlyArray<{
  pattern: RegExp;
  iata: string;
  name: string;
}> = [
  { pattern: /xiamen/, iata: "MF", name: "Xiamen Airlines" },
  { pattern: /chongqing/, iata: "OQ", name: "Chongqing Airlines" },
  { pattern: /hebei/, iata: "NS", name: "Hebei Airlines" },
  { pattern: /jiangxi/, iata: "RY", name: "Jiangxi Air" },
  {
    pattern: /southern|csair|\bguizhou\b|\bzhuhai\b|\bshantou\b|\bhenan\b/,
    iata: "CZ",
    name: "China Southern Airlines",
  },
  { pattern: /chengdu/, iata: "EU", name: "Chengdu Airlines" },
  { pattern: /\bups\b|united\s*parcel/, iata: "5X", name: "UPS Airlines" },
  { pattern: /fedex|federal\s*express/, iata: "FX", name: "FedEx" },
  { pattern: /\bunited\b(?!.*parcel)/, iata: "UA", name: "United Airlines" },
  { pattern: /american\s*air/, iata: "AA", name: "American Airlines" },
  { pattern: /\bdelta\b/, iata: "DL", name: "Delta Air Lines" },
  { pattern: /qatar/, iata: "QR", name: "Qatar Airways" },
  { pattern: /emirates/, iata: "EK", name: "Emirates" },
  { pattern: /etihad/, iata: "EY", name: "Etihad Airways" },
  { pattern: /saudia|saudi\s*arabian/, iata: "SV", name: "Saudia" },
  { pattern: /cathay/, iata: "CX", name: "Cathay Pacific" },
  { pattern: /air\s*france/, iata: "AF", name: "Air France" },
  { pattern: /\bklm\b/, iata: "KL", name: "KLM" },
  { pattern: /westjet/, iata: "WS", name: "WestJet" },
];

/** Google Flights airline logo CDN — keyed by IATA. */
export function remoteAirlineLogoUrl(iata: string): string {
  return `https://www.gstatic.com/flights/airline_logos/70px/${iata.toUpperCase()}.png`;
}

/**
 * Extract IATA/ICAO designator from a flight number like `5X104(A)`, `CSN327`, `CZ3101`.
 */
export function extractAirlineDesignator(
  flightnum?: string | null,
): string | null {
  if (!flightnum) return null;
  const raw = flightnum
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\([^)]*\)$/, "");
  if (!raw) return null;

  const icao = raw.match(/^([A-Z]{3})(\d+)/);
  if (icao) return icao[1];

  const iata = raw.match(/^([A-Z][A-Z0-9]|[A-Z0-9][A-Z])(\d+)/);
  if (iata) return iata[1];

  return null;
}

function designatorToIata(designator: string): string | null {
  if (designator.length === 2) return designator;
  return ICAO_TO_IATA[designator] ?? null;
}

function resolveFromLivery(
  livery: string,
): { iata: string; name: string } | null {
  if (!livery) return null;
  for (const hint of LIVERY_HINTS) {
    if (hint.pattern.test(livery)) {
      return { iata: hint.iata, name: hint.name };
    }
  }
  return null;
}

/**
 * Resolves airline logo from flight number / livery.
 * CZVG group carriers use local assets; all other airlines use the Google Flights
 * IATA logo CDN so partner routes (e.g. UPS `5X104`) show the correct icon.
 */
export function getAirlineLogoForFlight(
  flightnum?: string | null,
  liveryname?: string | null,
): AirlineLogoResult | null {
  const designator = extractAirlineDesignator(flightnum);
  const livery = (liveryname || "").trim().toLowerCase();
  const liveryHint = resolveFromLivery(livery);

  const iata =
    (designator ? designatorToIata(designator) : null) ?? liveryHint?.iata ?? null;

  if (!iata) return null;

  const displayName =
    liveryHint?.name ??
    (liveryname?.trim() || null) ??
    LOCAL_LOGOS[iata]?.name ??
    iata;

  const local = LOCAL_LOGOS[iata];
  if (local) {
    return { ...local, name: displayName };
  }

  const logo = remoteAirlineLogoUrl(iata);
  return { logo, logoDark: logo, name: displayName };
}
