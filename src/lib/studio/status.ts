import { STUCK_AFTER_MS } from "@/lib/ingest/status";

// What the UI shows for a studio item: busy, ready or error.
export type StudioState = "busy" | "ready" | "error";

export const STUCK_MESSAGE = "Die Erstellung wurde abgebrochen. Bitte versuche es erneut.";

// A job that is still pending or processing after STUCK_AFTER_MS was stopped
// by the platform (maxDuration). It will never finish, so it counts as an
// error: the UI stops polling and the item may be deleted.
export function studioState(status: string, createdAt: string, now: Date): StudioState {
  if (status === "ready") return "ready";
  if (status === "error") return "error";
  const age = now.getTime() - new Date(createdAt).getTime();
  return age > STUCK_AFTER_MS ? "error" : "busy";
}
