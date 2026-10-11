import { describe, expect, it } from "vitest";
import { decodeBody, fetchPage, isBlockedAddress, parsePublicUrl } from "./fetch-url";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.5",
    "192.168.178.1",
    "169.254.169.254", // cloud metadata service
    "0.0.0.0",
    "::1",
    "fd12:3456::1",
    "fe80::1",
    "::ffff:127.0.0.1", // IPv4 hidden in IPv6
    "::ffff:7f00:1", // the same, written in hex
  ])("blocks %s", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "185.199.108.153", "::ffff:8.8.8.8", "2a00:1450:4001:82a::200e"])(
    "allows the public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );

  it("blocks anything that is not an IP address", () => {
    expect(isBlockedAddress("localhost")).toBe(true);
  });
});

describe("parsePublicUrl", () => {
  it("accepts a normal https URL", () => {
    expect(parsePublicUrl("https://example.com/artikel?id=1").hostname).toBe("example.com");
  });

  it.each([
    ["ftp://example.com/datei", "Nur Adressen mit http:// oder https://"],
    ["file:///etc/passwd", "Nur Adressen mit http:// oder https://"],
    ["https://nutzer:geheim@example.com", "Benutzername oder Passwort"],
    ["http://example.com:8080/", "ohne eigenen Port"],
    ["http://127.0.0.1/", "nicht öffentlich"],
    ["http://169.254.169.254/latest/meta-data/", "nicht öffentlich"],
    ["http://[::1]/", "nicht öffentlich"],
    ["kein url", "ungültig"],
  ])("rejects %s", (url, message) => {
    expect(() => parsePublicUrl(url)).toThrow(message);
  });
});

describe("fetchPage", () => {
  // "localhost" is a host name, not an IP address, so parsePublicUrl lets it
  // through. The check inside the DNS lookup must stop it (127.0.0.1).
  it("does not connect to localhost via a host name", async () => {
    await expect(fetchPage("http://localhost/")).rejects.toThrow("nicht öffentlich");
  });
});

describe("decodeBody", () => {
  const latin1 = Buffer.from("Grüße aus Köln", "latin1");

  it("uses the charset from the Content-Type header", () => {
    expect(decodeBody(latin1, "text/html; charset=ISO-8859-1")).toBe("Grüße aus Köln");
  });

  it("uses the charset from a meta tag", () => {
    const html = Buffer.concat([
      Buffer.from('<meta charset="iso-8859-1"><p>'),
      latin1,
    ]);
    expect(decodeBody(html, "text/html")).toContain("Grüße aus Köln");
  });

  it("assumes UTF-8 otherwise", () => {
    expect(decodeBody(Buffer.from("Grüße"), "text/html")).toBe("Grüße");
  });

  it("falls back to UTF-8 for an unknown charset", () => {
    expect(decodeBody(Buffer.from("Grüße"), "text/html; charset=quatsch")).toBe("Grüße");
  });
});
