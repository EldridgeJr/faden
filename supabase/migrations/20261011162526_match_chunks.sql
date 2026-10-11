-- Faden: hybrid search for the chat
--
-- match_chunks finds the best chunks for a question in two ways:
--   1. Vector search: chunks whose embedding is close to the question
--      embedding (cosine distance, <=>). Finds chunks with the same meaning.
--   2. Full-text search: chunks that contain the words of the question
--      (German stemming). Finds exact terms, names and numbers.
-- Each search returns its top 20. Reciprocal Rank Fusion (RRF) merges both
-- lists into one: score = 1 / (60 + rank in list 1) + 1 / (60 + rank in list 2).
-- A chunk that ranks high in both lists wins. The function returns the top 8.

-- Postgres only knows the setting hnsw.iterative_scan (used below) after the
-- pgvector library is loaded in this session. Unknown settings may only be
-- set by a superuser. Reading a vector value loads the library.
select '[1]'::extensions.vector;

create function public.match_chunks(
  p_notebook_id uuid,
  p_source_ids uuid[],
  p_query_embedding extensions.vector(1536),
  p_query_text text,
  p_match_count integer default 8
)
returns table (
  id bigint,
  source_id uuid,
  source_title text,
  content text,
  page integer,
  "position" integer,
  score double precision
)
language sql
stable
-- security invoker: the function runs with the rights of the caller.
-- So RLS applies, and a user only finds chunks of their own notebooks.
security invoker
-- Empty search path: every name below is written with its schema. Nobody can
-- change what a name means by creating an object with the same name.
set search_path = ''
-- HNSW first takes the ~40 nearest vectors of the whole table and filters
-- afterwards. With many notebooks, too few of them would belong to this
-- notebook. An iterative scan keeps searching until enough rows pass the
-- filter (pgvector 0.8+). "relaxed_order" may return them slightly out of
-- order, so we sort again below.
set hnsw.iterative_scan = relaxed_order
as $$
  with semantic as (
    select nearest.id, row_number() over (order by nearest.distance) as rank_ix
    from (
      select c.id, c.embedding operator(extensions.<=>) p_query_embedding as distance
      from public.chunks c
      where c.notebook_id = p_notebook_id
        and c.source_id = any (p_source_ids)
      order by distance
      limit 20
    ) nearest
  ),
  full_text as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, query) desc) as rank_ix
    from public.chunks c, websearch_to_tsquery('german', p_query_text) query
    where c.notebook_id = p_notebook_id
      and c.source_id = any (p_source_ids)
      and c.fts @@ query
    order by rank_ix
    limit 20
  )
  select
    c.id,
    c.source_id,
    s.title as source_title,
    c.content,
    c.page,
    c.position,
    coalesce(1.0 / (60 + semantic.rank_ix), 0.0)
      + coalesce(1.0 / (60 + full_text.rank_ix), 0.0) as score
  from semantic
  full outer join full_text on full_text.id = semantic.id
  join public.chunks c on c.id = coalesce(semantic.id, full_text.id)
  join public.sources s on s.id = c.source_id
  -- c.id as tie-breaker: the same question always gives the same order.
  order by score desc, c.id
  limit least(p_match_count, 20)
$$;

-- Functions are executable by PUBLIC by default. Only logged-in users may
-- search, and RLS limits them to their own notebooks.
revoke execute on function public.match_chunks from public, anon;
grant execute on function public.match_chunks to authenticated, service_role;
