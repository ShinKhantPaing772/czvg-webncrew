const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    "https://global.discourse-cdn.com",
    "https://sea1.discourse-cdn.com",
    "https://upload.wikimedia.org",
    "https://dubaiva.weebly.com",
    "https://aireuropavirtual.digitalweb.app",
    "https://static.wixstatic.com",
    "https:",
    ...(isDev ? ["http:"] : []),
  ].join(" "),
  "font-src 'self' data:",
  isDev ? "connect-src 'self' ws: wss: http: https:" : "connect-src 'self'",
  isDev
    ? "frame-src 'self' http://localhost:5173 https://www.google.com https://docs.google.com https://map.ifczvg.com"
    : "frame-src https://www.google.com https://docs.google.com https://map.ifczvg.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

export const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: contentSecurityPolicy,
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
];
