-- Private user reports and profile moderation appeals.
begin;

create table if not exists public.content_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 target_type text not null check (target_type in ('title','profile')),
 target_id uuid not null,
 category text not null check (category in ('incorrect_info','copyright','harassment','privacy','spam','other')),
 description text not null check (char_length(trim(description)) between 10 and 2000),
 status text not null default 'open' check (status in ('open','in_review','resolved','dismissed')),
 moderator_id uuid references auth.users(id) on delete set null,
 resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
 moderated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index if not exists content_reports_one_active_target_per_user_uidx
 on public.content_reports(reporter_id,target_type,target_id)
 where status in ('open','in_review');
create index if not exists content_reports_status_created_idx
 on public.content_reports(status,created_at desc);
create index if not exists content_reports_target_idx
 on public.content_reports(target_type,target_id);

create table if not exists public.moderation_appeals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check (char_length(trim(reason)) between 20 and 2000),
 status text not null default 'open' check (status in ('open','in_review','accepted','rejected')),
 moderator_id uuid references auth.users(id) on delete set null,
 resolution_note text check (resolution_note is null or char_length(resolution_note) <= 2000),
 moderated_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create unique index if not exists moderation_appeals_one_active_per_user_uidx
 on public.moderation_appeals(user_id) where status in ('open','in_review');
create index if not exists moderation_appeals_status_created_idx
 on public.moderation_appeals(status,created_at desc);

alter table public.catalog_audit_log drop constraint if exists catalog_audit_log_entity_table_check;
alter table public.catalog_audit_log add constraint catalog_audit_log_entity_table_check
 check (entity_table in ('franchises','titles','title_relationships','genres','title_genres','title_seasons','title_episodes','title_editions','title_volumes','title_chapters','video_sources','reading_sources','profiles','content_reports','moderation_appeals'));

create or replace function private.capture_user_moderation_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare old_row jsonb; new_row jsonb; event_action text; row_data jsonb; event_id uuid;
begin
 if tg_op='INSERT' then new_row:=to_jsonb(new);row_data:=new_row;event_action:='insert';
 elsif tg_op='UPDATE' then old_row:=to_jsonb(old);new_row:=to_jsonb(new);row_data:=new_row;event_action:='update';
 else old_row:=to_jsonb(old);row_data:=old_row;event_action:='delete';end if;
 event_id:=nullif(row_data->>'id','')::uuid;
 insert into public.catalog_audit_log(actor_id,entity_table,action,entity_id,title_id,before_data,after_data)
 values(auth.uid(),tg_table_name,event_action,event_id,case when tg_table_name='content_reports' and row_data->>'target_type'='title' then nullif(row_data->>'target_id','')::uuid else null end,old_row,new_row);
 if tg_op='DELETE' then return old;end if;return new;
end;
$$;
drop trigger if exists content_reports_audit on public.content_reports;
create trigger content_reports_audit after insert or update or delete on public.content_reports for each row execute function private.capture_user_moderation_audit();
drop trigger if exists moderation_appeals_audit on public.moderation_appeals;
create trigger moderation_appeals_audit after insert or update or delete on public.moderation_appeals for each row execute function private.capture_user_moderation_audit();

alter table public.content_reports enable row level security;
alter table public.moderation_appeals enable row level security;
revoke all on public.content_reports,public.moderation_appeals from public,anon,authenticated;
grant select(id,reporter_id,target_type,target_id,category,description,status,moderator_id,resolution_note,moderated_at,created_at,updated_at) on public.content_reports to authenticated;
grant insert(reporter_id,target_type,target_id,category,description) on public.content_reports to authenticated;
grant update(status,moderator_id,resolution_note,moderated_at,updated_at) on public.content_reports to authenticated;
grant select(id,user_id,reason,status,moderator_id,resolution_note,moderated_at,created_at,updated_at) on public.moderation_appeals to authenticated;
grant insert(user_id,reason) on public.moderation_appeals to authenticated;
grant update(status,moderator_id,resolution_note,moderated_at,updated_at) on public.moderation_appeals to authenticated;
grant all on public.content_reports,public.moderation_appeals to service_role;

drop policy if exists "Reporters and admins can read reports" on public.content_reports;
create policy "Reporters and admins can read reports" on public.content_reports for select to authenticated
 using (reporter_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');
drop policy if exists "Users can submit own content reports" on public.content_reports;
create policy "Users can submit own content reports" on public.content_reports for insert to authenticated
 with check (
  reporter_id=(select auth.uid()) and
  ((target_type='title' and exists(select 1 from public.titles t where t.id=target_id and t.status='published')) or
   (target_type='profile' and target_id<>(select auth.uid()) and exists(select 1 from public.profiles p where p.id=target_id and p.is_public and not p.is_suspended)))
 );
drop policy if exists "Catalog admins can review reports" on public.content_reports;
create policy "Catalog admins can review reports" on public.content_reports for update to authenticated
 using (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin')
 with check (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');

drop policy if exists "Users and admins can read appeals" on public.moderation_appeals;
create policy "Users and admins can read appeals" on public.moderation_appeals for select to authenticated
 using (user_id=(select auth.uid()) or ((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');
drop policy if exists "Suspended users can submit own appeal" on public.moderation_appeals;
create policy "Suspended users can submit own appeal" on public.moderation_appeals for insert to authenticated
 with check (user_id=(select auth.uid()) and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.is_suspended));
drop policy if exists "Catalog admins can review appeals" on public.moderation_appeals;
create policy "Catalog admins can review appeals" on public.moderation_appeals for update to authenticated
 using (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin')
 with check (((select auth.jwt())->'app_metadata'->>'role')='catalog_admin');

commit;
