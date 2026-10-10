-- Supabase created public.rls_auto_enable() for the "Enable automatic RLS"
-- project option. It is SECURITY DEFINER and lives in the exposed schema, so
-- the Data API lists it as /rest/v1/rpc/rls_auto_enable.
-- It returns event_trigger, so Postgres refuses direct calls anyway.
-- We still remove EXECUTE, so the security advisor stays clean.
-- The event trigger keeps working: firing a trigger does not check EXECUTE.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
