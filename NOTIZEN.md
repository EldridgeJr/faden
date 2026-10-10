# Notizen fürs Interview

## Wo die KI danebenlag
<!-- Datum · was war falsch · woran ich es gemerkt habe · wie ich es gelöst habe -->

- **10.10.2026 · create-next-app schaltet mehr ein als angegeben.** Annahme: Es aktiviert nur die Flags, die ich übergebe. Falsch: Version 16.4 setzt `cacheComponents: true` und `partialPrefetching: true` in `next.config.ts`, obwohl ich `--cache-components` nicht übergeben habe. Gemerkt beim Lesen der erzeugten Dateien. Gelöst: Doku in `node_modules/next/dist/docs/` gelesen. Vorerst angelassen, Entscheidung fällt in Schritt 2 (siehe unten).
- **10.10.2026 · `.gitignore` hätte `.env.example` verschluckt.** Die Vorlage ignoriert `.env*`, also auch die Vorlage für Umgebungsvariablen. Gemerkt beim Anlegen von `.env.example`. Gelöst: Ausnahme `!.env.example`.
- **10.10.2026 · `npm audit` meldet 5 „high“.** Alle in der ESLint-Kette (`braces` → `micromatch` → `fast-glob` → `eslint-config-next`), also nur Entwicklungswerkzeug, nicht im ausgelieferten Code. `npm audit fix --force` hätte `eslint-config-next` auf 14 zurückgestuft und Next 16 kaputt gemacht. Gelöst: bewusst **nicht** ausgeführt, auf ein Update von `eslint-config-next` warten.
- **10.10.2026 · Vorlage lädt Geist, nutzt aber Arial.** `globals.css` setzte `font-family: Arial` auf `body`. Die Geist-Schrift wurde geladen, aber nie benutzt. Gelöst: Zeile entfernt, `font-sans` auf `body`.
- **10.10.2026 · Vitest 5 passt nicht zu `@types/node@20`.** Vitest 5 verlangt `@types/node` ab 22. Gelöst: auf `^24` angehoben, passt zu Node 24.
- **10.10.2026 · Falsche Live-URL geraten.** Die KI hat `faden-eldridge1.vercel.app` vor dem ersten Deployment in die Erklärseite geschrieben. Nach dem Deployment per `curl` geprüft: Diese Team-Domain antwortet mit 302 auf den Vercel-Login (Deployment Protection). Öffentlich ist nur `faden-one.vercel.app` (200). Gelöst: URL in Erklärseite und README ersetzt. Lehre: URLs erst nach dem Deployment eintragen und von außen testen.
- **10.10.2026 · `nvm install 24` wirkte in der Claude-Shell nicht.** Jeder Befehl startet eine neue Shell mit Node 23 im Pfad. Gelöst: Pfad zu Node 24 vor jedem Befehl setzen (steht in `CLAUDE.md` unter „Befehle“). Im eigenen Terminal reicht `nvm use`.
- **10.10.2026 · Supabase-MCP sah die neue Organisation nicht.** Annahme: Der Connector sieht alle Organisationen meines Kontos. Falsch: Die Freigabe gilt pro Organisation und wurde damals nur für „RetainLens“ erteilt. Gemerkt: `list_projects` zeigte das neue Projekt nicht. Gelöst: Connector getrennt und neu verbunden, nur „Faden“ freigegeben. Nebeneffekt: Die KI kommt jetzt nicht mehr an RetainLens heran.
- **10.10.2026 · Rat zur Projekterstellung geändert.** Zuerst hieß es „Projekt per MCP anlegen“. Der Dashboard-Dialog bietet aber Sicherheitsoptionen, die das MCP-Tool nicht hat („Automatically expose new tables“ aus, „Enable automatic RLS“ an). Gelöst: im Dashboard angelegt.
- **10.10.2026 · Supabase-Option erzeugt selbst eine Sicherheitswarnung.** „Enable automatic RLS“ legt `public.rls_auto_enable()` als `SECURITY DEFINER` im öffentlichen Schema an. Der Security-Advisor meldet: aufrufbar für `anon` über `/rest/v1/rpc/…`. Echtes Risiko fast null (Funktion gibt `event_trigger` zurück, direkter Aufruf geht nicht). Gelöst: zweite Migration entzieht `EXECUTE`. Advisor danach: 0 Warnungen.
- **10.10.2026 · Falsche Annahme über den deutschen Stemmer.** Der RLS-Test erwartete, dass die Suche nach „verbinden“ den Text „verbindet“ findet. Falsch: Snowball macht aus „verbinden“ `verbind`, lässt „verbindet“ aber unverändert. Gemerkt: der Test schlug fehl (gut, dass es ihn gibt). Gelöst: Test prüft jetzt „Quelle“ ↔ „Quellen“ (beide `quell`). Lehre: Volltextsuche allein verpasst Wortformen – genau dafür gibt es die Vektorsuche in der hybriden Suche.

## Entscheidungen
<!-- Was habe ich entschieden, warum, welche Alternative gab es -->

- **`src/`-Ordner.** App-Code (`src/app`, später `src/lib`) ist getrennt von Konfiguration, Migrationen und Doku. Alternative: alles im Wurzelverzeichnis, ein Ordner weniger.
- **Node 24 LTS** über `.nvmrc` und `engines` in `package.json`. Lokal und auf Vercel läuft dieselbe Hauptversion. Alternative: lokales Node 23 behalten (keine LTS-Version, kann sich anders verhalten).
- **Vitest mit `resolve.tsconfigPaths`** aus Vite 8 statt Plugin `vite-tsconfig-paths`. Eine Abhängigkeit weniger.
- **`typecheck` = `next typegen && tsc --noEmit`.** Next erzeugt Typen wie `LayoutProps<"/">` erst selbst. Ohne `typegen` scheitert der Typecheck auf einem frischen Checkout.
- **shadcn/ui erst in Schritt 5.** `shadcn init` überschreibt `globals.css` mit eigenen Farbvariablen. Das gehört zum Design-Schritt.
- **Vercel über Git verbunden.** Jeder Push auf `main` erzeugt ein Production-Deployment, jeder andere Branch ein Preview. Alternative: manuell mit `vercel deploy`.
- **Eigene Supabase-Organisation „Faden“** (Free, Projekt `faden`, Frankfurt). Trennt das Bewerbungsprojekt von RetainLens. Kein zusätzliches Gratis-Kontingent.
- **Projekt-Optionen:** Data API an (braucht `supabase-js`), „Automatically expose new tables“ aus, automatisches RLS an.
- **Kein Docker → keine lokale Supabase.** Migrationen gehen per Supabase-MCP direkt auf das Projekt. Die SQL-Dateien in `supabase/migrations/` tragen dieselbe Versionsnummer wie in der Datenbank. Alternative: Supabase-CLI mit lokalem Stack (braucht Docker).
- **Zwei Schutzschichten: `grant` + RLS.** `anon` bekommt gar nichts, `authenticated` nur die nötigen Rechte (`chunks` und `messages` ohne `update`). Ein Fehler in einer Policy allein öffnet noch nichts.
- **Status/Typ als `text` + `check` statt Postgres-Enum.** Werte lassen sich später leichter ändern (Enum-Werte kann man nicht einfach entfernen).
- **`chunks.id` als `bigint identity`** statt UUID. Kleiner Index, die ID erscheint nie in einer URL.
- **Zusammengesetzter Fremdschlüssel `chunks(source_id, notebook_id) → sources(id, notebook_id)`.** `notebook_id` ist in `chunks` kopiert (schneller Filter, RLS ohne Join). Der Schlüssel garantiert, dass die Kopie nie vom Notebook der Quelle abweicht.
- **`fts` als generierte Spalte** statt Trigger. Postgres hält sie selbst aktuell.
- **Storage-Pfad `<notebook_id>/<source_id>.<ext>`**, Policy prüft den ersten Ordner. Bucket privat, max. 20 MB, nur PDF und Text.
- **RLS-Test als SQL-Skript** (`supabase/checks/rls.sql`): zwei Testnutzer, `assert` pro Regel, am Ende `rollback`. Alternative: pgTAP mit `supabase test db` (braucht Docker).
- **Login später per E-Mail + Passwort.** Am einfachsten für Playwright und das Demo. Alternative: Magic Link (Postfach nötig, Mail-Limit).
- **Offen für Schritt 2: `cacheComponents`.** Mit Cache Components muss jede Seite, die Cookies liest (Login), diesen Teil hinter `<Suspense>` legen oder mit `instant = false` aussteigen. Fast alle Faden-Seiten sind nutzerbezogen. Prüfen, ob der Mehraufwand sich lohnt oder ob wir es ausschalten.

## Echte Zahlen
- Kosten pro Frage:
- Antwortzeit bis zum ersten Text:
- Abschnitte im Demo-Notebook:
- Dauer Podcast-Erstellung:

## Schwierigstes Problem
<!-- Problem · woran gemerkt · was probiert · Lösung · was ich mitnehme -->
