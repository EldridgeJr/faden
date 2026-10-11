import { z } from "zod";
import { citationSchema, type ChatMessage } from "./citations";

// A row of the table messages, as the notebook page loads it.
export type MessageRow = {
  id: string;
  role: string;
  content: string;
  citations: unknown;
};

// messages.citations is jsonb. The database does not check its shape,
// so we do. A broken value means: no buttons, the text still shows.
const citationsSchema = z.array(citationSchema);

// Turns saved messages into the format of useChat, so the page shows the
// earlier conversation after a reload.
export function toChatMessages(rows: MessageRow[]): ChatMessage[] {
  return rows.map((row): ChatMessage => {
    if (row.role !== "assistant") {
      return { id: row.id, role: "user", parts: [{ type: "text", text: row.content }] };
    }
    const citations = citationsSchema.safeParse(row.citations);
    return {
      id: row.id,
      role: "assistant",
      parts: [
        { type: "data-citations", id: "citations", data: citations.success ? citations.data : [] },
        { type: "text", text: row.content },
      ],
    };
  });
}
