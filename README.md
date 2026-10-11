# Faden

Faden ist ein NotebookLM-Klon. Du lädst Quellen hoch (PDF, Webseite, Text) und stellst Fragen.
Faden antwortet **nur aus diesen Quellen** – mit klickbaren Belegen, die direkt zur Textstelle springen.

> Status: im Aufbau. Testprojekt für die Bewerbung als Junior Entwickler bei Everlast AI.

**Live:** <https://faden-one.vercel.app>

## Stack

- Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4
- Supabase (Postgres + pgvector, Storage, Auth, RLS)
- Vercel AI SDK · OpenAI (Embeddings `text-embedding-3-small`, Chat `gpt-6-luna`, Text-to-Speech)
- Upstash Redis (Rate Limiting pro Nutzer)
- Vitest · Playwright

## Lokal starten

Voraussetzung: Node 24 (siehe `.nvmrc`).

```bash
nvm use
npm install
cp .env.example .env.local   # Werte eintragen
npm run dev
```

Dann <http://localhost:3000> öffnen.

## Befehle

| Befehl | Was er tut |
| --- | --- |
| `npm run dev` | Entwicklungsserver starten |
| `npm run build` | Produktions-Build erstellen |
| `npm run lint` | ESLint ausführen |
| `npm run typecheck` | Routen-Typen erzeugen und TypeScript prüfen |
| `npm test` | Unit-Tests mit Vitest |
| `npm run db:types` | TypeScript-Typen aus dem Datenbankschema neu erzeugen (braucht `supabase login`) |

## Datenbank

Supabase-Projekt `faden` in Frankfurt (eu-central-1).

- `supabase/migrations/` – das komplette Schema als SQL. Dateiname = Versionsnummer in der Datenbank.
- `supabase/checks/rls.sql` – prüft mit zwei Testnutzern, dass niemand fremde Daten sieht oder ändert. Läuft im SQL-Editor, endet mit `rollback`.
- `supabase/checks/match_chunks.sql` – prüft die hybride Suche (Rangfolge, Quellenfilter, fremde Nutzer). Ebenfalls mit `rollback`.
- `src/lib/supabase/` – Clients für Browser (`client.ts`) und Server (`server.ts`), Session-Erneuerung (`proxy.ts`), erzeugte Typen.

Zugriff ist doppelt geschützt: `grant` legt fest, welche Rolle eine Tabelle überhaupt benutzen darf (`anon` gar nicht), Row Level Security legt fest, welche Zeilen.

## Dokumentation

- `docs/erklaerungen/` – Erklärseite zu jedem Bauschritt (im Browser öffnen)
- `NOTIZEN.md` – Fehler, Annahmen und Entscheidungen während der Entwicklung

## Nächste Schritte

- **Folgefragen besser suchen:** Die Suche nutzt nur die aktuelle Frage. Bei „Und wer hat es entworfen?“ könnte ein Modell die Frage vorher mit dem Verlauf umschreiben (ein Aufruf mehr).
- **Reranking:** Die 20 + 20 Treffer mit einem Reranking-Modell neu sortieren, bevor die besten 8 ans Modell gehen.
- **OCR** für gescannte PDFs.
- **Echte Warteschlange** statt `after()` für das Einlesen.
- Video, Mind Maps, Teilen, Teams/Workspaces, Lernquiz, Briefing.
