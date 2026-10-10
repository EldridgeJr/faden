import { describe, expect, it } from "vitest";
import { notebookIdSchema, notebookTitleSchema, signInSchema } from "./schemas";

describe("signInSchema", () => {
  it("accepts a valid email and normalizes it", () => {
    const result = signInSchema.parse({
      email: "  Demo@Faden.TEST ",
      password: "secret",
    });
    expect(result.email).toBe("demo@faden.test");
  });

  it("rejects an invalid email with a German message", () => {
    const result = signInSchema.safeParse({ email: "kein-at", password: "x" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Bitte gib eine gültige E-Mail-Adresse ein.",
    );
  });

  it("rejects a missing field (FormData.get returns null)", () => {
    const result = signInSchema.safeParse({ email: null, password: null });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(
      "Bitte gib deine E-Mail-Adresse ein.",
    );
  });

  it("rejects an empty password", () => {
    const result = signInSchema.safeParse({ email: "a@b.de", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("notebookTitleSchema", () => {
  it("trims whitespace", () => {
    expect(notebookTitleSchema.parse("  Mein Notebook  ")).toBe("Mein Notebook");
  });

  it("rejects a title that is only whitespace", () => {
    expect(notebookTitleSchema.safeParse("   ").success).toBe(false);
  });

  it("accepts 200 characters and rejects 201", () => {
    expect(notebookTitleSchema.safeParse("a".repeat(200)).success).toBe(true);
    expect(notebookTitleSchema.safeParse("a".repeat(201)).success).toBe(false);
  });
});

describe("notebookIdSchema", () => {
  it("accepts a UUID from gen_random_uuid()", () => {
    expect(
      notebookIdSchema.safeParse("1ce9dbd8-d4db-4023-bee1-f70220058102").success,
    ).toBe(true);
  });

  it("rejects anything else", () => {
    expect(notebookIdSchema.safeParse("123").success).toBe(false);
    expect(notebookIdSchema.safeParse("'; drop table notebooks;--").success).toBe(
      false,
    );
  });
});
