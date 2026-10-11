// Light, dark or "system" (follow the operating system).
// Used on the server (layout.tsx reads the cookie) and in the browser
// (the switch writes it). So no "server-only" here.

export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_COOKIE = "theme";

// The cookie comes from the browser, so it can hold anything.
// Unknown values count as "system".
export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

// The class for <html>. "system" needs no class: CSS then follows
// prefers-color-scheme (see globals.css).
export function themeClass(theme: Theme): string | undefined {
  return theme === "system" ? undefined : theme;
}
