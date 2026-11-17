import { describe, expect, it } from "vitest";

import {
  extractAirlineDesignator,
  getAirlineLogoForFlight,
  remoteAirlineLogoUrl,
} from "@/lib/group-airlines";

describe("extractAirlineDesignator", () => {
  it("parses IATA flight numbers including alphanumeric codes and suffixes", () => {
    expect(extractAirlineDesignator("5X104(A)")).toBe("5X");
    expect(extractAirlineDesignator("CZ3101")).toBe("CZ");
    expect(extractAirlineDesignator("9C8801")).toBe("9C");
  });

  it("parses ICAO flight numbers", () => {
    expect(extractAirlineDesignator("CSN327")).toBe("CSN");
    expect(extractAirlineDesignator("CXA801")).toBe("CXA");
    expect(extractAirlineDesignator("ups102")).toBe("UPS");
  });
});

describe("getAirlineLogoForFlight", () => {
  it("uses local assets for CZVG group carriers", () => {
    expect(getAirlineLogoForFlight("CSN327", null)?.logo).toBe(
      "/airlines/china-southern.svg",
    );
    expect(getAirlineLogoForFlight("CXA801", null)?.logo).toBe(
      "/airlines/xiamenair.svg",
    );
    expect(getAirlineLogoForFlight("OQ2001", "Chongqing Airlines")?.logo).toBe(
      "/airlines/chongqing.webp",
    );
  });

  it("resolves partner airlines to the matching IATA CDN logo instead of Southern", () => {
    const ups = getAirlineLogoForFlight("5X104(A)", "UPS");
    expect(ups).not.toBeNull();
    expect(ups?.logo).toBe(remoteAirlineLogoUrl("5X"));
    expect(ups?.name).toMatch(/UPS/i);
    expect(ups?.logo).not.toContain("china-southern");
  });

  it("resolves partner airlines from livery when flight designator is missing", () => {
    const fedex = getAirlineLogoForFlight(null, "FedEx Express");
    expect(fedex?.logo).toBe(remoteAirlineLogoUrl("FX"));
  });

  it("does not default unknown flights to China Southern", () => {
    expect(getAirlineLogoForFlight(null, null)).toBeNull();
    expect(getAirlineLogoForFlight("ZZ", "Mystery Paint")).toBeNull();
  });
});
