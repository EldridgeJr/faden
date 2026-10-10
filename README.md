# Faden

Faden ist ein NotebookLM-Klon. Du lädst Quellen hoch (PDF, Webseite, Text) und stellst Fragen.
Faden antwortet **nur aus diesen Quellen** – mit klickbaren Belegen, die direkt zur Textstelle springen.

> Status: im Aufbau. Testprojekt für die Bewerbung als Junior Entwickler bei Everlast AI.

**Live:** <https://faden-one.vercel.app>

## Stack

- Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4
- Supabase (Postgres + pgvector, Storage, Auth, RLS)
- Vercel AI SDK · OpenAI (Embeddings, Text-to-Speech)
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

## Dokumentation

- `docs/erklaerungen/` – Erklärseite zu jedem Bauschritt (im Browser öffnen)
- `NOTIZEN.md` – Fehler, Annahmen und Entscheidungen während der Entwicklung

## Nächste Schritte

_folgt_
