import { getUtcWeekRange, toDateKey } from "@/lib/date";

describe("getUtcWeekRange", () => {
  it("anchors the range to the current UTC week instead of the current day", () => {
    const { start, end, days } = getUtcWeekRange(new Date("2026-03-28T18:45:00.000Z"));

    expect(toDateKey(start)).toBe("2026-03-23");
    expect(toDateKey(end)).toBe("2026-03-29");
    expect(days.map(toDateKey)).toEqual([
      "2026-03-23",
      "2026-03-24",
      "2026-03-25",
      "2026-03-26",
      "2026-03-27",
      "2026-03-28",
      "2026-03-29",
    ]);
  });

  it("returns a Sunday-start week when requested", () => {
    const { start, end } = getUtcWeekRange(new Date("2026-03-28T18:45:00.000Z"), 0);

    expect(toDateKey(start)).toBe("2026-03-22");
    expect(toDateKey(end)).toBe("2026-03-28");
  });
});
