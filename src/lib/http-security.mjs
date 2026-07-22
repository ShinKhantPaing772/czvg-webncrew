const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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
  ].join(" "),
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src https://www.google.com https://docs.google.com https://map.ifczvg.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
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
