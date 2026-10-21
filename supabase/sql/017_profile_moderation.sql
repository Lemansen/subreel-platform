-- Admin moderation for opt-in public profiles, with an audit trail.
begin;

alter table public.profiles
 add column if not exists is_suspended boolean not null default false,
 add column if not exists suspension_reason text,
 add column if not exists moderated_at timestamptz,
 add column if not exists moderated_by uuid references auth.users(id) on delete set null;

alter table public.profiles drop constraint if exists profiles_suspension_reason_length;
alter table public.profiles
 add constraint profiles_suspension_reason_length
 check (suspension_reason is null or char_length(suspension_reason) <= 500);

drop policy if exists "Users can read own or public profiles" on public.profiles;
create policy "Users can read own or public profiles"
 on public.profiles for select to authenticated
 using ((select auth.uid()) = id or (is_public and not is_suspended));

drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
 on public.profiles for select to anon
 using (is_public and not is_suspended);

drop policy if exists "Catalog admins can read profiles for moderation" on public.profiles;
create policy "Catalog admins can read profiles for moderation"
 on public.profiles for select to authenticated
 using (((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'catalog_admin');

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
 on public.profiles for update to authenticated
 using ((select auth.uid()) = id)
 with check ((select auth.uid()) = id and not is_suspended);

alter table public.catalog_audit_log
 drop constraint if exists catalog_audit_log_entity_table_check;
alter table public.catalog_audit_log
 add constraint catalog_audit_log_entity_table_check
 check (entity_table in (
  'franchises', 'titles', 'title_relationships', 'genres', 'title_genres',
  'title_seasons', 'title_episodes', 'title_editions', 'title_volumes',
  'title_chapters', 'video_sources', 'reading_sources', 'profiles'
 ));

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
 if tg_table_name <> 'profiles'
    and auth.uid() is not null
    and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'catalog_admin' then
  raise exception 'catalog audit requires a catalog admin';
 end if;

 if tg_op = 'INSERT' then
  new_row := to_jsonb(new); row_data := new_row; event_action := 'insert';
 elsif tg_op = 'UPDATE' then
  old_row := to_jsonb(old); new_row := to_jsonb(new); row_data := new_row; event_action := 'update';
 else
  old_row := to_jsonb(old); row_data := old_row; event_action := 'delete';
 end if;

 event_id := coalesce(nullif(row_data ->> 'id', '')::uuid, nullif(row_data ->> 'title_id', '')::uuid);
 event_title_id := case
  when tg_table_name = 'titles' then event_id
  when tg_table_name = 'title_relationships' then nullif(row_data ->> 'source_title_id', '')::uuid
  else nullif(row_data ->> 'title_id', '')::uuid
 end;

 insert into public.catalog_audit_log(actor_id, entity_table, action, entity_id, title_id, before_data, after_data)
 values (auth.uid(), tg_table_name, event_action, event_id, event_title_id, old_row, new_row);
 if tg_op = 'DELETE' then return old; end if;
 return new;
end;
$$;

drop trigger if exists catalog_audit_log_changes on public.profiles;
create trigger catalog_audit_log_changes after insert or update or delete on public.profiles
 for each row execute function private.capture_catalog_audit();

create or replace function public.admin_set_profile_moderation(
 target_user_id uuid,
 suspend_profile boolean,
 reason_text text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
 if coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'catalog_admin' then
  raise exception 'catalog admin role required' using errcode = '42501';
 end if;
 if target_user_id is null or (reason_text is not null and char_length(reason_text) > 500) then
  raise exception 'invalid moderation input' using errcode = '22023';
 end if;

 update public.profiles
 set is_suspended = suspend_profile,
     is_public = case when suspend_profile then false else is_public end,
     suspension_reason = case when suspend_profile then nullif(trim(reason_text), '') else null end,
     moderated_at = now(),
     moderated_by = auth.uid(),
     updated_at = now()
 where id = target_user_id;
 if not found then raise exception 'profile not found' using errcode = 'P0002'; end if;
end;
$$;

revoke all on function public.admin_set_profile_moderation(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_profile_moderation(uuid, boolean, text) to authenticated;

commit;
