import type { NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { assembleChunks, type SourceText } from "@/lib/chat/assemble";
import { sourceIdSchema, sourceMetaSchema } from "@/lib/schemas";

// ?page=3 comes from the URL as text. coerce turns "3" into 3.
const pageSchema = z.coerce.number().int().positive();

function errorResponse(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

// GET /api/sources/[id]/text?page=3
// One page of a source for the citation view: the text of its chunks,
// without the overlap, and where every chunk is in that text.
// PDFs: the page from ?page. Text and web pages have no pages: no ?page,
// the whole text.
//
// A route, not a Server Action: Server Actions are made for changes and run
// one after the other. Reading data is a normal GET.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/sources/[id]/text">) {
  // 1. Login. A route answers with 401, it does not redirect.
  const { supabase, userId } = await getUser();
  if (!userId) return errorResponse("Bitte melde dich an.", 401);

  // 2. Input: the id from the path and the page from the query.
  const { id } = await ctx.params;
  const parsedId = sourceIdSchema.safeParse(id);
  if (!parsedId.success) return errorResponse("Diese Quelle gibt es nicht mehr.", 404);

  const pageParam = request.nextUrl.searchParams.get("page");
  const parsedPage = pageParam === null ? null : pageSchema.safeParse(pageParam);
  if (parsedPage && !parsedPage.success) return errorResponse("Ungültige Seite.", 400);
  const page = parsedPage ? parsedPage.data : null;

  // 3. Rights. RLS shows only sources in the user's notebooks. Foreign and
  // deleted sources look the same: 404.
  const { data: source, error: sourceError } = await supabase
    .from("sources")
    .select("id, title, type, status, meta")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!source) return errorResponse("Diese Quelle gibt es nicht mehr.", 404);
  if (source.status !== "ready") return errorResponse("Diese Quelle ist noch nicht bereit.", 409);

  // 4. The chunks of this page in reading order. RLS applies here too.
  const query = supabase
    .from("chunks")
    .select("id, content")
    .eq("source_id", source.id)
    .order("position");
  const { data: chunks, error: chunksError } = await (page === null
    ? query.is("page", null)
    : query.eq("page", page));
  if (chunksError) throw chunksError;

  const { text, ranges } = assembleChunks(chunks);
  const meta = sourceMetaSchema.safeParse(source.meta);
  const body: SourceText = {
    title: source.title,
    type: source.type,
    page,
    pageCount: meta.success ? (meta.data.pages ?? null) : null,
    text,
    ranges,
  };
  return Response.json(body);
}
