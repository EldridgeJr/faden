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
