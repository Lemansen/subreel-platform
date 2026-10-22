-- Prevent concurrent retries of one row and update the source job atomically.
begin;

alter table public.catalog_import_job_errors
  add column if not exists retry_started_at timestamptz;

create or replace function public.complete_catalog_import_retry(
  p_error_id uuid,
  p_created_count integer,
  p_updated_count integer,
  p_skipped_count integer
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  source_job_id uuid;
begin
  if p_created_count is null or p_created_count < 0
    or p_updated_count is null or p_updated_count < 0
    or p_skipped_count is null or p_skipped_count < 0 then
    raise exception 'Invalid retry counters';
  end if;

  delete from public.catalog_import_job_errors
  where id = p_error_id
  returning job_id into source_job_id;

  if source_job_id is null then
    return false;
  end if;

  update public.catalog_import_jobs
  set created_count = created_count + p_created_count,
      updated_count = updated_count + p_updated_count,
      skipped_count = skipped_count + p_skipped_count,
      error_count = greatest(error_count - 1, 0),
      status = case when error_count <= 1 then 'completed' else 'partial' end,
      completed_at = case when error_count <= 1 then now() else completed_at end
  where id = source_job_id
    and status in ('partial', 'failed');

  if not found then
    raise exception 'Source import job could not be updated';
  end if;

  return true;
end;
$$;

revoke all on function public.complete_catalog_import_retry(uuid, integer, integer, integer) from public, anon;
grant execute on function public.complete_catalog_import_retry(uuid, integer, integer, integer) to authenticated;

commit;
