import { describe, expect, it } from "vitest";
import { canDeleteSource } from "./status";

const now = new Date("2026-10-11T12:00:00Z");

describe("canDeleteSource", () => {
  it.each(["pending", "ready", "error"])("allows deleting a source in status %s", (status) => {
    expect(canDeleteSource(status, "2026-10-11T11:59:59Z", now)).toBe(true);
  });

  it("blocks deleting while the processing may still run", () => {
    expect(canDeleteSource("processing", "2026-10-11T11:55:00Z", now)).toBe(false);
  });

  it("allows deleting a source that is stuck for more than 10 minutes", () => {
    expect(canDeleteSource("processing", "2026-10-11T11:49:00Z", now)).toBe(true);
  });
});
