import { lookup } from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { Agent, fetch, type Response } from "undici";

// Loads a web page for a URL source. The user chooses the URL, our server
// fetches it. Without protection a user could make our server call internal
// addresses (SSRF), for example the cloud metadata service at
// 169.254.169.254 or a database in the private network.

// An error whose message the user may see (German).
export class UrlFetchError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;
const USER_AGENT = "FadenBot/1.0 (+https://faden-one.vercel.app)";

// Address ranges that are not on the public internet.
const blockedRanges = new BlockList();
const BLOCKED_IPV4: [string, number][] = [
  ["0.0.0.0", 8], // "this network"
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback (localhost)
  ["169.254.0.0", 16], // link-local, includes the cloud metadata service
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, includes 255.255.255.255
];
const BLOCKED_IPV6: [string, number][] = [
  ["::", 128], // unspecified
  ["::1", 128], // loopback
  // No rule for "IPv4 inside IPv6" (::ffff:0:0/96): BlockList checks those
  // addresses against the IPv4 rules itself, so ::ffff:127.0.0.1 is blocked.
  // A rule for the whole range would block every IPv4 address.
  ["64:ff9b::", 96], // NAT64, could also hide an IPv4 address
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // private (unique local)
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];
for (const [net, prefix] of BLOCKED_IPV4) blockedRanges.addSubnet(net, prefix, "ipv4");
for (const [net, prefix] of BLOCKED_IPV6) blockedRanges.addSubnet(net, prefix, "ipv6");

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true; // not an IP address at all
  return blockedRanges.check(address, family === 4 ? "ipv4" : "ipv6");
}

// Checks a URL before we connect. Only plain http(s) on the standard ports.
export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UrlFetchError("Diese Adresse ist ungültig.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UrlFetchError("Nur Adressen mit http:// oder https:// sind erlaubt.");
  }
  if (url.username || url.password) {
    throw new UrlFetchError("Adressen mit Benutzername oder Passwort sind nicht erlaubt.");
  }
  // url.port is "" for the default port of the protocol (80 or 443).
  if (url.port !== "") {
    throw new UrlFetchError("Nur Adressen ohne eigenen Port sind erlaubt.");
  }
  // An IP address in the URL skips the DNS lookup below, so check it here.
  // IPv6 addresses appear in brackets: [::1].
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && isBlockedAddress(host)) {
    throw new UrlFetchError("Diese Adresse ist nicht öffentlich erreichbar.");
  }
  return url;
}

// DNS lookup used while connecting. So we check exactly the address we
// connect to. A separate check before fetch() would leave a gap: the name
// could point somewhere else on the second lookup (DNS rebinding).
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(
        new UrlFetchError("Diese Adresse ist nicht öffentlich erreichbar."),
        "",
        4,
      );
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

const agent = new Agent({ connect: { lookup: safeLookup } });

export type FetchedPage = { finalUrl: string; contentType: string; body: string };

export async function fetchPage(rawUrl: string): Promise<FetchedPage> {
  let url = parsePublicUrl(rawUrl);
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  // Follow redirects ourselves: every new target must pass parsePublicUrl.
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
    let response;
    try {
      response = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal,
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
        },
      });
    } catch (error) {
      throw toUrlFetchError(error);
    }

    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      url = parsePublicUrl(new URL(location, url).href);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new UrlFetchError(`Die Seite antwortet mit dem Fehler ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!/^(text\/html|application\/xhtml\+xml|text\/plain)/i.test(contentType)) {
      await response.body?.cancel();
      throw new UrlFetchError(
        "Unter dieser Adresse liegt keine Webseite. PDFs bitte direkt hochladen.",
      );
    }

    const bytes = await readAtMost(response.body, MAX_BYTES);
    return { finalUrl: url.href, contentType, body: decodeBody(bytes, contentType) };
  }
  throw new UrlFetchError("Die Seite leitet zu oft weiter.");
}

// Reads the body, but stops as soon as it gets too big. response.text()
// would first load everything into memory.
async function readAtMost(body: Response["body"], maxBytes: number): Promise<Uint8Array> {
  if (!body) return new Uint8Array();
  const parts: Uint8Array[] = [];
  let size = 0;
  for await (const part of body) {
    size += part.byteLength;
    if (size > maxBytes) {
      await body.cancel();
      throw new UrlFetchError("Die Seite ist größer als 5 MB.");
    }
    parts.push(part);
  }
  return Buffer.concat(parts);
}

// Bytes → text in the right character set. response.text() always assumes
// UTF-8, so umlauts on older pages (ISO-8859-1) would break.
export function decodeBody(bytes: Uint8Array, contentType: string): string {
  const fromHeader = /charset=["']?([\w-]+)/i.exec(contentType)?.[1];
  // Otherwise look for <meta charset="…"> at the start of the page.
  const head = Buffer.from(bytes.subarray(0, 2048)).toString("latin1");
  const fromMeta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  try {
    return new TextDecoder(fromHeader ?? fromMeta ?? "utf-8").decode(bytes);
  } catch {
    // Unknown charset name: fall back to UTF-8.
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function toUrlFetchError(error: unknown): UrlFetchError {
  if (error instanceof UrlFetchError) return error;
  // undici wraps errors from the connection setup: TypeError("fetch failed")
  // with the real reason in "cause".
  const cause = error instanceof Error ? error.cause : undefined;
  if (cause instanceof UrlFetchError) return cause;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return new UrlFetchError("Die Seite hat nicht rechtzeitig geantwortet.");
  }
  const code = (cause as { code?: string } | undefined)?.code;
  if (code === "ENOTFOUND") {
    return new UrlFetchError("Diese Adresse wurde nicht gefunden.");
  }
  return new UrlFetchError("Die Seite konnte nicht geladen werden.");
}
