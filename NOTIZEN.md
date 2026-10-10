# Notizen fürs Interview

## Wo die KI danebenlag
<!-- Datum · was war falsch · woran ich es gemerkt habe · wie ich es gelöst habe -->

- **10.10.2026 · create-next-app schaltet mehr ein als angegeben.** Annahme: Es aktiviert nur die Flags, die ich übergebe. Falsch: Version 16.4 setzt `cacheComponents: true` und `partialPrefetching: true` in `next.config.ts`, obwohl ich `--cache-components` nicht übergeben habe. Gemerkt beim Lesen der erzeugten Dateien. Gelöst: Doku in `node_modules/next/dist/docs/` gelesen. Vorerst angelassen, Entscheidung fällt in Schritt 2 (siehe unten).
- **10.10.2026 · `.gitignore` hätte `.env.example` verschluckt.** Die Vorlage ignoriert `.env*`, also auch die Vorlage für Umgebungsvariablen. Gemerkt beim Anlegen von `.env.example`. Gelöst: Ausnahme `!.env.example`.
- **10.10.2026 · `npm audit` meldet 5 „high“.** Alle in der ESLint-Kette (`braces` → `micromatch` → `fast-glob` → `eslint-config-next`), also nur Entwicklungswerkzeug, nicht im ausgelieferten Code. `npm audit fix --force` hätte `eslint-config-next` auf 14 zurückgestuft und Next 16 kaputt gemacht. Gelöst: bewusst **nicht** ausgeführt, auf ein Update von `eslint-config-next` warten.
- **10.10.2026 · Vorlage lädt Geist, nutzt aber Arial.** `globals.css` setzte `font-family: Arial` auf `body`. Die Geist-Schrift wurde geladen, aber nie benutzt. Gelöst: Zeile entfernt, `font-sans` auf `body`.
- **10.10.2026 · Vitest 5 passt nicht zu `@types/node@20`.** Vitest 5 verlangt `@types/node` ab 22. Gelöst: auf `^24` angehoben, passt zu Node 24.
- **10.10.2026 · `nvm install 24` wirkte in der Claude-Shell nicht.** Jeder Befehl startet eine neue Shell mit Node 23 im Pfad. Gelöst: Pfad zu Node 24 vor jedem Befehl setzen (steht in `CLAUDE.md` unter „Befehle“). Im eigenen Terminal reicht `nvm use`.

## Entscheidungen
<!-- Was habe ich entschieden, warum, welche Alternative gab es -->

- **`src/`-Ordner.** App-Code (`src/app`, später `src/lib`) ist getrennt von Konfiguration, Migrationen und Doku. Alternative: alles im Wurzelverzeichnis, ein Ordner weniger.
- **Node 24 LTS** über `.nvmrc` und `engines` in `package.json`. Lokal und auf Vercel läuft dieselbe Hauptversion. Alternative: lokales Node 23 behalten (keine LTS-Version, kann sich anders verhalten).
- **Vitest mit `resolve.tsconfigPaths`** aus Vite 8 statt Plugin `vite-tsconfig-paths`. Eine Abhängigkeit weniger.
- **`typecheck` = `next typegen && tsc --noEmit`.** Next erzeugt Typen wie `LayoutProps<"/">` erst selbst. Ohne `typegen` scheitert der Typecheck auf einem frischen Checkout.
- **shadcn/ui erst in Schritt 5.** `shadcn init` überschreibt `globals.css` mit eigenen Farbvariablen. Das gehört zum Design-Schritt.
- **Vercel über Git verbunden.** Jeder Push auf `main` erzeugt ein Production-Deployment, jeder andere Branch ein Preview. Alternative: manuell mit `vercel deploy`.
- **Offen für Schritt 2: `cacheComponents`.** Mit Cache Components muss jede Seite, die Cookies liest (Login), diesen Teil hinter `<Suspense>` legen oder mit `instant = false` aussteigen. Fast alle Faden-Seiten sind nutzerbezogen. Prüfen, ob der Mehraufwand sich lohnt oder ob wir es ausschalten.

## Echte Zahlen
- Kosten pro Frage:
- Antwortzeit bis zum ersten Text:
- Abschnitte im Demo-Notebook:
- Dauer Podcast-Erstellung:

## Schwierigstes Problem
<!-- Problem · woran gemerkt · was probiert · Lösung · was ich mitnehme -->
