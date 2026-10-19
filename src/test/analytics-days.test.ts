import { describe, it, expect } from "vitest";
import { fillDays, rangeStart } from "@/lib/analytics-days";

describe("analytics day range", () => {
  const now = Date.parse("2026-10-19T15:30:00Z");

  it("starts at UTC midnight and includes today", () => {
    expect(new Date(rangeStart(now, 7)).toISOString()).toBe("2026-10-13T00:00:00.000Z");
    expect(new Date(rangeStart(now, 1)).toISOString()).toBe("2026-10-19T00:00:00.000Z");
  });

  it("returns one entry per day, zero-filling days the API omitted", () => {
    const days = fillDays(
      [
        { timestamp: "2026-10-14T00:00:00.000Z", pageviews: 5, visitors: 3 },
        { timestamp: "2026-10-19T00:00:00.000Z", pageviews: 2, visitors: 2 },
      ],
      rangeStart(now, 7),
      7,
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: "2026-10-13", pageviews: 0, visitors: 0 });
    expect(days[1]).toEqual({ date: "2026-10-14", pageviews: 5, visitors: 3 });
    expect(days[6]).toEqual({ date: "2026-10-19", pageviews: 2, visitors: 2 });
  });
});
