-- Append-only record of catalog-admin role change attempts.
begin;

create table if not exists public.admin_role_audit_log (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null,
 target_user_id uuid not null,
 target_email text,
 previous_role text,
 next_role text,
 outcome text not null default 'started' check (outcome in ('started', 'succeeded', 'failed')),
 failure_message text,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 constraint admin_role_audit_email_length check (target_email is null or char_length(target_email) <= 320),
 constraint admin_role_audit_failure_length check (failure_message is null or char_length(failure_message) <= 300)
);

create index if not exists admin_role_audit_created_at_idx
 on public.admin_role_audit_log(created_at desc);

alter table public.admin_role_audit_log enable row level security;
revoke all privileges on table public.admin_role_audit_log from anon, authenticated;
grant select on table public.admin_role_audit_log to authenticated;
grant select, insert, update on table public.admin_role_audit_log to service_role;

drop policy if exists "Catalog admins can read role audit log" on public.admin_role_audit_log;
create policy "Catalog admins can read role audit log"
 on public.admin_role_audit_log for select to authenticated
 using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');

commit;
