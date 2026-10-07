export type GroupAirline = {
  name: string;
  description: string;
  logo: string;
  regionalAirlines?: readonly string[];
  type?: "cargo";
};

export const groupAirlines: readonly GroupAirline[] = [
  {
    name: "China Southern Airlines",
    description:
      "The group’s flagship carrier, operating an extensive domestic and international network from major hubs across China.",
    logo: "/airlines/china-southern.svg",
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
  },
  {
    name: "China Southern Cargo",
    description:
      "The group’s dedicated air-freight carrier, operating cargo services within China and internationally.",
    logo: "/airlines/china-southern.svg",
    type: "cargo",
  },
  {
    name: "China Southern General Aviation",
    description: "Representing the group’s general aviation operations.",
    logo: "/airlines/china-southern.svg",
  },
  {
    name: "Chongqing Airlines",
    description:
      "Based in Chongqing, connecting Southwest China with destinations across the country.",
    logo: "/airlines/chongqing.webp",
  },
  {
    name: "Hebei Airlines",
    description:
      "Based in Shijiazhuang, connecting Hebei Province with destinations throughout China.",
    logo: "/airlines/hebei.webp",
  },
  {
    name: "Jiangxi Air",
    description:
      "Based in Nanchang, connecting Jiangxi Province with major cities across China.",
    logo: "/airlines/jiangxi.webp",
  },
];
