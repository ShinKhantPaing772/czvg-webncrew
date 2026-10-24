export type GroupAirline = {
  name: string;
  description: string;
  logo: string;
  logoDark?: string;
  regionalAirlines?: readonly string[];
  type?: "cargo";
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

/**
 * Resolves the authentic airline logo asset from `/public/airlines/` based on flight number or livery name.
 */
export function getAirlineLogoForFlight(
  flightnum?: string | null,
  liveryname?: string | null,
): { logo: string; logoDark: string; name: string } {
  const code = (flightnum || "").trim().toUpperCase();
  const livery = (liveryname || "").trim().toLowerCase();

  if (
    code.startsWith("CXA") ||
    code.startsWith("MF") ||
    livery.includes("xiamen")
  ) {
    return {
      logo: "/airlines/xiamenair.svg",
      logoDark: "/airlines/xiamenair-white.svg",
      name: "Xiamen Airlines",
    };
  }
  if (
    code.startsWith("CQN") ||
    code.startsWith("OQ") ||
    livery.includes("chongqing")
  ) {
    return {
      logo: "/airlines/chongqing.webp",
      logoDark: "/airlines/chongqing.webp",
      name: "Chongqing Airlines",
    };
  }
  if (
    code.startsWith("HBH") ||
    code.startsWith("NS") ||
    livery.includes("hebei")
  ) {
    return {
      logo: "/airlines/hebei.webp",
      logoDark: "/airlines/hebei.webp",
      name: "Hebei Airlines",
    };
  }
  if (
    code.startsWith("CJX") ||
    code.startsWith("RY") ||
    livery.includes("jiangxi")
  ) {
    return {
      logo: "/airlines/jiangxi.webp",
      logoDark: "/airlines/jiangxi.webp",
      name: "Jiangxi Air",
    };
  }
  return {
    logo: "/airlines/china-southern.svg",
    logoDark: "/airlines/china-southern-white.svg",
    name: "China Southern Airlines",
  };
}
