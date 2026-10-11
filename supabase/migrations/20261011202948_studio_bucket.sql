-- Storage: private bucket for generated studio files (podcast MP3s).
--
-- Path convention: <notebook_id>/<studio_item_id>.mp3
-- The first folder decides who may access the file, as in the sources bucket.
--
-- 25 MB: a 5-minute podcast at 128 kbit/s is about 5 MB. The limit leaves
-- room for longer episodes and stops anything far bigger.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('studio', 'studio', false, 26214400, array['audio/mpeg']);

-- Read: needed to create a signed URL for the audio player.
create policy "studio bucket: owner can select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'studio'
    and (storage.foldername(name))[1] in (
      select id::text from public.notebooks where owner_id = (select auth.uid())
    )
  );

-- Delete: when the user deletes a studio item or a notebook.
create policy "studio bucket: owner can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'studio'
    and (storage.foldername(name))[1] in (
      select id::text from public.notebooks where owner_id = (select auth.uid())
    )
  );

-- No insert policy on purpose: only the server writes here, with the secret
-- key, which bypasses RLS. A user cannot upload own files into this bucket.
