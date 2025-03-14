import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    domains: [
      "global.discourse-cdn.com",
      "sea1.discourse-cdn.com",
      "upload.wikimedia.org",
      "dubaiva.weebly.com",
      "aireuropavirtual.digitalweb.app",
      "static.wixstatic.com",
    ],
  },
};

export default nextConfig;
