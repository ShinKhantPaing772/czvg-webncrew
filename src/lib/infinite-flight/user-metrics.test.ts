import { describe, expect, it } from "vitest";
import { extractInfiniteFlightMetrics } from "./user-metrics";

describe("extractInfiniteFlightMetrics", () => {
  it("reads the grade and violation count IF returns", () => {
    expect(extractInfiniteFlightMetrics({ grade: 3, violations: 12 })).toEqual(
      { grade: 3, violations: 12 },
    );
  });

  it("counts a violation list and falls back to nested stats", () => {
    expect(
      extractInfiniteFlightMetrics({
        stats: { grade: "4" },
        violations: [{ level: 1 }, { level: 2 }],
      }),
    ).toEqual({ grade: 4, violations: 2 });
  });

  it("returns nulls when IF leaves the fields out", () => {
    expect(extractInfiniteFlightMetrics({ userId: "x" })).toEqual({
      grade: null,
      violations: null,
    });
  });
});
