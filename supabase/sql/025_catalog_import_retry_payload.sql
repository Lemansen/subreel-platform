-- Keep normalized, validated source data for retryable import row errors.
begin;

alter table public.catalog_import_job_errors
  add column if not exists payload jsonb;

comment on column public.catalog_import_job_errors.payload is
  'Validated catalog item from a failed row; null when the input failed schema validation.';

commit;
