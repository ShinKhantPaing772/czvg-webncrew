import { describe, expect, it } from "vitest";
import { estimateNearbyIfAirport } from "./position";
import type { IfAirport } from "./types";

const origin = { isOnGround: true, latitude: 0, longitude: 0 };
function airport(icao: string, distanceNm: number): IfAirport { return { icao, latitude: distanceNm / (3440.065 * Math.PI / 180), longitude: 0 }; }

describe("temporary IF nearby-airport estimates", () => {
  it("estimates the unique closest 3D airport without changing input data", () => {
    const position = Object.freeze({ ...origin });
    const airports = Object.freeze([Object.freeze(airport("FAR", 10)), Object.freeze(airport("NEAR", 1)), Object.freeze(airport("OTHER", 3))]);
    const estimate = estimateNearbyIfAirport(position, airports);
    expect(estimate?.icao).toBe("NEAR"); expect(estimate?.distanceNm).toBeCloseTo(1, 8);
    expect(Object.keys(estimate!)).toEqual(["icao", "distanceNm"]);
    expect(position).toEqual(origin); expect(airports.map(row => row.icao)).toEqual(["FAR", "NEAR", "OTHER"]);
  });
  it("does not report a nearest airport while airborne or when none is within five nautical miles", () => {
    expect(estimateNearbyIfAirport({ ...origin, isOnGround: false }, [airport("NEAR", 0)])).toBeNull();
    expect(estimateNearbyIfAirport(origin, [airport("FAR", 5.001)])).toBeNull();
    expect(estimateNearbyIfAirport(origin, [airport("NEAR", 4.999)])?.icao).toBe("NEAR");
    expect(estimateNearbyIfAirport(origin, [])).toBeNull();
  });
  it.each([0, 0.2, 0.25])("refuses distinct airports whose distances differ by only %s nautical miles", difference => {
    expect(estimateNearbyIfAirport(origin, [airport("ONE", 1), airport("TWO", 1 + difference)])).toBeNull();
  });
  it("does not hide an ambiguous competing airport just beyond the five-mile display limit", () => {
    expect(estimateNearbyIfAirport(origin, [airport("ONE", 4.9), airport("TWO", 5.1)])).toBeNull();
  });
  it("accepts a clearly closest airport and collapses identical copies of the same airport", () => {
    const closest = airport("near", 1);
    const estimate = estimateNearbyIfAirport(origin, [airport("OTHER", 1.251), closest, { ...closest, icao: "NEAR" }]);
    expect(estimate?.icao).toBe("NEAR"); expect(estimate?.distanceNm).toBeCloseTo(1, 8);
    expect(estimateNearbyIfAirport(origin, [airport("SAME", 1), airport("same", 2)])).toBeNull();
  });
  it.each([{ ...origin, latitude: 91 }, { ...origin, longitude: -181 }, { ...origin, latitude: Number.NaN }])("does not estimate from invalid position coordinates: %j", position => {
    expect(estimateNearbyIfAirport(position, [airport("NEAR", 1)])).toBeNull();
  });
  it.each([{ icao: "../bad", latitude: 0, longitude: 0 }, { icao: "CYYZ", latitude: 0, longitude: Number.POSITIVE_INFINITY }])("fails closed for an invalid airport reference: %j", invalid => {
    expect(estimateNearbyIfAirport(origin, [airport("NEAR", 1), invalid])).toBeNull();
  });
  it("measures nearby aircraft and airport coordinates across the antimeridian", () => {
    const estimate = estimateNearbyIfAirport({ isOnGround: true, latitude: 0, longitude: 179.999 }, [{ icao: "TEST", latitude: 0, longitude: -179.999 }]);
    expect(estimate?.icao).toBe("TEST"); expect(estimate?.distanceNm).toBeCloseTo(0.12008, 4);
  });
});
