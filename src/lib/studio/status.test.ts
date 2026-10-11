import { describe, expect, it } from "vitest";
import { studioState } from "./status";

const now = new Date("2026-10-11T12:00:00Z");
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();

describe("studioState", () => {
  it("passes ready and error through", () => {
    expect(studioState("ready", minutesAgo(1), now)).toBe("ready");
    expect(studioState("error", minutesAgo(1), now)).toBe("error");
  });

  it("is busy while pending or processing", () => {
    expect(studioState("pending", minutesAgo(0), now)).toBe("busy");
    expect(studioState("processing", minutesAgo(9), now)).toBe("busy");
  });

  it("counts a job that runs longer than 10 minutes as an error", () => {
    expect(studioState("processing", minutesAgo(11), now)).toBe("error");
    expect(studioState("pending", minutesAgo(11), now)).toBe("error");
  });
});
