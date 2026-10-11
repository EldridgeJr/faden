import { describe, expect, it } from "vitest";
import { pickChunks } from "./pick-chunks";

// n chunks of one source, positions 0..n-1, ids start at idBase.
function source(sourceId: string, n: number, idBase: number) {
  return Array.from({ length: n }, (_, position) => ({ id: idBase + position, sourceId, position }));
}

describe("pickChunks", () => {
  it("takes all chunks if there are fewer than max", () => {
    const chunks = source("a", 5, 0);
    expect(pickChunks(chunks, ["a"], 16).map((c) => c.position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("spreads the chunks over a long source: start, middle and end", () => {
    const chunks = source("a", 100, 0);
    const positions = pickChunks(chunks, ["a"], 4).map((c) => c.position);
    // Middle of each quarter: 12.5 → 12, 37.5 → 37, …
    expect(positions).toEqual([12, 37, 62, 87]);
  });

  it("takes the middle chunk if only one fits", () => {
    expect(pickChunks(source("a", 9, 0), ["a"], 1).map((c) => c.position)).toEqual([4]);
  });

  it("shares max between sources, a big source does not push out a small one", () => {
    const chunks = [...source("big", 200, 0), ...source("small", 2, 1000)];
    const picked = pickChunks(chunks, ["big", "small"], 6);
    expect(picked.filter((c) => c.sourceId === "small")).toHaveLength(2);
    expect(picked.filter((c) => c.sourceId === "big")).toHaveLength(4);
  });

  it("orders by source (as given), then by position", () => {
    // Input order is mixed on purpose.
    const chunks = [...source("b", 3, 100), ...source("a", 3, 0)].reverse();
    const picked = pickChunks(chunks, ["a", "b"], 16);
    expect(picked.map((c) => `${c.sourceId}${c.position}`)).toEqual(["a0", "a1", "a2", "b0", "b1", "b2"]);
  });

  it("ignores chunks of sources that are not selected", () => {
    const chunks = [...source("a", 3, 0), ...source("other", 3, 100)];
    expect(pickChunks(chunks, ["a"], 16).every((c) => c.sourceId === "a")).toBe(true);
  });

  it("never picks a chunk twice", () => {
    for (let n = 1; n <= 40; n++) {
      for (let max = 1; max <= 20; max++) {
        const ids = pickChunks(source("a", n, 0), ["a"], max).map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(Math.min(n, max));
      }
    }
  });

  it("returns nothing without chunks", () => {
    expect(pickChunks([], ["a", "b"], 16)).toEqual([]);
  });
});
