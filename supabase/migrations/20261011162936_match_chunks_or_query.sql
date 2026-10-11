-- Full-text search: OR instead of AND.
--
-- websearch_to_tsquery joins all words with AND. For the question
-- "Wann ist Ruhezeit im Haus?" it builds 'wann' & 'ruhezeit' & 'haus'.
-- A chunk must contain every word, even "wann". For real questions this
-- almost never happens, so the full-text list stayed empty.
--
-- Now: websearch_to_tsquery still splits and stems the words, then every
-- " & " becomes " | " (OR). A chunk counts if it contains one of the words.
-- ts_rank_cd ranks chunks with more matching words higher.
-- The cast ::tsquery reads the lexemes as they are (no second stemming).

select '[1]'::extensions.vector; -- load pgvector, see the first migration

create or replace function public.match_chunks(
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
security invoker
set search_path = ''
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
  question as (
    select replace(websearch_to_tsquery('german', p_query_text)::text, ' & ', ' | ')::tsquery as query
  ),
  full_text as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, question.query) desc) as rank_ix
    from public.chunks c, question
    where c.notebook_id = p_notebook_id
      and c.source_id = any (p_source_ids)
      and c.fts @@ question.query
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
  order by score desc, c.id
  limit least(p_match_count, 20)
$$;
