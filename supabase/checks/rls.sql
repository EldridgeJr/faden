-- RLS check: two users must never see or change each other's data.
--
-- Run it in the Supabase SQL editor or with the Supabase MCP (execute_sql).
-- Everything happens inside one transaction and ends with ROLLBACK,
-- so the database stays unchanged. A failed check stops the script with
-- an error that names the check.
--
-- How the script acts as a user: it switches the role to "authenticated" and
-- sets the JWT claims. auth.uid() reads the user id from these claims. This
-- is the same thing the Data API does for every request.

begin;

-- Two test users with fixed ids.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'rls-test-a@faden.test'),
  ('00000000-0000-0000-0000-00000000000b', 'rls-test-b@faden.test');

do $$
declare
  user_a constant uuid := '00000000-0000-0000-0000-00000000000a';
  user_b constant uuid := '00000000-0000-0000-0000-00000000000b';
  nb_a uuid;
  nb_a2 uuid;
  src_a uuid;
  n integer;
  failed boolean;
begin
  -- -------------------------------------------------------------------------
  -- As user A: create data
  -- -------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  assert current_user = 'authenticated', 'role switch did not work';

  insert into public.notebooks (title) values ('A: first') returning id into nb_a;
  insert into public.notebooks (title) values ('A: second') returning id into nb_a2;

  select count(*) into n from public.notebooks where id = nb_a and owner_id = user_a;
  assert n = 1, 'owner_id default is not auth.uid()';

  insert into public.sources (notebook_id, type, title)
    values (nb_a, 'text', 'A: source') returning id into src_a;

  insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
    values (src_a, nb_a, 'Der Faden verbindet Quellen.', 0, 6,
            array_fill(0.1::real, array[1536])::extensions.vector);

  insert into public.messages (notebook_id, role, content) values (nb_a, 'user', 'Frage');
  insert into public.studio_items (notebook_id, kind) values (nb_a, 'flashcards');
  insert into storage.objects (bucket_id, name) values ('sources', nb_a || '/' || src_a || '.txt');

  select count(*) into n from public.chunks;
  assert n = 1, 'A does not see own chunk';

  -- The fts column fills itself. German stemming: "Quellen" and "Quelle" both
  -- become "quell". (Not every form works: "verbindet" stays "verbindet".)
  select count(*) into n from public.chunks where fts @@ websearch_to_tsquery('german', 'Quelle');
  assert n = 1, 'full-text search does not find own chunk';

  -- Chunk with a notebook_id that does not match its source: composite FK blocks it.
  failed := false;
  begin
    insert into public.chunks (source_id, notebook_id, content, position, token_count, embedding)
      values (src_a, nb_a2, 'falsch', 1, 1, array_fill(0.1::real, array[1536])::extensions.vector);
  exception when foreign_key_violation then failed := true;
  end;
  assert failed, 'chunk with wrong notebook_id was accepted';

  -- File in a folder that is not one of A's notebooks.
  failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('sources', gen_random_uuid() || '/x.txt');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'A could upload into a foreign folder';

  -- -------------------------------------------------------------------------
  -- As user B: A's data must be invisible and unchangeable
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.notebooks;    assert n = 0, 'B sees A''s notebooks';
  select count(*) into n from public.sources;      assert n = 0, 'B sees A''s sources';
  select count(*) into n from public.chunks;       assert n = 0, 'B sees A''s chunks';
  select count(*) into n from public.messages;     assert n = 0, 'B sees A''s messages';
  select count(*) into n from public.studio_items; assert n = 0, 'B sees A''s studio items';
  select count(*) into n from storage.objects where bucket_id = 'sources';
  assert n = 0, 'B sees A''s files';

  update public.notebooks set title = 'gehackt' where id = nb_a;
  get diagnostics n = row_count;
  assert n = 0, 'B could rename A''s notebook';

  delete from public.sources where id = src_a;
  get diagnostics n = row_count;
  assert n = 0, 'B could delete A''s source';

  failed := false;
  begin
    insert into public.sources (notebook_id, type, title) values (nb_a, 'text', 'B: fremd');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'B could add a source to A''s notebook';

  failed := false;
  begin
    insert into public.notebooks (owner_id, title) values (user_a, 'B: als A');
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'B could create a notebook in A''s name';

  -- -------------------------------------------------------------------------
  -- As anon (not logged in): no access at all
  -- -------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);

  failed := false;
  begin
    select count(*) into n from public.notebooks;
  exception when insufficient_privilege then failed := true;
  end;
  assert failed, 'anon can read notebooks';

  -- -------------------------------------------------------------------------
  -- Back to A: deleting a source removes its chunks (on delete cascade)
  -- -------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_a, 'role', 'authenticated')::text, true);

  delete from public.sources where id = src_a;
  select count(*) into n from public.chunks;
  assert n = 0, 'chunks survived the deletion of their source';

  raise notice 'RLS check: all checks passed';
end;
$$;

select 'RLS check: all checks passed' as result;

rollback;
