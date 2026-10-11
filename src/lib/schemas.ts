import { z } from "zod";

// Every input from outside (forms, URL params) goes through one of these
// schemas before the app uses it. The messages are shown to the user,
// so they are in German.

export const signInSchema = z.object({
  email: z
    .string({ error: "Bitte gib deine E-Mail-Adresse ein." })
    .trim()
    .toLowerCase()
    .pipe(z.email("Bitte gib eine gültige E-Mail-Adresse ein.")),
  password: z
    .string({ error: "Bitte gib dein Passwort ein." })
    .min(1, "Bitte gib dein Passwort ein.")
    .max(200, "Das Passwort ist zu lang."),
});

// Same limits as the check constraint on notebooks.title (1 to 200 chars).
export const notebookTitleSchema = z
  .string({ error: "Bitte gib einen Titel ein." })
  .trim()
  .min(1, "Bitte gib einen Titel ein.")
  .max(200, "Der Titel darf höchstens 200 Zeichen lang sein.");

// Notebook ids come from the URL. Anything that is not a UUID is rejected
// before it reaches Postgres (which would answer with a type error).
export const notebookIdSchema = z.uuid();

export const renameNotebookSchema = z.object({
  notebookId: notebookIdSchema,
  title: notebookTitleSchema,
});

// Same limit as file_size_limit of the storage bucket "sources".
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

// What the browser tells us about a PDF before it uploads it.
// The bucket checks size and type again during the upload.
export const pdfUploadSchema = z.object({
  notebookId: z.uuid(),
  fileName: z.string().trim().min(1).max(255, "Der Dateiname ist zu lang."),
  fileSize: z
    .number()
    .int()
    .positive("Die Datei ist leer.")
    .max(MAX_UPLOAD_BYTES, "Die Datei ist größer als 20 MB."),
  fileType: z.literal("application/pdf", { error: "Bitte wähle eine PDF-Datei." }),
});

export const sourceIdSchema = z.uuid();

// Pasted text. 200,000 characters stay below the 1 MB body limit of
// Server Actions, even with many multi-byte characters (umlauts).
export const MAX_TEXT_CHARS = 200_000;

export const textSourceSchema = z.object({
  notebookId: z.uuid(),
  title: z
    .string({ error: "Bitte gib einen Titel ein." })
    .trim()
    .min(1, "Bitte gib einen Titel ein.")
    .max(500, "Der Titel darf höchstens 500 Zeichen lang sein."),
  text: z
    .string({ error: "Bitte füge einen Text ein." })
    .trim()
    .min(1, "Bitte füge einen Text ein.")
    .max(MAX_TEXT_CHARS, "Der Text ist länger als 200.000 Zeichen."),
});

// A web page. "example.com" without a scheme becomes "https://example.com".
// The full SSRF check (private addresses, DNS) runs when the page is fetched.
export const urlSourceSchema = z.object({
  notebookId: z.uuid(),
  url: z
    .string({ error: "Bitte gib eine Adresse ein." })
    .trim()
    .min(1, "Bitte gib eine Adresse ein.")
    .max(2000, "Die Adresse ist zu lang.")
    .transform((value) => (/^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`))
    .pipe(
      z.url({
        protocol: /^https?$/,
        error: "Bitte gib eine Adresse mit http:// oder https:// ein.",
      }),
    ),
});

// sources.meta is free JSON. Only these fields are read by the app.
export const sourceMetaSchema = z
  .object({ pages: z.number(), chunks: z.number(), url: z.string() })
  .partial();

// A chat question. The browser sends only the new question and the selected
// sources. The history comes from the database, so nobody can smuggle in a
// fake conversation.
export const MAX_QUESTION_CHARS = 2000;

export const chatRequestSchema = z.object({
  notebookId: z.uuid(),
  // A notebook with more than 100 sources is not realistic. The limit keeps
  // the request and the SQL array small.
  sourceIds: z.array(z.uuid()).max(100),
  question: z
    .string()
    .trim()
    .min(1, "Bitte stell eine Frage.")
    .max(MAX_QUESTION_CHARS, "Die Frage darf höchstens 2.000 Zeichen lang sein."),
});

// Create a studio item from the selected sources. The kinds grow with step 6
// (podcast follows).
export const studioRequestSchema = z.object({
  notebookId: z.uuid(),
  sourceIds: z.array(z.uuid()).min(1, "Bitte wähle mindestens eine Quelle aus.").max(100),
  kind: z.enum(["flashcards"]),
});

export const studioItemIdSchema = z.uuid();
