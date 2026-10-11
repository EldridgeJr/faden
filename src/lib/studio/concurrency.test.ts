import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./concurrency";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("mapWithConcurrency", () => {
  it("keeps the order of the items, even if later calls end first", async () => {
    // The first item takes longest.
    const results = await mapWithConcurrency([30, 10, 20, 0], 4, async (ms, i) => {
      await wait(ms);
      return i;
    });
    expect(results).toEqual([0, 1, 2, 3]);
  });

  it("never runs more than limit calls at the same time", async () => {
    let running = 0;
    let most = 0;
    await mapWithConcurrency(Array.from({ length: 12 }), 4, async () => {
      running++;
      most = Math.max(most, running);
      await wait(5);
      running--;
    });
    expect(most).toBe(4);
  });

  it("stops with the first error", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("kaputt");
        return n;
      }),
    ).rejects.toThrow("kaputt");
  });

  it("starts no new call after an error", async () => {
    const started: number[] = [];
    await expect(
      mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async (n) => {
        started.push(n);
        await wait(5);
        if (n === 0) throw new Error("kaputt");
      }),
    ).rejects.toThrow("kaputt");
    await wait(30);
    // 0 and 1 ran in parallel. After 0 failed, nobody took 2 to 5.
    expect(started).toEqual([0, 1]);
  });

  it("works with an empty list", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});
