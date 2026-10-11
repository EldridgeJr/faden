import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type ModelMessage,
} from "ai";
import { after } from "next/server";
import { CHAT_REASONING, chatModel, chatProviderOptions } from "@/lib/ai/models";
import { getUser } from "@/lib/auth";
import {
  findCitations,
  NO_ANSWER,
  stripCitations,
  type ChatMessage,
  type Citation,
} from "@/lib/chat/citations";
import { buildInstructions } from "@/lib/chat/prompt";
import { searchChunks } from "@/lib/chat/search";
import { allowChatRequest } from "@/lib/rate-limit";
import { chatRequestSchema } from "@/lib/schemas";

// Enough for a search and a streamed answer. The answer is short (8 chunks
// in, a few paragraphs out), usually done in a few seconds.
export const maxDuration = 60;

// How many earlier messages the model sees: the last 3 questions and answers.
// Enough for follow-up questions, small enough to keep the prompt cheap.
const HISTORY_MESSAGES = 6;

// Caps the cost of one answer. Reasoning tokens count as output, too.
const MAX_OUTPUT_TOKENS = 4000;

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// POST /api/chat
// Body: { notebookId, sourceIds, question }
// Answer: a UI message stream (server-sent events) for useChat.
export async function POST(request: Request) {
  // 1. Login. A route has no redirect to /login, it answers with 401.
  const { supabase, userId } = await getUser();
  if (!userId) return errorResponse("Bitte melde dich an.", 401);

  // 2. Input. Never trust the body: it can be anything.
  const body: unknown = await request.json().catch(() => null);
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? "Ungültige Anfrage.", 400);
  }
  const { notebookId, sourceIds, question } = parsed.data;
  if (sourceIds.length === 0) {
    return errorResponse("Bitte wähle mindestens eine Quelle aus.", 400);
  }

  // 3. Rate limit. Before any paid call (embedding, model).
  if (!(await allowChatRequest(userId))) {
    return errorResponse("Du hast gerade sehr viele Fragen gestellt. Bitte warte kurz.", 429);
  }

  // 4. Rights. RLS hides notebooks of other users, so a foreign notebook
  // looks like a missing one: 404, not 403.
  const { data: notebook, error: notebookError } = await supabase
    .from("notebooks")
    .select("id")
    .eq("id", notebookId)
    .maybeSingle();
  if (notebookError) throw notebookError;
  if (!notebook) return errorResponse("Notebook nicht gefunden.", 404);

  // 5. Only sources of this notebook that are ready. Ids from other
  // notebooks or sources that are still processing are dropped silently.
  const { data: sources, error: sourcesError } = await supabase
    .from("sources")
    .select("id")
    .eq("notebook_id", notebookId)
    .eq("status", "ready")
    .in("id", sourceIds);
  if (sourcesError) throw sourcesError;
  if (sources.length === 0) {
    return errorResponse("Bitte wähle mindestens eine bereite Quelle aus.", 400);
  }

  // 6. History: the last messages of this notebook, oldest first.
  // Read before the new question is saved, so it is not in there twice.
  const { data: lastMessages, error: historyError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("notebook_id", notebookId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);
  if (historyError) throw historyError;

  const history: ModelMessage[] = lastMessages.reverse().map((message) =>
    message.role === "assistant"
      ? { role: "assistant", content: stripCitations(message.content) }
      : { role: "user", content: message.content },
  );

  // 7. Search. The question alone, not the history (see NOTIZEN.md).
  const { chunks } = await searchChunks(supabase, {
    notebookId,
    sourceIds: sources.map((source) => source.id),
    question,
  });

  // The chunks in search order become [1] to [8].
  const citations: Citation[] = chunks.map((chunk, i) => ({
    n: i + 1,
    chunkId: chunk.id,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    page: chunk.page,
    position: chunk.position,
    content: chunk.content,
  }));

  // 8. Save the question.
  const { error: questionError } = await supabase
    .from("messages")
    .insert({ notebook_id: notebookId, role: "user", content: question });
  if (questionError) throw questionError;

  // Saves the answer with only the citations it really uses.
  // Numbers outside 1..8 are dropped by findCitations.
  async function saveAnswer(text: string) {
    const used = new Set(findCitations(text, citations.length));
    const { error } = await supabase.from("messages").insert({
      notebook_id: notebookId,
      role: "assistant",
      content: text,
      citations: citations.filter((citation) => used.has(citation.n)),
    });
    if (error) console.error("Saving the answer failed", error);
  }

  const stream = createUIMessageStream<ChatMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start" });

      // The citations go first, before any text. So the browser can turn
      // [1] into a button as soon as it arrives.
      writer.write({ type: "data-citations", id: "citations", data: citations });

      // Nothing found: the fixed sentence, without calling the model.
      if (chunks.length === 0) {
        writer.write({ type: "text-start", id: "answer" });
        writer.write({ type: "text-delta", id: "answer", delta: NO_ANSWER });
        writer.write({ type: "text-end", id: "answer" });
        await saveAnswer(NO_ANSWER);
        return;
      }

      const result = streamText({
        model: chatModel,
        reasoning: CHAT_REASONING,
        providerOptions: chatProviderOptions,
        instructions: buildInstructions(chunks),
        messages: [...history, { role: "user", content: question }],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        onEnd: async ({ text, totalUsage }) => {
          await saveAnswer(text);
          // Only numbers, no content: for cost tracking in the server log.
          console.info("chat answer", {
            inputTokens: totalUsage.inputTokens,
            outputTokens: totalUsage.outputTokens,
            reasoningTokens: totalUsage.outputTokenDetails.reasoningTokens,
          });
        },
      });

      // Read the model stream to the end, even if the browser goes away
      // (tab closed). Then onEnd runs and the answer is saved. after() keeps
      // the function alive until this is done.
      const finished = result.consumeStream();
      after(async () => {
        await finished;
      });

      writer.merge(toUIMessageStream({ stream: result.stream, sendStart: false }));
    },
    // Error details only go to the server log, never to the browser.
    onError: (error) => {
      console.error("Chat answer failed", error);
      return "Die Antwort ist fehlgeschlagen. Bitte versuche es noch einmal.";
    },
  });

  return createUIMessageStreamResponse({ stream });
}
