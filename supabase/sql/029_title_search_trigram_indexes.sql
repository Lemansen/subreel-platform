-- Accelerate case-insensitive substring search used by /catalog (ILIKE %query%).
-- Run this migration in Supabase SQL Editor or through the project's migration workflow.
create extension if not exists pg_trgm with schema extensions;

create index if not exists titles_name_trgm_idx
  on public.titles using gin (name extensions.gin_trgm_ops);

create index if not exists titles_original_name_trgm_idx
  on public.titles using gin (original_name extensions.gin_trgm_ops)
  where original_name is not null;
