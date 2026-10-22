-- Admin-only provenance and audit records for catalog JSON imports.
begin;

create table if not exists public.catalog_external_ids (
 id uuid primary key default gen_random_uuid(),
 title_id uuid not null references public.titles(id) on delete cascade,
 provider text not null check (provider in ('anilist','tmdb','openlibrary','custom')),
 external_id text not null check (char_length(external_id) between 1 and 120),
 source_url text check (source_url is null or source_url ~* '^https://'),
 created_at timestamptz not null default now(),
 unique(provider,external_id),
 unique(provider,title_id)
);
create index if not exists catalog_external_ids_title_idx on public.catalog_external_ids(title_id);

create table if not exists public.catalog_import_jobs (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 status text not null default 'running' check (status in ('running','completed','partial','failed')),
 source_name text not null check (char_length(source_name) between 1 and 160),
 input_count integer not null default 0 check (input_count >= 0),
 created_count integer not null default 0 check (created_count >= 0),
 updated_count integer not null default 0 check (updated_count >= 0),
 skipped_count integer not null default 0 check (skipped_count >= 0),
 error_count integer not null default 0 check (error_count >= 0),
 created_at timestamptz not null default now(),
 completed_at timestamptz
);
create index if not exists catalog_import_jobs_created_idx on public.catalog_import_jobs(created_at desc);
create index if not exists catalog_import_jobs_actor_idx on public.catalog_import_jobs(actor_id,created_at desc);

create table if not exists public.catalog_import_job_errors (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.catalog_import_jobs(id) on delete cascade,
 row_number integer not null check (row_number > 0),
 external_id text,
 item_name text,
 message text not null check (char_length(message) between 1 and 1000),
 created_at timestamptz not null default now(),
 unique(job_id,row_number)
);
create index if not exists catalog_import_job_errors_job_idx on public.catalog_import_job_errors(job_id,row_number);

alter table public.catalog_external_ids enable row level security;
alter table public.catalog_import_jobs enable row level security;
alter table public.catalog_import_job_errors enable row level security;
revoke all on public.catalog_external_ids,public.catalog_import_jobs,public.catalog_import_job_errors from public,anon,authenticated;
grant select,insert,update,delete on public.catalog_external_ids,public.catalog_import_jobs,public.catalog_import_job_errors to authenticated;
grant all on public.catalog_external_ids,public.catalog_import_jobs,public.catalog_import_job_errors to service_role;

drop policy if exists "Catalog admins manage external IDs" on public.catalog_external_ids;
create policy "Catalog admins manage external IDs" on public.catalog_external_ids for all to authenticated
 using (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin')
 with check (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');
drop policy if exists "Catalog admins manage import jobs" on public.catalog_import_jobs;
create policy "Catalog admins manage import jobs" on public.catalog_import_jobs for all to authenticated
 using (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin')
 with check (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');
drop policy if exists "Catalog admins manage import errors" on public.catalog_import_job_errors;
create policy "Catalog admins manage import errors" on public.catalog_import_job_errors for all to authenticated
 using (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin')
 with check (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');

commit;
