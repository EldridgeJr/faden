"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, themeClass, type Theme } from "@/lib/theme";

const OPTIONS: { theme: Theme; label: string; Icon: typeof Sun }[] = [
  { theme: "light", label: "Hell", Icon: Sun },
  { theme: "dark", label: "Dunkel", Icon: Moon },
  { theme: "system", label: "System", Icon: Monitor },
];

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

// Side effects in the browser, outside the component: store the choice in a
// cookie and change the class on <html> at once (no reload).
function applyTheme(theme: Theme) {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_IN_SECONDS}; samesite=lax`;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  const className = themeClass(theme);
  if (className) root.classList.add(className);
}

// Three buttons: light, dark, system.
// On the next request the server reads the cookie and renders the right
// class from the start, so the page never flashes.
export function ThemeSwitch({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState(initialTheme);

  function choose(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div role="group" aria-label="Farbschema" className="inline-flex gap-1 rounded-full bg-tile p-1">
      {OPTIONS.map(({ theme: option, label, Icon }) => (
        <button
          key={option}
          type="button"
          onClick={() => choose(option)}
          aria-pressed={theme === option}
          aria-label={label}
          title={label}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            theme === option && "bg-card text-foreground shadow-sm",
          )}
        >
          <Icon className="size-4" aria-hidden />
        </button>
      ))}
    </div>
  );
}
