-- Faden: initial schema
-- Tables, pgvector, indexes, row level security, storage bucket.
--
-- Access model:
--   A user owns notebooks. Everything else belongs to a notebook.
--   Two layers protect every table:
--     1. GRANT decides which role may use a table at all (anon gets nothing).
--     2. RLS policies decide which rows that role may see or change.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- pgvector stores embeddings and compares them (cosine distance: <=>).
create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  -- auth.uid() as default: the client does not need to send owner_id.
  -- The insert policy rejects any other value.
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  created_at timestamptz not null default now()
);

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  type text not null check (type in ('pdf', 'url', 'text')),
  title text not null check (char_length(title) between 1 and 500),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'error')),
  storage_path text,
  error text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  -- Target for the composite foreign key in chunks (see below).
  unique (id, notebook_id)
);

create table public.chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null,
  -- Copied from the source on purpose: search and RLS filter by notebook
  -- without a join through sources.
  notebook_id uuid not null,
  content text not null,
  page integer check (page > 0),
  position integer not null check (position >= 0),
  token_count integer not null check (token_count > 0),
  embedding extensions.vector(1536) not null,
  -- Postgres keeps this column up to date itself. No trigger needed.
  fts tsvector generated always as (to_tsvector('german', content)) stored,
  -- The pair (source_id, notebook_id) must exist in sources. So the copied
  -- notebook_id can never disagree with the notebook of the source.
  foreign key (source_id, notebook_id)
    references public.sources (id, notebook_id) on delete cascade,
  unique (source_id, position)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.studio_items (
  id uuid primary key default gen_random_uuid(),
  notebook_id uuid not null references public.notebooks (id) on delete cascade,
  kind text not null check (kind in ('podcast', 'flashcards')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'ready', 'error')),
  data jsonb not null default '{}'::jsonb,
  storage_path text,
  error text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Lists and foreign keys. Without an index, "on delete cascade" and the
-- RLS subquery would scan whole tables.
create index notebooks_owner_id_created_at_idx on public.notebooks (owner_id, created_at desc);
create index sources_notebook_id_idx on public.sources (notebook_id);
create index chunks_notebook_id_idx on public.chunks (notebook_id);
create index chunks_source_id_notebook_id_idx on public.chunks (source_id, notebook_id);
create index messages_notebook_id_created_at_idx on public.messages (notebook_id, created_at);
create index studio_items_notebook_id_idx on public.studio_items (notebook_id);

-- Vector search: HNSW graph, cosine distance (matches the <=> operator).
create index chunks_embedding_idx on public.chunks
  using hnsw (embedding extensions.vector_cosine_ops);

-- Full-text search on the generated tsvector column.
create index chunks_fts_idx on public.chunks using gin (fts);

-- ---------------------------------------------------------------------------
-- Grants (layer 1)
-- ---------------------------------------------------------------------------

-- "Automatically expose new tables" is off in this project. New tables only
-- get default privileges like TRUNCATE. We remove them and grant exactly
-- what the app needs. anon (not logged in) gets nothing.
revoke all on public.notebooks, public.sources, public.chunks,
  public.messages, public.studio_items from anon, authenticated;

grant select, insert, update, delete
  on public.notebooks, public.sources, public.studio_items to authenticated;

-- Chunks and messages are never edited, only written and deleted.
grant select, insert, delete on public.chunks, public.messages to authenticated;

-- The server (secret key) needs full access for background processing.
grant all on public.notebooks, public.sources, public.chunks,
  public.messages, public.studio_items to service_role;

-- ---------------------------------------------------------------------------
-- Row level security (layer 2)
-- ---------------------------------------------------------------------------

-- The project also enables RLS automatically (event trigger). We enable it
-- here anyway, so the migration is correct on its own.
alter table public.notebooks enable row level security;
alter table public.sources enable row level security;
alter table public.chunks enable row level security;
alter table public.messages enable row level security;
alter table public.studio_items enable row level security;

-- (select auth.uid()) instead of auth.uid(): Postgres calls the function
-- once per query, not once per row.

-- notebooks: the owner may do everything with their own notebooks.
create policy "notebooks: owner can select" on public.notebooks
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "notebooks: owner can insert" on public.notebooks
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "notebooks: owner can update" on public.notebooks
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "notebooks: owner can delete" on public.notebooks
  for delete to authenticated
  using (owner_id = (select auth.uid()));

-- All other tables: the row must belong to a notebook of the user.
-- "notebook_id in (subquery)" runs the subquery once, not once per row.

-- sources
create policy "sources: owner can select" on public.sources
  for select to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "sources: owner can insert" on public.sources
  for insert to authenticated
  with check (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "sources: owner can update" on public.sources
  for update to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())))
  with check (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "sources: owner can delete" on public.sources
  for delete to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

-- chunks
create policy "chunks: owner can select" on public.chunks
  for select to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "chunks: owner can insert" on public.chunks
  for insert to authenticated
  with check (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "chunks: owner can delete" on public.chunks
  for delete to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

-- messages
create policy "messages: owner can select" on public.messages
  for select to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "messages: owner can insert" on public.messages
  for insert to authenticated
  with check (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "messages: owner can delete" on public.messages
  for delete to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

-- studio_items
create policy "studio_items: owner can select" on public.studio_items
  for select to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "studio_items: owner can insert" on public.studio_items
  for insert to authenticated
  with check (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "studio_items: owner can update" on public.studio_items
  for update to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())))
  with check (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

create policy "studio_items: owner can delete" on public.studio_items
  for delete to authenticated
  using (notebook_id in (select id from public.notebooks where owner_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Storage: private bucket for uploaded source files
-- ---------------------------------------------------------------------------

-- Path convention: <notebook_id>/<source_id>.<ext>
-- The first folder decides who may access the file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sources', 'sources', false, 20971520, array['application/pdf', 'text/plain']);

create policy "sources bucket: owner can select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.notebooks where owner_id = (select auth.uid())
    )
  );

create policy "sources bucket: owner can insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.notebooks where owner_id = (select auth.uid())
    )
  );

create policy "sources bucket: owner can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.notebooks where owner_id = (select auth.uid())
    )
  );
