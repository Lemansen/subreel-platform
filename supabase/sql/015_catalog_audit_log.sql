-- Immutable, admin-readable audit trail for catalog mutations.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists public.catalog_audit_log (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 entity_table text not null check (entity_table in (
  'franchises', 'titles', 'title_relationships', 'genres', 'title_genres',
  'title_seasons', 'title_episodes', 'title_editions', 'title_volumes',
  'title_chapters', 'video_sources', 'reading_sources'
 )),
 action text not null check (action in ('insert', 'update', 'delete')),
 entity_id uuid not null,
 title_id uuid,
 before_data jsonb,
 after_data jsonb,
 created_at timestamptz not null default now()
);

create index if not exists catalog_audit_log_created_at_idx
 on public.catalog_audit_log(created_at desc);
create index if not exists catalog_audit_log_title_created_idx
 on public.catalog_audit_log(title_id, created_at desc)
 where title_id is not null;
create index if not exists catalog_audit_log_entity_created_idx
 on public.catalog_audit_log(entity_table, entity_id, created_at desc);
create index if not exists catalog_audit_log_actor_created_idx
 on public.catalog_audit_log(actor_id, created_at desc)
 where actor_id is not null;

alter table public.catalog_audit_log enable row level security;
revoke all privileges on table public.catalog_audit_log from anon, authenticated;
grant select on table public.catalog_audit_log to authenticated;
create policy "Catalog admins can read audit log"
 on public.catalog_audit_log for select to authenticated
 using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');

create or replace function private.capture_catalog_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
 old_row jsonb;
 new_row jsonb;
 row_data jsonb;
 event_action text;
 event_id uuid;
 event_title_id uuid;
begin
 -- Catalog writes from authenticated requests must carry the trusted admin role.
 -- Database maintenance writes without a user session are still captured.
 if auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'catalog_admin' then
  raise exception 'catalog audit requires a catalog admin';
 end if;

 if tg_op = 'INSERT' then
  new_row := to_jsonb(new);
  row_data := new_row;
  event_action := 'insert';
 elsif tg_op = 'UPDATE' then
  old_row := to_jsonb(old);
  new_row := to_jsonb(new);
  row_data := new_row;
  event_action := 'update';
 else
  old_row := to_jsonb(old);
  row_data := old_row;
  event_action := 'delete';
 end if;

 event_id := coalesce(nullif(row_data ->> 'id', '')::uuid, nullif(row_data ->> 'title_id', '')::uuid);
 event_title_id := case
  when tg_table_name = 'titles' then event_id
  when tg_table_name = 'title_relationships' then nullif(row_data ->> 'source_title_id', '')::uuid
  else nullif(row_data ->> 'title_id', '')::uuid
 end;

 insert into public.catalog_audit_log(actor_id, entity_table, action, entity_id, title_id, before_data, after_data)
 values (
  auth.uid(),
  tg_table_name,
  event_action,
  event_id,
  event_title_id,
  old_row,
  new_row
 );

 if tg_op = 'DELETE' then return old; end if;
 return new;
end;
$$;

revoke all on function private.capture_catalog_audit() from public, anon, authenticated;

drop trigger if exists catalog_audit_log_changes on public.franchises;
create trigger catalog_audit_log_changes after insert or update or delete on public.franchises for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.titles;
create trigger catalog_audit_log_changes after insert or update or delete on public.titles for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_relationships;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_relationships for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.genres;
create trigger catalog_audit_log_changes after insert or update or delete on public.genres for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_genres;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_genres for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_seasons;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_seasons for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_episodes;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_episodes for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_editions;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_editions for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_volumes;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_volumes for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.title_chapters;
create trigger catalog_audit_log_changes after insert or update or delete on public.title_chapters for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.video_sources;
create trigger catalog_audit_log_changes after insert or update or delete on public.video_sources for each row execute function private.capture_catalog_audit();
drop trigger if exists catalog_audit_log_changes on public.reading_sources;
create trigger catalog_audit_log_changes after insert or update or delete on public.reading_sources for each row execute function private.capture_catalog_audit();
