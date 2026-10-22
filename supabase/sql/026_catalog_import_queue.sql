-- Persist validated import packages and resumable queue progress.
begin;

alter table public.catalog_import_jobs
  drop constraint if exists catalog_import_jobs_status_check;

alter table public.catalog_import_jobs
  add constraint catalog_import_jobs_status_check
  check (status in ('queued', 'running', 'completed', 'partial', 'failed'));

alter table public.catalog_import_jobs
  add column if not exists payload jsonb,
  add column if not exists next_row integer not null default 1,
  add column if not exists lease_owner uuid,
  add column if not exists lease_until timestamptz;

alter table public.catalog_import_jobs
  add constraint catalog_import_jobs_payload_array_check
  check (payload is null or jsonb_typeof(payload) = 'array');

create index if not exists catalog_import_jobs_queue_idx
  on public.catalog_import_jobs(status, created_at)
  where status in ('queued', 'running');

commit;
