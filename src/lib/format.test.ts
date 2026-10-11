import { describe, expect, it } from "vitest";
import { formatBuildTime, formatDay, formatDuration, formatMegabytes, greeting } from "./format";

describe("greeting", () => {
  // October: Germany is UTC+2 (summer time).
  it("uses German time, not UTC", () => {
    expect(greeting(new Date("2026-10-11T07:30:00Z"))).toBe("Guten Morgen"); // 09:30
    expect(greeting(new Date("2026-10-11T09:00:00Z"))).toBe("Guten Tag"); // 11:00
    expect(greeting(new Date("2026-10-11T16:00:00Z"))).toBe("Guten Abend"); // 18:00
    expect(greeting(new Date("2026-10-11T01:00:00Z"))).toBe("Guten Abend"); // 03:00
  });
});

describe("formatDay", () => {
  const now = new Date("2026-10-11T18:00:00Z"); // 20:00 in Berlin

  it("says Heute and Gestern for calendar days", () => {
    expect(formatDay(new Date("2026-10-11T06:00:00Z"), now)).toBe("Heute");
    // 23:30 in Berlin on the 10th is yesterday, although it is less than 24 h ago.
    expect(formatDay(new Date("2026-10-10T21:30:00Z"), now)).toBe("Gestern");
    // 00:30 in Berlin on the 11th is today, although it is the 10th in UTC.
    expect(formatDay(new Date("2026-10-10T22:30:00Z"), now)).toBe("Heute");
  });

  it("shows a short date, with the year only for other years", () => {
    expect(formatDay(new Date("2026-10-06T10:00:00Z"), now)).toBe("6. Okt.");
    expect(formatDay(new Date("2025-10-06T10:00:00Z"), now)).toBe("6. Okt. 2025");
  });
});

describe("formatDuration", () => {
  it("writes minutes and two-digit seconds", () => {
    expect(formatDuration(312.4)).toBe("5:12");
    expect(formatDuration(9)).toBe("0:09");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("rounds down and never goes below zero", () => {
    expect(formatDuration(59.99)).toBe("0:59");
    expect(formatDuration(-3)).toBe("0:00");
  });
});

describe("formatMegabytes", () => {
  it("writes megabytes with a German decimal comma", () => {
    expect(formatMegabytes(4_812_345)).toBe("4,8 MB");
    expect(formatMegabytes(6_000_000)).toBe("6 MB");
  });
});

describe("formatBuildTime", () => {
  it("writes seconds, or minutes and seconds", () => {
    expect(formatBuildTime(39.4)).toBe("39 s");
    expect(formatBuildTime(108)).toBe("1 Min. 48 s");
    expect(formatBuildTime(120)).toBe("2 Min.");
  });
});
