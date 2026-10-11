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

// sources.meta is free JSON. Only these fields are read by the UI.
export const sourceMetaSchema = z
  .object({ pages: z.number(), chunks: z.number() })
  .partial();
