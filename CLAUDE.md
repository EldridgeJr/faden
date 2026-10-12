# Faden – NotebookLM-Klon

Testprojekt: eine Web-App nach dem Vorbild von NotebookLM.
Faden lässt Nutzer Quellen hochladen und beantwortet Fragen **nur aus diesen Quellen**, mit klickbaren Belegen, die direkt zur Textstelle springen.

## Abgabe
- Öffentliches GitHub-Repo mit gutem README
- Live-Deployment auf Vercel
- Loom-Video (max. 10 Min.): Vorgehen erklären und live testen
- Frist: 7 Tage ab 09.10.2026, Ziel: deutlich früher

## Wichtig für die Zusammenarbeit
- Ich muss jede Zeile im Repo selbst erklären können. **Erkläre bei jedem Schritt kurz, was du tust und warum.** Keine Magie, keine unnötigen Abstraktionen.
- Arbeite in kleinen Schritten. Vor größeren Änderungen erst einen Plan zeigen und auf mein Okay warten.
- Nach jedem Schritt: `npm run lint`, Typecheck und Tests laufen lassen, dann committen (klare Commit-Nachricht).
- Wenn du dir bei einer API unsicher bist (Versionen ändern sich), prüfe die aktuelle Doku, statt zu raten. Sag mir, wenn du unsicher bist.
- Nach jedem fertigen Schritt: Erklärseite erstellen (siehe unten).
- Trage in `NOTIZEN.md` ein, wenn etwas schiefging, eine Annahme falsch war oder du einen Fehler korrigieren musstest. Das ist mein Lerntagebuch.

## Erklärseite nach jedem Schritt
Wenn ein Schritt aus der Reihenfolge fertig ist, erstelle eine Erklärseite als HTML:
`docs/erklaerungen/schritt-<nr>-<thema>.html`, eine einzige Datei ohne externe Abhängigkeiten, die sich per Doppelklick im Browser öffnet.

Inhalt:
1. **Was jetzt funktioniert** – in 3 bis 5 Sätzen.
2. **Ablauf als Diagramm** – inline SVG: wie Daten durch Browser, Server, Supabase und OpenAI fließen, Pfeile beschriftet.
3. **Geänderte Dateien** – Tabelle: Datei, Aufgabe, warum sie so gebaut ist.
4. **Wichtigster Code** – 3 bis 5 Ausschnitte, jeweils kurz erklärt.
5. **Entscheidungen und Alternativen** – was wir gewählt haben und was die Alternative gewesen wäre.
6. **Was schiefgehen kann** – Grenzen, Fehlerfälle, Sicherheitsaspekte.
7. **Selbsttest** – 5 Verständnisfragen zum Schritt, Antworten zum Aufklappen.

Schreibstil: kurze, klare Sätze, ein Gedanke pro Satz, aktive Form, gleiche Begriffe für gleiche Dinge (etwa 80 % in Richtung ASD-STE100 / Simplified Technical English).

**Die Seiten sollen schön und interaktiv sein**, nicht nur Text:
- Gestaltung im Faden-Look (Farben, Radien und Schrift aus „Design“ unten), sorgfältige Typografie, viel Weißraum, hell und dunkel, auch auf dem Handy gut.
- Diagramm zum Durchklicken: Klick auf einen Schritt oder Pfeil hebt ihn hervor und zeigt Details. Dazu ein „Abspielen“-Knopf, der den Datenfluss Schritt für Schritt animiert.
- Code-Ausschnitte mit Syntax-Hervorhebung und Kopieren-Knopf; einzelne Zeilen anklickbar mit Erklärung.
- Interaktive Mini-Demos, wo es passt: z. B. Text eingeben und sehen, wie er in Abschnitte mit Überlappung zerfällt, oder wie RRF zwei Ranglisten zusammenführt.
- Selbsttest als Lernkarten: erst Frage, Klick zeigt Antwort, Fortschritt „x von 5 gewusst“.
- Sanfte Übergänge und Animationen, die `prefers-reduced-motion` respektieren.
- Alles in einer Datei: eigenes CSS und JavaScript inline, keine CDNs, funktioniert offline.
- Zusätzlich `docs/erklaerungen/index.html` als Übersicht aller Schritte, wird nach jedem Schritt aktualisiert.

## Umfang
**Muss**
- Notebooks anlegen, umbenennen, löschen
- Quellen: PDF, Webseite (URL), eingefügter Text. Status: wartet → in Arbeit → bereit / Fehler
- Gescannte PDFs ohne Text als Fehler erkennen und klar anzeigen
- Chat, der nur aus den ausgewählten Quellen antwortet, gestreamt
- Belege `[1]`, `[2]` in der Antwort, klickbar, springen zur markierten Stelle in der Quelle
- Fragen außerhalb der Quellen ehrlich ablehnen („Dazu habe ich in deinen Quellen nichts gefunden.“)
- Löschen einer Quelle entfernt Datei, Abschnitte und Embeddings

**Wow**
- Audio-Zusammenfassung als Podcast mit zwei Stimmen (Lea und Tom), mit Transkript und Belegen
- Ein Studio-Tool: Karteikarten (oder FAQ)

**Später (nur in README unter „Nächste Schritte“)**
Video, Mind Maps, Teilen, Teams/Workspaces, Lernquiz, Briefing, Reranking, OCR, echte Warteschlange.
Nicht bauen, solange der Muss-Teil nicht fertig und getestet ist.

## Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui, Icons: Lucide
- Supabase, Region Frankfurt: Postgres + pgvector, Storage, Auth, Row Level Security
- Vercel AI SDK für Chat und Streaming (`streamText`, `useChat`); Modell an einer Stelle konfigurierbar
- OpenAI: Embeddings `text-embedding-3-small` (1.536 Dimensionen)
- ElevenLabs (`eleven_v3`): Text-to-Speech für den Podcast, zwei deutsche Stimmen mit Audio-Tags
- Zod für alle Eingaben von außen (Requests, Tool-Argumente, Modell-JSON)
- Upstash Redis für Rate Limiting pro Nutzer
- Vitest für die Kernlogik, Playwright für einen End-to-End-Test

## Architektur
**Einlesen**
1. Browser holt eine signierte Upload-URL und lädt die Datei **direkt** in Supabase Storage (nicht durch die API-Route, Vercel Functions nehmen nur ca. 4,5 MB im Request an).
2. Verarbeitung: Text extrahieren → in Abschnitte teilen (ca. 800 Tokens, 15 % Überlappung, möglichst an Absätzen) → Embeddings gebündelt berechnen → in `chunks` speichern mit Seite und Position.
3. Status steht in der Datenbank, die Oberfläche zeigt den Fortschritt.

**Frage beantworten** (`/api/chat`)
1. Login und Eingabe prüfen (Zod), Rate Limit.
2. Frage einbetten.
3. Hybride Suche in Postgres: Vektorsuche (`<=>`, Kosinus) + Volltextsuche (`tsvector`, `websearch_to_tsquery('german', …)`), je Top 20, zusammengeführt mit Reciprocal Rank Fusion (k = 60) → Top 8.
4. Prompt: feste Regeln + nummerierte Abschnitte `[1]` bis `[8]`. Dokumenttext ist **Daten**, keine Anweisung (Prompt Injection).
5. Antwort streamen, Belegnummern serverseitig gegen die gelieferten Abschnitte prüfen.

**Podcast**
Skript aus den Quellen erzeugen (mit Belegen) → jeden Redebeitrag einzeln vertonen (zwei Stimmen) → zu einer MP3 zusammenfügen → in Storage speichern.

## Datenmodell (Startpunkt)
- `notebooks`: id, owner_id, title, created_at
- `sources`: id, notebook_id, type (pdf | url | text), title, status, storage_path, error, meta (jsonb)
- `chunks`: id, source_id, notebook_id, content, page, position, token_count, embedding vector(1536), fts tsvector
- `messages`: id, notebook_id, role, content, citations (jsonb)
- `studio_items`: id, notebook_id, kind (podcast | flashcards), status, data (jsonb), storage_path
- Fremdschlüssel mit `on delete cascade`. HNSW-Index mit `vector_cosine_ops`, GIN-Index auf `fts`.
- `notebook_id` steht bewusst auch in `chunks` (schneller Filter, RLS ohne Join).

## Sicherheit (nicht verhandelbar)
- RLS auf allen Tabellen, Policies mit `(select auth.uid())`.
- Secret-/Service-Role-Key nur auf dem Server, nie im Client, nie im Repo. `.env.example` pflegen.
- Jede Route und Server Action prüft Login, Eingaben und Rechte selbst.
- Modell-Ausgaben nie ungeprüft als HTML rendern (kein `dangerouslySetInnerHTML` mit Rohtext).
- Fremde Notebooks: 404, nicht 403.

## Design
Vorlage: Design-Artefakt „Faden“ (5 Screens: Startseite, Notebook mit Quellen · Chat · Studio, Quellen hinzufügen, Beleg-Ansicht, Audio-Zusammenfassung).
- Schrift: Geist (UI), Geist Mono (IDs, Zeiten, Zahlen) über `next/font/google`
- Farben: Hintergrund #E9EBEE · Fläche #F6F7F8 · Karte #FFFFFF · Kachel #F3F4F6 · Linie #E3E5E8 · Text #111315 · Grau #6B7078 · Akzent #D6EE57
- Status: Bereit #6E9A1C · In Arbeit #FDF0D5 / #8A5A00 · Fehler #FDE4DB / #A3361A
- Radien: Karte 28 · Kachel 18 · Buttons und Chips rund (999)
- Icons: Lucide, 1,8 px Strich
- Akzent (Lime) nur für Belege, Fortschritt und die wichtigste Aktion. Primäre Buttons sonst schwarz.
- UI-Texte auf Deutsch. Code, Variablen und Commits auf Englisch.

## Reihenfolge
- [x] 1. Next.js-Projekt aufsetzen (Hinweis: `create-next-app` bricht in Ordnern mit vorhandenen Dateien ab – in einen Unterordner erzeugen und die Dateien hierher verschieben, `CLAUDE.md` und `NOTIZEN.md` behalten), Git, GitHub, Vercel verbinden
- [x] 2. Supabase: Migration mit Tabellen, pgvector, Indizes, RLS; Supabase-Clients für Server und Browser
- [x] 3. Einlesen: Upload → Text → Abschnitte → Embeddings (zuerst mit einer PDF testen)
- [x] 4. Chat: hybride Suche, Prompt, Streaming, Belege
- [x] 5. UI nach dem Design: drei Spalten, Beleg-Ansicht, Quellen-Dialog
- [x] 6. Podcast + Karteikarten
- [x] 7. Tests (Vitest + Playwright), README, Demo-Notebook (Loom-Video: Aufnahme folgt)

## Befehle
Node 24 (`.nvmrc`). In der Claude-Shell vor npm-Befehlen `export PATH="$HOME/.nvm/versions/node/v24.21.0/bin:$PATH"` setzen.
- `npm run dev` – Entwicklungsserver (http://localhost:3000)
- `npm run build` – Produktions-Build
- `npm run lint` – ESLint
- `npm run typecheck` – `next typegen && tsc --noEmit`
- `npm test` – Vitest (einmaliger Lauf), `npm run test:watch` im Watch-Modus
- `npm run e2e` – Playwright (ab Schritt 7)

## Next.js 16
@AGENTS.md
