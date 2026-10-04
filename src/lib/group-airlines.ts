export type GroupAirline = {
  name: string;
  description: string;
  logo: string;
  type?: "cargo";
};

export const groupAirlines: readonly GroupAirline[] = [
  {
    name: "China Southern Airlines",
    description:
      "The group’s flagship carrier, operating an extensive domestic and international network from major hubs across China.",
    logo: "/airlines/china-southern.svg",
  },
  {
    name: "XiamenAir",
    description:
      "Based in Xiamen, operating an extensive domestic network alongside services across Asia and international destinations.",
    logo: "/airlines/xiamenair.svg",
  },
  {
    name: "Chongqing Airlines",
    description:
      "Based in Chongqing, connecting Southwest China with destinations across the country.",
    logo: "/airlines/chongqing.webp",
  },
  {
    name: "China Southern Henan Airlines",
    description:
      "Serving Henan Province and connecting Zhengzhou with major destinations throughout China.",
    logo: "/airlines/china-southern.svg",
  },
  {
    name: "Guizhou Airlines",
    description:
      "Serving Guizhou Province and supporting China Southern’s network across Southwest China.",
    logo: "/airlines/china-southern.svg",
  },
  {
    name: "Zhuhai Airlines",
    description:
      "Based in Zhuhai, supporting China Southern services in the Pearl River Delta and beyond.",
    logo: "/airlines/china-southern.svg",
  },
  {
    name: "Shantou Airlines",
    description:
      "Serving the Chaoshan region of Guangdong as part of the China Southern network.",
    logo: "/airlines/china-southern.svg",
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
  {
    name: "China Southern Cargo",
    description:
      "The group’s dedicated air-freight carrier, operating cargo services within China and internationally.",
    logo: "/airlines/china-southern.svg",
    type: "cargo",
  },
];
