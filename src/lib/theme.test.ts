import { describe, expect, it } from "vitest";
import { parseTheme, themeClass } from "./theme";

describe("parseTheme", () => {
  it("accepts the three known values", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to system for a missing or unknown cookie", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("DARK")).toBe("system");
    expect(parseTheme('dark" onload="alert(1)')).toBe("system");
  });
});

describe("themeClass", () => {
  it("sets a class only for light and dark", () => {
    expect(themeClass("light")).toBe("light");
    expect(themeClass("dark")).toBe("dark");
    expect(themeClass("system")).toBeUndefined();
  });
});
