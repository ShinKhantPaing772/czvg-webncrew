/** @type {import('next').NextConfig} */
import MiniCssExtractPlugin from "mini-css-extract-plugin";

const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.plugins.push(new MiniCssExtractPlugin());
    }
    return config;
  },
  images: {
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "global.discourse-cdn.com",
      },
      {
        protocol: "https",
        hostname: "sea1.discourse-cdn.com",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "dubaiva.weebly.com",
      },
      {
        protocol: "https",
        hostname: "aireuropavirtual.digitalweb.app",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
    ],
  },
};

export default nextConfig;
