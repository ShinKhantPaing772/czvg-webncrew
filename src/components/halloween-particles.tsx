"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

/**
 * High-end Ambient Atmosphere (Zero-dependency, 100% SSR-Safe):
 * 1. Dual Gaussian-blurred Ambient Aurora:
 *    - Top-left Ghost Purple radial glow
 *    - Top-right Pumpkin Orange radial glow
 * 2. Hardware-accelerated CSS Floating Embers & Fireflies:
 *    - Warm Pumpkin Amber & Ethereal Ghost Purple breathing fireflies
 *    - Silky smooth 60fps GPU transforms with zero canvas/SSR module crashes
 *    - Strictly pointer-events-none, fixed inset-0, z-index: 0
 */

interface FireflyConfig {
  id: number;
  left: string;
  delay: string;
  duration: string;
  size: number;
  color: string;
  glowColor: string;
}

const FIREFLIES: FireflyConfig[] = [
  { id: 1, left: "8%", delay: "0s", duration: "8.5s", size: 5, color: "#F59E0B", glowColor: "rgba(245, 158, 11, 0.85)" },
  { id: 2, left: "18%", delay: "3s", duration: "10.5s", size: 4, color: "#A855F7", glowColor: "rgba(168, 85, 247, 0.8)" },
  { id: 3, left: "28%", delay: "1.2s", duration: "9.2s", size: 6, color: "#F97316", glowColor: "rgba(249, 115, 22, 0.85)" },
  { id: 4, left: "38%", delay: "5s", duration: "11s", size: 3.5, color: "#EA580C", glowColor: "rgba(234, 88, 12, 0.8)" },
  { id: 5, left: "48%", delay: "0.8s", duration: "8s", size: 5.5, color: "#F59E0B", glowColor: "rgba(245, 158, 11, 0.85)" },
  { id: 6, left: "58%", delay: "3.5s", duration: "10s", size: 4.5, color: "#C084FC", glowColor: "rgba(192, 132, 252, 0.8)" },
  { id: 7, left: "68%", delay: "2s", duration: "9.5s", size: 5, color: "#F97316", glowColor: "rgba(249, 115, 22, 0.85)" },
  { id: 8, left: "78%", delay: "4.2s", duration: "11.5s", size: 4, color: "#9333EA", glowColor: "rgba(147, 51, 234, 0.8)" },
  { id: 9, left: "88%", delay: "1.5s", duration: "8.8s", size: 5, color: "#F59E0B", glowColor: "rgba(245, 158, 11, 0.85)" },
  { id: 10, left: "94%", delay: "5.5s", duration: "10.2s", size: 3.5, color: "#FB923C", glowColor: "rgba(251, 146, 60, 0.8)" },
  { id: 11, left: "14%", delay: "6s", duration: "9.8s", size: 4.5, color: "#A855F7", glowColor: "rgba(168, 85, 247, 0.8)" },
  { id: 12, left: "52%", delay: "2.8s", duration: "8.2s", size: 6, color: "#F97316", glowColor: "rgba(249, 115, 22, 0.85)" },
  { id: 13, left: "84%", delay: "4.8s", duration: "9s", size: 4, color: "#EAB308", glowColor: "rgba(234, 179, 8, 0.85)" },
];

export function HalloweenParticles() {
  const { isHalloween } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isHalloween) return null;

  return (
    <>
      {/* ── Global Background Ambient Aurora ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      >
        {/* Top-left Ghost Purple Aurora */}
        <div
          className="absolute -top-32 -left-32 h-[560px] w-[560px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(147, 51, 234, 0.12) 0%, transparent 70%)",
            filter: "blur(120px)",
          }}
        />
        {/* Top-right Pumpkin Orange Aurora */}
        <div
          className="absolute -top-32 -right-32 h-[560px] w-[560px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(249, 115, 22, 0.10) 0%, transparent 70%)",
            filter: "blur(120px)",
          }}
        />
      </div>

      {/* ── Glowing Floating Halloween Embers / Fireflies ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none [contain:strict]"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes ember-float-sway {
            0% {
              transform: translate3d(0, 105vh, 0);
              opacity: 0;
            }
            15% {
              opacity: 0.95;
            }
            45% {
              transform: translate3d(16px, 55vh, 0);
              opacity: 0.65;
            }
            75% {
              transform: translate3d(-14px, 25vh, 0);
              opacity: 0.9;
            }
            100% {
              transform: translate3d(8px, -5vh, 0);
              opacity: 0;
            }
          }
        `}} />
        {FIREFLIES.map((f) => (
          <span
            key={f.id}
            className="absolute rounded-full"
            style={{
              left: f.left,
              bottom: 0,
              width: f.size,
              height: f.size,
              backgroundColor: f.color,
              boxShadow: `0 0 10px ${f.glowColor}, 0 0 18px ${f.glowColor}`,
              animation: `ember-float-sway ${f.duration} infinite ease-in-out`,
              animationDelay: f.delay,
              willChange: "transform, opacity",
            }}
          />
        ))}
      </div>
    </>
  );
}
