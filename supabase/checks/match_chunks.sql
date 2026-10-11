-- Check for public.match_chunks (hybrid search).
--
-- Run it like rls.sql: Supabase SQL editor or Supabase MCP (execute_sql).
-- One transaction, ends with ROLLBACK. A failed check stops the script with
-- an error that names the check.
--
-- The embeddings are hand-made, so the vector ranking is predictable:
-- e(k) is a vector with 1 at position k and 0 everywhere else. Two equal
-- vectors have cosine distance 0, two different e(k) have distance 1.

begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'search-test-a@faden.test'),
  ('00000000-0000-0000-0000-00000000000b', 'search-test-b@faden.test');

do $$
declare
  user_a constant uuid := '00000000-0000-0000-0000-00000000000a';
  user_b constant uuid := '00000000-0000-0000-0000-00000000000b';
  e1 extensions.vector;
  e2 extensions.vector;
  e3 extensions.vector;
  e4 extensions.vector;
  nb uuid;
  nb_other uuid;
  src_1 uuid;
  src_2 uuid;
  src_other uuid;
  c_best bigint;
  c_text bigint;
  c_far bigint;
  c_src2 bigint;
  c_other bigint;
  ids bigint[];
  n integer;
  failed boolean;
begin
  select array_agg(case when i = 1 then 1 else 0 end order by i)::extensions.vector into e1 from generate_series(1, 1536) i;
  select array_agg(case when i = 2 then 1 else 0 end order by i)::extensions.vector into e2 from generate_series(1, 1536) i;
  select array_agg(case when i = 3 then 1 else 0 end order by i)::extensions.vector into e3 from generate_series(1, 1536) i;
  select array_agg(case when i = 4 then 1 else 0 end order by i)::extensions.vector into e4 from generate_series(1, 1536) i;

  -- -------------------------------------------------------------------------
  -- As user A: two notebooks, the first one with two sources
  -- -------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  insert into public.notebooks (title) values ('A: Hausordnung') returning id into nb;
  insert into public.notebooks (title) values ('A: anderes') returning id into nb_other;
  insert into public.sources (notebook_id, type, title) values (nb, 'text', 'Quelle 1') returning id into src_1;
  insert into public.sources (notebook_id, type, title) values (nb, 'text', 'Quelle 2') returning id into src_2;
  insert into public.sources (notebook_id, type, title) values (nb_other, 'text', 'Fremd') returning id into src_other;

  -- Same direction as the question, and contains the word twice (so it also
  -- ranks first in the full-text list): best in both lists.
  insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
    values (src_1, nb, 'Die Mülltonnen stehen im Hof. Mülltonnen bitte schließen.', 0, 12, e1)
    returning id into c_best;
  -- Contains the word, but another direction.
  insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
    values (src_1, nb, 'Nach 22 Uhr die Mülltonnen leise schließen.', 1, 10, e2) returning id into c_text;
  -- Neither the word nor the direction.
  insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
    values (src_1, nb, 'Fahrräder gehören in den Keller.', 2, 8, e3) returning id into c_far;
  -- Second source of the same notebook.
  insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
    values (src_2, nb, 'Die Mülltonnen werden dienstags geleert.', 0, 9, e4) returning id into c_src2;
  -- Perfect match, but in another notebook: must never appear.
  insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
    values (src_other, nb_other, 'Mülltonnen, Mülltonnen, Mülltonnen.', 0, 6, e1) returning id into c_other;

  -- All sources of the notebook.
  select array_agg(id order by score desc, id) into ids
    from public.match_chunks(nb, array[src_1, src_2], e1, 'Mülltonnen');
  assert cardinality(ids) = 4, format('expected 4 results, got %s', cardinality(ids));
  assert ids[1] = c_best, 'chunk that wins both searches is not first';
  assert ids[4] = c_far, 'chunk without word and direction is not last';
  assert not c_other = any (ids), 'chunk of another notebook was found';

  -- Only the first source is selected.
  select array_agg(id) into ids
    from public.match_chunks(nb, array[src_1], e1, 'Mülltonnen');
  assert cardinality(ids) = 3, 'source filter does not work';
  assert not c_src2 = any (ids), 'chunk of an unselected source was found';

  -- No source selected: nothing.
  select count(*) into n from public.match_chunks(nb, array[]::uuid[], e1, 'Mülltonnen');
  assert n = 0, 'empty source list returned chunks';

  -- No word matches: the vector search alone still finds chunks.
  select array_agg(id order by score desc, id) into ids
    from public.match_chunks(nb, array[src_1], e1, 'Xylophon');
  assert cardinality(ids) = 3, 'vector search alone finds nothing';
  assert ids[1] = c_best, 'vector search alone has the wrong order';

  -- A real question: "wann" and "geleert" are not in every chunk. With AND,
  -- the full-text list would be empty. With OR it finds the Mülltonnen chunks.
  -- The vector points to the bicycle chunk (e3), so it wins the vector list.
  -- It must still end up last, because it is in only one list.
  select array_agg(id order by score desc, id) into ids
    from public.match_chunks(nb, array[src_1, src_2], e3, 'Wann werden die Mülltonnen geleert?');
  assert cardinality(ids) = 4, 'question with many words: wrong count';
  assert ids[4] = c_far, 'full-text search ignores questions with extra words (AND instead of OR?)';

  -- Empty question text: no error, the vector search still works.
  select count(*) into n from public.match_chunks(nb, array[src_1], e1, '');
  assert n = 3, 'empty question text breaks the search';

  -- The limit works, and it is capped at 20.
  select count(*) into n from public.match_chunks(nb, array[src_1, src_2], e1, 'Mülltonnen', 2);
  assert n = 2, 'match_count is ignored';

  -- -------------------------------------------------------------------------
  -- As user B: A's notebook gives nothing (RLS, because security invoker)
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.match_chunks(nb, array[src_1, src_2], e1, 'Mülltonnen');
  assert n = 0, 'B finds chunks in A''s notebook';

  -- -------------------------------------------------------------------------
  -- As anon: may not call the function at all
  -- -------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  failed := false;
  begin
    perform public.match_chunks(nb, array[src_1], e1, 'Mülltonnen');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'anon may call match_chunks';

  raise notice 'match_chunks: all checks passed';
end;
$$;

-- Only reached if every assert above passed.
select 'all checks passed' as result;

rollback;
