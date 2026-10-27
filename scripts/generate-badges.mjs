import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const badgesDir = path.join(__dirname, "../public/badges");

if (!fs.existsSync(badgesDir)) {
  fs.mkdirSync(badgesDir, { recursive: true });
}

// Helper to generate themed SVG badges
function createBadgeSvg({
  id,
  type = "shield", // 'shield', 'roundel', 'star', 'wings', 'diamond'
  primaryColor = "#002776",
  accentColor = "#F59E0B",
  metalColor = "#D97706",
  iconPath = "",
  subText = "",
  tierStars = 0,
}) {
  const starsSvg = Array.from({ length: tierStars })
    .map((_, i) => {
      const offset = (i - (tierStars - 1) / 2) * 11;
      return `<polygon points="${48 + offset},76 ${50 + offset},80.5 ${54.5 + offset},80.5 ${51 + offset},83.5 ${52.5 + offset},88 ${48 + offset},85 ${43.5 + offset},88 ${45 + offset},83.5 ${41.5 + offset},80.5 ${46 + offset},80.5" fill="${accentColor}" stroke="#1E293B" stroke-width="0.5"/>`;
    })
    .join("\n");

  const subTextSvg = subText
    ? `<text x="48" y="70" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="7" font-weight="900" fill="${accentColor}" letter-spacing="0.4">${subText}</text>`
    : "";

  let baseShape = "";
  if (type === "shield") {
    baseShape = `
      <!-- Shield Outer Frame -->
      <path d="M 48 10 C 68 10, 84 14, 84 32 C 84 62, 54 84, 48 88 C 42 84, 12 62, 12 32 C 12 14, 28 10, 48 10 Z" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="2" filter="url(#dropShadow)" />
      <!-- Shield Inner Core -->
      <path d="M 48 14 C 65 14, 79 18, 79 34 C 79 59, 53 79, 48 83 C 43 79, 17 59, 17 34 C 17 18, 31 14, 48 14 Z" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.2" opacity="0.95" />
    `;
  } else if (type === "roundel") {
    baseShape = `
      <!-- Outer Roundel Ring -->
      <circle cx="48" cy="48" r="40" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="2" filter="url(#dropShadow)" />
      <!-- Cog / Notches or Laurel Ring -->
      <circle cx="48" cy="48" r="35" fill="none" stroke="${accentColor}" stroke-width="1" stroke-dasharray="3,2" />
      <!-- Inner Core -->
      <circle cx="48" cy="48" r="32" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.5" />
    `;
  } else if (type === "wings") {
    baseShape = `
      <!-- Aviation Wings Base -->
      <g filter="url(#dropShadow)">
        <!-- Left Wing -->
        <path d="M 48 48 C 36 32, 16 34, 4 40 C 14 50, 32 54, 48 54 Z" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" />
        <path d="M 44 46 C 34 37, 20 38, 10 43 C 18 49, 32 51, 44 51 Z" fill="${accentColor}" opacity="0.3" />
        <!-- Right Wing -->
        <path d="M 48 48 C 60 32, 80 34, 92 40 C 82 50, 64 54, 48 54 Z" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" />
        <path d="M 52 46 C 62 37, 76 38, 86 43 C 78 49, 64 51, 52 51 Z" fill="${accentColor}" opacity="0.3" />
      </g>
      <!-- Center Emblem Roundel -->
      <circle cx="48" cy="48" r="22" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" filter="url(#dropShadow)" />
      <circle cx="48" cy="48" r="18" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1" />
    `;
  } else if (type === "diamond") {
    baseShape = `
      <!-- Diamond Star Polygon -->
      <polygon points="48,6 60,34 90,48 60,62 48,90 36,62 6,48 36,34" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" filter="url(#dropShadow)" />
      <polygon points="48,14 57,36 80,48 57,60 48,82 39,60 16,48 39,36" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1" />
    `;
  } else {
    // Star Medallion
    baseShape = `
      <polygon points="48,8 57,28 78,18 73,39 94,48 73,57 78,78 57,68 48,88 39,68 18,78 23,57 2,48 23,39 18,18 39,28" fill="url(#metalGrad)" stroke="${metalColor}" stroke-width="1.5" filter="url(#dropShadow)"/>
      <circle cx="48" cy="48" r="24" fill="url(#coreGrad)" stroke="${accentColor}" stroke-width="1.5" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <defs>
    <filter id="dropShadow" x="-10%" y="-10%" width="125%" height="125%">
      <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.5" />
    </filter>
    <linearGradient id="metalGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.8" />
      <stop offset="25%" stop-color="${accentColor}" />
      <stop offset="70%" stop-color="${metalColor}" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="50%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="glyphGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FFFFFF" />
      <stop offset="60%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="${metalColor}" />
    </linearGradient>
  </defs>

  ${baseShape}

  <!-- Icon Glyph -->
  <g transform="translate(0, 0)">
    ${iconPath}
  </g>

  ${subTextSvg}
  ${starsSvg}
</svg>`;
}

// Glyph definitions
const GLYPHS = {
  // Airplane ascending
  planeUp: `
    <path d="M 48 28 L 52 38 L 66 43 L 66 46 L 52 46 L 52 54 L 56 57 L 56 60 L 48 58 L 40 60 L 40 57 L 44 54 L 44 46 L 30 46 L 30 43 L 44 38 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
  `,
  // Wings with star
  wingsStar: `
    <path d="M 48 30 L 51 37 L 59 37 L 53 42 L 55 50 L 48 45 L 41 50 L 43 42 L 37 37 L 45 37 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
    <path d="M 48 44 C 40 40, 32 44, 25 48 C 31 52, 40 50, 48 48 Z" fill="url(#glyphGrad)" />
    <path d="M 48 44 C 56 40, 64 44, 71 48 C 65 52, 56 50, 48 48 Z" fill="url(#glyphGrad)" />
  `,
  // Compass rose / Star
  compass: `
    <polygon points="48,26 52,44 68,48 52,52 48,70 44,52 28,48 44,44" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
    <circle cx="48" cy="48" r="3" fill="#FFFFFF" />
  `,
  // Globe with route
  globe: `
    <circle cx="48" cy="46" r="14" fill="none" stroke="url(#glyphGrad)" stroke-width="1.5" />
    <ellipse cx="48" cy="46" rx="6" ry="14" fill="none" stroke="url(#glyphGrad)" stroke-width="1" />
    <line x1="34" y1="46" x2="62" y2="46" stroke="url(#glyphGrad)" stroke-width="1" />
    <path d="M 32 54 Q 48 34 64 40" fill="none" stroke="#E60012" stroke-width="1.8" stroke-dasharray="2,1" />
    <polygon points="65,39 61,37 62,42" fill="#E60012" />
  `,
  // High Plateau Mountains (for Tibet / Daocheng / high altitude airports)
  mountains: `
    <polygon points="34,56 48,34 62,56" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
    <polygon points="48,34 52,40 44,40" fill="#FFFFFF" />
    <polygon points="22,58 34,42 46,58" fill="url(#glyphGrad)" opacity="0.8" />
    <polygon points="50,58 62,44 74,58" fill="url(#glyphGrad)" opacity="0.8" />
    <path d="M 32 30 L 40 32 L 48 28 L 56 32 L 64 30" fill="none" stroke="#E60012" stroke-width="1.5" />
  `,
  // Modern widebody (Twin engine jet)
  widebodyJet: `
    <path d="M 48 24 C 50 24, 51 28, 51 40 L 68 50 L 68 53 L 51 51 L 51 60 L 56 64 L 56 67 L 48 65 L 40 67 L 40 64 L 45 60 L 45 51 L 28 53 L 28 50 L 45 40 C 45 28, 46 24, 48 24 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
    <!-- Engines -->
    <rect x="36" y="47" width="2.5" height="5" rx="1.2" fill="#FFFFFF" stroke="#0F172A" stroke-width="0.5" />
    <rect x="57.5" y="47" width="2.5" height="5" rx="1.2" fill="#FFFFFF" stroke="#0F172A" stroke-width="0.5" />
  `,
  // A380 / B747 Superjumbo (4 engines)
  superjumbo: `
    <path d="M 48 23 C 51 23, 52 28, 52 42 L 72 52 L 72 55 L 52 52 L 52 61 L 58 65 L 58 68 L 48 66 L 38 68 L 38 65 L 44 61 L 44 52 L 24 55 L 24 52 L 44 42 C 44 28, 45 23, 48 23 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="0.75" />
    <!-- 4 Engines -->
    <rect x="32" y="49" width="2" height="4.5" rx="1" fill="#FFFFFF" />
    <rect x="37" y="48" width="2" height="4.5" rx="1" fill="#FFFFFF" />
    <rect x="57" y="48" width="2" height="4.5" rx="1" fill="#FFFFFF" />
    <rect x="62" y="49" width="2" height="4.5" rx="1" fill="#FFFFFF" />
  `,
  // Cargo Box + Heavy Wing
  cargo: `
    <rect x="38" y="38" width="20" height="18" rx="2" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
    <line x1="38" y1="47" x2="58" y2="47" stroke="#0F172A" stroke-width="1" />
    <line x1="48" y1="38" x2="48" y2="56" stroke="#0F172A" stroke-width="1" />
    <path d="M 30 35 L 42 27 L 54 27 L 66 35 Z" fill="#E60012" opacity="0.9" />
  `,
  // Tower / Airport Radar
  radar: `
    <path d="M 44 60 L 46 40 L 43 40 L 43 36 L 53 36 L 53 40 L 50 40 L 52 60 Z" fill="url(#glyphGrad)" />
    <circle cx="48" cy="32" r="6" fill="url(#glyphGrad)" />
    <path d="M 38 28 A 14 14 0 0 1 58 28" fill="none" stroke="#0EA5E9" stroke-width="1.5" />
    <path d="M 34 24 A 20 20 0 0 1 62 24" fill="none" stroke="#0EA5E9" stroke-width="1.5" stroke-dasharray="2,2" />
  `,
  // Night Moon + Cloud + Plane
  moonNight: `
    <path d="M 54 26 A 12 12 0 1 1 40 44 A 15 15 0 0 0 54 26 Z" fill="#F59E0B" />
    <path d="M 32 50 C 32 46, 36 43, 40 44 C 42 40, 48 40, 50 43 C 54 42, 58 45, 57 49 C 60 50, 61 54, 58 57 L 34 57 C 32 57, 30 55, 32 50 Z" fill="#E2E8F0" opacity="0.8" />
    <polygon points="56,36 62,38 58,40" fill="#E60012" />
  `,
  // Clock / Duration
  clock: `
    <circle cx="48" cy="46" r="15" fill="none" stroke="url(#glyphGrad)" stroke-width="2" />
    <polyline points="48,36 48,46 54,46" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
    <polygon points="48,26 51,30 45,30" fill="url(#glyphGrad)" />
  `,
  // Laurel Crown / Royal
  laurelCrown: `
    <path d="M 48 30 L 53 40 L 63 36 L 58 46 L 68 50 L 56 54 L 54 64 L 48 57 L 42 64 L 40 54 L 28 50 L 38 46 L 33 36 L 43 40 Z" fill="url(#glyphGrad)" stroke="#E60012" stroke-width="0.8" />
    <circle cx="48" cy="47" r="4" fill="#E60012" />
  `,
  // Shield with checkmark (Clean PIREPs)
  shieldCheck: `
    <path d="M 48 28 C 58 28, 64 30, 64 38 C 64 54, 52 64, 48 66 C 44 64, 32 54, 32 38 C 32 30, 38 28, 48 28 Z" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
    <polyline points="40,46 45,51 56,39" fill="none" stroke="#002776" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
  `,
  // Calendar / Veteran
  calendarVeteran: `
    <rect x="34" y="32" width="28" height="26" rx="3" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
    <rect x="34" y="32" width="28" height="8" rx="2" fill="#E60012" />
    <line x1="41" y1="28" x2="41" y2="34" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
    <line x1="55" y1="28" x2="55" y2="34" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" />
    <circle cx="48" cy="48" r="4" fill="#002776" />
  `,
  // Diamond Gem / Ultra Master
  diamondGem: `
    <polygon points="48,26 64,36 58,58 38,58 32,36" fill="url(#glyphGrad)" stroke="#0F172A" stroke-width="1" />
    <polyline points="32,36 48,40 64,36" fill="none" stroke="#FFFFFF" stroke-width="1" />
    <line x1="48" y1="40" x2="48" y2="58" stroke="#FFFFFF" stroke-width="1" />
  `,
};

// 81 Badges Full Master Config
const BADGES = [
  // ================= 1. MILESTONES: FLIGHTS (13) =================
  { id: "badge-first-flight", type: "wings", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "1ST", tierStars: 1 },
  { id: "badge-flights-5", type: "roundel", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.planeUp, subText: "5 FLTS", tierStars: 0 },
  { id: "badge-flights-10", type: "roundel", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0369A1", iconPath: GLYPHS.planeUp, subText: "10 FLTS", tierStars: 1 },
  { id: "badge-flights-25", type: "roundel", primaryColor: "#002776", accentColor: "#10B981", metalColor: "#047857", iconPath: GLYPHS.planeUp, subText: "25 FLTS", tierStars: 2 },
  { id: "badge-flights-50", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.wingsStar, subText: "50 FLTS", tierStars: 3 },
  { id: "badge-flights-75", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.wingsStar, subText: "75 FLTS", tierStars: 3 },
  { id: "badge-flights-100", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.wingsStar, subText: "100 FLTS", tierStars: 4 },
  { id: "badge-flights-150", type: "shield", primaryColor: "#0F172A", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.compass, subText: "150 FLTS", tierStars: 4 },
  { id: "badge-flights-200", type: "shield", primaryColor: "#0F172A", accentColor: "#EC4899", metalColor: "#BE185D", iconPath: GLYPHS.laurelCrown, subText: "200 FLTS", tierStars: 5 },
  { id: "badge-flights-300", type: "shield", primaryColor: "#0F172A", accentColor: "#8B5CF6", metalColor: "#6D28D9", iconPath: GLYPHS.laurelCrown, subText: "300 FLTS", tierStars: 5 },
  { id: "badge-flights-500", type: "star", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.diamondGem, subText: "500 FLTS", tierStars: 5 },
  { id: "badge-flights-750", type: "star", primaryColor: "#0F172A", accentColor: "#E60012", metalColor: "#990000", iconPath: GLYPHS.diamondGem, subText: "750 FLTS", tierStars: 5 },
  { id: "badge-flights-1000", type: "diamond", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.laurelCrown, subText: "1000 FLTS", tierStars: 5 },
  { id: "badge-flights-1500", type: "diamond", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.laurelCrown, subText: "1500 FLTS", tierStars: 5 },

  // ================= 2. MILESTONES: HOURS (15) =================
  { id: "badge-hours-5", type: "roundel", primaryColor: "#002776", accentColor: "#CD7F32", metalColor: "#8C481A", iconPath: GLYPHS.clock, subText: "5H", tierStars: 0 },
  { id: "badge-hours-10", type: "roundel", primaryColor: "#002776", accentColor: "#CD7F32", metalColor: "#8C481A", iconPath: GLYPHS.clock, subText: "10H", tierStars: 1 },
  { id: "badge-hours-25", type: "roundel", primaryColor: "#002776", accentColor: "#94A3B8", metalColor: "#64748B", iconPath: GLYPHS.clock, subText: "25H", tierStars: 1 },
  { id: "badge-hours-50", type: "roundel", primaryColor: "#002776", accentColor: "#CBD5E1", metalColor: "#475569", iconPath: GLYPHS.clock, subText: "50H", tierStars: 2 },
  { id: "badge-hours-100", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "100H", tierStars: 3 },
  { id: "badge-hours-150", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.planeUp, subText: "150H", tierStars: 3 },
  { id: "badge-hours-200", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.compass, subText: "200H", tierStars: 3 },
  { id: "badge-hours-350", type: "shield", primaryColor: "#0F172A", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.compass, subText: "350H", tierStars: 4 },
  { id: "badge-hours-500", type: "shield", primaryColor: "#0F172A", accentColor: "#F43F5E", metalColor: "#BE123C", iconPath: GLYPHS.wingsStar, subText: "500H", tierStars: 5 },
  { id: "badge-hours-750", type: "star", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.laurelCrown, subText: "750H", tierStars: 5 },
  { id: "badge-hours-1000", type: "star", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.laurelCrown, subText: "1000H", tierStars: 5 },
  { id: "badge-hours-1500", type: "star", primaryColor: "#002776", accentColor: "#E60012", metalColor: "#990000", iconPath: GLYPHS.diamondGem, subText: "1500H", tierStars: 5 },
  { id: "badge-hours-2000", type: "diamond", primaryColor: "#0F172A", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.diamondGem, subText: "2000H", tierStars: 5 },
  { id: "badge-hours-3000", type: "diamond", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.laurelCrown, subText: "3000H", tierStars: 5 },
  { id: "badge-hours-5000", type: "diamond", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#E60012", iconPath: GLYPHS.diamondGem, subText: "5000H", tierStars: 5 },

  // ================= 3. HUBS & ROUTES (22) =================
  { id: "badge-hub-zggg", type: "roundel", primaryColor: "#002776", accentColor: "#E60012", metalColor: "#990000", iconPath: GLYPHS.radar, subText: "ZGGG 5", tierStars: 1 },
  { id: "badge-hub-zggg-master", type: "shield", primaryColor: "#002776", accentColor: "#E60012", metalColor: "#D97706", iconPath: GLYPHS.radar, subText: "ZGGG 20", tierStars: 3 },
  { id: "badge-hub-zggg-50", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.laurelCrown, subText: "ZGGG 50", tierStars: 4 },
  { id: "badge-hub-zggg-100", type: "star", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#E60012", iconPath: GLYPHS.diamondGem, subText: "ZGGG 100", tierStars: 5 },
  { id: "badge-hub-zbad", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.radar, subText: "ZBAD 5", tierStars: 1 },
  { id: "badge-hub-zbad-master", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.radar, subText: "ZBAD 20", tierStars: 3 },
  { id: "badge-hub-zbad-50", type: "star", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.laurelCrown, subText: "ZBAD 50", tierStars: 4 },
  { id: "badge-hub-zgsz", type: "roundel", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0369A1", iconPath: GLYPHS.planeUp, subText: "ZGSZ 5", tierStars: 1 },
  { id: "badge-hub-zgsz-20", type: "shield", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.planeUp, subText: "ZGSZ 20", tierStars: 3 },
  { id: "badge-hub-zwww", type: "roundel", primaryColor: "#002776", accentColor: "#14B8A6", metalColor: "#0F766E", iconPath: GLYPHS.compass, subText: "ZWWW 5", tierStars: 1 },
  { id: "badge-hub-zwww-20", type: "shield", primaryColor: "#002776", accentColor: "#14B8A6", metalColor: "#0F766E", iconPath: GLYPHS.compass, subText: "ZWWW 20", tierStars: 3 },
  { id: "badge-hub-zuck", type: "roundel", primaryColor: "#002776", accentColor: "#8B5CF6", metalColor: "#6D28D9", iconPath: GLYPHS.planeUp, subText: "ZUCK 5", tierStars: 1 },
  { id: "badge-hub-zuck-20", type: "shield", primaryColor: "#002776", accentColor: "#8B5CF6", metalColor: "#6D28D9", iconPath: GLYPHS.planeUp, subText: "ZUCK 20", tierStars: 3 },
  { id: "badge-route-jingguang", type: "wings", primaryColor: "#002776", accentColor: "#E60012", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "CAN-PKX 5", tierStars: 2 },
  { id: "badge-route-jingguang-20", type: "wings", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "CAN-PKX 20", tierStars: 4 },
  // High Plateau Extreme Challenges
  { id: "badge-hub-zuls", type: "shield", primaryColor: "#0F172A", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.mountains, subText: "ZULS 3", tierStars: 4 },
  { id: "badge-hub-zlxn", type: "shield", primaryColor: "#0F172A", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.mountains, subText: "ZLXN 3", tierStars: 3 },
  { id: "badge-hub-zwsh", type: "shield", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.mountains, subText: "ZWSH 3", tierStars: 3 },
  // Regional Metropolises
  { id: "badge-hub-shanghai", type: "roundel", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.radar, subText: "SHA/PVG 10", tierStars: 2 },
  { id: "badge-hub-chengdu", type: "roundel", primaryColor: "#002776", accentColor: "#10B981", metalColor: "#047857", iconPath: GLYPHS.planeUp, subText: "CTU/TFU 10", tierStars: 2 },
  { id: "badge-hub-hainan", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.compass, subText: "HAK/SYX 10", tierStars: 2 },
  { id: "badge-hub-vhhh", type: "shield", primaryColor: "#002776", accentColor: "#E60012", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "VHHH 5", tierStars: 3 },

  // ================= 4. FLEET MASTERY (16) =================
  { id: "badge-fleet-a350", type: "shield", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.widebodyJet, subText: "A350 3", tierStars: 2 },
  { id: "badge-fleet-a350-15", type: "star", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.widebodyJet, subText: "A350 15", tierStars: 4 },
  { id: "badge-fleet-b77w", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.widebodyJet, subText: "B77W 3", tierStars: 2 },
  { id: "badge-fleet-b77w-15", type: "star", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.widebodyJet, subText: "B77W 15", tierStars: 4 },
  { id: "badge-fleet-b787", type: "shield", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0369A1", iconPath: GLYPHS.widebodyJet, subText: "B787 3", tierStars: 2 },
  { id: "badge-fleet-b787-15", type: "star", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0369A1", iconPath: GLYPHS.widebodyJet, subText: "B787 15", tierStars: 4 },
  { id: "badge-fleet-a330", type: "shield", primaryColor: "#002776", accentColor: "#CBD5E1", metalColor: "#64748B", iconPath: GLYPHS.widebodyJet, subText: "A330 3", tierStars: 2 },
  { id: "badge-fleet-a330-15", type: "star", primaryColor: "#002776", accentColor: "#CBD5E1", metalColor: "#64748B", iconPath: GLYPHS.widebodyJet, subText: "A330 15", tierStars: 4 },
  { id: "badge-fleet-a320", type: "roundel", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.planeUp, subText: "A320 5", tierStars: 1 },
  { id: "badge-fleet-a320-25", type: "shield", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.planeUp, subText: "A320 25", tierStars: 3 },
  { id: "badge-fleet-b737", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "B737 5", tierStars: 1 },
  { id: "badge-fleet-b737-25", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "B737 25", tierStars: 3 },
  { id: "badge-fleet-cargo", type: "roundel", primaryColor: "#002776", accentColor: "#F97316", metalColor: "#C2410C", iconPath: GLYPHS.cargo, subText: "CARGO 3", tierStars: 2 },
  { id: "badge-fleet-cargo-15", type: "shield", primaryColor: "#002776", accentColor: "#F97316", metalColor: "#C2410C", iconPath: GLYPHS.cargo, subText: "CARGO 15", tierStars: 4 },
  { id: "badge-fleet-a380", type: "star", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.superjumbo, subText: "A380 1", tierStars: 4 },
  { id: "badge-fleet-a380-5", type: "diamond", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.superjumbo, subText: "A380 5", tierStars: 5 },
  { id: "badge-fleet-b747", type: "shield", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.superjumbo, subText: "B747F 3", tierStars: 3 },
  { id: "badge-fleet-b757", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.planeUp, subText: "B757 3", tierStars: 2 },
  { id: "badge-fleet-e190", type: "shield", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.planeUp, subText: "E190 3", tierStars: 2 },
  { id: "badge-fleet-xiamen", type: "roundel", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.wingsStar, subText: "CXA 3", tierStars: 2 },

  // ================= 5. CHALLENGES (10) =================
  { id: "badge-challenge-longhaul", type: "shield", primaryColor: "#0F172A", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.globe, subText: "10H+", tierStars: 3 },
  { id: "badge-challenge-ultrahaul", type: "diamond", primaryColor: "#0F172A", accentColor: "#F43F5E", metalColor: "#BE123C", iconPath: GLYPHS.globe, subText: "14H+ ULTRA", tierStars: 5 },
  { id: "badge-challenge-europe", type: "shield", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.globe, subText: "EUROPE 5", tierStars: 3 },
  { id: "badge-challenge-northamerica", type: "shield", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.globe, subText: "N.AMERICA 5", tierStars: 3 },
  { id: "badge-challenge-oceania", type: "shield", primaryColor: "#002776", accentColor: "#10B981", metalColor: "#047857", iconPath: GLYPHS.globe, subText: "OCEANIA 5", tierStars: 3 },
  { id: "badge-challenge-mideast", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#B45309", iconPath: GLYPHS.compass, subText: "MIDEAST 3", tierStars: 2 },
  { id: "badge-challenge-night", type: "roundel", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#475569", iconPath: GLYPHS.moonNight, subText: "NIGHT 3", tierStars: 2 },
  { id: "badge-challenge-night-10", type: "shield", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#64748B", iconPath: GLYPHS.moonNight, subText: "NIGHT 10", tierStars: 4 },
  { id: "badge-challenge-clean-20", type: "shield", primaryColor: "#002776", accentColor: "#10B981", metalColor: "#047857", iconPath: GLYPHS.shieldCheck, subText: "20 CLEAN", tierStars: 3 },
  { id: "badge-challenge-clean-50", type: "star", primaryColor: "#002776", accentColor: "#10B981", metalColor: "#047857", iconPath: GLYPHS.shieldCheck, subText: "50 CLEAN", tierStars: 5 },

  // ================= 6. HONORS (5) =================
  { id: "badge-honor-live", type: "wings", primaryColor: "#002776", accentColor: "#0EA5E9", metalColor: "#0284C7", iconPath: GLYPHS.planeUp, subText: "DISPATCH", tierStars: 3 },
  { id: "badge-honor-ceo", type: "star", primaryColor: "#002776", accentColor: "#E60012", metalColor: "#D97706", iconPath: GLYPHS.laurelCrown, subText: "CEO", tierStars: 5 },
  { id: "badge-honor-year-1", type: "roundel", primaryColor: "#002776", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.calendarVeteran, subText: "1 YEAR", tierStars: 2 },
  { id: "badge-honor-year-2", type: "shield", primaryColor: "#002776", accentColor: "#38BDF8", metalColor: "#0284C7", iconPath: GLYPHS.calendarVeteran, subText: "2 YEARS", tierStars: 4 },
  { id: "badge-honor-inspector", type: "wings", primaryColor: "#0F172A", accentColor: "#F59E0B", metalColor: "#D97706", iconPath: GLYPHS.laurelCrown, subText: "INSPECTOR", tierStars: 5 },
];

console.log(`Generating ${BADGES.length} badge SVGs...`);
for (const badge of BADGES) {
  const filePath = path.join(badgesDir, `${badge.id}.svg`);
  const svg = createBadgeSvg(badge);
  fs.writeFileSync(filePath, svg, "utf-8");
}
console.log(`Successfully generated ${BADGES.length} badge SVGs in public/badges/!`);
