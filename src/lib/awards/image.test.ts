import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_BADGE_CDN_BASE,
  displayBadgeImageUrl,
  resolveBadgeImageUrl,
} from "./image";

describe("awards image CDN resolver", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_BADGES_CDN_URL;
    delete process.env.BADGES_CDN_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("resolves relative path to default jsDelivr CDN URL", () => {
    const url = resolveBadgeImageUrl("/badges/badge-first-flight.svg");
    expect(url).toBe(
      `${DEFAULT_BADGE_CDN_BASE}/badge-first-flight.svg`,
    );
  });

  it("resolves pure filename to default jsDelivr CDN URL", () => {
    const url = resolveBadgeImageUrl("badge-flights-5.svg");
    expect(url).toBe(
      `${DEFAULT_BADGE_CDN_BASE}/badge-flights-5.svg`,
    );
  });

  it("handles public/badges/ prefix cleanly", () => {
    const url = resolveBadgeImageUrl("public/badges/badge-hub-zggg.svg");
    expect(url).toBe(
      `${DEFAULT_BADGE_CDN_BASE}/badge-hub-zggg.svg`,
    );
  });

  it("leaves already-absolute HTTPS and HTTP URLs untouched", () => {
    const externalHttps = "https://images.example.com/awards/custom.png";
    expect(resolveBadgeImageUrl(externalHttps)).toBe(externalHttps);

    const externalHttp = "http://example.com/badge.svg";
    expect(resolveBadgeImageUrl(externalHttp)).toBe(externalHttp);
  });

  it("respects custom NEXT_PUBLIC_BADGES_CDN_URL environment variable", () => {
    process.env.NEXT_PUBLIC_BADGES_CDN_URL = "https://cdn.my-va.org/badges/";
    const url = resolveBadgeImageUrl("/badges/badge-a350.svg");
    expect(url).toBe("https://cdn.my-va.org/badges/badge-a350.svg");
  });

  it("supports 'local' override to keep relative /badges paths for offline use", () => {
    process.env.NEXT_PUBLIC_BADGES_CDN_URL = "local";
    const url = resolveBadgeImageUrl("badge-b777.svg");
    expect(url).toBe("/badges/badge-b777.svg");
  });

  it("returns empty string for null, undefined, or empty inputs", () => {
    expect(resolveBadgeImageUrl(null)).toBe("");
    expect(resolveBadgeImageUrl(undefined)).toBe("");
    expect(resolveBadgeImageUrl("")).toBe("");
    expect(resolveBadgeImageUrl("   ")).toBe("");
  });

  describe("displayBadgeImageUrl", () => {
    it("returns fully qualified HTTPS CDN URL for valid filename", () => {
      const url = displayBadgeImageUrl("badge-first-flight.svg");
      expect(url).toBe(
        `${DEFAULT_BADGE_CDN_BASE}/badge-first-flight.svg`,
      );
    });

    it("returns null for invalid or empty inputs", () => {
      expect(displayBadgeImageUrl(null)).toBeNull();
      expect(displayBadgeImageUrl(undefined)).toBeNull();
      expect(displayBadgeImageUrl("")).toBeNull();
      expect(displayBadgeImageUrl(123)).toBeNull();
    });
  });
});
