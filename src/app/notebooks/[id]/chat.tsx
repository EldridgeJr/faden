"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import {
  splitCitations,
  type ChatMessage,
  type Citation,
} from "@/lib/chat/citations";
import { MAX_QUESTION_CHARS } from "@/lib/schemas";

type ReadySource = { id: string; title: string };

const GENERIC_ERROR = "Die Antwort ist fehlgeschlagen. Bitte versuche es noch einmal.";

// The route answers errors as JSON: { "error": "…" }. useChat puts the raw
// body into error.message. We show only that text, never other details.
function errorText(error: Error): string {
  try {
    const body: unknown = JSON.parse(error.message);
    if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Not JSON: a network error or an error inside the stream.
  }
  return GENERIC_ERROR;
}

export function Chat({
  notebookId,
  sources,
  initialMessages,
}: {
  notebookId: string;
  sources: ReadySource[];
  initialMessages: ChatMessage[];
}) {
  // We store the sources the user switched OFF, not the ones that are on.
  // So a source that becomes ready later is selected automatically.
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const selectedIds = sources.filter((s) => !excluded.has(s.id)).map((s) => s.id);

  const [input, setInput] = useState("");
  // The citation that is open: which answer and which number.
  const [open, setOpen] = useState<{ messageId: string; n: number } | null>(null);

  // The transport sends only what the route needs: the new question and the
  // selected sources. The history stays on the server (see route.ts).
  const [transport] = useState(
    () =>
      new DefaultChatTransport<ChatMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, body }) => {
          const last = messages[messages.length - 1];
          const question = last.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
          return { body: { notebookId, sourceIds: body?.sourceIds ?? [], question } };
        },
      }),
  );

  const { messages, sendMessage, status, error, stop } = useChat<ChatMessage>({
    id: notebookId,
    messages: initialMessages,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const canSend = !busy && input.trim().length > 0 && selectedIds.length > 0;

  function send() {
    if (!canSend) return;
    sendMessage({ text: input.trim() }, { body: { sourceIds: selectedIds } });
    setInput("");
  }

  function toggleSource(id: string) {
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {sources.length === 0 ? (
        <p className="text-muted-foreground">Sobald eine Quelle bereit ist, kannst du Fragen stellen.</p>
      ) : (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-sm text-muted-foreground">Antworten nur aus diesen Quellen:</legend>
          {sources.map((source) => {
            const checked = !excluded.has(source.id);
            return (
              <label
                key={source.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm ${
                  checked ? "border-foreground bg-card" : "border-border text-muted-foreground"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSource(source.id)}
                  className="accent-foreground"
                />
                <span className="max-w-60 truncate">{source.title}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      <ol className="flex flex-col gap-3">
        {messages.map((message) => (
          <li key={message.id}>
            {message.role === "user" ? (
              <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-tile bg-primary px-4 py-3 text-primary-foreground">
                {message.parts.map((part) => (part.type === "text" ? part.text : "")).join("")}
              </p>
            ) : (
              <Answer
                message={message}
                openNumber={open?.messageId === message.id ? open.n : null}
                onToggle={(n) =>
                  setOpen((current) =>
                    current?.messageId === message.id && current.n === n
                      ? null
                      : { messageId: message.id, n },
                  )
                }
              />
            )}
          </li>
        ))}
      </ol>

      {status === "submitted" && (
        <p className="text-sm text-muted-foreground">Faden sucht in deinen Quellen …</p>
      )}
      {error && (
        <p role="alert" className="rounded-tile bg-error px-4 py-3 text-sm text-error-foreground">
          {errorText(error)}
        </p>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
        className="flex items-end gap-2 rounded-tile bg-card p-2"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter makes a new line.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
          maxLength={MAX_QUESTION_CHARS}
          rows={2}
          placeholder="Frag etwas zu deinen Quellen …"
          aria-label="Frage"
          className="min-h-12 flex-1 resize-none bg-transparent px-3 py-2 outline-none"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => stop()}
            className="rounded-full border border-border px-4 py-2 text-sm"
          >
            Stopp
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-40"
          >
            Senden
          </button>
        )}
      </form>
    </div>
  );
}

// One answer: text with [n] as buttons, and the open citation below it.
function Answer({
  message,
  openNumber,
  onToggle,
}: {
  message: ChatMessage;
  openNumber: number | null;
  onToggle: (n: number) => void;
}) {
  const citations: Citation[] = message.parts.flatMap((part) =>
    part.type === "data-citations" ? part.data : [],
  );
  const text = message.parts.map((part) => (part.type === "text" ? part.text : "")).join("");
  const segments = splitCitations(text, new Set(citations.map((c) => c.n)));
  const openCitation = citations.find((c) => c.n === openNumber);

  return (
    <div className="flex max-w-[85%] flex-col gap-2">
      {/* Plain text only. React escapes it, so model output never becomes HTML. */}
      <p className="whitespace-pre-wrap rounded-tile bg-card px-4 py-3">
        {segments.map((segment, i) =>
          segment.type === "text" ? (
            <span key={i}>{segment.text}</span>
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => onToggle(segment.n)}
              aria-expanded={openNumber === segment.n}
              className={`mx-0.5 rounded-full px-1.5 font-mono text-xs align-super ${
                openNumber === segment.n ? "bg-primary text-highlight" : "bg-highlight text-foreground"
              }`}
            >
              {segment.n}
            </button>
          ),
        )}
      </p>
      {openCitation && (
        <blockquote className="rounded-tile border border-border bg-surface px-4 py-3 text-sm">
          <p className="mb-2 font-medium">
            [{openCitation.n}] {openCitation.sourceTitle}
            {openCitation.page !== null && (
              <span className="font-mono text-muted-foreground"> · Seite {openCitation.page}</span>
            )}
          </p>
          <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-muted-foreground">
            {openCitation.content}
          </p>
        </blockquote>
      )}
    </div>
  );
}
